import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { toIsoDate } from '../../../shared/utils/format';
import { SearchSelectComponent } from '../../collection/components/search-select.component';
import { DELIVERY_SLOTS, DeliverySchedule, DeliverySlot, SCHEDULE_STATUSES, ScheduleRequest } from '../delivery.model';
import { DeliveryService } from '../delivery.service';

@Component({
  selector: 'app-schedules',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    ModalComponent,
    FormFieldComponent,
    HasPermissionDirective,
    SearchSelectComponent,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Delivery Schedules" subtitle="Plan route, vehicle and driver for each delivery run">
      <button *appHasPermission="'route.manage'" type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="bi bi-plus-lg me-1"></i>Add Schedule
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
      searchPlaceholder="Search route, vehicle or driver..."
      emptyTitle="No schedules found"
      (queryChange)="onQuery($event)"
      (retry)="load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
        <input type="date" class="form-control form-control-sm w-auto" formControlName="date" aria-label="Date" />
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="slot" aria-label="Slot">
          <option value="">All slots</option>
          @for (s of slots; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="routeId" aria-label="Route">
          <option value="">All routes</option>
          @for (r of routes(); track r.id) {
            <option [value]="r.id">{{ r.name }}</option>
          }
        </select>
        <div style="min-width: 200px">
          <app-search-select
            placeholder="All drivers"
            [options]="employees()"
            [value]="filters.controls.driverEmployeeId.value"
            (valueChange)="filters.controls.driverEmployeeId.setValue($event)"
          />
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="filters.reset()">Reset</button>
      </div>

      <ng-template appColumn="plannedStartTime" let-row>{{ row.plannedStartTime ? row.plannedStartTime.slice(0, 5) : '—' }}</ng-template>
      <ng-template appColumn="deliveries" let-row>
        @if (perm.has('delivery.view')) {
          <a [routerLink]="['/delivery']" [queryParams]="{ scheduleId: row.id }" class="text-decoration-none">
            {{ row.deliveredCount }} / {{ row.deliveryCount }}
          </a>
        } @else {
          {{ row.deliveredCount }} / {{ row.deliveryCount }}
        }
      </ng-template>
      <ng-template appRowActions let-row>
        <button *appHasPermission="'route.manage'" type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="openEdit(row)">
          <i class="bi bi-pencil"></i> Edit
        </button>
        <button *appHasPermission="'route.manage'" type="button" class="btn btn-sm btn-outline-danger" (click)="remove(row)" [disabled]="row.deliveryCount > 0">
          <i class="bi bi-trash"></i>
        </button>
      </ng-template>
    </app-data-table>

    <app-modal [open]="modalOpen()" [title]="editing() ? 'Edit Schedule' : 'Add Schedule'" size="lg" (closed)="closeModal()">
      <form id="scheduleForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row">
          <div class="col-md-6">
            @if (editing(); as e) {
              <div class="mb-3">
                <label class="form-label">Route</label>
                <input type="text" class="form-control" [value]="e.routeName" disabled />
              </div>
            } @else {
              <app-form-field label="Route" inputId="scRoute" [control]="form.controls.routeId">
                <select id="scRoute" class="form-select" formControlName="routeId">
                  <option [ngValue]="null">Select route</option>
                  @for (r of routes(); track r.id) {
                    <option [ngValue]="r.id">{{ r.name }}</option>
                  }
                </select>
              </app-form-field>
            }
          </div>
          <div class="col-md-3">
            <app-form-field label="Date" inputId="scDate" [control]="form.controls.scheduleDate" [hint]="dateLocked() ? 'Locked: schedule has deliveries or is not planned' : ''">
              <input id="scDate" type="date" class="form-control" formControlName="scheduleDate" />
            </app-form-field>
          </div>
          <div class="col-md-3">
            <app-form-field label="Slot" inputId="scSlot" [control]="form.controls.slot">
              <select id="scSlot" class="form-select" formControlName="slot">
                @for (s of slots; track s) {
                  <option [value]="s">{{ s }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Vehicle" inputId="scVehicle" [control]="form.controls.vehicleId" hint="Blank = route default vehicle">
              <select id="scVehicle" class="form-select" formControlName="vehicleId">
                <option [ngValue]="null">Route default</option>
                @for (v of vehicles(); track v.id) {
                  <option [ngValue]="v.id">{{ v.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Driver" inputId="scDriver" [control]="form.controls.driverEmployeeId" hint="Blank = route default driver">
              <app-search-select
                inputId="scDriver"
                placeholder="Search employee..."
                [options]="employees()"
                [value]="form.controls.driverEmployeeId.value"
                (valueChange)="form.controls.driverEmployeeId.setValue($event)"
              />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Planned start time" inputId="scTime" [control]="form.controls.plannedStartTime">
              <input id="scTime" type="time" class="form-control" formControlName="plannedStartTime" />
            </app-form-field>
          </div>
          <div class="col-md-8">
            <app-form-field label="Remarks" inputId="scRemarks" [control]="form.controls.remarks">
              <input id="scRemarks" type="text" class="form-control" formControlName="remarks" maxlength="255" autocomplete="off" />
            </app-form-field>
          </div>
        </div>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeModal()">Cancel</button>
        <button type="submit" form="scheduleForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class SchedulesComponent {
  private readonly svc = inject(DeliveryService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  protected readonly perm = inject(PermissionService);

  readonly slots = DELIVERY_SLOTS;
  readonly statuses = SCHEDULE_STATUSES;
  readonly routes = toSignal(this.lookups.routes(), { initialValue: [] as LookupItem[] });
  readonly vehicles = toSignal(this.lookups.vehicles(), { initialValue: [] as LookupItem[] });
  readonly employees = toSignal(this.lookups.employees(), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'scheduleDate', label: 'Date', type: 'date', sortable: true, width: '120px' },
    { key: 'slot', label: 'Slot', sortable: true, width: '90px' },
    { key: 'routeName', label: 'Route', sortable: true },
    { key: 'vehicleNo', label: 'Vehicle' },
    { key: 'driverName', label: 'Driver', sortable: true },
    { key: 'plannedStartTime', label: 'Start', type: 'template', width: '80px' },
    { key: 'deliveries', label: 'Delivered / Stops', type: 'template', align: 'end' },
    { key: 'status', label: 'Status', type: 'badge', sortable: true, width: '110px' },
  ];

  readonly filters = this.fb.group({
    date: [''],
    status: [''],
    slot: [''],
    routeId: [''],
    driverEmployeeId: this.fb.control<number | null>(null),
  });
  readonly items = signal<DeliverySchedule[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  query: PagedQuery = { page: 1, pageSize: 20 };

  readonly modalOpen = signal(false);
  readonly editing = signal<DeliverySchedule | null>(null);
  readonly saving = signal(false);
  readonly dateLocked = signal(false);

  readonly form = this.fb.group({
    routeId: this.fb.control<number | null>(null, Validators.required),
    vehicleId: this.fb.control<number | null>(null),
    driverEmployeeId: this.fb.control<number | null>(null),
    scheduleDate: [toIsoDate(), Validators.required],
    slot: ['Morning' as DeliverySlot, Validators.required],
    plannedStartTime: [''],
    remarks: ['', Validators.maxLength(255)],
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      const driver = p.get('driverEmployeeId');
      this.filters.patchValue(
        {
          date: p.get('date') ?? '',
          status: p.get('status') ?? '',
          slot: p.get('slot') ?? '',
          routeId: p.get('routeId') ?? '',
          driverEmployeeId: driver ? Number(driver) : null,
        },
        { emitEvent: false },
      );
      this.query = { ...this.query, page: 1 };
      this.load();
    });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.query = { ...this.query, page: 1 };
      this.load();
    });
  }

  onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.schedules({ ...this.query, ...this.filters.getRawValue() }).subscribe({
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
    this.dateLocked.set(false);
    this.form.controls.scheduleDate.enable();
    this.form.controls.slot.enable();
    this.form.controls.routeId.setValidators(Validators.required);
    this.form.reset();
    this.modalOpen.set(true);
  }

  openEdit(s: DeliverySchedule): void {
    this.editing.set(s);
    const locked = s.status !== 'Planned' || s.deliveryCount > 0;
    this.dateLocked.set(locked);
    this.form.controls.routeId.clearValidators();
    this.form.reset({
      routeId: s.routeId,
      vehicleId: s.vehicleId,
      driverEmployeeId: s.driverEmployeeId,
      scheduleDate: s.scheduleDate.slice(0, 10),
      slot: s.slot,
      plannedStartTime: s.plannedStartTime ? s.plannedStartTime.slice(0, 5) : '',
      remarks: s.remarks ?? '',
    });
    if (locked) {
      this.form.controls.scheduleDate.disable();
      this.form.controls.slot.disable();
    } else {
      this.form.controls.scheduleDate.enable();
      this.form.controls.slot.enable();
    }
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
    const body: ScheduleRequest = {
      routeId: current ? null : v.routeId,
      vehicleId: v.vehicleId,
      driverEmployeeId: v.driverEmployeeId,
      scheduleDate: v.scheduleDate,
      slot: v.slot,
      plannedStartTime: v.plannedStartTime || null,
      remarks: v.remarks.trim() || null,
    };
    this.saving.set(true);
    const request$: Observable<unknown> = current ? this.svc.updateSchedule(current.id, body) : this.svc.createSchedule(body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.toast.success(current ? 'Schedule updated.' : 'Schedule created.');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  async remove(s: DeliverySchedule): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Delete schedule',
      message: `Delete the ${s.slot} schedule of ${s.routeName} on ${s.scheduleDate.slice(0, 10)}?`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc.removeSchedule(s.id).subscribe(() => {
      this.toast.success('Schedule deleted.');
      this.load();
    });
  }
}
