import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../../../core/utils/http-error';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { AppCurrencyPipe, AppDatePipe } from '../../../shared/pipes/app-pipes';
import { CustomerPaymentDetail } from '../billing.model';
import { BillingService } from '../billing.service';

@Component({
  selector: 'app-payment-detail-modal',
  standalone: true,
  imports: [RouterLink, ModalComponent, LoadingComponent, StatusBadgeComponent, AppCurrencyPipe, AppDatePipe],
  template: `
    <app-modal [open]="paymentId() !== null" [title]="payment() ? 'Payment ' + payment()!.paymentNumber : 'Payment'" size="lg" (closed)="closed.emit()">
      @if (loading()) {
        <app-loading text="Loading payment..." />
      } @else if (error()) {
        <div class="alert alert-danger mb-0">{{ error() }}</div>
      } @else if (payment(); as p) {
        <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
          <app-status-badge [status]="p.status" />
          <span class="text-muted small">{{ p.paymentDate | appDate }} · {{ p.paymentModeName }}{{ p.referenceNo ? ' · ' + p.referenceNo : '' }}</span>
        </div>
        <dl class="row small">
          <dt class="col-sm-3">Customer</dt>
          <dd class="col-sm-9">{{ p.customerName }} ({{ p.customerCode }})</dd>
          <dt class="col-sm-3">Amount</dt><dd class="col-sm-9 fw-semibold">{{ p.amount | appCurrency }}</dd>
          <dt class="col-sm-3">Allocated</dt><dd class="col-sm-9">{{ p.allocatedAmount | appCurrency }}</dd>
          <dt class="col-sm-3">Unallocated credit</dt><dd class="col-sm-9">{{ p.unallocatedAmount | appCurrency }}</dd>
          <dt class="col-sm-3">Received by</dt><dd class="col-sm-9">{{ p.receivedByName || '—' }}</dd>
          @if (p.remarks) {
            <dt class="col-sm-3">Remarks</dt><dd class="col-sm-9">{{ p.remarks }}</dd>
          }
        </dl>
        <h2 class="section-title">Invoice allocations</h2>
        @if (p.allocations.length === 0) {
          <p class="text-muted mb-0">This payment is not allocated to any invoice (customer credit).</p>
        } @else {
          <div class="table-responsive">
            <table class="table table-sm align-middle app-table mb-0">
              <thead>
                <tr><th>Invoice</th><th>Invoice date</th><th class="text-end">Invoice total</th><th class="text-end">Allocated</th><th>Allocated on</th></tr>
              </thead>
              <tbody>
                @for (a of p.allocations; track a.id) {
                  <tr>
                    <td><a [routerLink]="['/billing/invoices', a.invoiceId]" (click)="closed.emit()" class="text-decoration-none">{{ a.invoiceNumber }}</a></td>
                    <td>{{ a.invoiceDate | appDate }}</td>
                    <td class="text-end">{{ a.invoiceTotal | appCurrency }}</td>
                    <td class="text-end fw-semibold">{{ a.amount | appCurrency }}</td>
                    <td>{{ a.allocationDate | appDate }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
      <div modal-footer><button type="button" class="btn btn-light" (click)="closed.emit()">Close</button></div>
    </app-modal>
  `,
})
export class PaymentDetailModalComponent {
  private readonly svc = inject(BillingService);

  /** null = closed */
  readonly paymentId = input<number | null>(null);
  readonly closed = output<void>();

  readonly payment = signal<CustomerPaymentDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.paymentId();
      untracked(() => {
        this.payment.set(null);
        this.error.set(null);
        if (id !== null) {
          this.loading.set(true);
          this.svc.getPayment(id).subscribe({
            next: (p) => {
              this.payment.set(p);
              this.loading.set(false);
            },
            error: (err) => {
              this.error.set(errorMessage(err));
              this.loading.set(false);
            },
          });
        }
      });
    });
  }
}
