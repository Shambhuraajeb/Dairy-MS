import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { dateRangeValidator } from '../../../shared/validators/app-validators';
import { toIsoDate } from '../../../shared/utils/format';
import { PagedList, orNull } from '../../../shared/utils/paged-list';
import { LEAVE_STATUSES, LEAVE_TYPES, LeaveRequest, LeaveType } from '../employee.model';
import { EmployeeService } from '../employee.service';

function halfStep(control: AbstractControl): ValidationErrors | null {
  const v = control.value as number | null;
  return v === null || v === undefined || (Number(v) * 2) % 1 === 0 ? null : { halfStep: true };
}

@Component({
  selector: 'app-leave',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    ModalComponent,
    FormFieldComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Leave Requests" subtitle="Apply for leave and approve or reject requests">
      <a routerLink="/employees" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>Employees</a>
      <button *appHasPermission="'leave.create'" type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="bi bi-plus-lg me-1"></i>New Leave Request
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
      sortBy="createdDate"
      sortDir="desc"
      searchPlaceholder="Search employee or reason..."
      emptyTitle="No leave requests"
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
        <select class="form-select form-select-sm w-auto" formControlName="leaveType" aria-label="Leave type">
          <option value="">All types</option>
          @for (t of leaveTypes; track t) {
            <option [value]="t">{{ t }}</option>
          }
        </select>
        @if (canPickEmployee()) {
          <select class="form-select form-select-sm w-auto" formControlName="employeeId" aria-label="Employee">
            <option value="">All employees</option>
            @for (e of employees(); track e.id) {
              <option [value]="e.id">{{ e.name }}</option>
            }
          </select>
        }
        <input type="date" class="form-control form-control-sm w-auto" formControlName="from" aria-label="From date" />
        <input type="date" class="form-control form-control-sm w-auto" formControlName="to" aria-label="To date" />
      </div>

      <ng-template appColumn="employeeName" let-row>
        <div class="fw-semibold">{{ row.employeeName }}</div>
        <div class="small text-muted">{{ row.employeeCode }}</div>
      </ng-template>
      <ng-template appColumn="status" let-row>
        <app-status-badge [status]="row.status" />
        @if (row.status === 'Rejected' && row.rejectionReason) {
          <div class="small text-muted mt-1">{{ row.rejectionReason }}</div>
        }
        @if (row.approvedByName && row.status !== 'Pending') {
          <div class="small text-muted">by {{ row.approvedByName }}</div>
        }
      </ng-template>
      <ng-template appRowActions let-row>
        @if (row.status === 'Pending') {
          <button *appHasPermission="'leave.approve'" type="button" class="btn btn-sm btn-outline-success me-1" (click)="approve(row)">
            <i class="bi bi-check-lg"></i> Approve
          </button>
          <button *appHasPermission="'leave.approve'" type="button" class="btn btn-sm btn-outline-danger" (click)="openReject(row)">
            <i class="bi bi-x-lg"></i> Reject
          </button>
        }
      </ng-template>
    </app-data-table>

    <app-modal [open]="createOpen()" title="New Leave Request" (closed)="closeCreate()">
      <form id="leaveForm" [formGroup]="form" (ngSubmit)="saveCreate()" novalidate>
        @if (canApprove()) {
          <app-form-field label="Employee" inputId="lvEmployee" [control]="form.controls.employeeId" hint="Leave empty to apply for yourself">
            <select id="lvEmployee" class="form-select" formControlName="employeeId">
              <option [ngValue]="null">Myself</option>
              @for (e of employees(); track e.id) {
                <option [ngValue]="e.id">{{ e.name }}</option>
              }
            </select>
          </app-form-field>
        }
        <app-form-field label="Leave type" inputId="lvType" [control]="form.controls.leaveType">
          <select id="lvType" class="form-select" formControlName="leaveType">
            @for (t of leaveTypes; track t) {
              <option [value]="t">{{ t }}</option>
            }
          </select>
        </app-form-field>
        <div class="row">
          <div class="col-6">
            <app-form-field label="From" inputId="lvFrom" [control]="form.controls.fromDate">
              <input id="lvFrom" type="date" class="form-control" formControlName="fromDate" />
            </app-form-field>
          </div>
          <div class="col-6">
            <app-form-field label="To" inputId="lvTo" [control]="form.controls.toDate">
              <input id="lvTo" type="date" class="form-control" formControlName="toDate" />
            </app-form-field>
          </div>
        </div>
        @if (form.errors?.['dateRange']) {
          <div class="text-danger small mb-3">The end date cannot be before the start date.</div>
        }
        <app-form-field
          label="Days"
          inputId="lvDays"
          [control]="form.controls.days"
          hint="Optional. Defaults to calendar days; use 0.5 steps for half days."
          [messages]="{ halfStep: 'Days must be a multiple of 0.5.' }"
        >
          <input id="lvDays" type="number" min="0.5" step="0.5" class="form-control" formControlName="days" />
        </app-form-field>
        <app-form-field label="Reason" inputId="lvReason" [control]="form.controls.reason">
          <textarea id="lvReason" rows="2" class="form-control" formControlName="reason" maxlength="500"></textarea>
        </app-form-field>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeCreate()">Cancel</button>
        <button type="submit" form="leaveForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Submit
        </button>
      </div>
    </app-modal>

    <app-modal [open]="rejecting() !== null" title="Reject Leave Request" size="sm" (closed)="closeReject()">
      <p class="mb-3">
        Reject the {{ rejecting()?.leaveType }} leave of <strong>{{ rejecting()?.employeeName }}</strong>?
      </p>
      <form id="rejectForm" [formGroup]="rejectForm" (ngSubmit)="confirmReject()" novalidate>
        <app-form-field label="Reason" inputId="lvRejectReason" [control]="rejectForm.controls.reason">
          <textarea id="lvRejectReason" rows="2" class="form-control" formControlName="reason" maxlength="255"></textarea>
        </app-form-field>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeReject()">Cancel</button>
        <button type="submit" form="rejectForm" class="btn btn-danger" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Reject
        </button>
      </div>
    </app-modal>
  `,
})
export class LeaveComponent {
  private readonly svc = inject(EmployeeService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly perm = inject(PermissionService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly statuses = LEAVE_STATUSES;
  readonly leaveTypes = LEAVE_TYPES;
  readonly employees = toSignal(this.lookups.get('employees'), { initialValue: [] as LookupItem[] });
  readonly canApprove = computed(() => this.perm.has('leave.approve'));
  readonly canPickEmployee = computed(() => this.perm.hasAny('leave.approve', 'employee.view'));

  readonly columns: TableColumn[] = [
    { key: 'employeeName', label: 'Employee', sortable: true },
    { key: 'leaveType', label: 'Type', sortable: true, width: '100px' },
    { key: 'fromDate', label: 'From', type: 'date', sortable: true, width: '120px' },
    { key: 'toDate', label: 'To', type: 'date', sortable: true, width: '120px' },
    { key: 'days', label: 'Days', type: 'number', sortable: true, width: '80px' },
    { key: 'reason', label: 'Reason' },
    { key: 'status', label: 'Status', sortable: true },
  ];

  readonly filters = this.fb.group({ status: [''], leaveType: [''], employeeId: [''], from: [''], to: [''] });
  readonly list = new PagedList<LeaveRequest>(
    (q) => this.svc.listLeave(q),
    () => this.filters.getRawValue() as PagedQuery,
    { sortBy: 'createdDate', sortDir: 'desc' },
  );

  readonly createOpen = signal(false);
  readonly saving = signal(false);
  readonly rejecting = signal<LeaveRequest | null>(null);

  readonly form = this.fb.group(
    {
      employeeId: [null as number | null],
      leaveType: ['Casual' as LeaveType, Validators.required],
      fromDate: [toIsoDate(), Validators.required],
      toDate: [toIsoDate(), Validators.required],
      days: [null as number | null, [Validators.min(0.5), halfStep]],
      reason: ['', Validators.maxLength(500)],
    },
    { validators: [dateRangeValidator('fromDate', 'toDate')] },
  );
  readonly rejectForm = this.fb.group({ reason: ['', Validators.maxLength(255)] });

  constructor() {
    this.list.load();
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
  }

  openCreate(): void {
    this.form.reset({ employeeId: null, leaveType: 'Casual', fromDate: toIsoDate(), toDate: toIsoDate(), days: null, reason: '' });
    this.createOpen.set(true);
  }

  closeCreate(): void {
    if (!this.saving()) {
      this.createOpen.set(false);
    }
  }

  saveCreate(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.svc
      .createLeave({
        employeeId: this.canApprove() ? v.employeeId : null,
        leaveType: v.leaveType,
        fromDate: v.fromDate,
        toDate: v.toDate,
        days: v.days,
        reason: orNull(v.reason.trim()),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.createOpen.set(false);
          this.toast.success('Leave request submitted.');
          this.list.load();
        },
        error: () => this.saving.set(false),
      });
  }

  async approve(row: LeaveRequest): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Approve leave',
      message: `Approve ${row.days} day(s) of ${row.leaveType} leave for ${row.employeeName}? Attendance for these days will be updated.`,
      confirmText: 'Approve',
      variant: 'success',
    });
    if (!ok) {
      return;
    }
    this.svc.approveLeave(row.id).subscribe(() => {
      this.toast.success('Leave approved.');
      this.list.load();
    });
  }

  openReject(row: LeaveRequest): void {
    this.rejectForm.reset({ reason: '' });
    this.rejecting.set(row);
  }

  closeReject(): void {
    if (!this.saving()) {
      this.rejecting.set(null);
    }
  }

  confirmReject(): void {
    const row = this.rejecting();
    if (!row || this.rejectForm.invalid) {
      return;
    }
    this.saving.set(true);
    this.svc.rejectLeave(row.id, orNull(this.rejectForm.getRawValue().reason.trim())).subscribe({
      next: () => {
        this.saving.set(false);
        this.rejecting.set(null);
        this.toast.success('Leave rejected.');
        this.list.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
