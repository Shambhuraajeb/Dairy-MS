import { Component, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, merge, of, switchMap, tap } from 'rxjs';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AppCurrencyPipe } from '../../../shared/pipes/app-pipes';
import { positiveNumberValidator } from '../../../shared/validators/app-validators';
import { toIsoDate } from '../../../shared/utils/format';
import { SearchSelectComponent } from '../components/search-select.component';
import { currentShift, optNumber, optText, resolveShiftId, shiftLabel, shiftsForCenter, toNumberOrNull } from '../collection.util';
import {
  CollectionListItem,
  CreateCollectionRequest,
  CreateCollectionResult,
  MILK_TYPES,
  RatePreview,
  RatePreviewParams,
  ShiftDto,
} from '../models/collection.model';
import { Tank } from '../models/tank.model';
import { CollectionShiftService } from '../services/collection-shift.service';
import { MilkCollectionService } from '../services/milk-collection.service';
import { MilkTankService } from '../services/milk-tank.service';

interface PreviewState {
  rate: RatePreview | null;
  error: string | null;
}

@Component({
  selector: 'app-collection-entry',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    FormFieldComponent,
    SearchSelectComponent,
    AppCurrencyPipe,
    ...DATA_TABLE_IMPORTS,
  ],
  templateUrl: './collection-entry.component.html',
})
export class CollectionEntryComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(MilkCollectionService);
  private readonly shiftSvc = inject(CollectionShiftService);
  private readonly tankSvc = inject(MilkTankService);
  private readonly lookup = inject(LookupService);
  private readonly toast = inject(ToastService);

  // initial values from the query string
  readonly center = input<string>();
  readonly shift = input<string>();
  readonly date = input<string>();

  protected readonly today = toIsoDate();
  protected readonly milkTypes = MILK_TYPES;
  protected readonly shiftLabel = shiftLabel;

  protected readonly centers = toSignal(this.lookup.collectionCenters(), { initialValue: [] as LookupItem[] });
  protected readonly farmers = toSignal(this.lookup.get('farmers', { status: 'Active' }), { initialValue: [] as LookupItem[] });
  protected readonly shifts = signal<ShiftDto[]>([]);
  protected readonly tanks = signal<Tank[]>([]);

  protected readonly form = this.fb.group({
    collectionCenterId: this.fb.control<number | null>(null, Validators.required),
    shiftId: this.fb.control<number | null>(null, Validators.required),
    collectionDate: [toIsoDate(), Validators.required],
    farmerId: this.fb.control<number | null>(null, Validators.required),
    milkType: ['Cow', Validators.required],
    quantityLiters: this.fb.control<number | null>(null, [Validators.required, positiveNumberValidator()]),
    fat: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.1), Validators.max(25)]),
    snf: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.1), Validators.max(25)]),
    clr: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(60)]),
    temperature: this.fb.control<number | null>(null, [Validators.min(-5), Validators.max(100)]),
    milkTankId: this.fb.control<number | null>(null),
    waterAdded: [false],
    remarks: ['', Validators.maxLength(500)],
  });

  private readonly centerId = toSignal(this.form.controls.collectionCenterId.valueChanges, {
    initialValue: this.form.controls.collectionCenterId.value,
  });
  protected readonly shiftOptions = computed(() => shiftsForCenter(this.shifts(), this.centerId()));

  protected readonly saving = signal(false);
  protected readonly lastSaved = signal<CreateCollectionResult | null>(null);

  protected readonly preview = signal<PreviewState>({ rate: null, error: null });
  protected readonly previewLoading = signal(false);

  protected readonly recent = signal<CollectionListItem[]>([]);
  protected readonly recentLoading = signal(false);
  protected readonly recentError = signal<string | null>(null);
  protected readonly recentColumns: TableColumn[] = [
    { key: 'collectionNumber', label: 'No.' },
    { key: 'createdDate', label: 'Time', type: 'datetime' },
    { key: 'farmerName', label: 'Farmer' },
    { key: 'milkType', label: 'Milk' },
    { key: 'quantityLiters', label: 'Qty (L)', type: 'number' },
    { key: 'fat', label: 'FAT', type: 'number' },
    { key: 'snf', label: 'SNF', type: 'number' },
    { key: 'finalRate', label: 'Rate', type: 'currency' },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'status', label: 'Status', type: 'badge' },
  ];

  constructor() {
    // a single center: preselect it
    effect(() => {
      const list = this.centers();
      untracked(() => {
        if (list.length === 1 && this.form.controls.collectionCenterId.value === null) {
          this.form.controls.collectionCenterId.setValue(list[0].id);
        }
      });
    });

    // center change: keep a valid shift and reload tanks
    this.form.controls.collectionCenterId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.ensureShift();
      this.form.controls.milkTankId.setValue(null);
      this.loadTanks(id);
    });

    // recent entries follow center / shift / date
    merge(
      this.form.controls.collectionCenterId.valueChanges,
      this.form.controls.shiftId.valueChanges,
      this.form.controls.collectionDate.valueChanges,
    )
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe(() => this.loadRecent());

    // farmer pick: default the milk type to the farmer's own
    this.form.controls.farmerId.valueChanges
      .pipe(
        switchMap((id) => (id ? this.svc.farmerMilkType(id).pipe(catchError(() => of({} as { milkType?: string }))) : of({} as { milkType?: string }))),
        takeUntilDestroyed(),
      )
      .subscribe((f) => {
        if (f.milkType && (MILK_TYPES as string[]).includes(f.milkType)) {
          this.form.controls.milkType.setValue(f.milkType);
        }
      });

    // live rate preview (debounced, latest request wins)
    this.form.valueChanges
      .pipe(
        debounceTime(400),
        map(() => this.previewParams()),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        tap((p) => {
          this.previewLoading.set(p !== null);
          if (p === null) {
            this.preview.set({ rate: null, error: null });
          }
        }),
        switchMap((p) =>
          p === null
            ? of<PreviewState | null>(null)
            : this.svc.ratePreview(p).pipe(
                map((rate): PreviewState => ({ rate, error: null })),
                catchError((err) => of<PreviewState>({ rate: null, error: errorMessage(err) })),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => {
        this.previewLoading.set(false);
        if (state) {
          this.preview.set(state);
        }
      });
  }

  ngOnInit(): void {
    const d = this.date();
    if (d && d <= this.today) {
      this.form.controls.collectionDate.setValue(d.slice(0, 10));
    }
    const c = toNumberOrNull(this.center());
    if (c) {
      this.form.controls.collectionCenterId.setValue(c);
    }
    this.shiftSvc
      .list()
      .pipe(catchError(() => of([] as ShiftDto[])))
      .subscribe((list) => {
        this.shifts.set(list);
        this.ensureShift(resolveShiftId(list, this.shift(), this.form.controls.collectionCenterId.value));
        this.loadRecent();
      });
  }

  private ensureShift(preferred?: number | null): void {
    const options = this.shiftOptions();
    const cur = this.form.controls.shiftId.value;
    if (cur !== null && options.some((s) => s.id === cur)) {
      return;
    }
    const pick = (preferred ? options.find((s) => s.id === preferred) : undefined) ?? currentShift(options) ?? options[0] ?? null;
    this.form.controls.shiftId.setValue(pick ? pick.id : null);
  }

  private loadTanks(centerId: number | null): void {
    if (!centerId) {
      this.tanks.set([]);
      return;
    }
    this.tankSvc
      .list({ page: 1, pageSize: 100, centerId, isActive: true })
      .pipe(catchError(() => of({ items: [] as Tank[], total: 0, page: 1, pageSize: 100 })))
      .subscribe((res) => this.tanks.set(res.items.filter((t) => t.status === 'Active')));
  }

  protected loadRecent(): void {
    const v = this.form.getRawValue();
    if (!v.collectionCenterId || !v.shiftId || !v.collectionDate) {
      this.recent.set([]);
      return;
    }
    this.recentLoading.set(true);
    this.recentError.set(null);
    this.svc
      .list({
        page: 1,
        pageSize: 10,
        sortBy: 'createdDate',
        sortDir: 'desc',
        centerId: v.collectionCenterId,
        shiftId: v.shiftId,
        from: v.collectionDate,
        to: v.collectionDate,
      })
      .subscribe({
        next: (res) => {
          this.recent.set(res.items);
          this.recentLoading.set(false);
        },
        error: (err) => {
          this.recentError.set(errorMessage(err));
          this.recentLoading.set(false);
        },
      });
  }

  private previewParams(): RatePreviewParams | null {
    const v = this.form.getRawValue();
    const fat = optNumber(v.fat);
    const snf = optNumber(v.snf);
    if (!v.collectionCenterId || !fat || !snf || fat <= 0 || snf <= 0) {
      return null;
    }
    return {
      centerId: v.collectionCenterId,
      date: v.collectionDate || undefined,
      milkType: v.milkType || undefined,
      fat,
      snf,
      clr: optNumber(v.clr),
      quantity: optNumber(v.quantityLiters),
    };
  }

  protected setFarmer(id: number | null): void {
    const c = this.form.controls.farmerId;
    c.setValue(id);
    c.markAsDirty();
    c.markAsTouched();
  }

  protected tankLabel(t: Tank): string {
    return `${t.name} (${t.fillPercent}% full)`;
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: CreateCollectionRequest = {
      collectionDate: v.collectionDate,
      shiftId: v.shiftId as number,
      collectionCenterId: v.collectionCenterId as number,
      farmerId: v.farmerId as number,
      milkType: v.milkType,
      quantityLiters: Number(v.quantityLiters),
      fat: Number(v.fat),
      snf: Number(v.snf),
      clr: optNumber(v.clr),
      temperature: optNumber(v.temperature),
      milkTankId: v.milkTankId ?? undefined,
      waterAdded: v.waterAdded ? true : undefined,
      remarks: optText(v.remarks),
    };
    this.saving.set(true);
    this.svc.create(body).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.lastSaved.set(res);
        this.toast.success(`Collection ${res.number} saved (${res.status}).`);
        this.resetForNext();
        this.loadRecent();
      },
      error: () => this.saving.set(false),
    });
  }

  /** keep center / shift / date, clear the per-farmer values and jump back to the farmer field */
  protected resetForNext(): void {
    this.form.patchValue({
      farmerId: null,
      quantityLiters: null,
      fat: null,
      snf: null,
      clr: null,
      temperature: null,
      waterAdded: false,
      remarks: '',
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.preview.set({ rate: null, error: null });
    setTimeout(() => document.getElementById('entryFarmer')?.focus(), 0);
  }
}
