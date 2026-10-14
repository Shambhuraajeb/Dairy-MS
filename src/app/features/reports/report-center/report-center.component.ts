import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../../../core/utils/http-error';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ReportCatalogItem } from '../report.model';
import { ReportsService } from '../reports.service';

const GROUP_ICONS: Record<string, string> = {
  Collection: 'bi-droplet-half',
  'Farmer Payments': 'bi-cash-coin',
  Animals: 'bi-heart-pulse',
  Inventory: 'bi-box-seam',
  Sales: 'bi-cart-check',
  Finance: 'bi-bank',
};

const CODE_ICONS: Record<string, string> = {
  'daily-collection': 'bi-calendar-day',
  'shift-collection': 'bi-sunrise',
  'farmer-collection': 'bi-person-lines-fill',
  'milk-quality': 'bi-clipboard2-pulse',
  'rejected-milk': 'bi-x-octagon',
  'farmer-settlement': 'bi-receipt',
  'farmer-outstanding': 'bi-hourglass-split',
  'animal-health': 'bi-heart-pulse',
  'vaccination-due': 'bi-shield-plus',
  'inventory-stock': 'bi-boxes',
  'low-stock': 'bi-exclamation-triangle',
  'expiring-batches': 'bi-calendar-x',
  purchase: 'bi-bag-check',
  sales: 'bi-graph-up',
  'customer-outstanding': 'bi-person-exclamation',
  'delivery-performance': 'bi-truck',
  expenses: 'bi-wallet2',
  revenue: 'bi-currency-rupee',
  'profit-loss': 'bi-piggy-bank',
};

interface ReportCard extends ReportCatalogItem {
  icon: string;
}

interface ReportGroup {
  name: string;
  icon: string;
  items: ReportCard[];
}

@Component({
  selector: 'app-report-center',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, LoadingComponent, EmptyStateComponent],
  templateUrl: './report-center.component.html',
  styles: [
    `
      .report-card {
        color: inherit;
        transition: box-shadow 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
      }
      .report-card:hover {
        border-color: var(--bs-primary);
        box-shadow: 0 4px 14px rgba(17, 24, 39, 0.1);
        transform: translateY(-1px);
      }
      .report-icon {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
        flex-shrink: 0;
        background: rgba(37, 99, 235, 0.1);
        color: var(--bs-primary);
      }
    `,
  ],
})
export class ReportCenterComponent {
  private readonly svc = inject(ReportsService);

  readonly catalog = signal<ReportCatalogItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly search = signal('');

  readonly groups = computed<ReportGroup[]>(() => {
    const term = this.search().trim().toLowerCase();
    const map = new Map<string, ReportGroup>();
    for (const r of this.catalog()) {
      if (term && !`${r.name} ${r.description} ${r.group}`.toLowerCase().includes(term)) {
        continue;
      }
      const name = r.group || 'Other';
      let g = map.get(name);
      if (!g) {
        g = { name, icon: GROUP_ICONS[name] ?? 'bi-file-earmark-bar-graph', items: [] };
        map.set(name, g);
      }
      g.items.push({ ...r, icon: CODE_ICONS[r.code] ?? g.icon });
    }
    return [...map.values()];
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.catalog().subscribe({
      next: (list) => {
        this.catalog.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
