import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Params } from '@angular/router';
import type { ChartType } from 'chart.js';
import { PermissionService } from '../../../core/services/permission.service';
import { errorMessage } from '../../../core/utils/http-error';
import { ChartComponent } from '../../../shared/components/chart/chart.component';
import { KpiCardComponent, KpiColor } from '../../../shared/components/kpi-card/kpi-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { formatDate, toIsoDate } from '../../../shared/utils/format';
import { DashboardVariantData, DashboardVariantName } from '../dashboard.model';
import { DashboardService } from '../dashboard.service';
import { formatCell, humanize, pickValue, toSeries } from '../dashboard.util';

interface VariantKpi {
  title: string;
  keys: string[];
  icon: string;
  color: KpiColor;
  format: 'number' | 'currency' | 'percent' | 'none';
  suffix?: string;
  link: string;
  query?: Params;
  perm?: string | string[];
}

interface VariantConfig {
  title: string;
  subtitle: string;
  kpis: VariantKpi[];
}

function config(name: DashboardVariantName, today: string): VariantConfig {
  const day: Params = { from: today, to: today };
  switch (name) {
    case 'collection':
      return {
        title: 'Collection dashboard',
        subtitle: 'Current shift and milk intake',
        kpis: [
          { title: 'Current shift', keys: ['shiftName', 'currentShift', 'shift', 'currentShiftName'], icon: 'bi-clock', color: 'primary', format: 'none', link: '/collection', perm: 'collection.view' },
          { title: 'Farmers served', keys: ['farmersServed', 'farmers'], icon: 'bi-people', color: 'info', format: 'number', link: '/collection/history', query: day, perm: 'collection.view' },
          { title: 'Liters collected', keys: ['totalLiters', 'totalLitres', 'liters', 'litres', 'quantity'], icon: 'bi-droplet-fill', color: 'primary', format: 'number', suffix: 'L', link: '/collection/history', query: day, perm: 'collection.view' },
          { title: 'Average FAT', keys: ['avgFat', 'averageFat'], icon: 'bi-moisture', color: 'secondary', format: 'number', suffix: '%', link: '/collection/quality', query: day, perm: ['collection.quality.record', 'collection.view'] },
          { title: 'Average SNF', keys: ['avgSnf', 'averageSnf'], icon: 'bi-clipboard-data', color: 'secondary', format: 'number', suffix: '%', link: '/collection/quality', query: day, perm: ['collection.quality.record', 'collection.view'] },
          { title: 'Accepted', keys: ['acceptedCount', 'accepted'], icon: 'bi-check-circle', color: 'success', format: 'number', link: '/collection/history', query: { ...day, status: 'Approved' }, perm: 'collection.view' },
          { title: 'Rejected', keys: ['rejectedCount', 'rejected'], icon: 'bi-x-octagon', color: 'danger', format: 'number', link: '/collection/rejections', query: day, perm: 'collection.view' },
          { title: 'Pending approvals', keys: ['pendingApprovals', 'pending'], icon: 'bi-hourglass-split', color: 'warning', format: 'number', link: '/collection/approval', perm: ['collection.approve', 'collection.reject'] },
        ],
      };
    case 'inventory':
      return {
        title: 'Inventory dashboard',
        subtitle: 'Stock position, alerts and consumption',
        kpis: [
          { title: 'Stock value', keys: ['summary.stockValue', 'stockValue', 'totalStockValue'], icon: 'bi-currency-rupee', color: 'success', format: 'currency', link: '/inventory/stock', perm: 'inventory.view' },
          { title: 'Low stock items', keys: ['summary.lowStockCount', 'lowStockCount', 'lowStock'], icon: 'bi-exclamation-triangle', color: 'warning', format: 'number', link: '/inventory/alerts', query: { type: 'low-stock' }, perm: 'inventory.view' },
          { title: 'Expiring batches', keys: ['summary.expiringBatchCount', 'expiringBatchCount', 'expiringInventoryCount'], icon: 'bi-hourglass-bottom', color: 'danger', format: 'number', link: '/inventory/alerts', query: { type: 'expiring' }, perm: 'inventory.view' },
          { title: 'Recent purchases', keys: ['recentPurchases', 'recentPurchasesCount', 'purchasesThisMonth'], icon: 'bi-cart-plus', color: 'info', format: 'number', link: '/inventory/purchases', perm: 'purchase.view' },
        ],
      };
    default:
      return {
        title: 'My dashboard',
        subtitle: 'Subscription, deliveries and billing',
        kpis: [
          { title: 'Subscription', keys: ['subscriptions', 'subscription', 'activeSubscriptions', 'subscriptionCount'], icon: 'bi-calendar-check', color: 'primary', format: 'none', link: '/subscriptions', perm: 'subscription.view' },
          { title: "Today's delivery", keys: ['todayDeliveries.0.deliveryStatus', 'todayDeliveries.0.orderStatus', 'todayDeliveryStatus', 'todayDelivery'], icon: 'bi-truck', color: 'info', format: 'none', link: '/delivery', perm: 'delivery.view' },
          { title: 'Current bill', keys: ['currentBill.balanceAmount', 'currentBill.totalAmount', 'currentBill', 'currentBillAmount'], icon: 'bi-receipt', color: 'warning', format: 'currency', link: '/billing/invoices', perm: 'invoice.view' },
          { title: 'Outstanding', keys: ['outstanding.outstandingBalance', 'outstanding', 'outstandingAmount'], icon: 'bi-hourglass-split', color: 'danger', format: 'currency', link: '/billing/outstanding', perm: 'invoice.view' },
          { title: 'Open complaints', keys: ['openComplaints', 'complaints'], icon: 'bi-chat-left-dots', color: 'secondary', format: 'number', link: '/customers/complaints', perm: 'complaint.view' },
        ],
      };
  }
}

