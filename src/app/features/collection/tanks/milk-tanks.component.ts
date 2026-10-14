import { Component, OnInit, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { isoDay, optNumber, optText, toNumberOrNull } from '../collection.util';
import { TankTransactionsModalComponent } from '../components/tank-transactions-modal.component';
import { MILK_TYPES } from '../models/collection.model';
import { CreateTankRequest, TANK_STATUSES, Tank, UpdateTankRequest } from '../models/tank.model';
import { MilkTankService } from '../services/milk-tank.service';

@Component({
  selector: 'app-milk-tanks',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    ModalComponent,
    FormFieldComponent,
    HasPermissionDirective,
    AppNumberPipe,
    TankTransactionsModalComponent,
    ...DATA_TABLE_IMPORTS,
  ],
  templateUrl: './milk-tanks.component.html',
})
export class MilkTanksComponent implements OnInit {
  private readonly svc = inject(MilkTankService);
  private readonly lookup = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  // initial filters from the query string
  readonly center = input<string>();
  readonly centerId = input<string>();
  readonly status = input<string>();

  protected readonly milkTypes = MILK_TYPES;
  protected readonly statuses = TANK_STATUSES;
  protected readonly centers = toSignal(this.lookup.collectionCenters(), { initialValue: [] as LookupItem[] });
  protected readonly columns: TableColumn[] = [
    { key: 'code', label: 'Code', sortable: true },
    { key: 'name', label: 'Tank', sortable: true },
    { key: 'collectionCenterName', label: 'Center', sortable: true },
    { key: 'capacityLiters', label: 'Capacity (L)', type: 'number', sortable: true },
    { key: 'currentQuantity', label: 'Current (L)', type: 'number', sortable: true },
    { key: 'fillPercent', label: 'Fill' },
    { key: 'milkType', label: 'Milk' },
    { key: 'currentTemperature', label: 'Temp (°C)' },
    { key: 'lastCleanedDate', label: 'Last cleaned', type: 'date' },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
  ];

  protected readonly items = signal<Tank[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected query: PagedQuery = { page: 1, pageSize: 20 };

  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Tank | null>(null);
  protected readonly saving = signal(false);
  protected readonly txnTank = signal<Tank | null>(null);

  protected readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    collectionCenterId: this.fb.control<number | null>(null, Validators.required),
    capacityLiters: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.001)]),
    milkType: [''],
    minTemperature: this.fb.control<number | null>(null),
    maxTemperature: this.fb.control<number | null>(null),
    currentTemperature: this.fb.control<number | null>(null),
    status: ['Active'],
    lastCleanedDate: [''],
    isActive: [true],
  });

  ngOnInit(): void {
    this.query = {
      ...this.query,
      centerId: toNumberOrNull(this.center() ?? this.centerId()) ?? undefined,
      status: this.status() || undefined,
    };
    this.load();
  }

  protected qs(key: string): string {
    const v = this.query[key];
    return v === undefined || v === null ? '' : String(v);
  }

  protected onFilter(key: 'centerId' | 'status', event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const next: PagedQuery = { ...this.query, page: 1 };
    next[key] = key === 'centerId' ? (toNumberOrNull(value) ?? undefined) : value || undefined;
    this.query = next;
    this.load();
  }

  protected onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.list(this.query).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected fillClass(percent: number): string {
    return percent >= 90 ? 'bg-danger' : percent >= 70 ? 'bg-warning' : 'bg-success';
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ code: '', name: '', collectionCenterId: null, capacityLiters: null, milkType: '', status: 'Active', lastCleanedDate: '', isActive: true });
    this.form.controls.code.enable();
    this.form.controls.capacityLiters.setValidators([Validators.required, Validators.min(0.001)]);
    this.form.controls.capacityLiters.updateValueAndValidity();
    this.modalOpen.set(true);
  }

  protected openEdit(t: Tank): void {
    this.editing.set(t);
    this.form.reset({
      code: t.code,
      name: t.name,
      collectionCenterId: t.collectionCenterId,
      capacityLiters: t.capacityLiters,
      milkType: t.milkType ?? '',
      minTemperature: t.minTemperature,
      maxTemperature: t.maxTemperature,
      currentTemperature: t.currentTemperature,
      status: t.status,
      lastCleanedDate: t.lastCleanedDate ? isoDay(t.lastCleanedDate) : '',
      isActive: t.isActive,
    });
    this.form.controls.code.disable();
    // capacity may not drop below the milk currently in the tank
    this.form.controls.capacityLiters.setValidators([Validators.required, Validators.min(Math.max(0.001, t.currentQuantity))]);
    this.form.controls.capacityLiters.updateValueAndValidity();
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    if (!this.saving()) {
      this.modalOpen.set(false);
    }
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const current = this.editing();
    const common = {
      name: v.name.trim(),
      collectionCenterId: Number(v.collectionCenterId),
      capacityLiters: Number(v.capacityLiters),
      milkType: optText(v.milkType) ?? null,
      minTemperature: optNumber(v.minTemperature) ?? null,
      maxTemperature: optNumber(v.maxTemperature) ?? null,
      currentTemperature: optNumber(v.currentTemperature) ?? null,
    };
    this.saving.set(true);
    let request$: Observable<Tank>;
    if (current) {
      const body: UpdateTankRequest = {
        ...common,
        status: v.status,
        lastCleanedDate: v.lastCleanedDate || null,
        isActive: v.isActive,
      };
      request$ = this.svc.update(current.id, body);
    } else {
      const body: CreateTankRequest = { ...common, code: v.code.trim() };
      request$ = this.svc.create(body);
    }
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.toast.success(current ? 'Tank updated.' : 'Tank created.');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
