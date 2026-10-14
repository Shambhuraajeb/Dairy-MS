import { Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { toIsoDate } from '../../../shared/utils/format';
import { dateRangeValidator } from '../../../shared/validators/app-validators';
import { isoDay, optNumber, optText } from '../collection.util';
import { MILK_TYPES } from '../models/collection.model';
import { RateChart, RateChartDetail, RateChartRequest } from '../models/rate-chart.model';
import { RateChartService } from '../services/rate-chart.service';

type DetailGroup = FormGroup<{
  fatFrom: FormControl<number | null>;
  fatTo: FormControl<number | null>;
  snfFrom: FormControl<number | null>;
  snfTo: FormControl<number | null>;
  rate: FormControl<number | null>;
  bonusPerLiter: FormControl<number | null>;
  penaltyPerLiter: FormControl<number | null>;
}>;

/** Create / edit a Draft rate chart (header, formula parameters, slab grid) and activate it. Non-draft charts are read-only. */
@Component({
  selector: 'app-rate-chart-editor',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, FormFieldComponent, LoadingComponent, StatusBadgeComponent],
  templateUrl: './rate-chart-editor.component.html',
})
export class RateChartEditorComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(RateChartService);
  private readonly lookup = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly perm = inject(PermissionService);
  private readonly router = inject(Router);

  /** route param; absent on /collection/rate-charts/new */
  readonly id = input<string>();

  protected readonly milkTypes = MILK_TYPES;
  protected readonly centers = toSignal(this.lookup.collectionCenters(), { initialValue: [] as LookupItem[] });

  protected readonly details = new FormArray<DetailGroup>([]);
  protected readonly form = this.fb.group(
    {
      name: ['', [Validators.required, Validators.maxLength(150)]],
      milkType: ['Cow', Validators.required],
      collectionCenterId: this.fb.control<number | null>(null),
      effectiveFrom: [toIsoDate(), Validators.required],
      effectiveTo: [''],
      calculationMethod: ['Slab', Validators.required],
      baseRatePerLiter: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
      baseFat: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
      baseSnf: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
      fatRatePerPoint: this.fb.control<number | null>(0, [Validators.required]),
      snfRatePerPoint: this.fb.control<number | null>(0, [Validators.required]),
      minRatePerLiter: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
      maxRatePerLiter: this.fb.control<number | null>(null, [Validators.min(0)]),
      bonusMinFat: this.fb.control<number | null>(null, [Validators.min(0)]),
      bonusMinSnf: this.fb.control<number | null>(null, [Validators.min(0)]),
      qualityBonusPerLiter: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
      penaltyBelowFat: this.fb.control<number | null>(null, [Validators.min(0)]),
      penaltyBelowSnf: this.fb.control<number | null>(null, [Validators.min(0)]),
      qualityPenaltyPerLiter: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
      description: ['', Validators.maxLength(500)],
      details: this.details,
    },
    { validators: [dateRangeValidator('effectiveFrom', 'effectiveTo')] },
  );

  protected readonly method = toSignal(this.form.controls.calculationMethod.valueChanges, {
    initialValue: this.form.controls.calculationMethod.value,
  });

  protected readonly chart = signal<RateChart | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly activating = signal(false);

  protected readonly isNew = computed(() => !this.id());
  protected readonly editable = computed(
    () => this.perm.has('ratechart.manage') && (this.isNew() || this.chart()?.status === 'Draft'),
  );

  constructor() {
    // read-only unless it is an editable draft; slab rows are ignored by validation in Formula mode
    effect(() => {
      const editable = this.editable();
      const slab = this.method() === 'Slab';
      if (editable) {
        this.form.enable({ emitEvent: false });
        if (!slab) {
          this.details.disable({ emitEvent: false });
        }
      } else {
        this.form.disable({ emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    const id = this.id();
    if (id) {
      this.load(Number(id));
    } else {
      this.addRow();
    }
  }

  protected reload(): void {
    const id = this.id();
    if (id) {
      this.load(Number(id));
    }
  }

  private load(id: number): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.get(id).subscribe({
      next: (c) => {
        this.setChart(c);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  private setChart(c: RateChart): void {
    this.chart.set(c);
    this.form.patchValue({
      name: c.name,
      milkType: c.milkType,
      collectionCenterId: c.collectionCenterId,
      effectiveFrom: isoDay(c.effectiveFrom),
      effectiveTo: c.effectiveTo ? isoDay(c.effectiveTo) : '',
      calculationMethod: c.calculationMethod,
      baseRatePerLiter: c.baseRatePerLiter,
      baseFat: c.baseFat,
      baseSnf: c.baseSnf,
      fatRatePerPoint: c.fatRatePerPoint,
      snfRatePerPoint: c.snfRatePerPoint,
      minRatePerLiter: c.minRatePerLiter,
      maxRatePerLiter: c.maxRatePerLiter,
      bonusMinFat: c.bonusMinFat,
      bonusMinSnf: c.bonusMinSnf,
      qualityBonusPerLiter: c.qualityBonusPerLiter,
      penaltyBelowFat: c.penaltyBelowFat,
      penaltyBelowSnf: c.penaltyBelowSnf,
      qualityPenaltyPerLiter: c.qualityPenaltyPerLiter,
      description: c.description ?? '',
    });
    this.details.clear();
    for (const d of c.details) {
      this.details.push(this.newDetail(d));
    }
    this.form.markAsPristine();
  }

  private newDetail(d?: Partial<RateChartDetail>): DetailGroup {
    return this.fb.group({
      fatFrom: this.fb.control<number | null>(d?.fatFrom ?? null, [Validators.required, Validators.min(0)]),
      fatTo: this.fb.control<number | null>(d?.fatTo ?? null, [Validators.required, Validators.min(0)]),
      snfFrom: this.fb.control<number | null>(d?.snfFrom ?? null, [Validators.required, Validators.min(0)]),
      snfTo: this.fb.control<number | null>(d?.snfTo ?? null, [Validators.required, Validators.min(0)]),
      rate: this.fb.control<number | null>(d?.rate ?? null, [Validators.required, Validators.min(0)]),
      bonusPerLiter: this.fb.control<number | null>(d?.bonusPerLiter ?? 0, [Validators.required, Validators.min(0)]),
      penaltyPerLiter: this.fb.control<number | null>(d?.penaltyPerLiter ?? 0, [Validators.required, Validators.min(0)]),
    });
  }

  protected addRow(): void {
    this.details.push(this.newDetail());
    this.form.markAsDirty();
  }

  protected removeRow(index: number): void {
    this.details.removeAt(index);
    this.form.markAsDirty();
  }

  /** client-side mirror of the server slab rules: from < to and no overlapping FAT/SNF rectangles */
  private slabError(): string | null {
    if (this.method() !== 'Slab') {
      return null;
    }
    const rows = this.details.getRawValue().map((r) => ({
      fatFrom: Number(r.fatFrom),
      fatTo: Number(r.fatTo),
      snfFrom: Number(r.snfFrom),
      snfTo: Number(r.snfTo),
    }));
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].fatFrom >= rows[i].fatTo || rows[i].snfFrom >= rows[i].snfTo) {
        return `Slab ${i + 1}: "from" must be lower than "to" for both FAT and SNF.`;
      }
    }
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i];
        const b = rows[j];
        if (a.fatFrom < b.fatTo && b.fatFrom < a.fatTo && a.snfFrom < b.snfTo && b.snfFrom < a.snfTo) {
          return `Slabs ${i + 1} and ${j + 1} overlap.`;
        }
      }
    }
    return null;
  }

  private buildRequest(): RateChartRequest {
    const v = this.form.getRawValue();
    const n = (x: number | null): number => (x === null || isNaN(Number(x)) ? 0 : Number(x));
    const slab = v.calculationMethod === 'Slab';
    return {
      name: v.name.trim(),
      milkType: v.milkType,
      collectionCenterId: v.collectionCenterId,
      effectiveFrom: v.effectiveFrom,
      effectiveTo: v.effectiveTo || null,
      calculationMethod: v.calculationMethod,
      baseRatePerLiter: n(v.baseRatePerLiter),
      baseFat: n(v.baseFat),
      baseSnf: n(v.baseSnf),
      fatRatePerPoint: n(v.fatRatePerPoint),
      snfRatePerPoint: n(v.snfRatePerPoint),
      minRatePerLiter: n(v.minRatePerLiter),
      maxRatePerLiter: optNumber(v.maxRatePerLiter) ?? null,
      bonusMinFat: optNumber(v.bonusMinFat) ?? null,
      bonusMinSnf: optNumber(v.bonusMinSnf) ?? null,
      qualityBonusPerLiter: n(v.qualityBonusPerLiter),
      penaltyBelowFat: optNumber(v.penaltyBelowFat) ?? null,
      penaltyBelowSnf: optNumber(v.penaltyBelowSnf) ?? null,
      qualityPenaltyPerLiter: n(v.qualityPenaltyPerLiter),
      description: optText(v.description) ?? null,
      details: slab
        ? v.details.map((r) => ({
            fatFrom: n(r.fatFrom),
            fatTo: n(r.fatTo),
            snfFrom: n(r.snfFrom),
            snfTo: n(r.snfTo),
            rate: n(r.rate),
            bonusPerLiter: n(r.bonusPerLiter),
            penaltyPerLiter: n(r.penaltyPerLiter),
          }))
        : [],
    };
  }

  protected save(): void {
    if (!this.editable()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please fix the highlighted fields.');
      return;
    }
    const slabError = this.slabError();
    if (slabError) {
      this.toast.error(slabError);
      return;
    }
    const body = this.buildRequest();
    const current = this.chart();
    this.saving.set(true);
    const request$ = current ? this.svc.update(current.id, body) : this.svc.create(body);
    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.toast.success(current ? 'Rate chart saved.' : 'Draft rate chart created.');
        if (current) {
          this.setChart(saved);
        } else {
          this.form.markAsPristine();
          this.router.navigate(['/collection/rate-charts', saved.id]);
        }
      },
      error: () => this.saving.set(false),
    });
  }

  protected async activate(): Promise<void> {
    const c = this.chart();
    if (!c) {
      return;
    }
    if (this.form.dirty) {
      this.toast.warning('Save your changes before activating.');
      return;
    }
    const ok = await this.confirmService.confirm({
      title: 'Activate rate chart',
      message: `Activate "${c.name}"? Overlapping active charts for the same milk type and center are superseded.`,
      confirmText: 'Activate',
    });
    if (!ok) {
      return;
    }
    this.activating.set(true);
    this.svc.activate(c.id).subscribe({
      next: (res) => {
        this.activating.set(false);
        const n = res.supersededChartIds.length;
        this.toast.success(n > 0 ? `Rate chart activated; ${n} older chart(s) superseded.` : 'Rate chart activated.');
        this.setChart(res.chart);
      },
      error: () => this.activating.set(false),
    });
  }
}
