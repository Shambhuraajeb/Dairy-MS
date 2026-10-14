import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { AppCurrencyPipe, AppDatePipe, AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { DeliveryConfirmModalComponent } from '../components/delivery-confirm-modal.component';
import { DeliveryDetail } from '../delivery.model';
import { DeliveryService } from '../delivery.service';

@Component({
  selector: 'app-delivery-detail',
  standalone: true,
  imports: [
    RouterLink,
    PageHeaderComponent,
    StatusBadgeComponent,
    DeliveryConfirmModalComponent,
    AppDatePipe,
    AppCurrencyPipe,
    AppNumberPipe,
  ],
  template: `
    <app-page-header [title]="delivery() ? 'Delivery ' + delivery()!.deliveryNumber : 'Delivery'" subtitle="Delivery details and confirmation">
      <a routerLink="/delivery" class="btn btn-outline-secondary"><i class="bi bi-arrow-left me-1"></i>Deliveries</a>
      @if (delivery(); as d) {
        @if (d.status === 'Pending' && perm.has('delivery.update')) {
          <button type="button" class="btn btn-outline-info" (click)="dispatch(d)"><i class="bi bi-send me-1"></i>Dispatch</button>
        }
        @if ((d.status === 'Pending' || d.status === 'Dispatched') && perm.has('delivery.confirm')) {
          <button type="button" class="btn btn-success" (click)="openConfirm('deliver')"><i class="bi bi-check2-circle me-1"></i>Confirm delivered</button>
          <button type="button" class="btn btn-outline-danger" (click)="openConfirm('fail')"><i class="bi bi-x-circle me-1"></i>Mark failed</button>
        }
      }
    </app-page-header>

    @if (loading() && !delivery()) {
      <div class="text-center text-muted py-5"><span class="spinner-border spinner-border-sm me-2"></span>Loading delivery...</div>
    } @else if (error()) {
      <div class="card"><div class="card-body text-center py-5">
        <i class="bi bi-exclamation-octagon text-danger fs-3 d-block mb-2"></i>
        <div class="text-danger mb-2">{{ error() }}</div>
        <button type="button" class="btn btn-sm btn-outline-primary" (click)="reload()"><i class="bi bi-arrow-clockwise"></i> Retry</button>
      </div></div>
    } @else if (delivery(); as d) {
      <div class="row g-3 mb-3">
        <div class="col-lg-6">
          <div class="card h-100"><div class="card-body">
            <div class="section-title mb-3">Delivery</div>
            <dl class="row mb-0">
              <dt class="col-sm-4">Status</dt><dd class="col-sm-8"><app-status-badge [status]="d.status" /></dd>
              <dt class="col-sm-4">Order</dt>
              <dd class="col-sm-8">
                @if (perm.has('order.view')) {
                  <a [routerLink]="['/orders', d.salesOrderId]" class="text-decoration-none fw-semibold">{{ d.orderNumber }}</a>
                } @else {
                  {{ d.orderNumber }}
                }
                <span class="text-muted small">&middot; {{ d.orderTotal | appCurrency }}</span>
              </dd>
              <dt class="col-sm-4">Date / slot</dt><dd class="col-sm-8">{{ d.deliveryDate | appDate }} &middot; {{ d.deliverySlot }}</dd>
              <dt class="col-sm-4">Route</dt><dd class="col-sm-8">{{ d.routeName || '—' }}{{ d.sequenceNo ? ' (stop #' + d.sequenceNo + ')' : '' }}</dd>
              <dt class="col-sm-4">Schedule</dt>
              <dd class="col-sm-8">
                @if (d.deliveryScheduleId && perm.has('route.view')) {
                  <a [routerLink]="['/delivery/schedules']" [queryParams]="{ routeId: d.routeId, date: d.deliveryDate.slice(0, 10) }" class="text-decoration-none">#{{ d.deliveryScheduleId }}</a>
                } @else {
                  {{ d.deliveryScheduleId ? '#' + d.deliveryScheduleId : '—' }}
                }
              </dd>
              <dt class="col-sm-4">Driver</dt><dd class="col-sm-8">{{ d.driverName || 'Not assigned' }}</dd>
              <dt class="col-sm-4">Assigned user</dt><dd class="col-sm-8">{{ d.assignedUserName || '—' }}</dd>
              <dt class="col-sm-4">Dispatched</dt><dd class="col-sm-8">{{ d.dispatchedDate ? (d.dispatchedDate | appDate: 'datetime') : '—' }}</dd>
              <dt class="col-sm-4">Delivered</dt><dd class="col-sm-8">{{ d.deliveredDate ? (d.deliveredDate | appDate: 'datetime') : '—' }}</dd>
              @if (d.failureReason) {
                <dt class="col-sm-4 mt-2">Failure reason</dt><dd class="col-sm-8 mt-2 text-danger">{{ d.failureReason }}</dd>
              }
              <dt class="col-sm-4">Remarks</dt><dd class="col-sm-8 mb-0">{{ d.remarks || '—' }}</dd>
            </dl>
          </div></div>
        </div>
        <div class="col-lg-6">
          <div class="card h-100"><div class="card-body">
            <div class="section-title mb-3">Customer &amp; address</div>
            <dl class="row mb-0">
              <dt class="col-sm-4">Customer</dt><dd class="col-sm-8">{{ d.customerName }}</dd>
              <dt class="col-sm-4">Mobile</dt>
              <dd class="col-sm-8">
                @if (d.customerMobile) {
                  <a [href]="'tel:' + d.customerMobile" class="text-decoration-none">{{ d.customerMobile }}</a>
                } @else {
                  —
                }
              </dd>
              <dt class="col-sm-4">Address</dt><dd class="col-sm-8">{{ d.addressText || '—' }}</dd>
              <dt class="col-sm-4">Instructions</dt><dd class="col-sm-8 mb-0">{{ d.deliveryInstructions || '—' }}</dd>
            </dl>
          </div></div>
        </div>
      </div>

      @if (d.confirmation; as c) {
        <div class="card mb-3" [class.border-success]="c.outcome === 'Delivered'" [class.border-danger]="c.outcome === 'Failed'">
          <div class="card-body">
            <div class="section-title mb-3">Confirmation</div>
            <dl class="row mb-0">
              <dt class="col-sm-3">Outcome</dt><dd class="col-sm-9"><app-status-badge [status]="c.outcome" /></dd>
              <dt class="col-sm-3">Confirmed by</dt><dd class="col-sm-9">{{ c.confirmedByName || '—' }}</dd>
              <dt class="col-sm-3">Confirmed on</dt><dd class="col-sm-9">{{ c.confirmedDate | appDate: 'datetime' }}</dd>
              <dt class="col-sm-3">Delivered quantity</dt><dd class="col-sm-9">{{ c.deliveredQuantity | appNumber: 3 }}</dd>
              <dt class="col-sm-3">Received by</dt><dd class="col-sm-9">{{ c.receivedBy || '—' }}</dd>
              <dt class="col-sm-3">Collected amount</dt><dd class="col-sm-9">{{ c.collectedAmount === null ? '—' : (c.collectedAmount | appCurrency) }}</dd>
              <dt class="col-sm-3">Location</dt>
              <dd class="col-sm-9">
                @if (c.latitude !== null && c.longitude !== null) {
                  <a target="_blank" rel="noopener" class="text-decoration-none" [href]="'https://www.google.com/maps?q=' + c.latitude + ',' + c.longitude">
                    <i class="bi bi-geo-alt me-1"></i>{{ c.latitude }}, {{ c.longitude }}
                  </a>
                } @else {
                  Not captured
                }
              </dd>
              @if (c.failureReason) {
                <dt class="col-sm-3">Failure reason</dt><dd class="col-sm-9 text-danger">{{ c.failureReason }}</dd>
              }
              <dt class="col-sm-3">Remarks</dt><dd class="col-sm-9 mb-0">{{ c.remarks || '—' }}</dd>
            </dl>
          </div>
        </div>
      }

      <div class="card">
        <div class="card-body">
          <div class="section-title mb-3">Items</div>
          <div class="table-responsive">
            <table class="table align-middle app-table mb-0">
              <thead>
                <tr>
                  <th>Product</th>
                  <th class="text-end">Ordered</th>
                  <th class="text-end">Delivered</th>
                  <th class="text-end">Unit price</th>
                  <th class="text-end">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (l of d.lines; track l.id) {
                  <tr>
                    <td>
                      <div class="fw-semibold">{{ l.productName }}</div>
                      <div class="small text-muted">{{ l.productCode }}</div>
                    </td>
                    <td class="text-end">{{ l.quantity | appNumber: 3 }} {{ l.unitCode }}</td>
                    <td class="text-end">{{ l.deliveredQuantity | appNumber: 3 }}</td>
                    <td class="text-end">{{ l.unitPrice | appCurrency }}</td>
                    <td class="text-end fw-semibold">{{ l.lineTotal | appCurrency }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    }

    <app-delivery-confirm-modal
      [open]="confirmOpen()"
      [delivery]="delivery()"
      [mode]="mode()"
      (done)="onConfirmed($event)"
      (closed)="confirmOpen.set(false)"
    />
  `,
})
export class DeliveryDetailComponent {
  private readonly svc = inject(DeliveryService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  protected readonly perm = inject(PermissionService);

  readonly id = input.required<string>();

  readonly delivery = signal<DeliveryDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly confirmOpen = signal(false);
  readonly mode = signal<'deliver' | 'fail'>('deliver');

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => this.load(id));
    });
  }

  reload(): void {
    this.load(Number(this.id()));
  }

  private load(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.get(id).subscribe({
      next: (d) => {
        this.delivery.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.delivery.set(null);
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  async dispatch(d: DeliveryDetail): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Dispatch delivery',
      message: `Dispatch ${d.deliveryNumber} for ${d.customerName}?`,
      confirmText: 'Dispatch',
    });
    if (!ok) {
      return;
    }
    this.svc.dispatch(d.id).subscribe((updated) => {
      this.delivery.set(updated);
      this.toast.success('Delivery dispatched.');
    });
  }

  openConfirm(mode: 'deliver' | 'fail'): void {
    this.mode.set(mode);
    this.confirmOpen.set(true);
  }

  onConfirmed(updated: DeliveryDetail): void {
    this.confirmOpen.set(false);
    this.delivery.set(updated);
  }
}
