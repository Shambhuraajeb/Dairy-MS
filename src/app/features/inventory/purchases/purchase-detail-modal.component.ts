import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { errorMessage } from '../../../core/utils/http-error';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { AppCurrencyPipe, AppDatePipe, AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { PurchaseDetail } from '../inventory.model';
import { InventoryService } from '../inventory.service';

@Component({
  selector: 'app-purchase-detail-modal',
  standalone: true,
  imports: [ModalComponent, LoadingComponent, StatusBadgeComponent, AppCurrencyPipe, AppDatePipe, AppNumberPipe],
  template: `
    <app-modal [open]="purchaseId() !== null" [title]="detail()?.purchaseNumber ?? 'Purchase'" size="xl" (closed)="closed.emit()">
      @if (loading()) {
        <app-loading text="Loading purchase..." />
      } @else if (error()) {
        <div class="alert alert-danger mb-0">{{ error() }}</div>
      } @else if (detail(); as d) {
        <div class="row g-3 mb-3">
          <div class="col-md-3"><div class="text-muted small">Supplier</div><div class="fw-semibold">{{ d.supplierName }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Purchase date</div><div>{{ d.purchaseDate | appDate }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Status</div><app-status-badge [status]="d.status" /></div>
          <div class="col-md-3"><div class="text-muted small">Payment</div><app-status-badge [status]="d.paymentStatus" /></div>
          <div class="col-md-3"><div class="text-muted small">Created by</div><div>{{ d.createdByName ?? '—' }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Approved</div><div>{{ d.approvedByName ?? '—' }} {{ d.approvedDate | appDate }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Received</div><div>{{ d.receivedByName ?? '—' }} {{ d.receivedDate | appDate }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Supplier invoice</div><div>{{ d.supplierInvoiceNo ?? '—' }}</div></div>
          @if (d.cancelReason) {
            <div class="col-12"><div class="alert alert-warning mb-0 py-2">Cancelled {{ d.cancelledDate | appDate }}: {{ d.cancelReason }}</div></div>
          }
          @if (d.remarks) {
            <div class="col-12"><div class="text-muted small">Remarks</div><div>{{ d.remarks }}</div></div>
          }
        </div>
        <div class="table-responsive">
          <table class="table table-sm align-middle app-table mb-0">
            <thead>
              <tr>
                <th>Item</th><th class="text-end">Qty</th><th class="text-end">Received</th><th class="text-end">Unit cost</th>
                <th class="text-end">Tax</th><th class="text-end">Total</th><th>Batch</th><th>Mfg</th><th>Expiry</th>
              </tr>
            </thead>
            <tbody>
              @for (l of d.lines; track l.id) {
                <tr>
                  <td>{{ l.itemName }} <span class="text-muted small">{{ l.itemCode }}</span></td>
                  <td class="text-end">{{ l.quantity | appNumber: 3 }} {{ l.unitName }}</td>
                  <td class="text-end">{{ l.receivedQuantity | appNumber: 3 }}</td>
                  <td class="text-end">{{ l.unitCost | appCurrency }}</td>
                  <td class="text-end">{{ l.taxAmount | appCurrency }}</td>
                  <td class="text-end">{{ l.lineTotal | appCurrency }}</td>
                  <td>{{ l.batchNumber ?? '—' }}</td>
                  <td>{{ l.manufactureDate | appDate }}</td>
                  <td>{{ l.expiryDate | appDate }}</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr><td colspan="5" class="text-end text-muted">Sub total</td><td class="text-end">{{ d.subTotal | appCurrency }}</td><td colspan="3"></td></tr>
              <tr><td colspan="5" class="text-end text-muted">Tax</td><td class="text-end">{{ d.taxAmount | appCurrency }}</td><td colspan="3"></td></tr>
              @if (d.discountAmount > 0) {
                <tr><td colspan="5" class="text-end text-muted">Discount</td><td class="text-end">-{{ d.discountAmount | appCurrency }}</td><td colspan="3"></td></tr>
              }
              <tr><td colspan="5" class="text-end fw-semibold">Total</td><td class="text-end fw-semibold">{{ d.totalAmount | appCurrency }}</td><td colspan="3"></td></tr>
            </tfoot>
          </table>
        </div>
      }
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closed.emit()">Close</button>
      </div>
    </app-modal>
  `,
})
export class PurchaseDetailModalComponent {
  private readonly svc = inject(InventoryService);

  readonly purchaseId = input<number | null>(null);
  readonly closed = output<void>();

  readonly detail = signal<PurchaseDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private seq = 0;

  constructor() {
    effect(() => {
      const id = this.purchaseId();
      untracked(() => this.load(id));
    });
  }

  private load(id: number | null): void {
    const n = ++this.seq;
    this.detail.set(null);
    this.error.set(null);
    if (id === null) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.svc.purchase(id).subscribe({
      next: (d) => {
        if (n === this.seq) {
          this.detail.set(d);
          this.loading.set(false);
        }
      },
      error: (e) => {
        if (n === this.seq) {
          this.error.set(errorMessage(e));
          this.loading.set(false);
        }
      },
    });
  }
}