interface ChartBlock {
  key: string;
  title: string;
  type: ChartType;
  labels: string[];
  datasets: unknown[];
}

interface TableBlock {
  key: string;
  title: string;
  headers: string[];
  rows: string[][];
}

const isPoint = (o: unknown): boolean =>
  !!o && typeof o === 'object' && ('label' in (o as object) || 'name' in (o as object)) && 'value' in (o as object);

/** Collection / Inventory / Customer dashboards: KPI cards from known keys + auto-rendered charts and tables for array fields. */
@Component({
  selector: 'app-variant-dashboard',
  standalone: true,
  imports: [PageHeaderComponent, KpiCardComponent, ChartComponent],
  template: `
    <app-page-header [title]="cfg().title" [subtitle]="cfg().subtitle + ' · ' + todayLabel">
      <button type="button" class="btn btn-outline-primary btn-sm" (click)="load()" [disabled]="loading()">
        <i class="bi bi-arrow-clockwise me-1"></i>Refresh
      </button>
    </app-page-header>

    @if (error()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
        <span><i class="bi bi-exclamation-octagon me-2"></i>{{ error() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="load()">Retry</button>
      </div>
    }

    <div class="row g-3 mb-4">
      @for (k of kpis(); track k.title) {
        <div class="col-12 col-sm-6 col-xl-3">
          <app-kpi-card
            [title]="k.title"
            [value]="k.value"
            [icon]="k.icon"
            [color]="k.color"
            [format]="k.format"
            [suffix]="k.suffix ?? ''"
            [loading]="loading()"
            [link]="k.link"
            [queryParams]="k.query ?? null"
          />
        </div>
      }
    </div>

    @if (charts().length) {
      <div class="row g-3 mb-4">
        @for (c of charts(); track c.key) {
          <div class="col-12 col-lg-6">
            <div class="card chart-card h-100">
              <div class="card-header">{{ c.title }}</div>
              <div class="card-body"><app-chart [type]="c.type" [labels]="c.labels" [datasets]="c.datasets" [height]="260" /></div>
            </div>
          </div>
        }
      </div>
    }

    @for (t of tables(); track t.key) {
      <div class="card mb-4">
        <div class="card-header">{{ t.title }}</div>
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 app-table">
            <thead>
              <tr>
                @for (h of t.headers; track h) {
                  <th>{{ h }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of t.rows; track $index) {
                <tr>
                  @for (cell of row; track $index) {
                    <td>{{ cell }}</td>
                  }
                </tr>
              } @empty {
                <tr><td [attr.colspan]="t.headers.length" class="text-center text-muted py-4">Nothing to show</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
})
export class VariantDashboardComponent implements OnInit {
  readonly name = input.required<DashboardVariantName>();

  private readonly svc = inject(DashboardService);
  private readonly perm = inject(PermissionService);

  private readonly today = toIsoDate();
  protected readonly todayLabel = formatDate(this.today);

  readonly data = signal<DashboardVariantData | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  protected readonly cfg = computed(() => config(this.name(), this.today));

  protected readonly kpis = computed(() =>
    this.cfg().kpis.map((k) => ({
      ...k,
      value: pickValue(this.data(), k.keys),
      link: this.perm.check(k.perm) ? k.link : null,
    })),
  );

  protected readonly charts = computed<ChartBlock[]>(() => {
    const d = this.data() ?? {};
    return Object.entries(d)
      .filter(([, v]) => Array.isArray(v) && v.length > 0 && v.every(isPoint))
      .map(([key, v]) => {
        const s = toSeries(v as unknown[]);
        return {
          key,
          title: humanize(key),
          type: (/trend|daily|weekly|monthly/i.test(key) ? 'line' : 'bar') as ChartType,
          labels: s.labels,
          datasets: [{ label: humanize(key), data: s.values }],
        };
      });
  });

  protected readonly tables = computed<TableBlock[]>(() => {
    const d = this.data() ?? {};
    return Object.entries(d)
      .filter(([, v]) => Array.isArray(v) && v.length > 0 && !v.every(isPoint) && typeof v[0] === 'object' && v[0] !== null)
      .map(([key, v]) => {
        const rows = v as Record<string, unknown>[];
        const cols = Object.keys(rows[0])
          .filter((c) => c.toLowerCase() !== 'id' && typeof rows[0][c] !== 'object')
          .slice(0, 6);
        return {
          key,
          title: humanize(key),
          headers: cols.map(humanize),
          rows: rows.slice(0, 10).map((r) => cols.map((c) => formatCell(r[c]))),
        };
      });
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.variant(this.name()).subscribe({
      next: (d) => {
        this.data.set(d ?? {});
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e, 'Could not load dashboard.'));
        this.loading.set(false);
      },
    });
  }
}
