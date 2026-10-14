import { Component, OnInit, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppCurrencyPipe, AppDatePipe } from '../../../shared/pipes/app-pipes';
import { positiveNumberValidator } from '../../../shared/validators/app-validators';
import { FarmerLoan, LoanInstallment } from '../farmer.model';
import { FarmerService } from '../farmer.service';

@Component({
  selector: 'app-loan-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    KpiCardComponent,
    StatusBadgeComponent,
    ModalComponent,
    FormFieldComponent,
    HasPermissionDirective,
    AppDatePipe,
    AppCurrencyPipe,
  ],
  template: `
    @if (loading()) {
      <app-loading text="Loading loan..." />
    } @else if (error()) {
      <div class="card">
        <app-empty-state icon="bi-exclamation-octagon" title="Could not load loan" [message]="error()!">
          <button type="button" class="btn btn-outline-primary btn-sm me-2" (click)="load()">Retry</button>
          <a routerLink="/farmers/loans" class="btn btn-light btn-sm">Back</a>
        </app-empty-state>
      </div>
    } @else if (loan(); as l) {
      <app-page-header [title]="'Loan ' + l.loanNumber" [subtitle]="l.farmerName + ' (' + l.farmerCode + ') · ' + (l.purpose || 'Farmer loan')">
        <a routerLink="/farmers/loans" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>Back</a>
        <a [routerLink]="['/farmers', l.farmerId]" class="btn btn-outline-secondary"><i class="bi bi-person me-1"></i>Farmer</a>
      </app-page-header>

      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3"><app-kpi-card title="Principal" [value]="l.principalAmount" format="currency" icon="bi-bank" color="primary" [subtitle]="l.interestRate + '% p.a.'" /></div>
        <div class="col-6 col-lg-3"><app-kpi-card title="Total payable" [value]="l.totalPayable" format="currency" icon="bi-calculator" color="info" [subtitle]="'Interest ' + (l.interestAmount | appCurrency)" /></div>
        <div class="col-6 col-lg-3"><app-kpi-card title="Paid" [value]="l.paidAmount" format="currency" icon="bi-check-circle" color="success" [subtitle]="l.paidInstallments + ' of ' + l.numberOfInstallments + ' installments'" /></div>
        <div class="col-6 col-lg-3"><app-kpi-card title="Outstanding" [value]="l.outstandingAmount" format="currency" icon="bi-hourglass-split" color="danger" /></div>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <dl class="row mb-0 small">
            <dt class="col-sm-3 col-lg-2 text-muted">Status</dt><dd class="col-sm-9 col-lg-4"><app-status-badge [status]="l.status" /></dd>
            <dt class="col-sm-3 col-lg-2 text-muted">Loan date</dt><dd class="col-sm-9 col-lg-4">{{ l.loanDate | appDate }}</dd>
            <dt class="col-sm-3 col-lg-2 text-muted">Installment</dt><dd class="col-sm-9 col-lg-4">{{ l.installmentAmount | appCurrency }} x {{ l.numberOfInstallments }}</dd>
            <dt class="col-sm-3 col-lg-2 text-muted">First due</dt><dd class="col-sm-9 col-lg-4">{{ l.firstInstallmentDate | appDate }}</dd>
            <dt class="col-sm-3 col-lg-2 text-muted">Payment mode</dt><dd class="col-sm-9 col-lg-4">{{ l.paymentModeName || '—' }}</dd>
            <dt class="col-sm-3 col-lg-2 text-muted">Reference</dt><dd class="col-sm-9 col-lg-4">{{ l.referenceNo || '—' }}</dd>
            <dt class="col-sm-3 col-lg-2 text-muted">Closed on</dt><dd class="col-sm-9 col-lg-4">{{ l.closedDate | appDate }}</dd>
            <dt class="col-sm-3 col-lg-2 text-muted">Remarks</dt><dd class="col-sm-9 col-lg-4 mb-0">{{ l.remarks || '—' }}</dd>
          </dl>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Installment schedule</div>
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 app-table">
            <thead>
              <tr>
                <th>#</th><th>Due date</th><th class="text-end">Amount</th><th class="text-end">Principal</th><th class="text-end">Interest</th>
                <th class="text-end">Paid</th><th class="text-end">Balance</th><th>Paid on</th><th>Status</th><th>Source</th><th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (i of l.installments; track i.id) {
                <tr [class.table-danger]="i.isOverdue && i.status !== 'Paid'">
                  <td>{{ i.installmentNo }}</td>
                  <td>{{ i.dueDate | appDate }}</td>
                  <td class="text-end">{{ i.amount | appCurrency }}</td>
                  <td class="text-end">{{ i.principalComponent | appCurrency }}</td>
                  <td class="text-end">{{ i.interestComponent | appCurrency }}</td>
                  <td class="text-end">{{ i.paidAmount | appCurrency }}</td>
                  <td class="text-end">{{ i.balanceAmount | appCurrency }}</td>
                  <td>{{ i.paidDate | appDate }}</td>
                  <td>
                    <app-status-badge [status]="i.status" />
                    @if (i.isOverdue && i.status !== 'Paid') {
                      <app-status-badge status="Overdue" />
                    }
                  </td>
                  <td>{{ i.paymentSource || '—' }}</td>
                  <td class="text-end">
                    @if (i.status !== 'Paid' && l.status === 'Active') {
                      <button *appHasPermission="'loan.update'" type="button" class="btn btn-sm btn-outline-success" (click)="openPay(i)">
                        <i class="bi bi-cash-coin"></i> Pay
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <app-modal [open]="payTarget() !== null" [title]="'Pay installment #' + (payTarget()?.installmentNo ?? '')" (closed)="closePay()">
        @if (payTarget(); as t) {
          <p class="text-muted small mb-3">
            Due {{ t.dueDate | appDate }} &middot; installment {{ t.amount | appCurrency }} &middot; balance
            <strong>{{ t.balanceAmount | appCurrency }}</strong>
          </p>
        }
        <form id="payForm" [formGroup]="payForm" (ngSubmit)="submitPay()" novalidate>
          <app-form-field label="Amount to pay (INR)" inputId="payAmount" [control]="payForm.controls.amount" hint="Cannot exceed the installment balance" [messages]="{ max: 'Amount cannot exceed the installment balance.' }">
            <input id="payAmount" type="number" min="0" step="0.01" class="form-control" formControlName="amount" />
          </app-form-field>
        </form>
        <div modal-footer>
          <button type="button" class="btn btn-light" (click)="closePay()">Cancel</button>
          <button type="submit" form="payForm" class="btn btn-success" [disabled]="paying()">
            @if (paying()) {
              <span class="spinner-border spinner-border-sm me-1"></span>
            }
            Record payment
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class LoanDetailComponent implements OnInit {
  private readonly svc = inject(FarmerService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly id = input.required<string>();

  readonly loan = signal<FarmerLoan | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly payTarget = signal<LoanInstallment | null>(null);
  readonly paying = signal(false);
  readonly payForm = this.fb.group({ amount: [0 as number | null, [Validators.required, positiveNumberValidator()]] });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.loan(this.id()).subscribe({
      next: (l) => {
        this.loan.set(l);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  openPay(i: LoanInstallment): void {
    this.payTarget.set(i);
    this.payForm.controls.amount.setValidators([Validators.required, positiveNumberValidator(), Validators.max(i.balanceAmount)]);
    this.payForm.reset({ amount: i.balanceAmount });
    this.payForm.controls.amount.updateValueAndValidity();
  }

  closePay(): void {
    if (!this.paying()) {
      this.payTarget.set(null);
    }
  }

  submitPay(): void {
    const t = this.payTarget();
    const l = this.loan();
    if (!t || !l) {
      return;
    }
    if (this.payForm.invalid) {
      this.payForm.markAllAsTouched();
      return;
    }
    this.paying.set(true);
    this.svc.payInstallment(l.id, t.installmentNo, Number(this.payForm.getRawValue().amount)).subscribe({
      next: (updated) => {
        this.paying.set(false);
        this.payTarget.set(null);
        this.loan.set(updated);
        this.toast.success(`Installment #${t.installmentNo} payment recorded.`);
      },
      error: () => this.paying.set(false),
    });
  }
}
