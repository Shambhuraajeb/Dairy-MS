import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AppCurrencyPipe } from '../../../shared/pipes/app-pipes';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { Customer, RelatedKind } from '../customer.model';
import { CustomerService } from '../customer.service';
import { CustomerAddressesTabComponent } from './tabs/customer-addresses-tab.component';
import { CustomerOverviewTabComponent } from './tabs/customer-overview-tab.component';
import { CustomerRelatedTabComponent } from './tabs/customer-related-tab.component';

type TabKey = 'overview' | 'addresses' | RelatedKind;

interface TabDef {
  key: TabKey;
  label: string;
  icon: string;
  permission?: string;
}

const TABS: TabDef[] = [
  { key: 'overview', label: 'Overview', icon: 'bi-speedometer2' },
  { key: 'addresses', label: 'Addresses', icon: 'bi-geo-alt' },
  { key: 'subscriptions', label: 'Subscriptions', icon: 'bi-calendar-check', permission: 'subscription.view' },
  { key: 'orders', label: 'Orders', icon: 'bi-bag', permission: 'order.view' },
  { key: 'invoices', label: 'Invoices', icon: 'bi-receipt', permission: 'invoice.view' },
  { key: 'payments', label: 'Payments', icon: 'bi-cash-stack', permission: 'custpayment.view' },
  { key: 'complaints', label: 'Complaints', icon: 'bi-chat-left-dots', permission: 'complaint.view' },
];

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [
    RouterLink,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    AppCurrencyPipe,
    CustomerOverviewTabComponent,
    CustomerAddressesTabComponent,
    CustomerRelatedTabComponent,
  ],
  template: `
    @if (loading()) {
      <app-loading text="Loading customer..." />
    } @else if (error()) {
      <div class="card">
        <app-empty-state icon="bi-exclamation-octagon" title="Could not load customer" [message]="error()!">
          <button type="button" class="btn btn-outline-primary btn-sm me-2" (click)="load()">Retry</button>
          <a routerLink="/customers" class="btn btn-light btn-sm">Back to customers</a>
        </app-empty-state>
      </div>
    } @else if (customer(); as c) {
      <app-page-header [title]="c.name" [subtitle]="c.customerCode + ' · ' + c.customerType + ' · ' + c.mobile">
        @if (canList()) {
          <a routerLink="/customers" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>Back</a>
        }
        <ng-container *appHasPermission="'customer.update'">
          <a [routerLink]="['/customers', c.id, 'edit']" class="btn btn-outline-secondary"><i class="bi bi-pencil me-1"></i>Edit</a>
          @if (c.status === 'Active') {
            <button type="button" class="btn btn-outline-danger" [disabled]="busy()" (click)="deactivate()">
              <i class="bi bi-slash-circle me-1"></i>Deactivate
            </button>
          } @else {
            <button type="button" class="btn btn-success" [disabled]="busy()" (click)="activate()">
              <i class="bi bi-check-circle me-1"></i>Activate
            </button>
          }
        </ng-container>
        <a *appHasPermission="'subscription.create'" routerLink="/subscriptions/new" [queryParams]="{ customerId: c.id }" class="btn btn-primary">
          <i class="bi bi-plus-lg me-1"></i>New subscription
        </a>
      </app-page-header>

      <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
        <span class="text-muted small">Status</span><app-status-badge [status]="c.status" />
        @if (c.outstandingBalance > 0) {
          <span class="badge badge-soft badge-soft-warning ms-2">Outstanding {{ c.outstandingBalance | appCurrency }}</span>
        }
        @if (c.email) {
          <span class="text-muted small ms-2"><i class="bi bi-envelope me-1"></i>{{ c.email }}</span>
        }
      </div>

      <ul class="nav nav-tabs mb-3 flex-nowrap overflow-auto">
        @for (t of tabs(); track t.key) {
          <li class="nav-item">
            <button type="button" class="nav-link text-nowrap" [class.active]="tab() === t.key" (click)="tab.set(t.key)">
              <i class="bi {{ t.icon }} me-1"></i>{{ t.label }}
            </button>
          </li>
        }
      </ul>

      @switch (tab()) {
        @case ('overview') {
          <app-customer-overview-tab [customer]="c" />
        }
        @case ('addresses') {
          <app-customer-addresses-tab [customerId]="c.id" />
        }
        @case ('subscriptions') {
          <app-customer-related-tab [customerId]="c.id" kind="subscriptions" />
        }
        @case ('orders') {
          <app-customer-related-tab [customerId]="c.id" kind="orders" />
        }
        @case ('invoices') {
          <app-customer-related-tab [customerId]="c.id" kind="invoices" />
        }
        @case ('payments') {
          <app-customer-related-tab [customerId]="c.id" kind="payments" />
        }
        @case ('complaints') {
          <app-customer-related-tab [customerId]="c.id" kind="complaints" />
        }
      }
    }
  `,
})
export class CustomerDetailComponent implements OnInit {
  private readonly svc = inject(CustomerService);
  private readonly perm = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly id = input.required<string>();

  readonly customer = signal<Customer | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly tab = signal<TabKey>('overview');
  readonly tabs = computed(() => TABS.filter((t) => this.perm.check(t.permission)));
  readonly canList = computed(() => this.perm.has('customer.view'));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.get(this.id()).subscribe({
      next: (c) => {
        this.customer.set(c);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  async activate(): Promise<void> {
    const c = this.customer()!;
    const ok = await this.confirmService.confirm({
      title: 'Activate customer',
      message: `Activate ${c.name}? Active customers can order and subscribe.`,
      confirmText: 'Activate',
      variant: 'primary',
    });
    if (!ok) {
      return;
    }
    this.busy.set(true);
    this.svc.activate(c.id).subscribe({
      next: (updated) => {
        this.customer.set(updated);
        this.busy.set(false);
        this.toast.success('Customer activated.');
      },
      error: () => this.busy.set(false),
    });
  }

  async deactivate(): Promise<void> {
    const c = this.customer()!;
    const ok = await this.confirmService.confirm({
      title: 'Deactivate customer',
      message: `Deactivate ${c.name}? They will no longer be able to place new orders.`,
      confirmText: 'Deactivate',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    this.busy.set(true);
    this.svc.deactivate(c.id).subscribe({
      next: (updated) => {
        this.customer.set(updated);
        this.busy.set(false);
        this.toast.success('Customer deactivated.');
      },
      error: () => this.busy.set(false),
    });
  }
}
