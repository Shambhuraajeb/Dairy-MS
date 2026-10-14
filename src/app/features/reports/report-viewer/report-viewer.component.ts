import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, ViewEncapsulation, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { EMPTY, Observable, Subject, catchError, combineLatest, map, switchMap } from 'rxjs';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { AppCurrencyPipe, AppDatePipe, AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { ChartComponent } from '../../../shared/components/chart/chart.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { formatDate, formatNumber, toIsoDate } from '../../../shared/utils/format';
import { REPORT_FILTER_KEYS, ReportCatalogItem, ReportColumn, ReportResult, ReportRow } from '../report.model';
import { ReportsService } from '../reports.service';

type CellKind = 'text' | 'number' | 'currency' | 'percent' | 'date' | 'datetime' | 'boolean' | 'badge';
type KpiTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'secondary';
type Preset = 'today' | 'yesterday' | 'thisMonth' | 'lastMonth';

interface DisplayColumn {
  key: string;
  label: string;
  kind: CellKind;
  right: boolean;
}

interface ExtraSection {
  key: string;
  title: string;
  columns: DisplayColumn[];
  rows: ReportRow[];
  chartType: 'doughnut' | 'bar';
  chartLabels: string[];
  chartDatasets: { label: string; data: number[] }[];
}

interface SummaryItem {
  key: string;
  label: string;
  value: number;
  currency: boolean;
  color: KpiTone;
}

const NUMERIC_KINDS: ReadonlySet<CellKind> = new Set<CellKind>(['number', 'currency', 'percent']);
const PERCENT_KEY = /percent|successRate/i;
const BADGE_KEY = /(status|result|severity)$/i;
const MONEY_KEY = /amount|total|cost|value|price|revenue|expense|profit|income/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T/;

/** reports whose date window is forward looking: do not default to the current month */
const FORWARD_LOOKING: ReadonlySet<string> = new Set(['vaccination-due', 'expiring-batches']);

const MILK_STATUS = ['Pending', 'Approved', 'Rejected'];
const STATUS_OPTIONS: Record<string, string[]> = {
  'daily-collection': MILK_STATUS,
  'shift-collection': MILK_STATUS,
  'farmer-collection': MILK_STATUS,
  'milk-quality': MILK_STATUS,
  'rejected-milk': MILK_STATUS,
  'farmer-settlement': ['Draft', 'Approved', 'Paid', 'Cancelled'],
  'animal-health': ['Open', 'Ongoing', 'Recovered'],
  'vaccination-due': ['Due', 'Overdue'],
  sales: ['Pending', 'Confirmed', 'Scheduled', 'Dispatched', 'Delivered', 'Cancelled', 'Failed'],
  'customer-outstanding': ['Issued', 'PartiallyPaid', 'Paid', 'Cancelled'],
  revenue: ['Issued', 'PartiallyPaid', 'Paid', 'Cancelled'],
  'delivery-performance': ['Pending', 'Dispatched', 'Delivered', 'Failed'],
  expenses: ['Pending', 'Approved', 'Rejected'],
};

const BLANK_FILTERS = {
  from: '',
  to: '',
  branchId: '',
  collectionCenterId: '',
  farmerId: '',
  customerId: '',
  productId: '',
  shiftId: '',
  itemId: '',
  categoryId: '',
  status: '',
};

function humanize(key: string): string {
  const s = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function kindFor(c: ReportColumn): CellKind {
  switch ((c.type ?? '').toLowerCase()) {
    case 'money':
    case 'currency':
      return 'currency';
    case 'percent':
      return 'percent';
    case 'date':
      return 'date';
    case 'datetime':
      return 'datetime';
    case 'boolean':
      return 'boolean';
    case 'number':
    case 'int':
    case 'decimal':
      return PERCENT_KEY.test(c.key) ? 'percent' : 'number';
    default:
      return BADGE_KEY.test(c.key) ? 'badge' : 'text';
  }
}

function inferKind(key: string, sample: unknown): CellKind {
  if (typeof sample === 'boolean') {
    return 'boolean';
  }
  if (typeof sample === 'number') {
    return PERCENT_KEY.test(key) ? 'percent' : MONEY_KEY.test(key) ? 'currency' : 'number';
  }
  if (typeof sample === 'string') {
    if (ISO_DATE.test(sample)) {
      return 'date';
    }
    if (ISO_DATETIME.test(sample)) {
      return 'datetime';
    }
    return BADGE_KEY.test(key) ? 'badge' : 'text';
  }
  return 'text';
}

function display(key: string, label: string, kind: CellKind): DisplayColumn {
  return { key, label, kind, right: NUMERIC_KINDS.has(kind) };
}

function signature(code: string, params: Record<string, string>): string {
  return `${code}|${JSON.stringify(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)))}`;
}

@Component({
  selector: 'app-report-viewer',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    PaginationComponent,
    StatusBadgeComponent,
    KpiCardComponent,
    ChartComponent,
    AppCurrencyPipe,
    AppDatePipe,
    AppNumberPipe,
  ],
  templateUrl: './report-viewer.component.html',
  styleUrl: './report-viewer.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class ReportViewerComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reports = inject(ReportsService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly form = this.fb.group({ ...BLANK_FILTERS });

  readonly entry = signal<ReportCatalogItem | null>(null);
  readonly notFound = signal(false);
  readonly catalogError = signal<string | null>(null);
  readonly catalogLoading = signal(true);

  readonly result = signal<ReportResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly exporting = signal(false);
  readonly ranAt = signal<Date | null>(null);
  readonly appliedFilters = signal<{ label: string; value: string }[]>([]);

  readonly page = signal(1);
  readonly pageSize = signal(50);
  readonly pageSizeOptions = [25, 50, 100, 200];
  readonly printAll = signal(false);
  readonly sortKey = signal<string | null>(null);
  readonly sortDir = signal<'asc' | 'desc'>('asc');

  readonly branches = signal<LookupItem[]>([]);
  readonly centers = signal<LookupItem[]>([]);
  readonly shifts = signal<LookupItem[]>([]);
  readonly farmers = signal<LookupItem[]>([]);
  readonly customers = signal<LookupItem[]>([]);
  readonly products = signal<LookupItem[]>([]);
  readonly items = signal<LookupItem[]>([]);
  readonly categories = signal<LookupItem[]>([]);

  readonly supports = computed(() => new Set(this.entry()?.filters ?? []));
  readonly hasDates = computed(() => this.supports().has('from') || this.supports().has('to'));
  readonly statusOptions = computed(() => STATUS_OPTIONS[this.entry()?.code ?? ''] ?? null);
  readonly toLabel = computed(() => {
    switch (this.entry()?.code) {
      case 'vaccination-due':
        return 'Due until';
      case 'expiring-batches':
        return 'Expiring until';
      default:
        return 'To';
    }
  });
  readonly categoryLabel = computed(() => (this.entry()?.code === 'expenses' ? 'Expense category' : 'Item category'));

  readonly columns = computed<DisplayColumn[]>(() => {
    const r = this.result();
    if (!r) {
      return [];
    }
    if (r.columns?.length) {
      return r.columns.map((c) => display(c.key, c.label, kindFor(c)));
    }
    const first = r.rows?.[0];
    if (!first) {
      return [];
    }
    return Object.keys(first)
      .filter((k) => k.toLowerCase() !== 'id')
      .map((k) => display(k, humanize(k), inferKind(k, first[k])));
  });

  readonly totals = computed<Record<string, unknown>>(() => this.result()?.totals ?? {});

  readonly hasTotalsRow = computed(() => {
    const t = this.totals();
    return this.columns().some((c) => t[c.key] !== null && t[c.key] !== undefined);
  });

  readonly summary = computed<SummaryItem[]>(() => {
    const t = this.result()?.totals;
    if (!t) {
      return [];
    }
    const keys = new Set(this.columns().map((c) => c.key));
    const isPl = this.result()?.code === 'profit-loss';
    return Object.entries(t)
      .filter(([k, v]) => !keys.has(k) && v !== null && v !== '' && v !== undefined && !isNaN(Number(v)))
      .map(([k, v]) => {
        const value = Number(v);
        const color: KpiTone =
          k === 'profit' ? (value >= 0 ? 'success' : 'danger') : k === 'revenue' ? 'primary' : 'secondary';
        return { key: k, label: humanize(k), value, currency: isPl || MONEY_KEY.test(k), color };
      });
  });

  readonly sortedRows = computed<ReportRow[]>(() => {
    const rows = this.result()?.rows ?? [];
    const key = this.sortKey();
    if (!key) {
      return rows;
    }
    const col = this.columns().find((c) => c.key === key);
    const numeric = !!col && NUMERIC_KINDS.has(col.kind);
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = a[key];
      const y = b[key];
      const xe = x === null || x === undefined || x === '';
      const ye = y === null || y === undefined || y === '';
      if (xe && ye) {
        return 0;
      }
      if (xe) {
        return 1;
      }
      if (ye) {
        return -1;
      }
      return dir * (numeric ? Number(x) - Number(y) : String(x).localeCompare(String(y)));
    });
  });

  readonly totalRows = computed(() => this.result()?.rows?.length ?? 0);

  readonly visibleRows = computed<ReportRow[]>(() => {
    const all = this.sortedRows();
    if (this.printAll()) {
      return all;
    }
    const start = (this.page() - 1) * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });

  readonly extraSections = computed<ExtraSection[]>(() => {
    const extra = this.result()?.extra;
    if (!extra) {
      return [];
    }
    const out: ExtraSection[] = [];
    for (const [key, value] of Object.entries(extra)) {
      if (!Array.isArray(value) || value.length === 0 || typeof value[0] !== 'object' || value[0] === null) {
        continue;
      }
      const rows = value as ReportRow[];
      const keys = Object.keys(rows[0]).filter((k) => k.toLowerCase() !== 'id');
      const columns = keys.map((k) => display(k, humanize(k), inferKind(k, rows[0][k])));
      const numKey = keys.find((k) => typeof rows[0][k] === 'number');
      const labelKey = keys.find((k) => typeof rows[0][k] === 'string');
      const chartable = !!numKey && !!labelKey && keys.length <= 3 && rows.length <= 15;
      out.push({
        key,
        title: humanize(key),
        columns,
        rows,
        chartType: rows.length <= 8 ? 'doughnut' : 'bar',
        chartLabels: chartable ? rows.map((r) => String(r[labelKey!] ?? '')) : [],
        chartDatasets: chartable ? [{ label: humanize(key), data: rows.map((r) => Number(r[numKey!]) || 0) }] : [],
      });
    }
    return out;
  });

  readonly extraScalars = computed(() => {
    const extra = this.result()?.extra;
    if (!extra) {
      return [] as { label: string; text: string }[];
    }
    return Object.entries(extra)
      .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      .map(([k, v]) => ({ label: humanize(k), text: typeof v === 'number' ? formatNumber(v, 2) : String(v) }));
  });

  private lastSig = '';
  private lastParams: Record<string, string> = {};
  private seq = 0;
  private readonly reloadCenters$ = new Subject<void>();
  private readonly reloadShifts$ = new Subject<void>();

  constructor() {
    document.body.classList.add('report-printing');
    inject(DestroyRef).onDestroy(() => document.body.classList.remove('report-printing'));

    this.reloadCenters$
      .pipe(
        switchMap(() => {
          const b = this.form.controls.branchId.value;
          return this.supports().has('collectionCenterId')
            ? this.lookups.get('collection-centers', b ? { parentId: b } : undefined)
            : EMPTY;
        }),
        takeUntilDestroyed(),
      )
      .subscribe((list) => {
        this.centers.set(list);
        const ctl = this.form.controls.collectionCenterId;
        if (ctl.value && !list.some((x) => String(x.id) === ctl.value)) {
          ctl.setValue('');
        }
      });

    this.reloadShifts$
      .pipe(
        switchMap(() => {
          const c = this.form.controls.collectionCenterId.value;
          return this.supports().has('shiftId') ? this.lookups.get('shifts', c ? { parentId: c } : undefined) : EMPTY;
        }),
        takeUntilDestroyed(),
      )
      .subscribe((list) => {
        this.shifts.set(list);
        const ctl = this.form.controls.shiftId;
        if (ctl.value && !list.some((x) => String(x.id) === ctl.value)) {
          ctl.setValue('');
        }
      });

    this.form.controls.branchId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.reloadCenters$.next());
    this.form.controls.collectionCenterId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.reloadShifts$.next());

    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([pm, qp]) => {
          this.catalogLoading.set(true);
          this.catalogError.set(null);
          return this.reports.catalog().pipe(
            map((cat) => ({ code: pm.get('code') ?? '', qp, cat })),
            catchError((err) => {
              this.catalogError.set(errorMessage(err));
              this.catalogLoading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(({ code, qp, cat }) => {
        this.catalogLoading.set(false);
        this.onRoute(code, qp, cat);
      });
  }

  private onRoute(code: string, qp: ParamMap, cat: ReportCatalogItem[]): void {
    const entry = cat.find((c) => c.code === code) ?? null;
    if (!entry) {
      this.entry.set(null);
      this.result.set(null);
      this.notFound.set(true);
      return;
    }
    this.notFound.set(false);
    const changed = this.entry()?.code !== entry.code;
    this.entry.set(entry);
    const sup = new Set(entry.filters);

    const params: Record<string, string> = {};
    for (const k of REPORT_FILTER_KEYS) {
      const v = qp.get(k);
      if (sup.has(k) && v) {
        params[k] = v;
      }
    }

    if (changed) {
      this.result.set(null);
      this.error.set(null);
      this.lastSig = '';
      this.page.set(1);
      this.sortKey.set(null);
      this.categories.set([]);
      if (sup.has('from') && sup.has('to') && !qp.has('from') && !qp.has('to') && !FORWARD_LOOKING.has(code)) {
        const now = new Date();
        params['from'] = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
        params['to'] = toIsoDate(now);
      }
    }

    this.form.reset({ ...BLANK_FILTERS, ...params });
    this.loadLookups(entry, sup);

    if (signature(code, params) !== this.lastSig) {
      this.fetch(code, params);
    }
  }

  private loadLookups(entry: ReportCatalogItem, sup: Set<string>): void {
    const load = (flag: string, src: Observable<LookupItem[]>, target: WritableSignal<LookupItem[]>) => {
      if (sup.has(flag)) {
        src.subscribe((l) => target.set(l));
      }
    };
    load('branchId', this.lookups.get('branches'), this.branches);
    load('farmerId', this.lookups.farmers(), this.farmers);
    load('customerId', this.lookups.customers(), this.customers);
    load('productId', this.lookups.products(), this.products);
    load('itemId', this.lookups.items(), this.items);
    load(
      'categoryId',
      this.lookups.get(entry.code === 'expenses' ? 'expense-categories' : 'item-categories'),
      this.categories,
    );
    this.reloadCenters$.next();
    this.reloadShifts$.next();
  }

  private filterParams(): Record<string, string> {
    const raw: Record<string, string> = this.form.getRawValue();
    const sup = this.supports();
    const out: Record<string, string> = {};
    for (const k of REPORT_FILTER_KEYS) {
      if (sup.has(k) && raw[k]) {
        out[k] = raw[k];
      }
    }
    return out;
  }

  private fetch(code: string, params: Record<string, string>): void {
    const id = ++this.seq;
    this.lastSig = signature(code, params);
    this.lastParams = params;
    this.loading.set(true);
    this.error.set(null);
    this.page.set(1);
    this.appliedFilters.set(this.describe(params));
    this.reports.run(code, params).subscribe({
      next: (r) => {
        if (id !== this.seq) {
          return;
        }
        this.result.set(r);
        this.sortKey.set(null);
        this.ranAt.set(new Date());
        this.loading.set(false);
      },
      error: (err) => {
        if (id !== this.seq) {
          return;
        }
        this.result.set(null);
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  private describe(p: Record<string, string>): { label: string; value: string }[] {
    const name = (list: LookupItem[], v: string) => list.find((x) => String(x.id) === v)?.name ?? v;
    const out: { label: string; value: string }[] = [];
    if (p['from']) {
      out.push({ label: 'From', value: formatDate(p['from']) });
    }
    if (p['to']) {
      out.push({ label: this.toLabel(), value: formatDate(p['to']) });
    }
    if (p['branchId']) {
      out.push({ label: 'Branch', value: name(this.branches(), p['branchId']) });
    }
    if (p['collectionCenterId']) {
      out.push({ label: 'Collection center', value: name(this.centers(), p['collectionCenterId']) });
    }
    if (p['shiftId']) {
      out.push({ label: 'Shift', value: name(this.shifts(), p['shiftId']) });
    }
    if (p['farmerId']) {
      out.push({ label: 'Farmer', value: name(this.farmers(), p['farmerId']) });
    }
    if (p['customerId']) {
      out.push({ label: 'Customer', value: name(this.customers(), p['customerId']) });
    }
    if (p['productId']) {
      out.push({ label: 'Product', value: name(this.products(), p['productId']) });
    }
    if (p['itemId']) {
      out.push({ label: 'Item', value: name(this.items(), p['itemId']) });
    }
    if (p['categoryId']) {
      out.push({ label: this.categoryLabel(), value: name(this.categories(), p['categoryId']) });
    }
    if (p['status']) {
      out.push({ label: 'Status', value: p['status'] });
    }
    return out;
  }

  run(): void {
    const e = this.entry();
    if (!e) {
      return;
    }
    const params = this.filterParams();
    if (params['from'] && params['to'] && params['from'] > params['to']) {
      this.toast.warning('The start date cannot be after the end date.');
      return;
    }
    this.fetch(e.code, params);
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, replaceUrl: true });
  }

  reset(): void {
    const e = this.entry();
    if (!e) {
      return;
    }
    this.form.reset({ ...BLANK_FILTERS });
    this.run();
  }

  applyPreset(kind: Preset): void {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let from: Date;
    let to: Date;
    switch (kind) {
      case 'today':
        from = to = now;
        break;
      case 'yesterday':
        from = to = new Date(y, m, now.getDate() - 1);
        break;
      case 'thisMonth':
        from = new Date(y, m, 1);
        to = now;
        break;
      default:
        from = new Date(y, m - 1, 1);
        to = new Date(y, m, 0);
        break;
    }
    this.form.patchValue({ from: toIsoDate(from), to: toIsoDate(to) });
    this.run();
  }

  retry(): void {
    const e = this.entry();
    if (e) {
      this.fetch(e.code, this.lastParams);
    }
  }

  sortBy(key: string): void {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
    this.page.set(1);
  }

  setPageSize(value: string): void {
    this.pageSize.set(Number(value) || 50);
    this.page.set(1);
  }

  exportCsv(): void {
    const e = this.entry();
    if (!e || this.exporting()) {
      return;
    }
    this.exporting.set(true);
    this.reports.exportCsv(e.code, this.lastParams, `${e.code}-${toIsoDate()}.csv`).subscribe({
      next: () => this.exporting.set(false),
      error: () => this.exporting.set(false),
    });
  }

  print(): void {
    this.printAll.set(true);
    setTimeout(() => {
      window.print();
      this.printAll.set(false);
    }, 100);
  }
}
