import { Component, computed, inject, signal } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import type { ChartType } from 'chart.js';
import { PermissionService } from '../../../core/services/permission.service';
import { errorMessage } from '../../../core/utils/http-error';
import { ChartComponent } from '../../../shared/components/chart/chart.component';
import { KpiCardComponent, KpiColor } from '../../../shared/components/kpi-card/kpi-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

import { formatDate, toIsoDate } from '../../../shared/utils/format';
import { DashboardCharts, DashboardSummary } from '../dashboard.model';
import { DashboardService } from '../dashboard.service';
import { toSeries } from '../dashboard.util';

interface KpiDef {
  key: string;
  title: string;
  icon: string;
  color: KpiColor;
  format: 'number' | 'currency' | 'percent';
  suffix?: string;
  subtitle?: string;
  link: string;
  query?: Params;
  perm?: string | string[];
}

interface KpiSection {
  title: string;
  kpis: KpiDef[];
}

interface ChartDef {
  key: keyof DashboardCharts;
  title: string;
  type: ChartType;
  seriesLabel: string;
  col: string;
  options?: unknown;
  link?: string;
  perm?: string | string[];
}

function buildSections(today: string, monthStart: string): KpiSection[] {
  const day: Params = { from: today, to: today };
  return [
    {
      title: 'Milk collection today',
      kpis: [
        { key: 'milkCollectedToday', title: 'Milk collected', icon: 'bi-droplet-fill', color: 'primary', format: 'number', suffix: 'L', subtitle: 'all shifts', link: '/collection/history', query: day, perm: 'collection.view' },
        { key: 'morningCollection', title: 'Morning shift', icon: 'bi-sunrise', color: 'info', format: 'number', suffix: 'L', link: '/collection/history', query: { ...day, shift: 'Morning' }, perm: 'collection.view' },
        { key: 'eveningCollection', title: 'Evening shift', icon: 'bi-sunset', color: 'warning', format: 'number', suffix: 'L', link: '/collection/history', query: { ...day, shift: 'Evening' }, perm: 'collection.view' },
        { key: 'avgFat', title: 'Average FAT', icon: 'bi-moisture', color: 'secondary', format: 'number', suffix: '%', link: '/collection/quality', query: day, perm: ['collection.quality.record', 'collection.view'] },
        { key: 'avgSnf', title: 'Average SNF', icon: 'bi-clipboard-data', color: 'secondary', format: 'number', suffix: '%', link: '/collection/quality', query: day, perm: ['collection.quality.record', 'collection.view'] },
        { key: 'todayMilkValue', title: "Today's milk value", icon: 'bi-currency-rupee', color: 'success', format: 'currency', link: '/collection/history', query: day, perm: 'collection.view' },
      ],
    },
    {
      title: 'Sales & finance',
      kpis: [
        { key: 'salesToday', title: 'Sales today', icon: 'bi-bag-check', color: 'primary', format: 'currency', link: '/orders', query: day, perm: 'order.view' },
        { key: 'salesThisMonth', title: 'Sales this month', icon: 'bi-graph-up-arrow', color: 'info', format: 'currency', link: '/billing/invoices', query: { from: monthStart, to: today }, perm: 'invoice.view' },
        { key: 'revenue', title: 'Revenue', icon: 'bi-cash-stack', color: 'success', format: 'currency', subtitle: 'this month', link: '/billing/payments', query: { from: monthStart, to: today }, perm: 'custpayment.view' },
        { key: 'expenses', title: 'Expenses', icon: 'bi-wallet2', color: 'danger', format: 'currency', subtitle: 'this month', link: '/expenses', query: { from: monthStart, to: today }, perm: 'expense.view' },
        { key: 'profit', title: 'Profit', icon: 'bi-piggy-bank', color: 'success', format: 'currency', subtitle: 'revenue - expenses', link: '/reports', perm: 'report.view' },
        { key: 'farmerOutstanding', title: 'Farmer outstanding', icon: 'bi-person-down', color: 'warning', format: 'currency', subtitle: 'payable to farmers', link: '/collection/settlement', perm: 'payment.view' },
        { key: 'customerOutstanding', title: 'Customer outstanding', icon: 'bi-hourglass-split', color: 'danger', format: 'currency', subtitle: 'receivable', link: '/billing/outstanding', perm: 'invoice.view' },
      ],
    },
    {
      title: 'Operations & alerts',
      kpis: [
        { key: 'activeSubscriptions', title: 'Active subscriptions', icon: 'bi-calendar-check', color: 'primary', format: 'number', link: '/subscriptions', query: { status: 'Active' }, perm: 'subscription.view' },
        { key: 'deliverySuccessRate', title: 'Delivery success rate', icon: 'bi-truck', color: 'success', format: 'percent', link: '/delivery', perm: 'delivery.view' },
        { key: 'lowStockCount', title: 'Low stock items', icon: 'bi-exclamation-triangle', color: 'warning', format: 'number', link: '/inventory/alerts', query: { type: 'low-stock' }, perm: 'inventory.view' },
        { key: 'expiringInventoryCount', title: 'Expiring inventory', icon: 'bi-hourglass-bottom', color: 'danger', format: 'number', link: '/inventory/alerts', query: { type: 'expiring' }, perm: 'inventory.view' },
        { key: 'sickAnimals', title: 'Sick animals', icon: 'bi-heart-pulse', color: 'danger', format: 'number', link: '/animals', query: { healthStatus: 'Sick' }, perm: 'animal.view' },
        { key: 'vaccinationsDue', title: 'Vaccinations due', icon: 'bi-shield-plus', color: 'warning', format: 'number', link: '/animals', query: { vaccinationDue: true }, perm: 'animal.view' },
        { key: 'maintenanceDue', title: 'Maintenance due', icon: 'bi-tools', color: 'warning', format: 'number', link: '/maintenance/schedules', query: { due: true }, perm: 'maintenance.view' },
      ],
    },
  ];
}

