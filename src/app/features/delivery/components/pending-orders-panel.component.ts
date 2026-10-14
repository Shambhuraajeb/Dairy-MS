import { Component, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { toIsoDate } from '../../../shared/utils/format';
import { OrderListItem } from '../../orders/order.model';
import { DELIVERY_SLOTS, DeliverySchedule, scheduleLabel } from '../delivery.model';
import { DeliveryService } from '../delivery.service';

/** Orders without a live delivery; assign one (or many) to a delivery schedule. */
@Component({
  selector: 'app-pending-orders-panel',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ...DATA_TABLE_IMPORTS],
  template: `
    <div class="card mb-3 border-primary">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <div class="section-title mb-0">Orders awaiting delivery assignment</div>
            <div class="small text-muted">Pick a schedule, then assign single orders or a selection in bulk.</div>
          </div>
        </div>
        <div class="row g-2 align-items-end">
          <div class="col-lg-6">
            <label class="form-label small mb-1" for="poSchedule">Delivery schedule</label>
            <select id="poSchedule" class="form-select" [formControl]="scheduleControl">
              <option [ngValue]="null">Select a schedule...</option>
              @for (s of schedules(); track s.id) {
                <option [ngValue]="s.id">{{ label(s) }}</option>
              }
            </select>
            @if (schedulesLoaded() && schedules().length === 0) {
              <div class="form-text text-warning">
                No open schedules from today onward.
                <a routerLink="/delivery/schedules">Create a schedule</a>
              </div>
            }
          </div>
          <div class="col-lg-6 d-flex flex-wrap gap-2">
            <button type="button" class="btn btn-primary" [disabled]="assigning() || selected().size === 0 || scheduleControl.value === null" (click)="assignSelected()">
              @if (assigning()) {
                <span class="spinner-border spinner-border-sm me-1"></span>
              }
              <i class="bi bi-diagram-3 me-1"></i>Assign selected ({{ selected().size }})
            </button>
            <button type="button" class="btn btn-outline-secondary" (click)="selectPage()" [disabled]="items().length === 0">Select page</button>
            <button type="button" class="btn btn-outline-secondary" (click)="selected.set(emptySet())" [disabled]="selected().size === 0">Clear</button>
          </div>
        </div>

        @if (failures().length > 0) {
          <div class="alert alert-warning mt-3 mb-0">
            <div class="fw-semibold mb-1">Some orders could not be assigned</div>
            <ul class="mb-0 small">
              @for (f of failures(); track f.salesOrderId) {
                <li>{{ f.label }}: {{ f.message }}</li>
              }
            </ul>
          </div>
        }
      </div>
    </div>

    <app-data-table
      [columns]="columns"
      [items]="items()"
      [total]="total()"
      [loading]="loading()"
      [error]="error()"
      [page]="query.page ?? 1"
      [pageSize]="query.pageSize ?? 10"
      [pageSizeOptions]="[10, 20, 50]"
      searchPlaceholder="Search order or customer..."
      emptyTitle="No orders waiting for assignment"
      emptyMessage="All matching orders already have a delivery."
      (queryChange)="onQuery($event)"
      (retry)="load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
        <span class="small text-muted">Delivery</span>
        <input type="date" class="form-control form-control-sm w-auto" formControlName="from" aria-label="From date" />
        <span class="small text-muted">to</span>
        <input type="date" class="form-control form-control-sm w-auto" formControlName="to" aria-label="To date" />
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
      </div>
      <ng-template appColumn="select" let-row>
        <input type="checkbox" class="form-check-input" [checked]="selected().has(row.id)" (change)="toggle(row.id)" [attr.aria-label]="'Select ' + row.orderNumber" />
      </ng-template>
      <ng-template appColumn="orderNumber" let-row>
        <a [routerLink]="['/orders', row.id]" class="fw-semibold text-decoration-none">{{ row.orderNumber }}</a>
      </ng-template>
      <ng-template appRowActions let-row>
        <button type="button" class="btn btn-sm btn-outline-primary" [disabled]="assigning() || scheduleControl.value === null" (click)="assignOne(row)">
          <i class="bi bi-plus-circle me-1"></i>Assign
        </button>
      </ng-template>
    </app-data-table>
  `,
})
export class PendingOrdersPanelComponent {
  private readonly svc = inject(DeliveryService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly assigned = output<void>();

  readonly slots = DELIVERY_SLOTS;
  readonly routes = toSignal(this.lookups.routes(), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'select', label: '', type: 'template', width: '40px' },
    { key: 'orderNumber', label: 'Order #', sortable: true },
    { key: 'customerName', label: 'Customer', sortable: true },
    { key: 'deliveryDate', label: 'Delivery date', type: 'date', sortable: true },
    { key: 'deliverySlot', label: 'Slot', sortable: true },
    { key: 'routeName', label: 'Route' },
    { key: 'totalQuantity', label: 'Qty', type: 'number' },
    { key: 'status', label: 'Status', type: 'badge' },
  ];

