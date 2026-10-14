import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { SearchSelectComponent } from '../../collection/components/search-select.component';
import { DeliveryConfirmModalComponent } from '../components/delivery-confirm-modal.component';
import { PendingOrdersPanelComponent } from '../components/pending-orders-panel.component';
import { DELIVERY_SLOTS, DELIVERY_STATUSES, DeliveryListItem } from '../delivery.model';
import { DeliveryService } from '../delivery.service';

@Component({
  selector: 'app-delivery-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    HasPermissionDirective,
    SearchSelectComponent,
    DeliveryConfirmModalComponent,
    PendingOrdersPanelComponent,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Deliveries" subtitle="Track dispatch and confirmation of customer deliveries">
      <a *appHasPermission="'delivery.confirm'" routerLink="/delivery/my" class="btn btn-outline-secondary">
        <i class="bi bi-person-check me-1"></i>My deliveries
      </a>
      <a *appHasPermission="'route.view'" routerLink="/delivery/schedules" class="btn btn-outline-secondary">
        <i class="bi bi-calendar-week me-1"></i>Schedules
      </a>
      <button *appHasPermission="'delivery.update'" type="button" class="btn btn-primary" (click)="showPending.set(!showPending())">
        <i class="bi bi-diagram-3 me-1"></i>{{ showPending() ? 'Hide pending orders' : 'Assign pending orders' }}
      </button>
    </app-page-header>

    @if (showPending()) {
      <app-pending-orders-panel (assigned)="load()" />
    }

    <app-data-table
      [columns]="columns"
      [items]="items()"
      [total]="total()"
      [loading]="loading()"
      [error]="error()"
      [page]="query.page ?? 1"
      [pageSize]="query.pageSize ?? 20"
      searchPlaceholder="Search delivery, order, customer..."
      emptyTitle="No deliveries found"
      (queryChange)="onQuery($event)"
      (retry)="load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
        <input type="date" class="form-control form-control-sm w-auto" formControlName="date" aria-label="Delivery date" />
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
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
        <div style="min-width: 200px">
          <app-search-select
            placeholder="All drivers"
            [options]="employees()"
            [value]="filters.controls.driverEmployeeId.value"
            (valueChange)="filters.controls.driverEmployeeId.setValue($event)"
          />
        </div>
        @if (filters.controls.scheduleId.value) {
          <span class="badge text-bg-light border d-flex align-items-center gap-1">
            Schedule #{{ filters.controls.scheduleId.value }}
            <button type="button" class="btn-close btn-close-sm ms-1" style="font-size: 0.6rem" aria-label="Clear schedule filter" (click)="filters.controls.scheduleId.setValue('')"></button>
          </span>
        }
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="filters.reset()">Reset</button>
      </div>

      <ng-template appColumn="deliveryNumber" let-row>
        <a [routerLink]="['/delivery', row.id]" class="fw-semibold text-decoration-none">{{ row.deliveryNumber }}</a>
        <div class="small text-muted">{{ row.orderNumber }}</div>
      </ng-template>
      <ng-template appColumn="customerName" let-row>
        <div>{{ row.customerName }}</div>
        @if (row.customerMobile) {
          <div class="small text-muted">{{ row.customerMobile }}</div>
        }
      </ng-template>
      <ng-template appRowActions let-row>
        <a [routerLink]="['/delivery', row.id]" class="btn btn-sm btn-outline-primary me-1"><i class="bi bi-eye"></i></a>
        @if (row.status === 'Pending') {
          <button *appHasPermission="'delivery.update'" type="button" class="btn btn-sm btn-outline-info me-1" (click)="dispatch(row)">
            <i class="bi bi-send"></i> Dispatch
          </button>
        }
        @if (row.status === 'Pending' || row.status === 'Dispatched') {
          <button *appHasPermission="'delivery.confirm'" type="button" class="btn btn-sm btn-outline-success me-1" (click)="openConfirm(row, 'deliver')">
            <i class="bi bi-check2-circle"></i> Confirm
          </button>
          <button *appHasPermission="'delivery.confirm'" type="button" class="btn btn-sm btn-outline-danger" (click)="openConfirm(row, 'fail')">
            <i class="bi bi-x-circle"></i> Failed
          </button>
        }
      </ng-template>
    </app-data-table>

    <app-delivery-confirm-modal
      [open]="confirmOpen()"
      [delivery]="target()"
      [mode]="mode()"
      (done)="onConfirmed()"
      (closed)="confirmOpen.set(false)"
    />
  `,
})
export class DeliveryListComponent {
  private readonly svc = inject(DeliveryService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly statuses = DELIVERY_STATUSES;
  readonly slots = DELIVERY_SLOTS;
  readonly routes = toSignal(this.lookups.routes(), { initialValue: [] as LookupItem[] });
  readonly employees = toSignal(this.lookups.employees(), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'deliveryNumber', label: 'Delivery', sortable: true, width: '150px' },
    { key: 'customerName', label: 'Customer', sortable: true },
    { key: 'deliveryDate', label: 'Date', type: 'date', sortable: true },
    { key: 'deliverySlot', label: 'Slot', sortable: true, width: '90px' },
    { key: 'routeName', label: 'Route', sortable: true },
    { key: 'driverName', label: 'Driver' },
    { key: 'sequenceNo', label: 'Stop', type: 'number', sortable: true, width: '70px' },
    { key: 'orderTotal', label: 'Order total', type: 'currency' },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
  ];

  readonly filters = this.fb.group({
    date: [''],
    status: [''],
    slot: [''],
    routeId: [''],
    driverEmployeeId: this.fb.control<number | null>(null),
    scheduleId: [''],
  });

  readonly items = signal<DeliveryListItem[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  query: PagedQuery = { page: 1, pageSize: 20 };

  readonly showPending = signal(false);
  readonly confirmOpen = signal(false);
  readonly target = signal<DeliveryListItem | null>(null);
  readonly mode = signal<'deliver' | 'fail'>('deliver');

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      const driver = p.get('driverEmployeeId');
      this.filters.patchValue(
        {
          date: p.get('date') ?? '',
          status: p.get('status') ?? '',
          slot: p.get('slot') ?? '',
          routeId: p.get('routeId') ?? '',
          driverEmployeeId: driver ? Number(driver) : null,
          scheduleId: p.get('scheduleId') ?? '',
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

  async dispatch(d: DeliveryListItem): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Dispatch delivery',
      message: `Dispatch ${d.deliveryNumber} for ${d.customerName}? The order will be marked as dispatched.`,
      confirmText: 'Dispatch',
    });
    if (!ok) {
      return;
    }
    this.svc.dispatch(d.id).subscribe(() => {
      this.toast.success(`${d.deliveryNumber} dispatched.`);
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
