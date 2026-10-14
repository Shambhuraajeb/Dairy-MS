import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AppCurrencyPipe } from '../../../shared/pipes/app-pipes';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PagedList } from '../../../shared/utils/paged-list';
import { MONTHS, Salary } from '../employee.model';
import { EmployeeService } from '../employee.service';

const now = new Date();

/** group validator: month/year must not be in the future */
function notFuture(group: AbstractControl): ValidationErrors | null {
  const m = Number(group.get('month')?.value);
  const y = Number(group.get('year')?.value);
  if (!m || !y) {
    return null;
  }
  return y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1) ? { future: true } : null;
}

@Component({
  selector: 'app-salary',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    ModalComponent,
    FormFieldComponent,
    HasPermissionDirective,
    AppCurrencyPipe,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Salary" subtitle="Monthly salary sheets and payments">
      <a routerLink="/employees" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>Employees</a>
      <button *appHasPermission="'salary.manage'" type="button" class="btn btn-primary" (click)="openGenerate()">
        <i class="bi bi-gear me-1"></i>Generate for Month
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
      searchPlaceholder="Search employee name or code..."
      emptyTitle="No salary records"
      emptyMessage="Generate the salary sheet for this month or change the filters."
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
        <select class="form-select form-select-sm w-auto" formControlName="month" aria-label="Month">
          <option value="">All months</option>
          @for (m of months; track $index) {
            <option [value]="$index + 1">{{ m }}</option>
          }
        </select>
        <input type="number" class="form-control form-control-sm" style="width: 90px" formControlName="year" min="2000" max="2100" placeholder="Year" aria-label="Year" />
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">All statuses</option>
          <option value="Generated">Generated</option>
          <option value="Paid">Paid</option>
        </select>
      </div>

      <ng-template appColumn="employeeName" let-row>
        <div class="fw-semibold">{{ row.employeeName }}</div>
        <div class="small text-muted">{{ row.employeeCode }}{{ row.designationName ? ' · ' + row.designationName : '' }}</div>
      </ng-template>
      <ng-template appColumn="salaryMonth" let-row>{{ monthName(row.salaryMonth) }} {{ row.salaryYear }}</ng-template>
      <ng-template appColumn="presentDays" let-row>
        {{ row.presentDays }} / {{ row.workingDays }}
        @if (row.leaveDays) {
          <span class="small text-muted">(leave {{ row.leaveDays }})</span>
        }
      </ng-template>
      <ng-template appColumn="netAmount" let-row><span class="fw-semibold">{{ row.netAmount | appCurrency }}</span></ng-template>
      <ng-template appColumn="paidDate" let-row>
        @if (row.status === 'Paid') {
          <div>{{ row.paymentModeName ?? '—' }}</div>
          @if (row.referenceNo) {
            <div class="small text-muted">Ref {{ row.referenceNo }}</div>
          }
        } @else {
          —
        }
      </ng-template>
      <ng-template appRowActions let-row>
        @if (row.status !== 'Paid') {
          <button *appHasPermission="'salary.manage'" type="button" class="btn btn-sm btn-outline-success" (click)="openPay(row)">
            <i class="bi bi-cash-coin"></i> Pay
          </button>
        }
      </ng-template>
    </app-data-table>

    <app-modal [open]="generateOpen()" title="Generate Salaries" size="sm" (closed)="closeGenerate()">
      <form id="generateForm" [formGroup]="generateForm" (ngSubmit)="generate()" novalidate>
        <p class="text-muted small">
          Creates salary records for all active employees for the selected month, using attendance. Employees that already have a record are skipped.
        </p>
        <app-form-field label="Month" inputId="genMonth" [control]="generateForm.controls.month">
          <select id="genMonth" class="form-select" formControlName="month">
            @for (m of months; track $index) {
              <option [ngValue]="$index + 1">{{ m }}</option>
            }
          </select>
        </app-form-field>
        <app-form-field label="Year" inputId="genYear" [control]="generateForm.controls.year">
          <input id="genYear" type="number" min="2000" max="2100" class="form-control" formControlName="year" />
        </app-form-field>
        @if (generateForm.errors?.['future']) {
          <div class="text-danger small">Salaries cannot be generated for a future month.</div>
        }
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeGenerate()">Cancel</button>
        <button type="submit" form="generateForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Generate
        </button>
      </div>
    </app-modal>

    <app-modal [open]="paying() !== null" title="Pay Salary" size="sm" (closed)="closePay()">
      @if (paying(); as s) {
        <div class="mb-3">
          <div class="fw-semibold">{{ s.employeeName }}</div>
          <div class="text-muted small">{{ monthName(s.salaryMonth) }} {{ s.salaryYear }}</div>
          <div class="fs-4 mt-2">{{ s.netAmount | appCurrency }}</div>
        </div>
      }
      <form id="payForm" [formGroup]="payForm" (ngSubmit)="pay()" novalidate>
        <app-form-field label="Payment mode" inputId="payMode" [control]="payForm.controls.paymentModeId">
          <select id="payMode" class="form-select" formControlName="paymentModeId">
            <option [ngValue]="null">Select payment mode</option>
            @for (p of paymentModes(); track p.id) {
              <option [ngValue]="p.id">{{ p.name }}</option>
            }
          </select>
        </app-form-field>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closePay()">Cancel</button>
        <button type="submit" form="payForm" class="btn btn-success" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Mark as paid
        </button>
      </div>
    </app-modal>
  `,
})
export class SalaryComponent {
  private readonly svc = inject(EmployeeService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly months = MONTHS;
  readonly paymentModes = toSignal(this.lookups.get('payment-modes'), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'employeeName', label: 'Employee', sortable: true },
    { key: 'salaryMonth', label: 'Period', sortable: true, width: '130px' },
    { key: 'presentDays', label: 'Present / Working', width: '160px' },
    { key: 'basicAmount', label: 'Basic', type: 'currency' },
    { key: 'allowances', label: 'Allowances', type: 'currency' },
    { key: 'deductions', label: 'Deductions', type: 'currency' },
    { key: 'netAmount', label: 'Net', sortable: true, align: 'end', type: 'template' },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
    { key: 'paidDate', label: 'Paid', sortable: true },
  ];

  readonly filters = this.fb.group({
    month: [String(now.getMonth() + 1)],
    year: [String(now.getFullYear())],
    status: [''],
  });
  readonly list = new PagedList<Salary>(
    (q) => this.svc.listSalaries(q),
    () => this.filters.getRawValue() as PagedQuery,
  );

  readonly saving = signal(false);
  readonly generateOpen = signal(false);
  readonly generateForm = this.fb.group(
    {
      month: [now.getMonth() + 1, Validators.required],
      year: [now.getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
    },
    { validators: [notFuture] },
  );

  readonly paying = signal<Salary | null>(null);
  readonly payForm = this.fb.group({ paymentModeId: [null as number | null, Validators.required] });

  constructor() {
    this.list.load();
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
  }

  monthName(m: number): string {
    return this.months[m - 1] ?? String(m);
  }

  openGenerate(): void {
    this.generateForm.reset({ month: now.getMonth() + 1, year: now.getFullYear() });
    this.generateOpen.set(true);
  }

  closeGenerate(): void {
    if (!this.saving()) {
      this.generateOpen.set(false);
    }
  }

  async generate(): Promise<void> {
    if (this.generateForm.invalid) {
      this.generateForm.markAllAsTouched();
      return;
    }
    const { month, year } = this.generateForm.getRawValue();
    const ok = await this.confirmService.confirm({
      title: 'Generate salaries',
      message: `Generate salary records for ${this.monthName(month)} ${year}?`,
      confirmText: 'Generate',
    });
    if (!ok) {
      return;
    }
    this.saving.set(true);
    this.svc.generateSalaries(month, year).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.generateOpen.set(false);
        this.toast.success(`Generated ${res.generated} salary record(s); ${res.alreadyExisting} already existed.`);
        this.filters.patchValue({ month: String(month), year: String(year) }); // also reloads via valueChanges
      },
      error: () => this.saving.set(false),
    });
  }

  openPay(row: Salary): void {
    this.payForm.reset({ paymentModeId: null });
    this.paying.set(row);
  }

  closePay(): void {
    if (!this.saving()) {
      this.paying.set(null);
    }
  }

  pay(): void {
    const row = this.paying();
    if (!row) {
      return;
    }
    const modeId = this.payForm.getRawValue().paymentModeId;
    if (this.payForm.invalid || modeId === null) {
      this.payForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.svc.paySalary(row.id, modeId).subscribe({
      next: () => {
        this.saving.set(false);
        this.paying.set(null);
        this.toast.success(`Salary paid to ${row.employeeName}.`);
        this.list.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
