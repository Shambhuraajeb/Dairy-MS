import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PagedList, qp } from '../../../shared/utils/paged-list';
import { Equipment, MAINTENANCE_TYPES, MaintenanceRecord } from '../maintenance.model';
import { MaintenanceService } from '../maintenance.service';
import { RecordModalComponent } from './record-modal.component';

@Component({
  selector: 'app-record-list',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, StatusBadgeComponent, HasPermissionDirective, RecordModalComponent, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Maintenance History" subtitle="Completed maintenance and repairs">
      <button *appHasPermission="'maintenance.create'" type="button" class="btn btn-primary" (click)="modalOpen.set(true)">
        <i class="bi bi-wrench-adjustable me-1"></i>Record Maintenance
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
      searchPlaceholder="Search equipment, task, vendor or description..."
      emptyTitle="No maintenance records"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
        <select class="form-select form-select-sm w-auto" formControlName="equipmentId" aria-label="Equipment">
          <option value="">All equipment</option>
          @for (e of equipment(); track e.id) {
            <option [value]="e.id">{{ e.name }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="type" aria-label="Type">
          <option value="">All types</option>
          @for (t of types; track t) {
            <option [value]="t">{{ t }}</option>
          }
        </select>
        <input type="date" class="form-control form-control-sm w-auto" formControlName="from" aria-label="From date" />
        <input type="date" class="form-control form-control-sm w-auto" formControlName="to" aria-label="To date" />
      </div>

      <ng-template appColumn="equipmentName" let-row>
        <div class="fw-semibold">{{ row.equipmentName }}</div>
        <div class="small text-muted">{{ row.equipmentCode }}</div>
      </ng-template>
      <ng-template appColumn="description" let-row>
        @if (row.taskName) {
          <div class="fw-semibold small">{{ row.taskName }}</div>
        }
        <div class="text-truncate" style="max-width: 280px" [attr.title]="row.description">{{ row.description }}</div>
      </ng-template>
      <ng-template appColumn="maintenanceType" let-row>
        <span
          class="badge badge-soft"
          [class.badge-soft-success]="row.maintenanceType === 'Preventive'"
          [class.badge-soft-warning]="row.maintenanceType === 'Corrective'"
          [class.badge-soft-danger]="row.maintenanceType === 'Breakdown'"
        >
          {{ row.maintenanceType }}
        </span>
      </ng-template>
      <ng-template appColumn="status" let-row><app-status-badge [status]="row.status" /></ng-template>
    </app-data-table>

    <app-record-modal [open]="modalOpen()" (closed)="modalOpen.set(false)" (saved)="list.load()" />
  `,
})
export class RecordListComponent {
  private readonly svc = inject(MaintenanceService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly types = MAINTENANCE_TYPES;
  readonly equipment = toSignal(this.svc.equipmentOptions(), { initialValue: [] as Equipment[] });
  readonly modalOpen = signal(false);

  readonly columns: TableColumn[] = [
    { key: 'maintenanceDate', label: 'Date', type: 'date', sortable: true },
    { key: 'equipmentName', label: 'Equipment', sortable: true },
    { key: 'maintenanceType', label: 'Type', type: 'template', sortable: true },
    { key: 'description', label: 'Work done', type: 'template' },
    { key: 'vendorName', label: 'Vendor' },
    { key: 'cost', label: 'Cost', type: 'currency', sortable: true },
    { key: 'nextDueDate', label: 'Next due', type: 'date', sortable: true },
    { key: 'status', label: 'Status', type: 'template' },
  ];

  readonly filters = this.fb.group({ equipmentId: [''], type: [''], from: [''], to: [''] });
  readonly list = new PagedList<MaintenanceRecord>(
    (q) => this.svc.records(q),
    () => {
      const f = this.filters.getRawValue();
      return { equipmentId: f.equipmentId || undefined, type: f.type || undefined, from: f.from || undefined, to: f.to || undefined };
    },
  );

  constructor() {
    const p = this.route.snapshot.queryParamMap;
    this.filters.patchValue({ equipmentId: qp(p, 'equipmentId'), type: qp(p, 'type'), from: qp(p, 'from'), to: qp(p, 'to') });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
    this.list.load();
  }
}
