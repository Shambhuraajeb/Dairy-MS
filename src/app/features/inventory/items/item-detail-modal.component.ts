import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { errorMessage } from '../../../core/utils/http-error';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { AppCurrencyPipe, AppDatePipe, AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { InventoryItemDetail } from '../inventory.model';
import { InventoryService } from '../inventory.service';

@Component({
  selector: 'app-item-detail-modal',
  standalone: true,
  imports: [ModalComponent, LoadingComponent, StatusBadgeComponent, AppCurrencyPipe, AppDatePipe, AppNumberPipe],
  template: `
    <app-modal [open]="itemId() !== null" [title]="detail()?.name ?? 'Item details'" size="xl" (closed)="closed.emit()">
      @if (loading()) {
        <app-loading text="Loading item..." />
      } @else if (error()) {
        <div class="alert alert-danger mb-0">{{ error() }}</div>
      } @else if (detail(); as d) {
        <div class="row g-3 mb-3">
          <div class="col-md-3"><div class="text-muted small">Code</div><div class="fw-semibold">{{ d.itemCode }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Category</div><div>{{ d.categoryName }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Unit</div><div>{{ d.unitName }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Status</div><app-status-badge [status]="d.isActive" /></div>
          <div class="col-md-3">
            <div class="text-muted small">Current stock</div>
            <div class="fw-semibold">{{ d.currentStock | appNumber: 3 }} {{ d.unitName }} <app-status-badge [status]="d.stockStatus" /></div>
          </div>
          <div class="col-md-3"><div class="text-muted small">Reorder / Max level</div><div>{{ d.reorderLevel | appNumber: 3 }} / {{ d.maxStockLevel === null ? '—' : (d.maxStockLevel | appNumber: 3) }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Unit cost</div><div>{{ d.unitCost | appCurrency }} (tax {{ d.taxPercent | appNumber }}%)</div></div>
          <div class="col-md-3"><div class="text-muted small">Stock value</div><div>{{ d.stockValue | appCurrency }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Preferred supplier</div><div>{{ d.preferredSupplierName ?? '—' }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Storage</div><div>{{ d.storageLocation ?? '—' }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Barcode</div><div>{{ d.barcode ?? '—' }}</div></div>
          <div class="col-md-3"><div class="text-muted small">Nearest expiry</div><div>{{ d.nearestExpiryDate | appDate }}</div></div>
          @if (d.description) {
            <div class="col-12"><div class="text-muted small">Description</div><div>{{ d.description }}</div></div>
          }
        </div>
        <div class="d-flex gap-3 small text-muted mb-2">
          <span>{{ d.totalBatches }} batches</span><span>{{ d.availableBatches }} available</span>
          <span [class.text-danger]="d.expiredBatches > 0">{{ d.expiredBatches }} expired</span>
        </div>
        <div class="section-title">Batches</div>
        <div class="table-responsive">
          <table class="table table-sm align-middle app-table mb-0">
            <thead>
              <tr>
                <th>Batch</th><th>Received</th><th>Expiry</th><th class="text-end">Qty available</th><th class="text-end">Qty received</th>
                <th class="text-end">Unit cost</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (b of d.batches; track b.id) {
                <tr>
                  <td>{{ b.batchNumber }}</td>
                  <td>{{ b.receivedDate | appDate }}</td>
                  <td>
                    {{ b.expiryDate | appDate }}
                    @if (b.isExpired) {
                      <span class="badge badge-soft badge-soft-danger ms-1">Expired</span>
                    } @else if (b.daysToExpiry !== null && b.daysToExpiry <= 30) {
                      <span class="badge badge-soft badge-soft-warning ms-1">{{ b.daysToExpiry }}d left</span>
                    }
                  </td>
                  <td class="text-end">{{ b.quantityAvailable | appNumber: 3 }}</td>
                  <td class="text-end">{{ b.quantityReceived | appNumber: 3 }}</td>
                  <td class="text-end">{{ b.unitCost | appCurrency }}</td>
                  <td><app-status-badge [status]="b.status" /></td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="text-center text-muted py-3">No batches yet. Batches are created when a purchase is received.</td></tr>
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
export class ItemDetailModalComponent {
  private readonly svc = inject(InventoryService);

  readonly itemId = input<number | null>(null);
  readonly closed = output<void>();

  readonly detail = signal<InventoryItemDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private seq = 0;

  constructor() {
    effect(() => {
      const id = this.itemId();
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
    this.svc.item(id).subscribe({
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
