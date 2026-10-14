import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppDatePipe } from '../../../shared/pipes/app-pipes';
import { toIsoDate } from '../../../shared/utils/format';
import { PagedList } from '../../../shared/utils/paged-list';
import { SLOTS, SUBSCRIPTION_STATUSES, Subscription } from '../subscription.model';
import { SubscriptionService } from '../subscription.service';

@Component({
  selector: 'app-subscription-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    ModalComponent,
    FormFieldComponent,
    HasPermissionDirective,
    AppDatePipe,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Subscriptions" subtitle="Recurring milk and dairy deliveries">
      <a *appHasPermission="'subscription.view'" routerLink="/subscriptions/plans" class="btn btn-outline-secondary">
        <i class="bi bi-card-checklist me-1"></i>Plans
      </a>
      <button *appHasPermission="'subscription.update'" type="button" class="btn btn-outline-primary" (click)="openGenerate()">
        <i class="bi bi-lightning-charge me-1"></i>Generate orders
      </button>
      <a *appHasPermission="'subscription.create'" routerLink="/subscriptions/new" class="btn btn-primary">
        <i class="bi bi-plus-lg me-1"></i>New Subscription
      </a>
    </app-page-header>

    <app-data-table
      [columns]="columns"
      [items]="list.items()"
      [total]="list.total()"
      [loading]="list.loading()"
      [error]="list.error()"
      [page]="list.query.page ?? 1"
      [pageSize]="list.query.pageSize ?? 20"
      searchPlaceholder="Search number, customer or product..."
      emptyTitle="No subscriptions found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2">
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
        @if (customers().length > 1) {
          <select class="form-select form-select-sm w-auto" formControlName="customerId" aria-label="Customer">
            <option value="">All customers</option>
            @for (c of customers(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
        }
        <select class="form-select form-select-sm w-auto" formControlName="productId" aria-label="Product">
          <option value="">All products</option>
          @for (p of products(); track p.id) {
            <option [value]="p.id">{{ p.name }}</option>
          }
        </select>
      </div>

      <ng-template appColumn="subscriptionNumber" let-row>
        <a [routerLink]="['/subscriptions', row.id]" class="fw-semibold text-decoration-none">{{ row.subscriptionNumber }}</a>
      </ng-template>
      <ng-template appColumn="customerName" let-row>
        {{ row.customerName }}
        <div class="small text-muted">{{ row.customerCode }}</div>
      </ng-template>
      <ng-template appRowActions let-row>
        <a [routerLink]="['/subscriptions', row.id]" class="btn btn-sm btn-outline-primary"><i class="bi bi-eye"></i> View</a>
      </ng-template>
    </app-data-table>

    <app-modal [open]="generateOpen()" title="Generate subscription orders" size="sm" (closed)="closeGenerate()">
      <form id="genOrdersForm" [formGroup]="generateForm" (ngSubmit)="generate()" novalidate>
        <p class="text-muted small">
          Creates delivery orders for the active subscriptions that are due on the selected date.
        </p>
        <app-form-field label="Delivery date" inputId="goDate" [control]="generateForm.controls.forDate">
          <input id="goDate" type="date" class="form-control" formControlName="forDate" />
        </app-form-field>
        @if (lastResult(); as r) {
          <div class="alert alert-success py-2 mb-0">
            {{ r.ordersCreated }} order(s) created for {{ r.forDate | appDate }}.
          </div>
        }
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeGenerate()">Close</button>
        <button type="submit" form="genOrdersForm" class="btn btn-primary" [disabled]="generating()">
          @if (generating()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Generate
        </button>
      </div>
    </app-modal>
  `,
})
export class SubscriptionListComponent {
  private readonly svc = inject(SubscriptionService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly statuses = SUBSCRIPTION_STATUSES;
  readonly slots = SLOTS;
  readonly customers = toSignal(this.lookups.customers(), { initialValue: [] as LookupItem[] });
  readonly products = toSignal(this.lookups.products(), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'subscriptionNumber', label: 'Subscription', sortable: true, width: '150px' },
    { key: 'customerName', label: 'Customer', sortable: true },
    { key: 'productName', label: 'Product', sortable: true },
    { key: 'quantity', label: 'Qty', type: 'number', width: '80px' },
    { key: 'frequency', label: 'Frequency' },
    { key: 'deliverySlot', label: 'Slot' },
    { key: 'startDate', label: 'Start', type: 'date', sortable: true },
    { key: 'nextOrderDate', label: 'Next order', type: 'date', sortable: true },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
  ];

  readonly filters = this.fb.group({ status: [''], slot: [''], customerId: [''], productId: [''] });
  readonly list = new PagedList<Subscription>(
    (q) => this.svc.list(q),
    () => ({ ...this.filters.getRawValue() }),
  );

  readonly generateOpen = signal(false);
  readonly generating = signal(false);
  readonly lastResult = signal<{ ordersCreated: number; forDate: string } | null>(null);
  readonly generateForm = this.fb.group({ forDate: [toIsoDate(), Validators.required] });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.filters.patchValue(
        {
          status: p.get('status') ?? '',
          slot: p.get('slot') ?? '',
          customerId: p.get('customerId') ?? '',
          productId: p.get('productId') ?? '',
        },
        { emitEvent: false },
      );
      this.list.refilter();
    });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
  }

  openGenerate(): void {
    this.generateForm.reset({ forDate: toIsoDate() });
    this.lastResult.set(null);
    this.generateOpen.set(true);
  }

  closeGenerate(): void {
    if (!this.generating()) {
      this.generateOpen.set(false);
    }
  }

  generate(): void {
    if (this.generateForm.invalid) {
      this.generateForm.markAllAsTouched();
      return;
    }
    this.generating.set(true);
    this.svc.generateOrders(this.generateForm.getRawValue().forDate).subscribe({
      next: (r) => {
        this.generating.set(false);
        this.lastResult.set(r);
        this.toast.success(`${r.ordersCreated} order(s) generated.`);
        this.list.load();
      },
      error: () => this.generating.set(false),
    });
  }
}
