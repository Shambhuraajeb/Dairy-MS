import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppCurrencyPipe } from '../../../shared/pipes/app-pipes';
import { PagedList } from '../../../shared/utils/paged-list';
import { BillingSummary, INVOICE_STATUSES, Invoice } from '../billing.model';
import { BillingService } from '../billing.service';
import { RecordPaymentModalComponent } from '../payments/record-payment-modal.component';
import { GenerateInvoiceModalComponent } from './generate-invoice-modal.component';

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    KpiCardComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    AppCurrencyPipe,
    GenerateInvoiceModalComponent,
    RecordPaymentModalComponent,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Invoices" subtitle="Customer invoices, balances and due dates">
      <a *appHasPermission="'custpayment.view'" routerLink="/billing/payments" class="btn btn-outline-secondary">
        <i class="bi bi-credit-card me-1"></i>Payments
      </a>
      <a *appHasPermission="'invoice.view'" routerLink="/billing/outstanding" class="btn btn-outline-secondary">
        <i class="bi bi-hourglass-split me-1"></i>Outstanding
      </a>
      <button *appHasPermission="'invoice.create'" type="button" class="btn btn-primary" (click)="generateOpen.set(true)">
        <i class="bi bi-plus-lg me-1"></i>Generate Invoice
      </button>
    </app-page-header>

    @if (summary(); as s) {
      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Invoiced this month" [value]="s.invoicedThisMonth" format="currency" icon="bi-receipt" color="primary" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Collected this month" [value]="s.collectedThisMonth" format="currency" icon="bi-cash-stack" color="success"
            [subtitle]="'Today ' + (s.collectedToday | appCurrency:'INR':0)" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Outstanding" [value]="s.totalOutstanding" format="currency" icon="bi-hourglass-split" color="warning"
            [subtitle]="s.openInvoices + ' open invoices'" link="/billing/outstanding" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Overdue" [value]="s.overdueAmount" format="currency" icon="bi-exclamation-triangle" color="danger"
            [subtitle]="s.overdueInvoices + ' invoices'" link="/billing/invoices" [queryParams]="{ status: 'Overdue' }" />
        </div>
      </div>
    }

    <app-data-table
      [columns]="columns"
      [items]="list.items()"
      [total]="list.total()"
      [loading]="list.loading()"
      [error]="list.error()"
      [page]="list.query.page ?? 1"
      [pageSize]="list.query.pageSize ?? 20"
      searchPlaceholder="Search invoice no. or customer..."
      emptyTitle="No invoices found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
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
        <input type="date" class="form-control form-control-sm w-auto" formControlName="from" aria-label="From date" title="Invoice date from" />
        <input type="date" class="form-control form-control-sm w-auto" formControlName="to" aria-label="To date" title="Invoice date to" />
      </div>

      <ng-template appColumn="invoiceNumber" let-row>
        <a [routerLink]="['/billing/invoices', row.id]" class="fw-semibold text-decoration-none">{{ row.invoiceNumber }}</a>
        @if (row.invoiceType === 'Consolidated') {
          <div class="small text-muted">{{ row.orderCount }} orders</div>
        }
      </ng-template>
      <ng-template appColumn="customerName" let-row>
        {{ row.customerName }}
        <div class="small text-muted">{{ row.customerCode }}</div>
      </ng-template>
      <ng-template appColumn="status" let-row>
        @if (row.isOverdue && row.status !== 'Paid' && row.status !== 'Cancelled') {
          <app-status-badge status="Overdue" />
        } @else {
          <app-status-badge [status]="row.status" [color]="row.status === 'Issued' ? 'info' : null" />
        }
      </ng-template>
      <ng-template appRowActions let-row>
        <a [routerLink]="['/billing/invoices', row.id]" class="btn btn-sm btn-outline-primary me-1"><i class="bi bi-eye"></i> View</a>
        @if (canPay(row)) {
          <button *appHasPermission="'custpayment.create'" type="button" class="btn btn-sm btn-outline-success" (click)="openPay(row)">
            <i class="bi bi-cash"></i> Pay
          </button>
        }
      </ng-template>
    </app-data-table>

    <app-generate-invoice-modal
      [open]="generateOpen()"
      [customerId]="presetCustomerId()"
      (closed)="generateOpen.set(false)"
      (generated)="onGenerated($event.id)"
    />
    <app-record-payment-modal
      [open]="payOpen()"
      [customerId]="payInvoice()?.customerId ?? null"
      [invoiceId]="payInvoice()?.id ?? null"
      (closed)="payOpen.set(false)"
      (recorded)="refresh()"
    />
  `,
})
export class InvoiceListComponent implements OnInit {
  private readonly svc = inject(BillingService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly statuses = INVOICE_STATUSES;
  readonly customers = toSignal(this.lookups.customers(), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'invoiceNumber', label: 'Invoice', sortable: true, width: '150px' },
    { key: 'customerName', label: 'Customer', sortable: true },
    { key: 'invoiceDate', label: 'Date', type: 'date', sortable: true },
    { key: 'dueDate', label: 'Due', type: 'date', sortable: true },
    { key: 'totalAmount', label: 'Total', type: 'currency', sortable: true },
    { key: 'paidAmount', label: 'Paid', type: 'currency' },
    { key: 'balanceAmount', label: 'Balance', type: 'currency', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
  ];

  readonly filters = this.fb.group({ status: [''], customerId: [''], from: [''], to: [''] });
  readonly list = new PagedList<Invoice>(
    (q) => this.svc.listInvoices(q),
    () => ({ ...this.filters.getRawValue() }),
  );

  readonly summary = signal<BillingSummary | null>(null);
  readonly generateOpen = signal(false);
  readonly payOpen = signal(false);
  readonly payInvoice = signal<Invoice | null>(null);
  readonly presetCustomerId = signal<number | null>(null);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.filters.patchValue(
        {
          status: p.get('status') ?? '',
          customerId: p.get('customerId') ?? '',
          from: p.get('from') ?? '',
          to: p.get('to') ?? '',
        },
        { emitEvent: false },
      );
      const cid = Number(p.get('customerId'));
      this.presetCustomerId.set(cid > 0 ? cid : null);
      this.list.refilter();
    });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
  }

  ngOnInit(): void {
    this.loadSummary();
  }

  private loadSummary(): void {
    this.svc.summary().subscribe({ next: (s) => this.summary.set(s), error: () => this.summary.set(null) });
  }

  canPay(inv: Invoice): boolean {
    return inv.balanceAmount > 0 && inv.status !== 'Cancelled' && inv.status !== 'Draft';
  }

  openPay(inv: Invoice): void {
    this.payInvoice.set(inv);
    this.payOpen.set(true);
  }

  refresh(): void {
    this.list.load();
    this.loadSummary();
  }

  onGenerated(id: number): void {
    this.generateOpen.set(false);
    void this.router.navigate(['/billing/invoices', id]);
  }
}
