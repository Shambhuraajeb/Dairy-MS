import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppDatePipe } from '../../../shared/pipes/app-pipes';
import { PagedList, dateOnly, qp } from '../../../shared/utils/paged-list';
import { RecordModalComponent } from '../history/record-modal.component';
import { Equipment, MaintenanceSchedule, SCHEDULE_STATUSES } from '../maintenance.model';
import { MaintenanceService } from '../maintenance.service';
import { ScheduleFormModalComponent } from './schedule-form-modal.component';

@Component({
  selector: 'app-schedule-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    AppDatePipe,
    ScheduleFormModalComponent,
    RecordModalComponent,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Maintenance Schedules" subtitle="Recurring service tasks and when they are due">
      <button *appHasPermission="'maintenance.create'" type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="bi bi-plus-lg me-1"></i>Add Schedule
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
      searchPlaceholder="Search equipment or task..."
      emptyTitle="No schedules found"
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
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
        <div class="form-check form-check-inline mb-0">
          <input id="dueOnly" type="checkbox" class="form-check-input" formControlName="dueOnly" />
          <label class="form-check-label small" for="dueOnly">Due / overdue only</label>
        </div>
      </div>

      <ng-template appColumn="equipmentName" let-row>
        <div class="fw-semibold">{{ row.equipmentName }}</div>
        <div class="small text-muted">{{ row.equipmentCode }}</div>
      </ng-template>
      <ng-template appColumn="taskName" let-row>
        <div>{{ row.taskName }}</div>
        @if (row.description) {
          <div class="small text-muted text-truncate" style="max-width: 240px" [attr.title]="row.description">{{ row.description }}</div>
        }
      </ng-template>
      <ng-template appColumn="frequencyDays" let-row>every {{ row.frequencyDays }} d</ng-template>
      <ng-template appColumn="nextDueDate" let-row>
        <span [class.text-danger]="row.isOverdue" [class.fw-semibold]="row.isDue">{{ row.nextDueDate | appDate }}</span>
        @if (row.isOverdue) {
          <span class="badge badge-soft badge-soft-danger ms-1">Overdue {{ row.daysToDue === null ? '' : -row.daysToDue + 'd' }}</span>
        } @else if (row.isDue) {
          <span class="badge badge-soft badge-soft-warning ms-1">Due {{ row.daysToDue === 0 ? 'today' : 'in ' + row.daysToDue + 'd' }}</span>
        }
      </ng-template>
      <ng-template appColumn="status" let-row><app-status-badge [status]="row.status" /></ng-template>
      <ng-template appRowActions let-row>
        <button *appHasPermission="'maintenance.create'" type="button" class="btn btn-sm btn-outline-primary me-1" (click)="openRecord(row)">
          <i class="bi bi-wrench-adjustable"></i> Record
        </button>
        <ng-container *appHasPermission="'maintenance.update'">
          <button type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="openEdit(row)"><i class="bi bi-pencil"></i> Edit</button>
          <button type="button" class="btn btn-sm btn-outline-danger" (click)="remove(row)"><i class="bi bi-trash"></i></button>
        </ng-container>
      </ng-template>
    </app-data-table>

    <app-schedule-form-modal [open]="formOpen()" [schedule]="editing()" (closed)="formOpen.set(false)" (saved)="onSaved()" />
    <app-record-modal
      [open]="recordOpen()"
      [equipmentId]="recordEquipmentId()"
      [scheduleId]="recordScheduleId()"
      (closed)="recordOpen.set(false)"
      (saved)="list.load()"
    />
  `,
})
export class ScheduleListComponent {
  private readonly svc = inject(MaintenanceService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly statuses = SCHEDULE_STATUSES;
  readonly equipment = toSignal(this.svc.equipmentOptions(), { initialValue: [] as Equipment[] });

  readonly columns: TableColumn[] = [
    { key: 'equipmentName', label: 'Equipment', sortable: true },
    { key: 'taskName', label: 'Task', sortable: true, type: 'template' },
    { key: 'frequencyDays', label: 'Frequency', sortable: true, type: 'template' },
    { key: 'lastServiceDate', label: 'Last service', type: 'date', sortable: true },
    { key: 'nextDueDate', label: 'Next due', type: 'template', sortable: true },
    { key: 'assignedEmployeeName', label: 'Assigned to' },
    { key: 'status', label: 'Status', type: 'template', sortable: true },
  ];

  readonly filters = this.fb.group({ equipmentId: [''], status: [''], dueOnly: [false] });
  readonly list = new PagedList<MaintenanceSchedule>(
    (q) => this.svc.schedules(q),
    () => {
      const f = this.filters.getRawValue();
      return { equipmentId: f.equipmentId || undefined, status: f.status || undefined, dueOnly: f.dueOnly ? true : undefined };
    },
  );

  readonly formOpen = signal(false);
  readonly editing = signal<MaintenanceSchedule | null>(null);
  readonly recordOpen = signal(false);
  readonly recordEquipmentId = signal<number | null>(null);
  readonly recordScheduleId = signal<number | null>(null);

  constructor() {
    const p = this.route.snapshot.queryParamMap;
    const due = ['true', '1'].includes(qp(p, 'due').toLowerCase()) || ['true', '1'].includes(qp(p, 'dueOnly').toLowerCase());
    this.filters.patchValue({ equipmentId: qp(p, 'equipmentId'), status: qp(p, 'status'), dueOnly: due });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
    this.list.load();
  }

  openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  openEdit(row: MaintenanceSchedule): void {
    this.editing.set(row);
    this.formOpen.set(true);
  }

  openRecord(row: MaintenanceSchedule): void {
    this.recordEquipmentId.set(row.equipmentId);
    this.recordScheduleId.set(row.id);
    this.recordOpen.set(true);
  }

  onSaved(): void {
    this.formOpen.set(false);
    this.list.load();
  }

  async remove(row: MaintenanceSchedule): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Remove schedule',
      message: `Remove the schedule "${row.taskName}" for ${row.equipmentName}? History is kept.`,
      confirmText: 'Remove',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc
      .updateSchedule(row.id, {
        taskName: row.taskName,
        description: row.description,
        frequencyDays: row.frequencyDays,
        lastServiceDate: row.lastServiceDate ? dateOnly(row.lastServiceDate) : null,
        nextDueDate: null,
        alertBeforeDays: row.alertBeforeDays,
        assignedEmployeeId: row.assignedEmployeeId,
        status: row.status,
        isActive: false,
      })
      .subscribe(() => {
        this.toast.success('Schedule removed.');
        this.list.load();
      });
  }
}