const CHARTS: ChartDef[] = [
  { key: 'milkCollectionTrend', title: 'Milk collection trend (litres)', type: 'line', seriesLabel: 'Litres', col: 'col-lg-8', link: '/collection/history', perm: 'collection.view' },
  { key: 'collectionByCenter', title: 'Collection by center', type: 'doughnut', seriesLabel: 'Litres', col: 'col-lg-4' },
  { key: 'salesTrend', title: 'Sales trend', type: 'bar', seriesLabel: 'Sales (₹)', col: 'col-lg-6', link: '/billing/invoices', perm: 'invoice.view' },
  { key: 'topFarmers', title: 'Top farmers (litres)', type: 'bar', seriesLabel: 'Litres', col: 'col-lg-6', options: { indexAxis: 'y' }, link: '/farmers', perm: 'farmer.view' },
  { key: 'productSales', title: 'Product sales', type: 'bar', seriesLabel: 'Sales (₹)', col: 'col-lg-6', link: '/products', perm: 'product.view' },
  { key: 'expenseCategories', title: 'Expenses by category', type: 'pie', seriesLabel: 'Amount (₹)', col: 'col-lg-6', link: '/expenses', perm: 'expense.view' },
];

@Component({
  selector: 'app-owner-dashboard',
  standalone: true,
  imports: [PageHeaderComponent, KpiCardComponent, ChartComponent, RouterLink],
  template: `
    <app-page-header title="Dashboard" [subtitle]="'Business overview for ' + todayLabel">
      <button type="button" class="btn btn-outline-primary btn-sm" (click)="reload()" [disabled]="loadingSummary() || loadingCharts()">
        <i class="bi bi-arrow-clockwise me-1"></i>Refresh
      </button>
    </app-page-header>

    @if (summaryError()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
        <span><i class="bi bi-exclamation-octagon me-2"></i>{{ summaryError() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="reload()">Retry</button>
      </div>
    }

    @for (section of sections; track section.title) {
      <h2 class="section-title">{{ section.title }}</h2>
      <div class="row g-3 mb-4">
        @for (k of section.kpis; track k.key) {
          <div class="col-12 col-sm-6 col-xl-3">
            <app-kpi-card
              [title]="k.title"
              [value]="summary()?.[k.key]"
              [icon]="k.icon"
              [color]="k.color"
              [format]="k.format"
              [suffix]="k.suffix ?? ''"
              [subtitle]="k.subtitle ?? ''"
              [loading]="loadingSummary()"
              [link]="perm.check(k.perm) ? k.link : null"
              [queryParams]="k.query ?? null"
            />
          </div>
        }
      </div>
    }

    <h2 class="section-title">Trends & breakdowns</h2>
    @if (chartsError()) {
      <div class="alert alert-warning d-flex justify-content-between align-items-center" role="alert">
        <span>{{ chartsError() }}</span>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="loadCharts()">Retry</button>
      </div>
    }
    <div class="row g-3 mb-4">
      @for (c of chartModels(); track c.key) {
        <div [class]="'col-12 ' + c.col">
          <div class="card chart-card h-100">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span>{{ c.title }}</span>
              @if (c.link) {
                <a class="small" [routerLink]="c.link">View data</a>
              }
            </div>
            <div class="card-body">
              @if (loadingCharts()) {
                <div class="chart-empty" style="height: 280px"><span class="spinner-border spinner-border-sm me-2"></span>Loading...</div>
              } @else {
                <app-chart [type]="c.type" [labels]="c.labels" [datasets]="c.datasets" [options]="c.options" [height]="280" />
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class OwnerDashboardComponent {
  private readonly svc = inject(DashboardService);
  protected readonly perm = inject(PermissionService);

  private readonly today = toIsoDate();
  protected readonly todayLabel = formatDate(this.today);
  protected readonly sections = buildSections(this.today, toIsoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));

  readonly summary = signal<DashboardSummary | null>(null);
  readonly charts = signal<DashboardCharts | null>(null);
  readonly loadingSummary = signal(true);
  readonly loadingCharts = signal(true);
  readonly summaryError = signal<string | null>(null);
  readonly chartsError = signal<string | null>(null);

  protected readonly chartModels = computed(() => {
    const data = this.charts();
    return CHARTS.filter((c) => !c.perm || this.perm.check(c.perm)).map((c) => {
      const s = toSeries(data?.[c.key]);
      return {
        key: c.key,
        title: c.title,
        type: c.type,
        col: c.col,
        link: c.link,
        options: c.options,
        labels: s.labels,
        datasets: [{ label: c.seriesLabel, data: s.values }],
      };
    });
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loadSummary();
    this.loadCharts();
  }

  loadSummary(): void {
    this.loadingSummary.set(true);
    this.summaryError.set(null);
    this.svc.summary().subscribe({
      next: (d) => {
        this.summary.set(d);
        this.loadingSummary.set(false);
      },
      error: (e) => {
        this.summaryError.set(errorMessage(e, 'Could not load dashboard summary.'));
        this.loadingSummary.set(false);
      },
    });
  }

  loadCharts(): void {
    this.loadingCharts.set(true);
    this.chartsError.set(null);
    this.svc.charts().subscribe({
      next: (d) => {
        this.charts.set(d);
        this.loadingCharts.set(false);
      },
      error: (e) => {
        this.chartsError.set(errorMessage(e, 'Could not load dashboard charts.'));
        this.loadingCharts.set(false);
      },
    });
  }
}
