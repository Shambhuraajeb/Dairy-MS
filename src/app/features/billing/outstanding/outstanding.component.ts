import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { errorMessage } from '../../../core/utils/http-error';
import { ChartComponent } from '../../../shared/components/chart/chart.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppCurrencyPipe, AppDatePipe } from '../../../shared/pipes/app-pipes';
import { OutstandingRow } from '../billing.model';
import { BillingService } from '../billing.service';
import { RecordPaymentModalComponent } from '../payments/record-payment-modal.component';

@Component({
  selector: 'app-outstanding',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    KpiCardComponent,
    ChartComponent,
    LoadingComponent,
    EmptyStateComponent,
    HasPermissionDirective,
    RecordPaymentModalComponent,
    AppCurrencyPipe,
    AppDatePipe,
  ],
  template: `
    <app-page-header title="Outstanding" subtitle="Receivables by customer with aging buckets (days past due)">
      <a *appHasPermission="'invoice.view'" routerLink="/billing/invoices" class="btn btn-outline-secondary">
        <i class="bi bi-file-earmark-text me-1"></i>Invoices
      </a>
      <button *appHasPermission="'custpayment.create'" type="button" class="btn btn-primary" (click)="openPay(null)">
        <i class="bi bi-cash me-1"></i>Record Payment
      </button>
    </app-page-header>

    <div class="row g-3 mb-3">
      <div class="col-6 col-lg-3">
        <app-kpi-card title="Total outstanding" [value]="totals().total" format="currency" icon="bi-hourglass-split" color="warning"
          [subtitle]="rows().length + ' customers'" [loading]="loading()" />
      </div>
      <div class="col-6 col-lg-3">
        <app-kpi-card title="Not yet due" [value]="totals().current" format="currency" icon="bi-calendar-check" color="success" [loading]="loading()" />
      </div>
      <div class="col-6 col-lg-3">
        <app-kpi-card title="Overdue (1-60 days)" [value]="totals().d1 + totals().d31" format="currency" icon="bi-exclamation-triangle" color="warning" [loading]="loading()" />
      </div>
      <div class="col-6 col-lg-3">
        <app-kpi-card title="Overdue (60+ days)" [value]="totals().d61 + totals().d90" format="currency" icon="bi-exclamation-octagon" color="danger" [loading]="loading()" />
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <h2 class="section-title">Aging</h2>
        <app-chart type="bar" [labels]="agingLabels" [datasets]="agingDatasets()" [height]="220" [options]="chartOptions" />
      </div>
    </div>

    <div class="card">
      <div class="p-3 border-bottom d-flex flex-wrap gap-2 align-items-center" [formGroup]="filters">
        <div class="position-relative" style="min-width: 220px">
          <input type="search" class="form-control form-control-sm" placeholder="Search customer..." formControlName="search" aria-label="Search" />
        </div>
        @if (customers().length > 1) {
          <select class="form-select form-select-sm w-auto" formControlName="customerId" aria-label="Customer">
            <option value="">All customers</option>
            @for (c of customers(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
        }
        <button type="button" class="btn btn-sm btn-outline-secondary ms-auto" (click)="load()"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
      </div>

      @if (loading() && rows().length === 0) {
        <app-loading text="Loading outstanding..." />
      } @else if (error()) {
        <div class="text-center py-5">
          <i class="bi bi-exclamation-octagon text-danger fs-3 d-block mb-2"></i>
          <div class="text-danger mb-2">{{ error() }}</div>
          <button type="button" class="btn btn-sm btn-outline-primary" (click)="load()">Retry</button>
        </div>
      } @else if (visibleRows().length === 0) {
        <app-empty-state icon="bi-emoji-smile" title="No outstanding balances" message="There are no open invoices for the current selection." />
      } @else {
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 app-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th class="text-end">Open invoices</th>
                <th>Oldest due</th>
                <th class="text-end">Current</th>
                <th class="text-end">1-30</th>
                <th class="text-end">31-60</th>
                <th class="text-end">61-90</th>
                <th class="text-end">90+</th>
                <th class="text-end">Total</th>
                <th class="text-end">Credit</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (r of visibleRows(); track r.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/customers', r.id]" class="fw-semibold text-decoration-none">{{ r.customerName }}</a>
                    <div class="small text-muted">{{ r.customerCode }} · {{ r.customerType }}@if (r.mobile) { · {{ r.mobile }} }</div>
                  </td>
                  <td class="text-end">{{ r.openInvoices }}</td>
                  <td>{{ r.oldestDueDate | appDate }}</td>
                  <td class="text-end">{{ r.currentAmount | appCurrency }}</td>
                  <td class="text-end">{{ r.days1To30 | appCurrency }}</td>
                  <td class="text-end">{{ r.days31To60 | appCurrency }}</td>
                  <td class="text-end" [class.text-danger]="r.days61To90 > 0">{{ r.days61To90 | appCurrency }}</td>
                  <td class="text-end" [class.text-danger]="r.over90Days > 0">{{ r.over90Days | appCurrency }}</td>
                  <td class="text-end fw-bold">{{ r.totalOutstanding | appCurrency }}</td>
                  <td class="text-end" [class.text-success]="r.unallocatedCredit > 0">{{ r.unallocatedCredit | appCurrency }}</td>
                  <td class="text-end text-nowrap">
                    <a [routerLink]="['/billing/invoices']" [queryParams]="{ customerId: r.id }" class="btn btn-sm btn-outline-primary me-1">Invoices</a>
                    <button *appHasPermission="'custpayment.create'" type="button" class="btn btn-sm btn-outline-success" (click)="openPay(r.id)">
                      <i class="bi bi-cash"></i> Pay
                    </button>
                  </td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr class="fw-bold">
                <td>Total</td>
                <td class="text-end">{{ totals().invoices }}</td>
                <td></td>
                <td class="text-end">{{ totals().current | appCurrency }}</td>
                <td class="text-end">{{ totals().d1 | appCurrency }}</td>
                <td class="text-end">{{ totals().d31 | appCurrency }}</td>
                <td class="text-end">{{ totals().d61 | appCurrency }}</td>
                <td class="text-end">{{ totals().d90 | appCurrency }}</td>
                <td class="text-end">{{ totals().total | appCurrency }}</td>
                <td class="text-end">{{ totals().credit | appCurrency }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      }
    </div>

    <app-record-payment-modal [open]="payOpen()" [customerId]="payCustomerId()" [invoiceId]="null" (closed)="payOpen.set(false)" (recorded)="load()" />
  `,
})
export class OutstandingComponent {
  private readonly svc = inject(BillingService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly customers = toSignal(this.lookups.customers(), { initialValue: [] as LookupItem[] });
  readonly filters = this.fb.group({ search: [''], customerId: [''] });
  private readonly searchText = signal('');

  readonly rows = signal<OutstandingRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly payOpen = signal(false);
  readonly payCustomerId = signal<number | null>(null);

  readonly visibleRows = computed(() => {
    const q = this.searchText().trim().toLowerCase();
    return q
      ? this.rows().filter((r) => `${r.customerName} ${r.customerCode} ${r.mobile ?? ''}`.toLowerCase().includes(q))
      : this.rows();
  });

  readonly totals = computed(() => {
    const t = { invoices: 0, current: 0, d1: 0, d31: 0, d61: 0, d90: 0, total: 0, credit: 0 };
    for (const r of this.visibleRows()) {
      t.invoices += r.openInvoices;
      t.current += r.currentAmount;
      t.d1 += r.days1To30;
      t.d31 += r.days31To60;
      t.d61 += r.days61To90;
      t.d90 += r.over90Days;
      t.total += r.totalOutstanding;
      t.credit += r.unallocatedCredit;
    }
    return t;
  });

  readonly agingLabels = ['Current', '1-30 days', '31-60 days', '61-90 days', '90+ days'];
  readonly agingDatasets = computed(() => {
    const t = this.totals();
    return [{ label: 'Outstanding', data: [t.current, t.d1, t.d31, t.d61, t.d90], backgroundColor: ['#16a34a', '#f59e0b', '#ea580c', '#dc2626', '#7f1d1d'] }];
  });
  readonly chartOptions = { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } };

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.filters.patchValue({ customerId: p.get('customerId') ?? '' }, { emitEvent: false });
      this.load();
    });
    this.filters.controls.customerId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.load());
    this.filters.controls.search.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => this.searchText.set(v));
  }

  load(): void {
    const id = Number(this.filters.getRawValue().customerId);
    this.loading.set(true);
    this.error.set(null);
    this.svc.outstanding(id > 0 ? id : null).subscribe({
      next: (rows) => {
        this.rows.set(rows ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  openPay(customerId: number | null): void {
    this.payCustomerId.set(customerId);
    this.payOpen.set(true);
  }
}
