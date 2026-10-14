import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { errorMessage } from '../../../core/utils/http-error';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { AppCurrencyPipe, AppDatePipe, AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { FarmerPaymentDetail } from '../models/settlement.model';
import { FarmerPaymentService } from '../services/farmer-payment.service';

/** Farmer payment / settlement details: totals, collections covered, deductions, bank info. */
@Component({
  selector: 'app-payment-detail-modal',
  standalone: true,
  imports: [ModalComponent, StatusBadgeComponent, LoadingComponent, AppDatePipe, AppNumberPipe, AppCurrencyPipe],
  template: `
    <app-modal [open]="paymentId() !== null" title="Payment details" size="xl" (closed)="closed.emit()">
      @if (loading()) {
        <app-loading text="Loading details..." />
      } @else if (error()) {
        <div class="alert alert-danger mb-0">{{ error() }}</div>
      } @else if (detail(); as d) {
        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
          <h5 class="mb-0">{{ d.paymentNumber }}</h5>
          <app-status-badge [status]="d.status" />
        </div>
        <div class="row g-3 mb-3">
          <div class="col-md-4"><div class="text-muted small">Farmer</div><div>{{ d.farmerCode }} - {{ d.farmerName }}</div></div>
          <div class="col-md-4"><div class="text-muted small">Period</div><div>{{ d.periodFrom | appDate }} - {{ d.periodTo | appDate }}</div></div>
          <div class="col-md-4"><div class="text-muted small">Collections / Quantity</div><div>{{ d.totalCollections }} / {{ d.totalQuantity | appNumber: 3 }} L</div></div>
          <div class="col-md-3"><div class="text-muted small">Gross</div><div>{{ d.grossAmount | appCurrency }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Bonus</div><div class="text-success">{{ d.bonusAmount | appCurrency }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Penalty</div><div class="text-danger">{{ d.penaltyAmount | appCurrency }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Deductions</div><div class="text-danger">{{ d.deductionAmount | appCurrency }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Net payable</div><div class="fw-semibold">{{ d.netPayable | appCurrency }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Paid</div><div>{{ d.paidAmount | appCurrency }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Balance</div><div>{{ d.balanceAmount | appCurrency }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Payment mode / Ref</div><div>{{ d.paymentModeName ?? '—' }}{{ d.referenceNo ? ' / ' + d.referenceNo : '' }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Approved</div><div>{{ d.approvedByName ?? '—' }} {{ d.approvedDate ? '(' + (d.approvedDate | appDate) + ')' : '' }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Paid by</div><div>{{ d.paidByName ?? '—' }} {{ d.paidDate ? '(' + (d.paidDate | appDate) + ')' : '' }}</div></div>
          <div class="col-md-6">
            <div class="text-muted small">Bank</div>
            <div>{{ d.bankName ?? '—' }} {{ d.bankAccountMasked ?? '' }} {{ d.ifscCode ?? '' }} {{ d.upiId ? 'UPI: ' + d.upiId : '' }}</div>
          </div>
          @if (d.remarks) {
            <div class="col-md-6"><div class="text-muted small">Remarks</div><div>{{ d.remarks }}</div></div>
          }
        </div>
        @if (d.status === 'Cancelled') {
          <div class="alert alert-danger py-2">
            Cancelled {{ d.cancelledDate | appDate: 'datetime' }}: {{ d.cancelReason ?? '—' }}
          </div>
        }

        <h6 class="section-title">Deductions</h6>
        @if (d.deductions.length === 0) {
          <p class="text-muted">No deductions.</p>
        } @else {
          <div class="table-responsive mb-3">
            <table class="table table-sm align-middle mb-0">
              <thead><tr><th>Type</th><th>Reference</th><th>Remarks</th><th class="text-end">Amount</th></tr></thead>
              <tbody>
                @for (x of d.deductions; track x.id) {
                  <tr>
                    <td>{{ x.deductionType }}</td>
                    <td>
                      @if (x.advanceNumber) {
                        Advance {{ x.advanceNumber }}
                      } @else if (x.loanNumber) {
                        Loan {{ x.loanNumber }} #{{ x.installmentNo }}
                      } @else {
                        —
                      }
                    </td>
                    <td>{{ x.remarks ?? '—' }}</td>
                    <td class="text-end">{{ x.amount | appCurrency }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <h6 class="section-title">Collections covered</h6>
        <div class="table-responsive">
          <table class="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Collection</th><th>Date</th><th>Shift</th>
                <th class="text-end">Qty (L)</th><th class="text-end">Rate</th>
                <th class="text-end">Bonus</th><th class="text-end">Penalty</th><th class="text-end">Amount</th>
              </tr>
            </thead>
            <tbody>
              @for (l of d.details; track l.id) {
                <tr>
                  <td>{{ l.collectionNumber }}</td>
                  <td>{{ l.collectionDate | appDate }}</td>
                  <td>{{ l.shiftName }}</td>
                  <td class="text-end">{{ l.quantity | appNumber: 3 }}</td>
                  <td class="text-end">{{ l.rate | appCurrency }}</td>
                  <td class="text-end">{{ l.bonusAmount | appCurrency }}</td>
                  <td class="text-end">{{ l.penaltyAmount | appCurrency }}</td>
                  <td class="text-end">{{ l.amount | appCurrency }}</td>
                </tr>
              } @empty {
                <tr><td colspan="8" class="text-center text-muted py-3">No collections</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closed.emit()">Close</button>
      </div>
    </app-modal>
  `,
})
export class PaymentDetailModalComponent {
  private readonly svc = inject(FarmerPaymentService);

  readonly paymentId = input<number | null>(null);
  readonly closed = output<void>();

  protected readonly detail = signal<FarmerPaymentDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  private sub: Subscription | null = null;

  constructor() {
    effect(() => {
      const id = this.paymentId();
      untracked(() => this.load(id));
    });
  }

  private load(id: number | null): void {
    this.sub?.unsubscribe();
    this.detail.set(null);
    this.error.set(null);
    if (id === null) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.sub = this.svc.get(id).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