  readonly scheduleControl = this.fb.control<number | null>(null);
  readonly filters = this.fb.group({ from: [toIsoDate()], to: [''], slot: [''], routeId: [''] });

  readonly schedules = signal<DeliverySchedule[]>([]);
  readonly schedulesLoaded = signal(false);
  readonly items = signal<OrderListItem[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selected = signal<Set<number>>(new Set<number>());
  readonly assigning = signal(false);
  readonly failures = signal<{ salesOrderId: number; label: string; message: string }[]>([]);
  query: PagedQuery = { page: 1, pageSize: 10 };

  constructor() {
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.query = { ...this.query, page: 1 };
      this.load();
    });
    this.loadSchedules();
    this.load();
  }

  label(s: DeliverySchedule): string {
    return scheduleLabel(s);
  }

  emptySet(): Set<number> {
    return new Set<number>();
  }

  private loadSchedules(): void {
    this.svc
      .schedules({ page: 1, pageSize: 200, from: toIsoDate(), sortBy: 'scheduleDate', sortDir: 'asc' })
      .subscribe({
        next: (res) => {
          this.schedules.set(res.items.filter((s) => s.status !== 'Completed'));
          this.schedulesLoaded.set(true);
        },
        error: () => this.schedulesLoaded.set(true),
      });
  }

  onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.pendingOrders({ ...this.query, ...this.filters.getRawValue() }).subscribe({
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

  toggle(id: number): void {
    const next = new Set(this.selected());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selected.set(next);
  }

  selectPage(): void {
    const next = new Set(this.selected());
    for (const o of this.items()) {
      next.add(o.id);
    }
    this.selected.set(next);
  }

  assignOne(order: OrderListItem): void {
    const scheduleId = this.scheduleControl.value;
    if (scheduleId === null) {
      return;
    }
    this.assigning.set(true);
    this.failures.set([]);
    this.svc.create({ salesOrderId: order.id, deliveryScheduleId: scheduleId }).subscribe({
      next: (d) => {
        this.assigning.set(false);
        this.toast.success(`Order ${order.orderNumber} assigned (${d.deliveryNumber}).`);
        this.afterAssign([order.id]);
      },
      error: () => this.assigning.set(false),
    });
  }

  assignSelected(): void {
    const scheduleId = this.scheduleControl.value;
    const ids = [...this.selected()];
    if (scheduleId === null || ids.length === 0) {
      return;
    }
    this.assigning.set(true);
    this.failures.set([]);
    this.svc.bulk({ deliveryScheduleId: scheduleId, salesOrderIds: ids }).subscribe({
      next: (res) => {
        this.assigning.set(false);
        if (res.createdCount > 0) {
          this.toast.success(`${res.createdCount} of ${res.requestedCount} order(s) assigned.`);
        }
        if (res.failedCount > 0) {
          const names = new Map(this.items().map((o) => [o.id, o.orderNumber] as const));
          this.failures.set(
            res.failed.map((f) => ({
              salesOrderId: f.salesOrderId,
              label: names.get(f.salesOrderId) ?? `Order #${f.salesOrderId}`,
              message: f.message,
            })),
          );
          this.toast.warning(`${res.failedCount} order(s) could not be assigned.`);
        }
        this.afterAssign(res.created.map((c) => c.salesOrderId));
      },
      error: () => this.assigning.set(false),
    });
  }

  private afterAssign(doneIds: number[]): void {
    const next = new Set(this.selected());
    for (const id of doneIds) {
      next.delete(id);
    }
    this.selected.set(next);
    this.load();
    this.loadSchedules();
    this.assigned.emit();
  }
}
