import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { PermissionService } from '../../../../core/services/permission.service';
import { errorMessage } from '../../../../core/utils/http-error';
import { AppCurrencyPipe, AppDatePipe } from '../../../../shared/pipes/app-pipes';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { Customer, CustomerSummary } from '../../customer.model';
import { CustomerService } from '../../customer.service';

@Component({
  selector: 'app-customer-overview-tab',
  standalone: true,
  imports: [KpiCardComponent, EmptyStateComponent, AppCurrencyPipe, AppDatePipe],
  template: `
    @if (error()) {
      <div class="card">
        <app-empty-state icon="bi-exclamation-octagon" title="Could not load summary" [message]="error()!">
          <button type="button" class="btn btn-outline-primary btn-sm" (click)="load()">Retry</button>
        </app-empty-state>
      </div>
    } @else {
      @let s = summary();
      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Active subscriptions" [value]="s?.activeSubscriptions" icon="bi-calendar-check" color="success" [loading]="loading()"
            [subtitle]="(s?.pausedSubscriptions ?? 0) + ' paused'" [link]="subsLink()" [queryParams]="{ customerId: customer().id }" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Total orders" [value]="s?.totalOrders" icon="bi-bag" color="primary" [loading]="loading()"
            [subtitle]="(s?.pendingOrders ?? 0) + ' pending, ' + (s?.deliveredOrders ?? 0) + ' delivered'"
            [link]="ordersLink()" [queryParams]="{ customerId: customer().id }" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Total invoiced" [value]="s?.totalInvoiced" format="currency" icon="bi-receipt" color="info" [loading]="loading()"
            [subtitle]="(s?.openInvoices ?? 0) + ' open invoices'" [link]="invoicesLink()" [queryParams]="{ customerId: customer().id }" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Outstanding" [value]="s?.outstandingAmount" format="currency" icon="bi-hourglass-split" color="warning" [loading]="loading()"
            [subtitle]="'Overdue ' + ((s?.overdueAmount ?? 0) | appCurrency:'INR':0)" [link]="outstandingLink()" [queryParams]="{ customerId: customer().id }" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Overdue amount" [value]="s?.overdueAmount" format="currency" icon="bi-exclamation-triangle" color="danger" [loading]="loading()"
            [link]="invoicesLink()" [queryParams]="{ customerId: customer().id, status: 'Overdue' }" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Unallocated credit" [value]="s?.unallocatedCredit" format="currency" icon="bi-wallet2" color="secondary" [loading]="loading()" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Last payment" [value]="s?.lastPaymentAmount" format="currency" icon="bi-cash-stack" color="success" [loading]="loading()"
            [subtitle]="s?.lastPaymentDate ? (s!.lastPaymentDate | appDate) : 'No payments yet'" [link]="paymentsLink()" [queryParams]="{ customerId: customer().id }" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Open complaints" [value]="s?.openComplaints" icon="bi-chat-left-dots" color="danger" [loading]="loading()"
            [link]="complaintsLink()" [queryParams]="{ customerId: customer().id }" />
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <h2 class="section-title">Profile</h2>
          @let c = customer();
          <dl class="row mb-0">
            <dt class="col-sm-3">Type</dt><dd class="col-sm-9">{{ c.customerType }}</dd>
            <dt class="col-sm-3">Contact person</dt><dd class="col-sm-9">{{ c.contactPerson || '—' }}</dd>
            <dt class="col-sm-3">Mobile</dt>
            <dd class="col-sm-9">{{ c.mobile }}@if (c.alternateMobile) { <span class="text-muted"> / {{ c.alternateMobile }}</span> }</dd>
            <dt class="col-sm-3">Email</dt><dd class="col-sm-9">{{ c.email || '—' }}</dd>
            <dt class="col-sm-3">GST number</dt><dd class="col-sm-9">{{ c.gstNumber || '—' }}</dd>
            <dt class="col-sm-3">Branch</dt><dd class="col-sm-9">{{ c.branchName || '—' }}</dd>
            <dt class="col-sm-3">Credit limit</dt><dd class="col-sm-9">{{ c.creditLimit | appCurrency }} <span class="text-muted">({{ c.creditDays }} days)</span></dd>
            <dt class="col-sm-3">Discount</dt><dd class="col-sm-9">{{ c.discountPercent }}%</dd>
            <dt class="col-sm-3">Joined</dt><dd class="col-sm-9">{{ c.joinDate | appDate }}</dd>
            <dt class="col-sm-3">Last order</dt><dd class="col-sm-9">{{ s?.lastOrderDate | appDate }}</dd>
            <dt class="col-sm-3">Notes</dt><dd class="col-sm-9 mb-0">{{ c.notes || '—' }}</dd>
          </dl>
        </div>
      </div>
    }
  `,
})
export class CustomerOverviewTabComponent implements OnInit {
  private readonly svc = inject(CustomerService);
  private readonly perm = inject(PermissionService);

  readonly customer = input.required<Customer>();

  readonly summary = signal<CustomerSummary | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly subsLink = computed(() => (this.perm.has('subscription.view') ? '/subscriptions' : null));
  readonly ordersLink = computed(() => (this.perm.has('order.view') ? '/orders' : null));
  readonly invoicesLink = computed(() => (this.perm.has('invoice.view') ? '/billing/invoices' : null));
  readonly outstandingLink = computed(() => (this.perm.has('invoice.view') ? '/billing/outstanding' : null));
  readonly paymentsLink = computed(() => (this.perm.has('custpayment.view') ? '/billing/payments' : null));
  readonly complaintsLink = computed(() => (this.perm.has('complaint.view') ? '/customers/complaints' : null));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.summary(this.customer().id).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
