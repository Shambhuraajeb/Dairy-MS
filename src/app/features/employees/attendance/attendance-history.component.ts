import { Component, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { toIsoDate } from '../../../shared/utils/format';
import { PagedList } from '../../../shared/utils/paged-list';
import { ATTENDANCE_STATUSES, Attendance, toHHmm } from '../employee.model';
import { EmployeeService } from '../employee.service';

@Component({
  selector: 'app-attendance-history',
  standalone: true,
  imports: [ReactiveFormsModule, ...DATA_TABLE_IMPORTS],
  template: `
    <app-data-table
      [columns]="columns"
      [items]="list.items()"
      [total]="list.total()"
      [loading]="list.loading()"
      [error]="list.error()"
      [page]="list.query.page ?? 1"
      [pageSize]="list.query.pageSize ?? 20"
      sortBy="attendanceDate"
      sortDir="desc"
      searchPlaceholder="Search employee..."
      emptyTitle="No attendance records"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
        <input type="date" class="form-control form-control-sm w-auto" formControlName="from" aria-label="From date" />
        <input type="date" class="form-control form-control-sm w-auto" formControlName="to" aria-label="To date" />
        <select class="form-select form-select-sm w-auto" formControlName="employeeId" aria-label="Employee">
          <option value="">All employees</option>
          @for (e of employees(); track e.id) {
            <option [value]="e.id">{{ e.name }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
      </div>
      <ng-template appColumn="checkIn" let-row>{{ time(row.checkIn) }}</ng-template>
      <ng-template appColumn="checkOut" let-row>{{ time(row.checkOut) }}</ng-template>
    </app-data-table>
  `,
})
export class AttendanceHistoryComponent {
  private readonly svc = inject(EmployeeService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly statuses = ATTENDANCE_STATUSES;
  readonly employees = toSignal(this.lookups.get('employees'), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'attendanceDate', label: 'Date', type: 'date', sortable: true, width: '130px' },
    { key: 'employeeCode', label: 'Code', sortable: true, width: '110px' },
    { key: 'employeeName', label: 'Employee', sortable: true },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
    { key: 'checkIn', label: 'Check in', width: '100px' },
    { key: 'checkOut', label: 'Check out', width: '100px' },
    { key: 'workedHours', label: 'Hours', type: 'number', sortable: true, width: '90px' },
    { key: 'remarks', label: 'Remarks' },
  ];

  readonly filters = this.fb.group({
    from: [this.daysAgo(6)],
    to: [toIsoDate()],
    employeeId: [''],
    status: [''],
  });
  readonly list = new PagedList<Attendance>(
    (q) => this.svc.listAttendance(q),
    () => this.filterQuery(),
    { sortBy: 'attendanceDate', sortDir: 'desc' },
  );

  constructor() {
    this.list.load();
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
  }

  time(v: string | null): string {
    return toHHmm(v) || '—';
  }

  private filterQuery(): PagedQuery {
    const v = this.filters.getRawValue();
    return { from: v.from, to: v.to, employeeId: v.employeeId, status: v.status };
  }

  private daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toIsoDate(d);
  }
}
