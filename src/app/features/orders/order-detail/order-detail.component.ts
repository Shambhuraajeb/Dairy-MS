import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { AppCurrencyPipe, AppDatePipe, AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { toIsoDate } from '../../../shared/utils/format';
import { ReasonModalComponent } from '../../collection/components/reason-modal.component';
import { CustomerAddressLite, ORDER_SLOTS, OrderDetail, OrderSlot, addressLabel } from '../order.model';
import { OrderService } from '../order.service';

interface TimelineStep {
  label: string;
  date: string | null;
  note?: string | null;
  state: 'done' | 'current' | 'todo' | 'bad';
}

const RANK: Record<string, number> = { Pending: 0, Confirmed: 1, Scheduled: 2, Dispatched: 3, Delivered: 4 };

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    ModalComponent,
    FormFieldComponent,
    StatusBadgeComponent,
    ReasonModalComponent,
    AppDatePipe,
    AppCurrencyPipe,
    AppNumberPipe,
  ],
  template: `
    <app-page-header [title]="order() ? 'Order ' + order()!.orderNumber : 'Order'" subtitle="Order details, delivery progress and totals">
      <a routerLink="/orders" class="btn btn-outline-secondary"><i class="bi bi-arrow-left me-1"></i>Orders</a>
      @if (order(); as o) {
        @if (canEdit()) {
          <button type="button" class="btn btn-outline-primary" (click)="openEdit()"><i class="bi bi-pencil me-1"></i>Edit</button>
        }
        @if (canCancel()) {
          <button type="button" class="btn btn-outline-danger" (click)="cancelOpen.set(true)"><i class="bi bi-x-circle me-1"></i>Cancel order</button>
        }
        @if (o.invoiceId && perm.has('invoice.view')) {
          <a [routerLink]="['/billing/invoices', o.invoiceId]" class="btn btn-outline-secondary"><i class="bi bi-receipt me-1"></i>{{ o.invoiceNumber }}</a>
        }
      }
    </app-page-header>

    @if (loading() && !order()) {
      <div class="text-center text-muted py-5"><span class="spinner-border spinner-border-sm me-2"></span>Loading order...</div>
    } @else if (error()) {
      <div class="card"><div class="card-body text-center py-5">
        <i class="bi bi-exclamation-octagon text-danger fs-3 d-block mb-2"></i>
        <div class="text-danger mb-2">{{ error() }}</div>
        <button type="button" class="btn btn-sm btn-outline-primary" (click)="reload()"><i class="bi bi-arrow-clockwise"></i> Retry</button>
      </div></div>
    } @else if (order(); as o) {
      <div class="card mb-3">
        <div class="card-body">
          <div class="section-title mb-3">Progress</div>
          <div class="d-flex flex-wrap gap-4">
            @for (s of steps(); track s.label) {
              <div class="d-flex align-items-start gap-2">
                <i
                  class="bi fs-4"
                  [class.bi-check-circle-fill]="s.state === 'done'"
                  [class.text-success]="s.state === 'done'"
                  [class.bi-record-circle]="s.state === 'current'"
                  [class.text-primary]="s.state === 'current'"
                  [class.bi-circle]="s.state === 'todo'"
                  [class.text-muted]="s.state === 'todo'"
                  [class.bi-x-circle-fill]="s.state === 'bad'"
                  [class.text-danger]="s.state === 'bad'"
                ></i>
                <div>
                  <div class="fw-semibold" [class.text-muted]="s.state === 'todo'">{{ s.label }}</div>
                  <div class="small text-muted">{{ s.date ? (s.date | appDate: 'datetime') : '' }}</div>
                  @if (s.note) {
                    <div class="small text-danger">{{ s.note }}</div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-lg-6">
          <div class="card h-100"><div class="card-body">
            <div class="section-title mb-3">Order</div>
            <dl class="row mb-0">
              <dt class="col-sm-4">Status</dt><dd class="col-sm-8"><app-status-badge [status]="o.status" /></dd>
              <dt class="col-sm-4">Customer</dt>
              <dd class="col-sm-8">
                @if (perm.has('customer.view')) {
                  <a [routerLink]="['/customers', o.customerId]" class="text-decoration-none">{{ o.customerName }}</a>
                } @else {
                  {{ o.customerName }}
                }
                <span class="text-muted small">({{ o.customerCode }})</span>
              </dd>
              <dt class="col-sm-4">Address</dt><dd class="col-sm-8">{{ o.addressText || '—' }}</dd>
              <dt class="col-sm-4">Order date</dt><dd class="col-sm-8">{{ o.orderDate | appDate }}</dd>
              <dt class="col-sm-4">Delivery</dt><dd class="col-sm-8">{{ o.deliveryDate | appDate }} &middot; {{ o.deliverySlot }}</dd>
              <dt class="col-sm-4">Route</dt><dd class="col-sm-8">{{ o.routeName || '—' }}</dd>
              <dt class="col-sm-4">Source</dt><dd class="col-sm-8">{{ o.source }}</dd>
              <dt class="col-sm-4">Payment</dt><dd class="col-sm-8"><app-status-badge [status]="o.paymentStatus" /></dd>
              <dt class="col-sm-4">Remarks</dt><dd class="col-sm-8 mb-0">{{ o.remarks || '—' }}</dd>
              @if (o.cancelReason) {
                <dt class="col-sm-4 mt-2">Cancel reason</dt><dd class="col-sm-8 mt-2 mb-0 text-danger">{{ o.cancelReason }}</dd>
              }
            </dl>
          </div></div>
        </div>
        <div class="col-lg-6">
          <div class="card h-100"><div class="card-body">
            <div class="section-title mb-3">Delivery</div>
            @if (o.delivery; as d) {
              <dl class="row mb-0">
                <dt class="col-sm-4">Delivery #</dt>
                <dd class="col-sm-8">
                  @if (perm.has('delivery.view')) {
                    <a [routerLink]="['/delivery', d.id]" class="text-decoration-none fw-semibold">{{ d.deliveryNumber }}</a>
                  } @else {
                    {{ d.deliveryNumber }}
                  }
                </dd>
                <dt class="col-sm-4">Status</dt><dd class="col-sm-8"><app-status-badge [status]="d.status" /></dd>
                <dt class="col-sm-4">Route</dt><dd class="col-sm-8">{{ d.routeName || '—' }}</dd>
                <dt class="col-sm-4">Driver</dt><dd class="col-sm-8">{{ d.driverName || 'Not assigned' }}</dd>
                <dt class="col-sm-4">Dispatched</dt><dd class="col-sm-8">{{ d.dispatchedDate ? (d.dispatchedDate | appDate: 'datetime') : '—' }}</dd>
                <dt class="col-sm-4">Delivered</dt><dd class="col-sm-8">{{ d.deliveredDate ? (d.deliveredDate | appDate: 'datetime') : '—' }}</dd>
                @if (d.failureReason) {
                  <dt class="col-sm-4 mt-2">Failure reason</dt><dd class="col-sm-8 mt-2 mb-0 text-danger">{{ d.failureReason }}</dd>
                }
              </dl>
            } @else {
              <div class="text-muted">This order has not been assigned to a delivery schedule yet.</div>
              @if (['Pending', 'Confirmed', 'Failed'].includes(o.status) && perm.has('delivery.update')) {
                <a routerLink="/delivery" class="btn btn-sm btn-outline-primary mt-3"><i class="bi bi-truck me-1"></i>Assign in deliveries</a>
              }
            }
          </div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="section-title mb-3">Items</div>
          <div class="table-responsive">
            <table class="table align-middle app-table mb-3">
              <thead>
                <tr>
                  <th>Product</th>
                  <th class="text-end">Qty</th>
                  <th class="text-end">Delivered</th>
                  <th class="text-end">Unit price</th>
                  <th class="text-end">Discount</th>
                  <th class="text-end">Tax %</th>
                  <th class="text-end">Tax</th>
                  <th class="text-end">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (l of o.lines; track l.id) {
                  <tr>
                    <td>
                      <div class="fw-semibold">{{ l.productName }}</div>
                      <div class="small text-muted">{{ l.productCode }}</div>
                    </td>
                    <td class="text-end">{{ l.quantity | appNumber: 3 }} {{ l.unitCode }}</td>
                    <td class="text-end">{{ l.deliveredQuantity | appNumber: 3 }}</td>
                    <td class="text-end">{{ l.unitPrice | appCurrency }}</td>
                    <td class="text-end">{{ l.discountAmount | appCurrency }}</td>
                    <td class="text-end">{{ l.taxPercent | appNumber }}</td>
                    <td class="text-end">{{ l.taxAmount | appCurrency }}</td>
                    <td class="text-end fw-semibold">{{ l.lineTotal | appCurrency }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="row justify-content-end">
            <div class="col-md-5 col-lg-4">
              <div class="d-flex justify-content-between"><span class="text-muted">Subtotal</span><span>{{ o.subTotal | appCurrency }}</span></div>
              <div class="d-flex justify-content-between"><span class="text-muted">Discount</span><span>{{ o.discountAmount | appCurrency }}</span></div>
              <div class="d-flex justify-content-between"><span class="text-muted">Tax</span><span>{{ o.taxAmount | appCurrency }}</span></div>
              <div class="d-flex justify-content-between"><span class="text-muted">Delivery charge</span><span>{{ o.deliveryCharge | appCurrency }}</span></div>
              <hr class="my-2" />
              <div class="d-flex justify-content-between fs-5 fw-semibold"><span>Total</span><span>{{ o.totalAmount | appCurrency }}</span></div>
              <div class="d-flex justify-content-between"><span class="text-muted">Paid</span><span>{{ o.paidAmount | appCurrency }}</span></div>
              <div class="d-flex justify-content-between"><span class="text-muted">Balance</span><span>{{ o.totalAmount - o.paidAmount | appCurrency }}</span></div>
            </div>
          </div>
        </div>
      </div>
    }

    <app-modal [open]="editOpen()" title="Edit Order" (closed)="closeEdit()">
      <form id="orderEditForm" [formGroup]="editForm" (ngSubmit)="saveEdit()" novalidate>
        <app-form-field label="Delivery address" inputId="oeAddress" [control]="editForm.controls.customerAddressId">
          <select id="oeAddress" class="form-select" formControlName="customerAddressId">
            <option [ngValue]="null">Keep current / default</option>
            @for (a of addresses(); track a.id) {
              <option [ngValue]="a.id">{{ label(a) }}</option>
            }
          </select>
        </app-form-field>
        <div class="row">
          <div class="col-7">
            <app-form-field label="Delivery date" inputId="oeDate" [control]="editForm.controls.deliveryDate" [messages]="{ min: 'Delivery date cannot be in the past.' }">
              <input id="oeDate" type="date" class="form-control" formControlName="deliveryDate" [min]="today" />
            </app-form-field>
          </div>
          <div class="col-5">
            <app-form-field label="Slot" inputId="oeSlot" [control]="editForm.controls.deliverySlot">
              <select id="oeSlot" class="form-select" formControlName="deliverySlot">
                @for (s of slots; track s) {
                  <option [value]="s">{{ s }}</option>
                }
              </select>
            </app-form-field>
          </div>
        </div>
        <app-form-field label="Remarks" inputId="oeRemarks" [control]="editForm.controls.remarks">
          <textarea id="oeRemarks" class="form-control" rows="2" maxlength="500" formControlName="remarks"></textarea>
        </app-form-field>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeEdit()">Cancel</button>
        <button type="submit" form="orderEditForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>

    <app-reason-modal
      [open]="cancelOpen()"
      title="Cancel order"
      message="This cancels the order and any pending delivery. This cannot be undone."
      label="Reason for cancellation"
      confirmText="Cancel order"
      [saving]="saving()"
      (confirmed)="doCancel($event)"
      (closed)="cancelOpen.set(false)"
    />
  `,
})
export class OrderDetailComponent {
  private readonly svc = inject(OrderService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toast = inject(ToastService);
  protected readonly perm = inject(PermissionService);

  readonly id = input.required<string>();

  readonly today = toIsoDate();
  readonly slots = ORDER_SLOTS;
  readonly order = signal<OrderDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly editOpen = signal(false);
  readonly cancelOpen = signal(false);
  readonly addresses = signal<CustomerAddressLite[]>([]);

  readonly editForm = this.fb.group({
    customerAddressId: this.fb.control<number | null>(null),
    deliveryDate: [this.today, Validators.required],
    deliverySlot: ['Morning' as OrderSlot, Validators.required],
    remarks: ['', Validators.maxLength(500)],
  });

  readonly canEdit = computed(() => {
    const o = this.order();
    return !!o && ['Pending', 'Confirmed'].includes(o.status) && !o.invoiceId && this.perm.has('order.update');
  });

  readonly canCancel = computed(() => {
    const o = this.order();
    return (
      !!o &&
      ['Pending', 'Confirmed', 'Scheduled', 'Failed'].includes(o.status) &&
      !o.invoiceId &&
      this.perm.hasAny('order.update', 'order.create')
    );
  });

  readonly steps = computed<TimelineStep[]>(() => {
    const o = this.order();
    if (!o) {
      return [];
    }
    const d = o.delivery;
    const base = [
      { label: 'Placed', date: o.createdDate as string | null },
      { label: 'Confirmed', date: o.confirmedDate },
      { label: 'Scheduled', date: null as string | null },
      { label: 'Dispatched', date: d?.dispatchedDate ?? null },
      { label: 'Delivered', date: d?.deliveredDate ?? null },
    ];
    const terminalBad = o.status === 'Cancelled' || o.status === 'Failed';
    let reached: number;
    if (o.status === 'Cancelled') {
      reached = o.confirmedDate ? 1 : 0;
    } else if (o.status === 'Failed') {
      reached = 3;
    } else {
      reached = RANK[o.status] ?? 0;
    }
    const steps: TimelineStep[] = base.map((s, i) => {
      let state: TimelineStep['state'] = 'todo';
      if (terminalBad) {
        state = i <= reached ? 'done' : 'todo';
      } else if (o.status === 'Delivered' || i < reached) {
        state = 'done';
      } else if (i === reached) {
        state = 'current';
      }
      return { ...s, state };
    });
    if (terminalBad) {
      const kept = steps.slice(0, reached + 1);
      kept.push({
        label: o.status,
        date: o.status === 'Cancelled' ? o.cancelledDate : (d?.deliveredDate ?? null),
        note: o.status === 'Cancelled' ? o.cancelReason : d?.failureReason,
        state: 'bad',
      });
      return kept;
    }
    return steps;
  });

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => this.load(id));
    });
  }

  label(a: CustomerAddressLite): string {
    return addressLabel(a);
  }

  reload(): void {
    this.load(Number(this.id()));
  }

  private load(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.get(id).subscribe({
      next: (o) => {
        this.order.set(o);
        this.loading.set(false);
      },
      error: (err) => {
        this.order.set(null);
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  openEdit(): void {
    const o = this.order();
    if (!o) {
      return;
    }
    this.editForm.reset({
      customerAddressId: o.customerAddressId,
      deliveryDate: o.deliveryDate.slice(0, 10),
      deliverySlot: o.deliverySlot,
      remarks: o.remarks ?? '',
    });
    this.addresses.set([]);
    this.svc.customerAddresses(o.customerId).subscribe({
      next: (list) => this.addresses.set(list),
      error: () => this.addresses.set([]),
    });
    this.editOpen.set(true);
  }

  closeEdit(): void {
    if (!this.saving()) {
      this.editOpen.set(false);
    }
  }

  saveEdit(): void {
    const o = this.order();
    if (!o) {
      return;
    }
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const v = this.editForm.getRawValue();
    this.saving.set(true);
    this.svc
      .update(o.id, {
        customerAddressId: v.customerAddressId,
        deliveryDate: v.deliveryDate,
        deliverySlot: v.deliverySlot,
        remarks: v.remarks.trim() || null,
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.editOpen.set(false);
          this.order.set(updated);
          this.toast.success('Order updated.');
        },
        error: () => this.saving.set(false),
      });
  }

  doCancel(reason: string): void {
    const o = this.order();
    if (!o) {
      return;
    }
    this.saving.set(true);
    this.svc.cancel(o.id, reason).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.cancelOpen.set(false);
        this.order.set(updated);
        this.toast.success('Order cancelled.');
      },
      error: () => this.saving.set(false),
    });
  }
}
