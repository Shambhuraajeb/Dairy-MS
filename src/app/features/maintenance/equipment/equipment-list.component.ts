import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppDatePipe } from '../../../shared/pipes/app-pipes';
import { PagedList, qp } from '../../../shared/utils/paged-list';
import { RecordModalComponent } from '../history/record-modal.component';
import { EQUIPMENT_STATUSES, Equipment } from '../maintenance.model';
import { MaintenanceService } from '../maintenance.service';
import { daysUntil } from '../maintenance.util';
import { EquipmentFormModalComponent } from './equipment-form-modal.component';

@Component({
  selector: 'app-equipment-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    AppDatePipe,
    EquipmentFormModalComponent,
    RecordModalComponent,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Equipment" subtitle="Machines and assets that need servicing">
      <button *appHasPermission="'maintenance.create'" type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="bi bi-plus-lg me-1"></i>Add Equipment
      </button>
    </app-page-header>

    <app-data-table
      [columns]="columns"
      [items]="list.items()"
      [total]="list.total()"
      [loading]="list.loading()"
      [error]="list.error()"
      [page]="list.query.page ?? 1"
      [pageSize]="list.query.pageSize ?? 20"
      searchPlaceholder="Search code, name, serial or location..."
      emptyTitle="No equipment found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
        <input type="text" class="form-control form-control-sm w-auto" formControlName="category" placeholder="Category" aria-label="Category" />
        <select class="form-select form-select-sm w-auto" formControlName="isActive" aria-label="Active">
          <option value="">Active and inactive</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <ng-template appColumn="name" let-row>
        <div class="fw-semibold">{{ row.name }}</div>
        <div class="small text-muted">{{ row.equipmentCode }}{{ row.category ? ' - ' + row.category : '' }}</div>
      </ng-template>
      <ng-template appColumn="status" let-row>
        <app-status-badge [status]="row.status" [color]="statusColor(row.status)" />
        @if (!row.isActive) {
          <span class="badge badge-soft badge-soft-secondary ms-1">Inactive</span>
        }
      </ng-template>
      <ng-template appColumn="nextDueDate" let-row>
        @if (row.nextDueDate) {
          @let d = daysUntil(row.nextDueDate);
          <span [class.text-danger]="d !== null && d < 0">{{ row.nextDueDate | appDate }}</span>
          @if (d !== null && d < 0) {
            <span class="badge badge-soft badge-soft-danger ms-1">Overdue {{ -d }}d</span>
          } @else if (d !== null && d <= 7) {
            <span class="badge badge-soft badge-soft-warning ms-1">Due in {{ d }}d</span>
          }
        } @else {
          <span class="text-muted">—</span>
        }
      </ng-template>
      <ng-template appColumn="warrantyExpiry" let-row>
        @if (row.warrantyExpiry) {
          @let w = daysUntil(row.warrantyExpiry);
          <span [class.text-danger]="w !== null && w < 0">{{ row.warrantyExpiry | appDate }}</span>
        } @else {
          <span class="text-muted">—</span>
        }
      </ng-template>
      <ng-template appRowActions let-row>
        @if (row.status !== 'Retired' && row.isActive) {
          <button *appHasPermission="'maintenance.create'" type="button" class="btn btn-sm btn-outline-primary me-1" (click)="openRecord(row)">
            <i class="bi bi-wrench-adjustable"></i> Record
          </button>
        }
        <button *appHasPermission="'maintenance.update'" type="button" class="btn btn-sm btn-outline-secondary" (click)="openEdit(row)">
          <i class="bi bi-pencil"></i> Edit
        </button>
      </ng-template>
    </app-data-table>

    <app-equipment-form-modal [open]="formOpen()" [equipment]="editing()" (closed)="formOpen.set(false)" (saved)="onSaved()" />
    <app-record-modal [open]="recordOpen()" [equipmentId]="recordEquipmentId()" (closed)="recordOpen.set(false)" (saved)="list.load()" />
  `,
})
export class EquipmentListComponent {
  private readonly svc = inject(MaintenanceService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly statuses = EQUIPMENT_STATUSES;
  readonly daysUntil = daysUntil;

  readonly columns: TableColumn[] = [
    { key: 'name', label: 'Equipment', sortable: true },
    { key: 'location', label: 'Location' },
    { key: 'status', label: 'Status', type: 'template', sortable: true },
    { key: 'lastMaintenanceDate', label: 'Last service', type: 'date' },
    { key: 'nextDueDate', label: 'Next due', type: 'template', sortable: true },
    { key: 'warrantyExpiry', label: 'Warranty', type: 'template', sortable: true },
  ];

  readonly filters = this.fb.group({ status: [''], category: [''], isActive: [''] });
  readonly list = new PagedList<Equipment>(
    (q) => this.svc.equipment(q),
    () => {
      const f = this.filters.getRawValue();
      return { status: f.status || undefined, category: f.category.trim() || undefined, isActive: f.isActive || undefined };
    },
  );

  readonly formOpen = signal(false);
  readonly editing = signal<Equipment | null>(null);
  readonly recordOpen = signal(false);
  readonly recordEquipmentId = signal<number | null>(null);

  constructor() {
    const p = this.route.snapshot.queryParamMap;
    this.filters.patchValue({ status: qp(p, 'status'), category: qp(p, 'category'), isActive: qp(p, 'isActive') });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
    this.list.load();
  }

  statusColor(status: string): 'success' | 'warning' | 'secondary' {
    return status === 'Operational' ? 'success' : status === 'UnderMaintenance' ? 'warning' : 'secondary';
  }

  openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  openEdit(row: Equipment): void {
    this.editing.set(row);
    this.formOpen.set(true);
  }

  openRecord(row: Equipment): void {
    this.recordEquipmentId.set(row.id);
    this.recordOpen.set(true);
  }

  onSaved(): void {
    this.formOpen.set(false);
    this.list.load();
  }
}
