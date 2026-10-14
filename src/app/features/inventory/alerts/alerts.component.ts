import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { errorMessage } from '../../../core/utils/http-error';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppCurrencyPipe, AppDatePipe, AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { ExpiringAlert, LowStockAlert } from '../inventory.model';
import { InventoryService } from '../inventory.service';

type AlertTab = 'low-stock' | 'expiring';

@Component({
  selector: 'app-inventory-alerts',
  standalone: true,
  imports: [
    RouterLink,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    AppCurrencyPipe,
    AppDatePipe,
    AppNumberPipe,
  ],
  template: `
    <app-page-header title="Inventory Alerts" subtitle="Items below reorder level and batches nearing expiry">
      <button type="button" class="btn btn-outline-secondary" (click)="reload()"><i class="bi bi-arrow-clockwise me-1"></i>Refresh</button>
    </app-page-header>

    <ul class="nav nav-tabs mb-3">
      <li class="nav-item">
        <button type="button" class="nav-link" [class.active]="tab() === 'low-stock'" (click)="selectTab('low-stock')">
          Low stock
          @if (!lowLoading() && !lowError()) {
            <span class="badge rounded-pill text-bg-warning ms-1">{{ low().length }}</span>
          }
        </button>
      </li>
      <li class="nav-item">
        <button type="button" class="nav-link" [class.active]="tab() === 'expiring'" (click)="selectTab('expiring')">
          Expiring
          @if (!expLoading() && !expError()) {
            <span class="badge rounded-pill text-bg-danger ms-1">{{ expiring().length }}</span>
          }
        </button>
      </li>
    </ul>

    @if (tab() === 'low-stock') {
      <div class="card">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 app-table">
            <thead>
              <tr>
                <th>Item</th><th>Category</th><th class="text-end">Current stock</th><th class="text-end">Reorder level</th>
                <th class="text-end">Shortfall</th><th>Level</th><th class="text-end">Unit cost</th><th></th>
              </tr>
            </thead>
            <tbody>
              @if (lowLoading()) {
                <tr><td colspan="8"><app-loading text="Loading low stock items..." /></td></tr>
              } @else if (lowError()) {
                <tr>
                  <td colspan="8" class="text-center py-4">
                    <div class="text-danger mb-2">{{ lowError() }}</div>
                    <button type="button" class="btn btn-sm btn-outline-primary" (click)="loadLow()">Retry</button>
                  </td>
                </tr>
              } @else {
                @for (r of low(); track r.id) {
                  <tr>
                    <td><div class="fw-semibold">{{ r.itemName }}</div><div class="small text-muted">{{ r.itemCode }}</div></td>
                    <td>{{ r.categoryName }}</td>
                    <td class="text-end fw-semibold" [class.text-danger]="r.currentStock <= 0">{{ r.currentStock | appNumber: 3 }} {{ r.unitName }}</td>
                    <td class="text-end">{{ r.reorderLevel | appNumber: 3 }}</td>
                    <td class="text-end">{{ r.shortfall | appNumber: 3 }}</td>
                    <td><app-status-badge [status]="r.stockStatus" /></td>
                    <td class="text-end">{{ r.unitCost | appCurrency }}</td>
                    <td class="text-end">
                      <a *appHasPermission="'purchase.create'" routerLink="/inventory/purchases/new" class="btn btn-sm btn-outline-primary">
                        <i class="bi bi-cart-plus"></i> Purchase
                      </a>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="8" class="p-0"><app-empty-state icon="bi-check2-circle" title="All stocked up" message="No items are below their reorder level." /></td></tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    } @else {
      <div class="d-flex align-items-center gap-2 mb-3">
        <label class="small text-muted" for="expDays">Expiring within</label>
        <select id="expDays" class="form-select form-select-sm w-auto" [value]="days()" (change)="onDays($event)">
          @for (d of dayOptions; track d) {
            <option [value]="d" [selected]="d === days()">{{ d }} days</option>
          }
        </select>
        <span class="small text-muted">Expired batches with stock left are always listed.</span>
      </div>
      <div class="card">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 app-table">
            <thead>
              <tr>
                <th>Item</th><th>Batch</th><th>Expiry</th><th>Days</th><th class="text-end">Available</th>
                <th class="text-end">Value</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              @if (expLoading()) {
                <tr><td colspan="7"><app-loading text="Loading expiring batches..." /></td></tr>
              } @else if (expError()) {
                <tr>
                  <td colspan="7" class="text-center py-4">
                    <div class="text-danger mb-2">{{ expError() }}</div>
                    <button type="button" class="btn btn-sm btn-outline-primary" (click)="loadExpiring()">Retry</button>
                  </td>
                </tr>
              } @else {
                @for (r of expiring(); track r.id) {
                  <tr>
                    <td><div class="fw-semibold">{{ r.itemName }}</div><div class="small text-muted">{{ r.itemCode }}</div></td>
                    <td>{{ r.batchNumber }}</td>
                    <td [class.text-danger]="r.isExpired">{{ r.expiryDate | appDate }}</td>
                    <td>
                      @if (r.isExpired) {
                        <span class="badge badge-soft badge-soft-danger">Expired {{ -r.daysToExpiry }}d ago</span>
                      } @else if (r.daysToExpiry <= 7) {
                        <span class="badge badge-soft badge-soft-danger">{{ r.daysToExpiry }}d left</span>
                      } @else {
                        <span class="badge badge-soft badge-soft-warning">{{ r.daysToExpiry }}d left</span>
                      }
                    </td>
                    <td class="text-end">{{ r.quantityAvailable | appNumber: 3 }} {{ r.unitName }}</td>
                    <td class="text-end">{{ r.stockValue | appCurrency }}</td>
                    <td><app-status-badge [status]="r.isExpired ? 'Expired' : 'Expiring'" /></td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="p-0"><app-empty-state icon="bi-check2-circle" title="Nothing expiring" message="No batches expire within the selected window." /></td></tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
})
export class AlertsComponent {
  private readonly svc = inject(InventoryService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** query params (router input binding): ?type=low-stock|expiring&days=30 */
  readonly type = input<string>();
  readonly daysParam = input<string | undefined>(undefined, { alias: 'days' });

  readonly dayOptions = [7, 15, 30, 45, 60, 90];
  readonly tab = signal<AlertTab>('low-stock');
  readonly days = signal(30);

  readonly low = signal<LowStockAlert[]>([]);
  readonly lowLoading = signal(false);
  readonly lowError = signal<string | null>(null);
  readonly expiring = signal<ExpiringAlert[]>([]);
  readonly expLoading = signal(false);
  readonly expError = signal<string | null>(null);
  private expSeq = 0;

  constructor() {
    effect(() => {
      const t = this.type();
      untracked(() => this.tab.set(t === 'expiring' ? 'expiring' : 'low-stock'));
    });
    effect(() => {
      const d = Number(this.daysParam());
      if (d > 0) {
        untracked(() => {
          if (this.days() !== d) {
            this.days.set(d);
            this.loadExpiring();
          }
        });
      }
    });
    this.loadLow();
    this.loadExpiring();
  }

  selectTab(tab: AlertTab): void {
    this.tab.set(tab);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { type: tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  onDays(event: Event): void {
    this.days.set(Number((event.target as HTMLSelectElement).value));
    this.loadExpiring();
  }

  reload(): void {
    this.loadLow();
    this.loadExpiring();
  }

  loadLow(): void {
    this.lowLoading.set(true);
    this.lowError.set(null);
    this.svc.lowStock().subscribe({
      next: (rows) => {
        this.low.set(rows ?? []);
        this.lowLoading.set(false);
      },
      error: (e) => {
        this.lowError.set(errorMessage(e));
        this.lowLoading.set(false);
      },
    });
  }

  loadExpiring(): void {
    this.expLoading.set(true);
    this.expError.set(null);
    const n = ++this.expSeq;
    this.svc.expiring(this.days()).subscribe({
      next: (rows) => {
        if (n !== this.expSeq) {
          return;
        }
        this.expiring.set(rows ?? []);
        this.expLoading.set(false);
      },
      error: (e) => {
        if (n !== this.expSeq) {
          return;
        }
        this.expError.set(errorMessage(e));
        this.expLoading.set(false);
      },
    });
  }
}
