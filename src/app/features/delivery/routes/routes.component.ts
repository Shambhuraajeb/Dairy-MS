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
import { SearchSelectComponent } from '../../collection/components/search-select.component';
import { DeliveryRoute, RouteRequest } from '../delivery.model';
import { DeliveryService } from '../delivery.service';

@Component({
  selector: 'app-delivery-routes',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    ModalComponent,
    FormFieldComponent,
    HasPermissionDirective,
    SearchSelectComponent,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Delivery Routes" subtitle="Routes with default vehicle and driver">
      <button *appHasPermission="'route.manage'" type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="bi bi-plus-lg me-1"></i>Add Route
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
      searchPlaceholder="Search code or name..."
      emptyTitle="No routes found"
      (queryChange)="onQuery($event)"
      (retry)="load()"
    >
      <div tableFilters [formGroup]="filters">
        <select class="form-select form-select-sm w-auto" formControlName="isActive" aria-label="Status">
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <ng-template appColumn="path" let-row>
        {{ row.startLocation || '—' }}
        @if (row.endLocation) {
          <i class="bi bi-arrow-right mx-1"></i>{{ row.endLocation }}
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

    <app-modal [open]="modalOpen()" [title]="editing() ? 'Edit Route' : 'Add Route'" size="lg" (closed)="closeModal()">
      <form id="routeForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row">
          <div class="col-md-4">
            <app-form-field label="Code" inputId="rtCode" [control]="form.controls.code" [hint]="editing() ? '' : 'Leave blank to auto-generate'">
              <input id="rtCode" type="text" class="form-control" formControlName="code" maxlength="20" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-8">
            <app-form-field label="Name" inputId="rtName" [control]="form.controls.name">
              <input id="rtName" type="text" class="form-control" formControlName="name" maxlength="100" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Start location" inputId="rtStart" [control]="form.controls.startLocation">
              <input id="rtStart" type="text" class="form-control" formControlName="startLocation" maxlength="150" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="End location" inputId="rtEnd" [control]="form.controls.endLocation">
              <input id="rtEnd" type="text" class="form-control" formControlName="endLocation" maxlength="150" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Distance (km)" inputId="rtDist" [control]="form.controls.distanceKm">
              <input id="rtDist" type="number" class="form-control" formControlName="distanceKm" min="0" step="0.1" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Estimated minutes" inputId="rtMin" [control]="form.controls.estimatedMinutes">
              <input id="rtMin" type="number" class="form-control" formControlName="estimatedMinutes" min="0" step="1" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Branch" inputId="rtBranch" [control]="form.controls.branchId">
              <select id="rtBranch" class="form-select" formControlName="branchId">
                <option [ngValue]="null">None</option>
                @for (b of branches(); track b.id) {
                  <option [ngValue]="b.id">{{ b.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Default vehicle" inputId="rtVehicle" [control]="form.controls.defaultVehicleId">
              <select id="rtVehicle" class="form-select" formControlName="defaultVehicleId">
                <option [ngValue]="null">None</option>
                @for (v of vehicles(); track v.id) {
                  <option [ngValue]="v.id">{{ v.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Default driver" inputId="rtDriver" [control]="form.controls.defaultDriverEmployeeId">
              <app-search-select
                inputId="rtDriver"
                placeholder="Search employee..."
                [options]="employees()"
                [value]="form.controls.defaultDriverEmployeeId.value"
                (valueChange)="form.controls.defaultDriverEmployeeId.setValue($event)"
              />
            </app-form-field>
          </div>
          <div class="col-12">
            <app-form-field label="Description" inputId="rtDesc" [control]="form.controls.description">
              <textarea id="rtDesc" class="form-control" rows="2" maxlength="255" formControlName="description"></textarea>
            </app-form-field>
          </div>
          @if (editing()) {
            <div class="col-12">
              <div class="form-check form-switch">
                <input id="rtActive" type="checkbox" class="form-check-input" formControlName="isActive" />
                <label class="form-check-label" for="rtActive">Active</label>
              </div>
            </div>
          }
        </div>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeModal()">Cancel</button>
        <button type="submit" form="routeForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class RoutesComponent {
  private readonly svc = inject(DeliveryService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly branches = toSignal(this.lookups.branches(), { initialValue: [] as LookupItem[] });
  readonly vehicles = toSignal(this.lookups.vehicles(), { initialValue: [] as LookupItem[] });
  readonly employees = toSignal(this.lookups.employees(), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'code', label: 'Code', sortable: true, width: '100px' },
    { key: 'name', label: 'Route', sortable: true },
    { key: 'path', label: 'From / To', type: 'template' },
    { key: 'distanceKm', label: 'Km', type: 'number', sortable: true, width: '80px' },
    { key: 'estimatedMinutes', label: 'Minutes', type: 'number', sortable: true, width: '90px' },
    { key: 'defaultVehicleNo', label: 'Vehicle' },
    { key: 'defaultDriverName', label: 'Driver' },
    { key: 'addressCount', label: 'Addresses', type: 'number', width: '100px' },
    { key: 'isActive', label: 'Status', type: 'badge', sortable: true, width: '100px' },
  ];

  readonly filters = this.fb.group({ isActive: [''] });
  readonly items = signal<DeliveryRoute[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  query: PagedQuery = { page: 1, pageSize: 20 };

  readonly modalOpen = signal(false);
  readonly editing = signal<DeliveryRoute | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    code: ['', [Validators.maxLength(20)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    branchId: this.fb.control<number | null>(null),
    description: ['', Validators.maxLength(255)],
    startLocation: ['', Validators.maxLength(150)],
    endLocation: ['', Validators.maxLength(150)],
    distanceKm: [0, [Validators.required, Validators.min(0)]],
    estimatedMinutes: [0, [Validators.required, Validators.min(0)]],
    defaultVehicleId: this.fb.control<number | null>(null),
    defaultDriverEmployeeId: this.fb.control<number | null>(null),
    isActive: [true],
  });

  constructor() {
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.query = { ...this.query, page: 1 };
      this.load();
    });
    this.load();
  }

  onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.routes({ ...this.query, ...this.filters.getRawValue() }).subscribe({
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
    this.form.controls.code.setValidators([Validators.maxLength(20)]);
    this.form.reset();
    this.modalOpen.set(true);
  }

  openEdit(r: DeliveryRoute): void {
    this.editing.set(r);
    this.form.controls.code.setValidators([Validators.required, Validators.maxLength(20)]);
    this.form.reset({
      code: r.code,
      name: r.name,
      branchId: r.branchId,
      description: r.description ?? '',
      startLocation: r.startLocation ?? '',
      endLocation: r.endLocation ?? '',
      distanceKm: r.distanceKm,
      estimatedMinutes: r.estimatedMinutes,
      defaultVehicleId: r.defaultVehicleId,
      defaultDriverEmployeeId: r.defaultDriverEmployeeId,
      isActive: r.isActive,
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
    const body: RouteRequest = {
      code: v.code.trim() || null,
      name: v.name.trim(),
      branchId: v.branchId,
      description: v.description.trim() || null,
      startLocation: v.startLocation.trim() || null,
      endLocation: v.endLocation.trim() || null,
      distanceKm: Number(v.distanceKm),
      estimatedMinutes: Number(v.estimatedMinutes),
      defaultVehicleId: v.defaultVehicleId,
      defaultDriverEmployeeId: v.defaultDriverEmployeeId,
      isActive: current ? v.isActive : null,
    };
    this.saving.set(true);
    const request$: Observable<unknown> = current ? this.svc.updateRoute(current.id, body) : this.svc.createRoute(body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.lookups.clear('routes');
        this.toast.success(current ? 'Route updated.' : 'Route created.');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  async deactivate(r: DeliveryRoute): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Deactivate route',
      message: `Deactivate route "${r.name}"?`,
      confirmText: 'Deactivate',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc.removeRoute(r.id).subscribe(() => {
      this.lookups.clear('routes');
      this.toast.success('Route deactivated.');
      this.load();
    });
  }
}
