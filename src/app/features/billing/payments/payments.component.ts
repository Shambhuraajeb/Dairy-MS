import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PagedList } from '../../../shared/utils/paged-list';
import { AppCurrencyPipe } from '../../../shared/pipes/app-pipes';
import { CustomerPayment, PAYMENT_STATUSES } from '../billing.model';
import { BillingService } from '../billing.service';
import { PaymentDetailModalComponent } from './payment-detail-modal.component';
import { RecordPaymentModalComponent } from './record-payment-modal.component';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    HasPermissionDirective,
    PaymentDetailModalComponent,
    RecordPaymentModalComponent,
    AppCurrencyPipe,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Customer Payments" subtitle="Payments received from customers and their invoice allocation">
      <a *appHasPermission="'invoice.view'" routerLink="/billing/invoices" class="btn btn-outline-secondary">
        <i class="bi bi-file-earmark-text me-1"></i>Invoices
      </a>
      <button *appHasPermission="'custpayment.create'" type="button" class="btn btn-primary" (click)="recordOpen.set(true)">
        <i class="bi bi-plus-lg me-1"></i>Record Payment
      </button>
    </app-page-header>

    <app-data-table
      [columns]="columns"
      [items]="list.items()"
      [total]="list.total()"
      [loading]="list.loading()"
      [error]="list.error()"
      [page]="list.query.page ?? 1"
      [pageSize]="list.query.pageSize ?? 20"
      searchPlaceholder="Search payment no., customer or reference..."
      emptyTitle="No payments found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
        @if (customers().length > 1) {
          <select class="form-select form-select-sm w-auto" formControlName="customerId" aria-label="Customer">
            <option value="">All customers</option>
            @for (c of customers(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
        }
        <select class="form-select form-select-sm w-auto" formControlName="paymentModeId" aria-label="Payment mode">
          <option value="">All modes</option>
          @for (m of modes(); track m.id) {
            <option [value]="m.id">{{ m.name }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
        <input type="date" class="form-control form-control-sm w-auto" formControlName="from" aria-label="From date" title="From date" />
        <input type="date" class="form-control form-control-sm w-auto" formControlName="to" aria-label="To date" title="To date" />
      </div>

      <ng-template appColumn="paymentNumber" let-row>
        <button type="button" class="btn btn-link p-0 fw-semibold text-decoration-none" (click)="selectedId.set(row.id)">{{ row.paymentNumber }}</button>
      </ng-template>
      <ng-template appColumn="customerName" let-row>
        {{ row.customerName }}
        <div class="small text-muted">{{ row.customerCode }}</div>
      </ng-template>
      <ng-template appColumn="unallocatedAmount" let-row>
        <span [class.text-warning]="row.unallocatedAmount > 0">{{ row.unallocatedAmount | appCurrency }}</span>
      </ng-template>
      <ng-template appRowActions let-row>
        <button type="button" class="btn btn-sm btn-outline-primary" (click)="selectedId.set(row.id)"><i class="bi bi-eye"></i> View</button>
      </ng-template>
    </app-data-table>

    <app-record-payment-modal
      [open]="recordOpen()"
      [customerId]="null"
      [invoiceId]="null"
      (closed)="recordOpen.set(false)"
      (recorded)="list.load()"
    />
    <app-payment-detail-modal [paymentId]="selectedId()" (closed)="selectedId.set(null)" />
  `,
})
export class PaymentsComponent {
  private readonly svc = inject(BillingService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly statuses = PAYMENT_STATUSES;
  readonly customers = toSignal(this.lookups.customers(), { initialValue: [] as LookupItem[] });
  readonly modes = toSignal(this.lookups.paymentModes(), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'paymentNumber', label: 'Payment', sortable: true, width: '150px' },
    { key: 'customerName', label: 'Customer', sortable: true },
    { key: 'paymentDate', label: 'Date', type: 'date', sortable: true },
    { key: 'amount', label: 'Amount', type: 'currency', sortable: true },
    { key: 'allocatedAmount', label: 'Allocated', type: 'currency' },
    { key: 'unallocatedAmount', label: 'Unallocated', type: 'currency' },
    { key: 'paymentModeName', label: 'Mode' },
    { key: 'referenceNo', label: 'Reference' },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
  ];

  readonly filters = this.fb.group({ customerId: [''], paymentModeId: [''], status: [''], from: [''], to: [''], invoiceId: [''] });
  readonly list = new PagedList<CustomerPayment>(
    (q) => this.svc.listPayments(q),
    () => ({ ...this.filters.getRawValue() }),
  );

  readonly recordOpen = signal(false);
  readonly selectedId = signal<number | null>(null);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.filters.patchValue(
        {
          customerId: p.get('customerId') ?? '',
          paymentModeId: p.get('paymentModeId') ?? '',
          status: p.get('status') ?? '',
          from: p.get('from') ?? '',
          to: p.get('to') ?? '',
          invoiceId: p.get('invoiceId') ?? '',
        },
        { emitEvent: false },
      );
      this.list.refilter();
    });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
  }
}
