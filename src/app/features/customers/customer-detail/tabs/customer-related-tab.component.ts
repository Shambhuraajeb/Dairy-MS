import { Component, OnInit, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PermissionService } from '../../../../core/services/permission.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { AppCurrencyPipe } from '../../../../shared/pipes/app-pipes';
import { PagedList } from '../../../../shared/utils/paged-list';
import { RelatedKind } from '../../customer.model';
import { CustomerService } from '../../customer.service';

interface RelatedConfig {
  title: string;
  empty: string;
  columns: TableColumn[];
}

const CONFIGS: Record<RelatedKind, RelatedConfig> = {
  subscriptions: {
    title: 'Subscriptions',
    empty: 'No subscriptions',
    columns: [
      { key: 'subscriptionNumber', label: 'Subscription', sortable: true },
      { key: 'planName', label: 'Plan' },
      { key: 'productName', label: 'Product', sortable: true },
      { key: 'quantity', label: 'Qty', type: 'number', width: '80px' },
      { key: 'frequency', label: 'Frequency' },
      { key: 'deliverySlot', label: 'Slot' },
      { key: 'nextOrderDate', label: 'Next order', type: 'date', sortable: true },
      { key: 'status', label: 'Status', type: 'badge', sortable: true },
    ],
  },
  orders: {
    title: 'Orders',
    empty: 'No orders',
    columns: [
      { key: 'orderNumber', label: 'Order', sortable: true },
      { key: 'deliveryDate', label: 'Delivery date', type: 'date', sortable: true },
      { key: 'deliverySlot', label: 'Slot', sortable: true },
      { key: 'source', label: 'Source' },
      { key: 'totalAmount', label: 'Total', type: 'currency', sortable: true },
      { key: 'status', label: 'Status', type: 'badge', sortable: true },
      { key: 'paymentStatus', label: 'Payment', type: 'badge' },
    ],
  },
  invoices: {
    title: 'Invoices',
    empty: 'No invoices',
    columns: [
      { key: 'invoiceNumber', label: 'Invoice', sortable: true },
      { key: 'invoiceDate', label: 'Date', type: 'date', sortable: true },
      { key: 'dueDate', label: 'Due', type: 'date', sortable: true },
      { key: 'totalAmount', label: 'Total', type: 'currency', sortable: true },
      { key: 'balanceAmount', label: 'Balance', type: 'currency', sortable: true },
      { key: 'status', label: 'Status', type: 'badge', sortable: true },
    ],
  },
  payments: {
    title: 'Payments',
    empty: 'No payments',
    columns: [
      { key: 'paymentNumber', label: 'Payment', sortable: true },
      { key: 'paymentDate', label: 'Date', type: 'date', sortable: true },
      { key: 'amount', label: 'Amount', type: 'currency', sortable: true },
      { key: 'allocatedAmount', label: 'Allocated', type: 'currency' },
      { key: 'unallocatedAmount', label: 'Unallocated', type: 'currency' },
      { key: 'paymentModeName', label: 'Mode' },
      { key: 'referenceNo', label: 'Reference' },
      { key: 'status', label: 'Status', type: 'badge', sortable: true },
    ],
  },
  complaints: {
    title: 'Complaints',
    empty: 'No complaints',
    columns: [
      { key: 'complaintNumber', label: 'Complaint', sortable: true },
      { key: 'subject', label: 'Subject' },
      { key: 'category', label: 'Category', sortable: true },
      { key: 'priority', label: 'Priority', type: 'badge', sortable: true },
      { key: 'createdDate', label: 'Raised', type: 'date', sortable: true },
      { key: 'status', label: 'Status', type: 'badge', sortable: true },
    ],
  },
};

/** One paged read-only list of a customer's subscriptions / orders / invoices / payments / complaints. */
@Component({
  selector: 'app-customer-related-tab',
  standalone: true,
  imports: [RouterLink, HasPermissionDirective, AppCurrencyPipe, ...DATA_TABLE_IMPORTS],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="h6 mb-0">{{ config().title }}</h2>
      <div class="d-flex gap-2">
        @switch (kind()) {
          @case ('subscriptions') {
            <a *appHasPermission="'subscription.create'" routerLink="/subscriptions/new" [queryParams]="{ customerId: customerId() }" class="btn btn-sm btn-primary">
              <i class="bi bi-plus-lg me-1"></i>New subscription
            </a>
          }
          @case ('invoices') {
            <a *appHasPermission="'invoice.view'" routerLink="/billing/invoices" [queryParams]="{ customerId: customerId() }" class="btn btn-sm btn-outline-secondary">Open in billing</a>
          }
          @case ('payments') {
            <a *appHasPermission="'custpayment.view'" routerLink="/billing/payments" [queryParams]="{ customerId: customerId() }" class="btn btn-sm btn-outline-secondary">Open in billing</a>
          }
          @case ('complaints') {
            <a *appHasPermission="'complaint.view'" routerLink="/customers/complaints" [queryParams]="{ customerId: customerId() }" class="btn btn-sm btn-outline-secondary">Open complaints</a>
          }
        }
      </div>
    </div>

    <app-data-table
      [columns]="config().columns"
      [items]="list.items()"
      [total]="list.total()"
      [loading]="list.loading()"
      [error]="list.error()"
      [page]="list.query.page ?? 1"
      [pageSize]="list.query.pageSize ?? 10"
      [pageSizeOptions]="[10, 20, 50]"
      [searchable]="false"
      [emptyTitle]="config().empty"
      emptyMessage=""
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <ng-template appColumn="subscriptionNumber" let-row>
        @if (canOpenSubscription()) {
          <a [routerLink]="['/subscriptions', row.id]" class="text-decoration-none fw-semibold">{{ row.subscriptionNumber }}</a>
        } @else {
          {{ row.subscriptionNumber }}
        }
      </ng-template>
      <ng-template appColumn="orderNumber" let-row>
        @if (canOpenOrder()) {
          <a [routerLink]="['/orders', row.id]" class="text-decoration-none fw-semibold">{{ row.orderNumber }}</a>
        } @else {
          {{ row.orderNumber }}
        }
      </ng-template>
      <ng-template appColumn="invoiceNumber" let-row>
        <a [routerLink]="['/billing/invoices', row.id]" class="text-decoration-none fw-semibold">{{ row.invoiceNumber }}</a>
      </ng-template>
      <ng-template appColumn="complaintNumber" let-row>
        <a routerLink="/customers/complaints" [queryParams]="{ customerId: row.customerId }" class="text-decoration-none fw-semibold">{{ row.complaintNumber }}</a>
      </ng-template>
      <ng-template appColumn="unallocatedAmount" let-row>
        <span [class.text-warning]="row.unallocatedAmount > 0">{{ row.unallocatedAmount | appCurrency }}</span>
      </ng-template>
    </app-data-table>
  `,
})
export class CustomerRelatedTabComponent implements OnInit {
  private readonly svc = inject(CustomerService);
  private readonly perm = inject(PermissionService);

  readonly customerId = input.required<number>();
  readonly kind = input.required<RelatedKind>();

  readonly config = computed(() => CONFIGS[this.kind()]);
  readonly canOpenSubscription = computed(() => this.perm.has('subscription.view'));
  readonly canOpenOrder = computed(() => this.perm.has('order.view'));

  readonly list = new PagedList<any>((q) => this.svc.related<any>(this.customerId(), this.kind(), q), () => ({}), { pageSize: 10 });

  ngOnInit(): void {
    this.list.load();
  }
}
