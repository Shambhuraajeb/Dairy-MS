import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PagedList, qp } from '../../../shared/utils/paged-list';
import { EXPENSE_STATUSES, Expense } from '../expense.model';
import { ExpenseService } from '../expense.service';
import { ExpenseFormModalComponent } from './expense-form-modal.component';

@Component({
  selector: 'app-expense-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    ModalComponent,
    FormFieldComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    ExpenseFormModalComponent,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Expenses" subtitle="Operating expenses and their approval status">
      <button *appHasPermission="'expense.create'" type="button" class="btn btn-primary" (click)="formOpen.set(true)">
        <i class="bi bi-plus-lg me-1"></i>New Expense
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
      searchPlaceholder="Search number, payee, receipt or description..."
      emptyTitle="No expenses found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
        <select class="form-select form-select-sm w-auto" formControlName="categoryId" aria-label="Category">
          <option value="">All categories</option>
          @for (c of categories(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="paymentModeId" aria-label="Payment mode">
          <option value="">All payment modes</option>
          @for (m of paymentModes(); track m.id) {
            <option [value]="m.id">{{ m.name }}</option>
          }
        </select>
        <input type="date" class="form-control form-control-sm w-auto" formControlName="from" aria-label="From date" />
        <input type="date" class="form-control form-control-sm w-auto" formControlName="to" aria-label="To date" />
      </div>

      <ng-template appColumn="expenseNumber" let-row>
        <div class="fw-semibold">{{ row.expenseNumber }}</div>
        @if (row.receiptNo) {
          <div class="small text-muted">Receipt {{ row.receiptNo }}</div>
        }
      </ng-template>
      <ng-template appColumn="payee" let-row>
        {{ row.payee ?? '—' }}
        @if (row.description) {
          <div class="small text-muted text-truncate" style="max-width: 260px" [attr.title]="row.description">{{ row.description }}</div>
        }
      </ng-template>
      <ng-template appColumn="status" let-row>
        <app-status-badge [status]="row.status" />
        @if (row.status === 'Rejected' && row.rejectionReason) {
          <div class="small text-muted">{{ row.rejectionReason }}</div>
        } @else if (row.approvedByName) {
          <div class="small text-muted">by {{ row.approvedByName }}</div>
        }
      </ng-template>
      <ng-template appRowActions let-row>
        @if (row.status === 'Pending') {
          <ng-container *appHasPermission="'expense.approve'">
            <button type="button" class="btn btn-sm btn-outline-success me-1" (click)="approve(row)"><i class="bi bi-check2"></i> Approve</button>
            <button type="button" class="btn btn-sm btn-outline-danger" (click)="openReject(row)"><i class="bi bi-x-lg"></i> Reject</button>
          </ng-container>
        }
      </ng-template>
    </app-data-table>

    <app-expense-form-modal [open]="formOpen()" (closed)="formOpen.set(false)" (saved)="onSaved()" />

    <app-modal [open]="rejectTarget() !== null" title="Reject expense" (closed)="closeReject()">
      <form id="rejectExpenseForm" [formGroup]="rejectForm" (ngSubmit)="confirmReject()" novalidate>
        <p class="mb-3">
          Reject expense <strong>{{ rejectTarget()?.expenseNumber }}</strong> ({{ rejectTarget()?.categoryName }})?
        </p>
        <app-form-field label="Reason" inputId="rejReason" [control]="rejectForm.controls.reason">
          <textarea id="rejReason" rows="3" class="form-control" formControlName="reason" maxlength="250"></textarea>
        </app-form-field>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeReject()">Cancel</button>
        <button type="submit" form="rejectExpenseForm" class="btn btn-danger" [disabled]="rejecting()">
          @if (rejecting()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Reject
        </button>
      </div>
    </app-modal>
  `,
})
export class ExpenseListComponent {
  private readonly svc = inject(ExpenseService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly statuses = EXPENSE_STATUSES;
  readonly categories = toSignal(this.lookups.get('expense-categories'), { initialValue: [] as LookupItem[] });
  readonly paymentModes = toSignal(this.lookups.paymentModes(), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'expenseNumber', label: 'Number', sortable: true, width: '150px' },
    { key: 'expenseDate', label: 'Date', type: 'date', sortable: true },
    { key: 'categoryName', label: 'Category', sortable: true },
    { key: 'payee', label: 'Payee / Notes', type: 'template' },
    { key: 'amount', label: 'Amount', type: 'currency', sortable: true },
    { key: 'paymentModeName', label: 'Mode' },
    { key: 'status', label: 'Status', type: 'template', sortable: true },
    { key: 'createdByName', label: 'Entered by' },
  ];

  readonly filters = this.fb.group({ categoryId: [''], status: [''], paymentModeId: [''], from: [''], to: [''] });
  readonly list = new PagedList<Expense>(
    (q) => this.svc.list(q),
    () => {
      const f = this.filters.getRawValue();
      return {
        categoryId: f.categoryId || undefined,
        status: f.status || undefined,
        paymentModeId: f.paymentModeId || undefined,
        from: f.from || undefined,
        to: f.to || undefined,
      };
    },
  );

  readonly formOpen = signal(false);
  readonly rejectTarget = signal<Expense | null>(null);
  readonly rejecting = signal(false);
  readonly rejectForm = this.fb.group({ reason: ['', [Validators.required, Validators.maxLength(250)]] });

  constructor() {
    const p = this.route.snapshot.queryParamMap;
    this.filters.patchValue({
      categoryId: qp(p, 'categoryId'),
      status: qp(p, 'status'),
      paymentModeId: qp(p, 'paymentModeId'),
      from: qp(p, 'from'),
      to: qp(p, 'to'),
    });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
    this.list.load();
  }

  onSaved(): void {
    this.formOpen.set(false);
    this.list.load();
  }

  async approve(row: Expense): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Approve expense',
      message: `Approve expense ${row.expenseNumber}? A cash-out entry will be posted.`,
      confirmText: 'Approve',
      variant: 'primary',
    });
    if (!ok) {
      return;
    }
    this.svc.approve(row.id).subscribe(() => {
      this.toast.success(`Expense ${row.expenseNumber} approved.`);
      this.list.load();
    });
  }

  openReject(row: Expense): void {
    this.rejectForm.reset({ reason: '' });
    this.rejectTarget.set(row);
  }

  closeReject(): void {
    if (!this.rejecting()) {
      this.rejectTarget.set(null);
    }
  }

  confirmReject(): void {
    const target = this.rejectTarget();
    if (!target) {
      return;
    }
    if (this.rejectForm.invalid) {
      this.rejectForm.markAllAsTouched();
      return;
    }
    this.rejecting.set(true);
    this.svc.reject(target.id, this.rejectForm.getRawValue().reason.trim()).subscribe({
      next: () => {
        this.rejecting.set(false);
        this.rejectTarget.set(null);
        this.toast.success(`Expense ${target.expenseNumber} rejected.`);
        this.list.load();
      },
      error: () => this.rejecting.set(false),
    });
  }
}
