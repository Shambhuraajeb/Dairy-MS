import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { SearchSelectComponent } from '../../collection/components/search-select.component';
import { ORDER_SLOTS, ORDER_STATUSES, OrderListItem } from '../order.model';
import { OrderService } from '../order.service';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    HasPermissionDirective,
    SearchSelectComponent,
    StatusBadgeComponent,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Orders" subtitle="Customer sales orders and their delivery status">
      <a *appHasPermission="'order.create'" routerLink="/orders/new" class="btn btn-primary">
        <i class="bi bi-plus-lg me-1"></i>New Order
      </a>
    </app-page-header>

    <app-data-table
      [columns]="columns"
      [items]="items()"
      [total]="total()"
      [loading]="loading()"
      [error]="error()"
      [page]="query.page ?? 1"
      [pageSize]="query.pageSize ?? 20"
      searchPlaceholder="Search order number or customer..."
      emptyTitle="No orders found"
      (queryChange)="onQuery($event)"
      (retry)="load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
        <div style="min-width: 220px">
          <app-search-select
            placeholder="All customers"
            [options]="customers()"
            [value]="filters.controls.customerId.value"
            (valueChange)="filters.controls.customerId.setValue($event)"
          />
        </div>
        <select class="form-select form-select-sm w-auto" formControlName="slot" aria-label="Slot">
          <option value="">All slots</option>
          @for (s of slots; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="routeId" aria-label="Route">
          <option value="">All routes</option>
          @for (r of routes(); track r.id) {
            <option [value]="r.id">{{ r.name }}</option>
          }
        </select>
        <div class="d-flex align-items-center gap-1">
          <span class="small text-muted">Delivery</span>
          <input type="date" class="form-control form-control-sm w-auto" formControlName="from" aria-label="From date" />
          <span class="small text-muted">to</span>
          <input type="date" class="form-control form-control-sm w-auto" formControlName="to" aria-label="To date" />
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="reset()">Reset</button>
      </div>

      <ng-template appColumn="orderNumber" let-row>
        <a [routerLink]="['/orders', row.id]" class="fw-semibold text-decoration-none">{{ row.orderNumber }}</a>
        @if (row.source === 'Subscription') {
          <span class="badge rounded-pill badge-soft badge-soft-info ms-1">Sub</span>
        }
      </ng-template>
      <ng-template appColumn="customerName" let-row>
        <div>{{ row.customerName }}</div>
        <div class="small text-muted">{{ row.customerCode }}</div>
      </ng-template>
      <ng-template appColumn="paymentStatus" let-row>
        <app-status-badge [status]="row.paymentStatus" />
      </ng-template>
      <ng-template appRowActions let-row>
        <a [routerLink]="['/orders', row.id]" class="btn btn-sm btn-outline-primary"><i class="bi bi-eye"></i> View</a>
      </ng-template>
    </app-data-table>
  `,
})
export class OrderListComponent {
  private readonly svc = inject(OrderService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly statuses = ORDER_STATUSES;
  readonly slots = ORDER_SLOTS;
  readonly customers = toSignal(this.lookups.customers(), { initialValue: [] as LookupItem[] });
  readonly routes = toSignal(this.lookups.routes(), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'orderNumber', label: 'Order #', sortable: true, width: '150px' },
    { key: 'customerName', label: 'Customer', sortable: true },
    { key: 'deliveryDate', label: 'Delivery date', type: 'date', sortable: true },
    { key: 'deliverySlot', label: 'Slot', sortable: true, width: '90px' },
    { key: 'routeName', label: 'Route' },
    { key: 'totalAmount', label: 'Total', type: 'currency', sortable: true },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
    { key: 'paymentStatus', label: 'Payment', type: 'template' },
  ];

  readonly filters = this.fb.group({
    status: [''],
    customerId: this.fb.control<number | null>(null),
    slot: [''],
    routeId: [''],
    from: [''],
    to: [''],
  });

  readonly items = signal<OrderListItem[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  query: PagedQuery = { page: 1, pageSize: 20 };

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      const date = p.get('date');
      const customerId = p.get('customerId');
      this.filters.patchValue(
        {
          status: p.get('status') ?? '',
          customerId: customerId ? Number(customerId) : null,
          slot: p.get('slot') ?? '',
          routeId: p.get('routeId') ?? '',
          from: date ?? p.get('from') ?? '',
          to: date ?? p.get('to') ?? '',
        },
        { emitEvent: false },
      );
      this.query = { ...this.query, page: 1 };
      this.load();
    });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.query = { ...this.query, page: 1 };
      this.load();
    });
  }

  onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  reset(): void {
    this.filters.reset();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.list({ ...this.query, ...this.filters.getRawValue() }).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
