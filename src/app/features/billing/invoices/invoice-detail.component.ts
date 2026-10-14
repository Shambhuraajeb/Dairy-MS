import { Component, OnInit, ViewEncapsulation, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppCurrencyPipe, AppDatePipe, AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { orNull } from '../../../shared/utils/paged-list';
import { InvoiceDetail } from '../billing.model';
import { BillingService } from '../billing.service';
import { RecordPaymentModalComponent } from '../payments/record-payment-modal.component';

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    ModalComponent,
    FormFieldComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    RecordPaymentModalComponent,
    AppCurrencyPipe,
    AppDatePipe,
    AppNumberPipe,
  ],
  styles: [
    `
      .invoice-sheet .invoice-brand {
        font-size: 1.25rem;
        font-weight: 700;
      }
      .invoice-sheet .invoice-totals {
        max-width: 340px;
        margin-left: auto;
      }
      @media print {
        app-sidebar,
        app-topbar,
        app-breadcrumb,
        .app-sidebar,
        .app-topbar,
        .app-breadcrumb,
        .sidebar-backdrop,
        .toast-stack,
        .no-print {
          display: none !important;
        }
        .app-main {
          margin-left: 0 !important;
        }
        .app-content {
          padding: 0 !important;
        }
        .invoice-sheet.card {
          border: 0 !important;
          box-shadow: none !important;
        }
        .invoice-sheet .table {
          font-size: 0.85rem;
        }
        body {
          background: #fff !important;
        }
      }
    `,
  ],
  template: `
    @if (loading()) {
      <app-loading text="Loading invoice..." />
    } @else if (error()) {
      <div class="card">
        <app-empty-state icon="bi-exclamation-octagon" title="Could not load invoice" [message]="error()!">
          <button type="button" class="btn btn-outline-primary btn-sm me-2" (click)="load()">Retry</button>
          <a routerLink="/billing/invoices" class="btn btn-light btn-sm">Back to invoices</a>
        </app-empty-state>
      </div>
    } @else if (invoice(); as inv) {
      <div class="no-print">
        <app-page-header [title]="'Invoice ' + inv.invoiceNumber" [subtitle]="inv.customerName + ' · ' + inv.invoiceType + ' invoice'">
          <a routerLink="/billing/invoices" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>Back</a>
          <button type="button" class="btn btn-outline-secondary" (click)="print()"><i class="bi bi-printer me-1"></i>Print</button>
          @if (canPay()) {
            <button *appHasPermission="'custpayment.create'" type="button" class="btn btn-success" (click)="payOpen.set(true)">
              <i class="bi bi-cash me-1"></i>Record payment
            </button>
          }
          @if (canCancel()) {
            <button *appHasPermission="'invoice.create'" type="button" class="btn btn-outline-danger" (click)="openCancel()">
              <i class="bi bi-x-circle me-1"></i>Cancel invoice
            </button>
          }
        </app-page-header>
      </div>

      @if (inv.status === 'Cancelled') {
        <div class="alert alert-danger py-2">
          <strong>Cancelled</strong>
          @if (inv.cancelledDate) {
            on {{ inv.cancelledDate | appDate }}
          }
          @if (inv.cancelReason) {
            - {{ inv.cancelReason }}
          }
        </div>
      }

      <div class="card invoice-sheet">
        <div class="card-body p-4">
          <div class="d-flex flex-wrap justify-content-between gap-3 mb-4">
            <div>
              <div class="invoice-brand"><i class="bi bi-droplet-half text-primary me-1"></i>Dairy Management System</div>
              <div class="text-muted small">Tax invoice</div>
            </div>
            <div class="text-md-end">
              <div class="h5 mb-1">{{ inv.invoiceNumber }}</div>
              @if (inv.isOverdue && inv.status !== 'Paid' && inv.status !== 'Cancelled') {
                <app-status-badge status="Overdue" />
              } @else {
                <app-status-badge [status]="inv.status" [color]="inv.status === 'Issued' ? 'info' : null" />
              }
            </div>
          </div>

          <div class="row g-3 mb-4">
            <div class="col-md-6">
              <div class="text-muted small text-uppercase">Bill to</div>
              <div class="fw-semibold">{{ inv.customerName }}</div>
              <div class="small">Customer code: {{ inv.customerCode }}</div>
              @if (inv.customerMobile) {
                <div class="small">Mobile: {{ inv.customerMobile }}</div>
              }
              @if (inv.customerGstNumber) {
                <div class="small">GSTIN: {{ inv.customerGstNumber }}</div>
              }
            </div>
            <div class="col-md-6">
              <dl class="row small mb-0">
                <dt class="col-6 col-md-5">Invoice date</dt><dd class="col-6 col-md-7 mb-1">{{ inv.invoiceDate | appDate }}</dd>
                <dt class="col-6 col-md-5">Due date</dt><dd class="col-6 col-md-7 mb-1">{{ inv.dueDate | appDate }}</dd>
                @if (inv.periodFrom || inv.periodTo) {
                  <dt class="col-6 col-md-5">Billing period</dt>
                  <dd class="col-6 col-md-7 mb-1">{{ inv.periodFrom | appDate }} - {{ inv.periodTo | appDate }}</dd>
                }
                <dt class="col-6 col-md-5">Orders</dt><dd class="col-6 col-md-7 mb-0">{{ inv.orderCount }}</dd>
              </dl>
            </div>
          </div>

          <div class="table-responsive">
            <table class="table table-sm align-middle app-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Description</th>
                  <th>Order</th>
                  <th class="text-end">Qty</th>
                  <th class="text-end">Rate</th>
                  <th class="text-end">Discount</th>
                  <th class="text-end">Tax</th>
                  <th class="text-end">Amount</th>
                </tr>
              </thead>
              <tbody>
                @for (l of inv.lines; track l.id; let i = $index) {
                  <tr>
                    <td>{{ i + 1 }}</td>
                    <td>{{ l.description }}</td>
                    <td>{{ l.orderNumber || '—' }}</td>
                    <td class="text-end">{{ l.quantity | appNumber: 3 }}</td>
                    <td class="text-end">{{ l.unitPrice | appCurrency }}</td>
                    <td class="text-end">{{ l.discountAmount | appCurrency }}</td>
                    <td class="text-end">{{ l.taxAmount | appCurrency }} <span class="text-muted small">({{ l.taxPercent }}%)</span></td>
                    <td class="text-end fw-semibold">{{ l.lineTotal | appCurrency }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="8" class="text-center text-muted py-3">No invoice lines</td></tr>
                }
              </tbody>
            </table>
          </div>

          <div class="invoice-totals mt-3">
            <div class="d-flex justify-content-between"><span class="text-muted">Sub total</span><span>{{ inv.subTotal | appCurrency }}</span></div>
            <div class="d-flex justify-content-between"><span class="text-muted">Discount</span><span>- {{ inv.discountAmount | appCurrency }}</span></div>
            <div class="d-flex justify-content-between"><span class="text-muted">Tax</span><span>{{ inv.taxAmount | appCurrency }}</span></div>
            <hr class="my-2" />
            <div class="d-flex justify-content-between fs-5 fw-bold"><span>Total</span><span>{{ inv.totalAmount | appCurrency }}</span></div>
            <div class="d-flex justify-content-between text-success"><span>Paid</span><span>{{ inv.paidAmount | appCurrency }}</span></div>
            <div class="d-flex justify-content-between fw-bold" [class.text-danger]="inv.balanceAmount > 0">
              <span>Balance due</span><span>{{ inv.balanceAmount | appCurrency }}</span>
            </div>
          </div>

          @if (inv.remarks) {
            <div class="small text-muted mt-3">Remarks: {{ inv.remarks }}</div>
          }

          <h2 class="section-title mt-4">Payments &amp; allocations</h2>
          @if (inv.payments.length === 0) {
            <p class="text-muted small mb-0">No payments have been allocated to this invoice.</p>
          } @else {
            <div class="table-responsive">
              <table class="table table-sm align-middle app-table mb-0">
                <thead>
                  <tr><th>Payment</th><th>Date</th><th>Mode</th><th>Reference</th><th class="text-end">Allocated</th></tr>
                </thead>
                <tbody>
                  @for (p of inv.payments; track p.id) {
                    <tr>
                      <td>{{ p.paymentNumber }}</td>
                      <td>{{ p.paymentDate | appDate }}</td>
                      <td>{{ p.paymentModeName || '—' }}</td>
                      <td>{{ p.referenceNo || '—' }}</td>
                      <td class="text-end fw-semibold">{{ p.amount | appCurrency }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>

      <app-record-payment-modal
        [open]="payOpen()"
        [customerId]="inv.customerId"
        [invoiceId]="inv.id"
        (closed)="payOpen.set(false)"
        (recorded)="reload()"
      />

      <app-modal [open]="cancelOpen()" title="Cancel invoice" (closed)="closeCancel()">
        <form id="cancelInvoiceForm" [formGroup]="cancelForm" (ngSubmit)="submitCancel()" novalidate>
          <p class="text-muted small">
            Only invoices without payments can be cancelled. The orders are released for re-invoicing and the customer balance is reversed.
          </p>
          <app-form-field label="Reason" inputId="ciReason" [control]="cancelForm.controls.reason">
            <textarea id="ciReason" class="form-control" rows="3" formControlName="reason" maxlength="255"></textarea>
          </app-form-field>
        </form>
        <div modal-footer>
          <button type="button" class="btn btn-light" (click)="closeCancel()">Keep invoice</button>
          <button type="submit" form="cancelInvoiceForm" class="btn btn-danger" [disabled]="busy()">Cancel invoice</button>
        </div>
      </app-modal>
    }
  `,
})
export class InvoiceDetailComponent implements OnInit {
  private readonly svc = inject(BillingService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly id = input.required<string>();

  readonly invoice = signal<InvoiceDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly payOpen = signal(false);
  readonly cancelOpen = signal(false);

  readonly cancelForm = this.fb.group({ reason: ['', Validators.maxLength(255)] });

  readonly canPay = computed(() => {
    const i = this.invoice();
    return !!i && i.balanceAmount > 0 && i.status !== 'Cancelled' && i.status !== 'Draft';
  });
  readonly canCancel = computed(() => {
    const i = this.invoice();
    return !!i && i.status === 'Issued' && i.paidAmount === 0 && i.payments.length === 0;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.getInvoice(this.id()).subscribe({
      next: (i) => {
        this.invoice.set(i);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  /** silent refresh after a payment */
  reload(): void {
    this.svc.getInvoice(this.id()).subscribe((i) => this.invoice.set(i));
  }

  print(): void {
    window.print();
  }

  openCancel(): void {
    this.cancelForm.reset({ reason: '' });
    this.cancelOpen.set(true);
  }

  closeCancel(): void {
    if (!this.busy()) {
      this.cancelOpen.set(false);
    }
  }

  submitCancel(): void {
    if (this.cancelForm.invalid) {
      this.cancelForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.svc.cancelInvoice(this.invoice()!.id, orNull(this.cancelForm.getRawValue().reason.trim())).subscribe({
      next: (i) => {
        this.invoice.set(i);
        this.busy.set(false);
        this.cancelOpen.set(false);
        this.toast.success('Invoice cancelled.');
      },
      error: () => this.busy.set(false),
    });
  }
}
