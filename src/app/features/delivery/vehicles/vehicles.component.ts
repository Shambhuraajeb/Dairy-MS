import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppDatePipe } from '../../../shared/pipes/app-pipes';
import { toIsoDate } from '../../../shared/utils/format';
import { SearchSelectComponent } from '../../collection/components/search-select.component';
import { VEHICLE_STATUSES, VEHICLE_TYPES, Vehicle, VehicleRequest } from '../delivery.model';
import { DeliveryService } from '../delivery.service';

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    ModalComponent,
    FormFieldComponent,
    HasPermissionDirective,
    SearchSelectComponent,
    AppDatePipe,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Vehicles" subtitle="Delivery fleet, drivers and compliance dates">
      <button *appHasPermission="'route.manage'" type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="bi bi-plus-lg me-1"></i>Add Vehicle
      </button>
    </app-page-header>

    <app-data-table
      [columns]="columns"
      [items]="items()"
      [total]="total()"
      [loading]="loading()"
      [error]="error()"
      [page]="query.page ?? 1"
      [pageSize]="query.pageSize ?? 20"
      searchPlaceholder="Search registration, make or model..."
      emptyTitle="No vehicles found"
      (queryChange)="onQuery($event)"
      (retry)="load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2">
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="vehicleType" aria-label="Type">
          <option value="">All types</option>
          @for (t of types; track t) {
            <option [value]="t">{{ t }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="isActive" aria-label="Active">
          <option value="">Active / inactive</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <ng-template appColumn="vehicle" let-row>
        <div class="fw-semibold">{{ row.registrationNo }}</div>
        <div class="small text-muted">{{ row.vehicleType }}{{ row.make ? ' - ' + row.make : '' }}{{ row.model ? ' ' + row.model : '' }}</div>
      </ng-template>
      <ng-template appColumn="capacity" let-row>{{ row.capacity }} {{ row.capacityUnit }}</ng-template>
      <ng-template appColumn="insuranceExpiry" let-row>
        @if (row.insuranceExpiry) {
          <span [class.text-danger]="isExpired(row.insuranceExpiry)">{{ row.insuranceExpiry.slice(0, 10) | appDate }}</span>
        } @else {
          —
        }
      </ng-template>
      <ng-template appColumn="fitnessExpiry" let-row>
        @if (row.fitnessExpiry) {
          <span [class.text-danger]="isExpired(row.fitnessExpiry)">{{ row.fitnessExpiry.slice(0, 10) | appDate }}</span>
        } @else {
          —
        }
      </ng-template>
      <ng-template appRowActions let-row>
        <button *appHasPermission="'route.manage'" type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="openEdit(row)">
          <i class="bi bi-pencil"></i> Edit
        </button>
        @if (row.isActive) {
          <button *appHasPermission="'route.manage'" type="button" class="btn btn-sm btn-outline-danger" (click)="deactivate(row)">Deactivate</button>
        }
      </ng-template>
    </app-data-table>

    <app-modal [open]="modalOpen()" [title]="editing() ? 'Edit Vehicle' : 'Add Vehicle'" size="lg" (closed)="closeModal()">
      <form id="vehicleForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row">
          <div class="col-md-4">
            <app-form-field label="Registration no." inputId="vhReg" [control]="form.controls.registrationNo">
              <input id="vhReg" type="text" class="form-control" formControlName="registrationNo" maxlength="30" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Type" inputId="vhType" [control]="form.controls.vehicleType">
              <select id="vhType" class="form-select" formControlName="vehicleType">
                @for (t of types; track t) {
                  <option [value]="t">{{ t }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Status" inputId="vhStatus" [control]="form.controls.status">
              <select id="vhStatus" class="form-select" formControlName="status">
                @for (s of statuses; track s) {
                  <option [value]="s">{{ s }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Make" inputId="vhMake" [control]="form.controls.make">
              <input id="vhMake" type="text" class="form-control" formControlName="make" maxlength="50" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Model" inputId="vhModel" [control]="form.controls.model">
              <input id="vhModel" type="text" class="form-control" formControlName="model" maxlength="50" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Fuel type" inputId="vhFuel" [control]="form.controls.fuelType">
              <select id="vhFuel" class="form-select" formControlName="fuelType">
                <option value="">Not set</option>
                @for (f of fuels; track f) {
                  <option [value]="f">{{ f }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Capacity" inputId="vhCap" [control]="form.controls.capacity">
              <input id="vhCap" type="number" class="form-control" formControlName="capacity" min="0" step="0.1" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Capacity unit" inputId="vhCapUnit" [control]="form.controls.capacityUnit">
              <input id="vhCapUnit" type="text" class="form-control" formControlName="capacityUnit" maxlength="20" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Branch" inputId="vhBranch" [control]="form.controls.branchId">
              <select id="vhBranch" class="form-select" formControlName="branchId">
                <option [ngValue]="null">None</option>
                @for (b of branches(); track b.id) {
                  <option [ngValue]="b.id">{{ b.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Insurance expiry" inputId="vhIns" [control]="form.controls.insuranceExpiry">
              <input id="vhIns" type="date" class="form-control" formControlName="insuranceExpiry" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Fitness expiry" inputId="vhFit" [control]="form.controls.fitnessExpiry">
              <input id="vhFit" type="date" class="form-control" formControlName="fitnessExpiry" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Driver" inputId="vhDriver" [control]="form.controls.driverEmployeeId">
              <app-search-select
                inputId="vhDriver"
                placeholder="Search employee..."
                [options]="employees()"
                [value]="form.controls.driverEmployeeId.value"
                (valueChange)="form.controls.driverEmployeeId.setValue($event)"
              />
            </app-form-field>
          </div>
          @if (editing()) {
            <div class="col-12">
              <div class="form-check form-switch">
                <input id="vhActive" type="checkbox" class="form-check-input" formControlName="isActive" />
                <label class="form-check-label" for="vhActive">Active</label>
              </div>
            </div>
          }
        </div>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeModal()">Cancel</button>
        <button type="submit" form="vehicleForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class VehiclesComponent {
  private readonly svc = inject(DeliveryService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly types = VEHICLE_TYPES;
  readonly statuses = VEHICLE_STATUSES;
  readonly fuels = ['Diesel', 'Petrol', 'CNG', 'Electric'];
  readonly today = toIsoDate();
  readonly branches = toSignal(this.lookups.branches(), { initialValue: [] as LookupItem[] });
  readonly employees = toSignal(this.lookups.employees(), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'vehicle', label: 'Vehicle', sortable: true, sortKey: 'registrationNo', type: 'template' },
    { key: 'capacity', label: 'Capacity', sortable: true, type: 'template' },
    { key: 'driverName', label: 'Driver' },
    { key: 'insuranceExpiry', label: 'Insurance expiry', sortable: true, type: 'template' },
    { key: 'fitnessExpiry', label: 'Fitness expiry', sortable: true, type: 'template' },
    { key: 'status', label: 'Status', type: 'badge', sortable: true, width: '120px' },
    { key: 'isActive', label: 'Active', type: 'badge', width: '90px' },
  ];

  readonly filters = this.fb.group({ status: [''], vehicleType: [''], isActive: [''] });
  readonly items = signal<Vehicle[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  query: PagedQuery = { page: 1, pageSize: 20 };

  readonly modalOpen = signal(false);
  readonly editing = signal<Vehicle | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    registrationNo: ['', [Validators.required, Validators.maxLength(30)]],
    vehicleType: ['Van', Validators.required],
    make: ['', Validators.maxLength(50)],
    model: ['', Validators.maxLength(50)],
    capacity: [0, [Validators.required, Validators.min(0)]],
    capacityUnit: ['Liters', [Validators.required, Validators.maxLength(20)]],
    driverEmployeeId: this.fb.control<number | null>(null),
    branchId: this.fb.control<number | null>(null),
    fuelType: [''],
    insuranceExpiry: [''],
    fitnessExpiry: [''],
    status: ['Available', Validators.required],
    isActive: [true],
  });

  constructor() {
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.query = { ...this.query, page: 1 };
      this.load();
    });
    this.load();
  }

  isExpired(value: string): boolean {
    return value.slice(0, 10) < this.today;
  }

  onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.vehicles({ ...this.query, ...this.filters.getRawValue() }).subscribe({
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

  openCreate(): void {
    this.editing.set(null);
    this.form.reset();
    this.modalOpen.set(true);
  }

  openEdit(v: Vehicle): void {
    this.editing.set(v);
    this.form.reset({
      registrationNo: v.registrationNo,
      vehicleType: v.vehicleType,
      make: v.make ?? '',
      model: v.model ?? '',
      capacity: v.capacity,
      capacityUnit: v.capacityUnit || 'Liters',
      driverEmployeeId: v.driverEmployeeId,
      branchId: v.branchId,
      fuelType: v.fuelType ?? '',
      insuranceExpiry: v.insuranceExpiry ? v.insuranceExpiry.slice(0, 10) : '',
      fitnessExpiry: v.fitnessExpiry ? v.fitnessExpiry.slice(0, 10) : '',
      status: v.status,
      isActive: v.isActive,
    });
    this.modalOpen.set(true);
  }

  closeModal(): void {
    if (!this.saving()) {
      this.modalOpen.set(false);
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const current = this.editing();
    const body: VehicleRequest = {
      registrationNo: v.registrationNo.trim(),
      vehicleType: v.vehicleType,
      make: v.make.trim() || null,
      model: v.model.trim() || null,
      capacity: Number(v.capacity),
      capacityUnit: v.capacityUnit.trim() || 'Liters',
      driverEmployeeId: v.driverEmployeeId,
      branchId: v.branchId,
      fuelType: v.fuelType || null,
      insuranceExpiry: v.insuranceExpiry || null,
      fitnessExpiry: v.fitnessExpiry || null,
      status: v.status,
      isActive: current ? v.isActive : null,
    };
    this.saving.set(true);
    const request$: Observable<unknown> = current ? this.svc.updateVehicle(current.id, body) : this.svc.createVehicle(body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.lookups.clear('vehicles');
        this.toast.success(current ? 'Vehicle updated.' : 'Vehicle created.');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  async deactivate(v: Vehicle): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Deactivate vehicle',
      message: `Deactivate vehicle ${v.registrationNo}?`,
      confirmText: 'Deactivate',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc.removeVehicle(v.id).subscribe(() => {
      this.lookups.clear('vehicles');
      this.toast.success('Vehicle deactivated.');
      this.load();
    });
  }
}
