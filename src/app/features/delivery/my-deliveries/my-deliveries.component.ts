import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppCurrencyPipe, AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { toIsoDate } from '../../../shared/utils/format';
import { DeliveryConfirmModalComponent } from '../components/delivery-confirm-modal.component';
import { DeliveryListItem } from '../delivery.model';
import { DeliveryService } from '../delivery.service';

@Component({
  selector: 'app-my-deliveries',
  standalone: true,
  imports: [
    RouterLink,
    PageHeaderComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    DeliveryConfirmModalComponent,
    AppCurrencyPipe,
    AppNumberPipe,
  ],
  template: `
    <app-page-header title="My Deliveries" subtitle="Your assigned stops for the selected day">
      <input type="date" class="form-control w-auto" [value]="date()" (change)="onDate($event)" aria-label="Delivery date" />
      <button type="button" class="btn btn-outline-secondary" (click)="load()" [disabled]="loading()">
        <i class="bi bi-arrow-clockwise"></i><span class="d-none d-sm-inline ms-1">Refresh</span>
      </button>
    </app-page-header>

    <div class="row g-2 mb-3">
      <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2 text-center"><div class="fs-4 fw-semibold">{{ items().length }}</div><div class="small text-muted">Total stops</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2 text-center"><div class="fs-4 fw-semibold text-warning">{{ remaining() }}</div><div class="small text-muted">Remaining</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2 text-center"><div class="fs-4 fw-semibold text-success">{{ delivered() }}</div><div class="small text-muted">Delivered</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2 text-center"><div class="fs-4 fw-semibold text-danger">{{ failed() }}</div><div class="small text-muted">Failed</div></div></div></div>
    </div>

    @if (loading() && items().length === 0) {
      <div class="text-center text-muted py-5"><span class="spinner-border spinner-border-sm me-2"></span>Loading deliveries...</div>
    } @else if (error()) {
      <div class="card"><div class="card-body text-center py-5">
        <i class="bi bi-exclamation-octagon text-danger fs-3 d-block mb-2"></i>
        <div class="text-danger mb-2">{{ error() }}</div>
        <button type="button" class="btn btn-sm btn-outline-primary" (click)="load()"><i class="bi bi-arrow-clockwise"></i> Retry</button>
      </div></div>
    } @else if (items().length === 0) {
      <div class="card"><div class="card-body text-center text-muted py-5">
        <i class="bi bi-truck fs-1 d-block mb-2"></i>
        No deliveries assigned to you for this date.
      </div></div>
    } @else {
      <div class="row g-3">
        @for (d of items(); track d.id) {
          <div class="col-12 col-md-6 col-xl-4">
            <div class="card h-100" [class.border-success]="d.status === 'Delivered'" [class.border-danger]="d.status === 'Failed'">
              <div class="card-header d-flex justify-content-between align-items-center">
                <div class="fw-semibold">
                  @if (d.sequenceNo) {
                    <span class="badge text-bg-dark me-1">#{{ d.sequenceNo }}</span>
                  }
                  {{ d.deliverySlot }}
                  @if (d.routeName) {
                    <span class="text-muted fw-normal small"> &middot; {{ d.routeName }}</span>
                  }
                </div>
                <app-status-badge [status]="d.status" />
              </div>
              <div class="card-body">
                <div class="fs-5 fw-semibold">{{ d.customerName }}</div>
                @if (d.customerMobile) {
                  <a [href]="'tel:' + d.customerMobile" class="text-decoration-none d-inline-block mb-2"><i class="bi bi-telephone me-1"></i>{{ d.customerMobile }}</a>
                }
                <div class="mb-1"><i class="bi bi-geo-alt me-1 text-muted"></i>{{ d.addressText || 'No address on file' }}</div>
                @if (d.deliveryInstructions) {
                  <div class="alert alert-info py-1 px-2 small mb-2"><i class="bi bi-info-circle me-1"></i>{{ d.deliveryInstructions }}</div>
                }
                <div class="d-flex justify-content-between small text-muted mt-2">
                  <span>{{ d.orderNumber }} &middot; Qty {{ d.totalQuantity | appNumber: 3 }}</span>
                  <span class="fw-semibold text-body">{{ d.orderTotal | appCurrency }}</span>
                </div>
                @if (d.status === 'Failed' && d.failureReason) {
                  <div class="small text-danger mt-2">Failed: {{ d.failureReason }}</div>
                }
              </div>
              <div class="card-footer bg-transparent">
                <div class="d-grid gap-2">
                  @if (d.status === 'Pending') {
                    <button *appHasPermission="'delivery.update'" type="button" class="btn btn-outline-info btn-lg" (click)="dispatch(d)">
                      <i class="bi bi-send me-1"></i>Start / Dispatch
                    </button>
                  }
                  @if (d.status === 'Pending' || d.status === 'Dispatched') {
                    <div class="row g-2">
                      <div class="col-7">
                        <button type="button" class="btn btn-success btn-lg w-100" (click)="openConfirm(d, 'deliver')">
                          <i class="bi bi-check2-circle me-1"></i>Delivered
                        </button>
                      </div>
                      <div class="col-5">
                        <button type="button" class="btn btn-outline-danger btn-lg w-100" (click)="openConfirm(d, 'fail')">
                          <i class="bi bi-x-circle me-1"></i>Failed
                        </button>
                      </div>
                    </div>
                  }
                  <div class="d-flex gap-2">
                    <a class="btn btn-outline-secondary flex-fill" target="_blank" rel="noopener" [href]="mapUrl(d)"><i class="bi bi-map me-1"></i>Navigate</a>
                    <a class="btn btn-outline-secondary flex-fill" [routerLink]="['/delivery', d.id]"><i class="bi bi-card-list me-1"></i>Details</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    }

    <app-delivery-confirm-modal
      [open]="confirmOpen()"
      [delivery]="target()"
      [mode]="mode()"
      (done)="onConfirmed()"
      (closed)="confirmOpen.set(false)"
    />
  `,
})
export class MyDeliveriesComponent {
  private readonly svc = inject(DeliveryService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly date = signal(toIsoDate());
  readonly items = signal<DeliveryListItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly delivered = computed(() => this.items().filter((d) => d.status === 'Delivered').length);
  readonly failed = computed(() => this.items().filter((d) => d.status === 'Failed').length);
  readonly remaining = computed(() => this.items().filter((d) => d.status === 'Pending' || d.status === 'Dispatched').length);

  readonly confirmOpen = signal(false);
  readonly target = signal<DeliveryListItem | null>(null);
  readonly mode = signal<'deliver' | 'fail'>('deliver');

  constructor() {
    this.load();
  }

  onDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) {
      this.date.set(value);
      this.load();
    }
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.my(this.date()).subscribe({
      next: (list) => {
        this.items.set(list ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  mapUrl(d: DeliveryListItem): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.addressText || d.customerName)}`;
  }

  async dispatch(d: DeliveryListItem): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Start delivery',
      message: `Mark ${d.deliveryNumber} for ${d.customerName} as dispatched?`,
      confirmText: 'Dispatch',
    });
    if (!ok) {
      return;
    }
    this.svc.dispatch(d.id).subscribe(() => {
      this.toast.success('Marked as dispatched.');
      this.load();
    });
  }

  openConfirm(d: DeliveryListItem, mode: 'deliver' | 'fail'): void {
    this.target.set(d);
    this.mode.set(mode);
    this.confirmOpen.set(true);
  }

  onConfirmed(): void {
    this.confirmOpen.set(false);
    this.load();
  }
}
