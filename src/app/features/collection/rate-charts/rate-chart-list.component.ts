import { Component, OnInit, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppCurrencyPipe, AppDatePipe } from '../../../shared/pipes/app-pipes';
import { toNumberOrNull } from '../collection.util';
import { MILK_TYPES } from '../models/collection.model';
import { RATE_CHART_STATUSES, RateChartListItem } from '../models/rate-chart.model';
import { RateChartService } from '../services/rate-chart.service';

@Component({
  selector: 'app-rate-chart-list',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, HasPermissionDirective, AppDatePipe, AppCurrencyPipe, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Rate Charts" subtitle="Milk purchase rates by FAT / SNF slab or formula">
      <a *appHasPermission="'ratechart.manage'" class="btn btn-primary" routerLink="/collection/rate-charts/new">
        <i class="bi bi-plus-lg me-1"></i>New Rate Chart
      </a>
    </app-page-header>

    <app-data-table
      [columns]="columns"
      [items]="items()"
      [total]="total()"
      [loading]="loading()"
      [error]="error()"
      [page]="query.page ?? 1"
      [pageSize]="query.pageSize ?? 20"
      searchPlaceholder="Search chart name..."
      emptyTitle="No rate charts found"
      emptyMessage="Create a rate chart and activate it so collections can be priced."
      (queryChange)="onQuery($event)"
      (retry)="load()"
    >
      <div tableFilters class="d-flex flex-wrap gap-2 align-items-center">
        <select class="form-select form-select-sm w-auto" aria-label="Milk type" (change)="onFilter('milkType', $event)">
          <option value="" [selected]="!query['milkType']">All milk types</option>
          @for (m of milkTypes; track m) {
            <option [value]="m" [selected]="query['milkType'] === m">{{ m }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" aria-label="Status" (change)="onFilter('status', $event)">
          <option value="" [selected]="!query['status']">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s" [selected]="query['status'] === s">{{ s }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" aria-label="Center" (change)="onFilter('centerId', $event)">
          <option value="" [selected]="!query['centerId']">All centers</option>
          @for (c of centers(); track c.id) {
            <option [value]="c.id" [selected]="query['centerId'] === c.id">{{ c.name }}</option>
          }
        </select>
      </div>

      <ng-template appColumn="name" let-row>
        <a [routerLink]="['/collection/rate-charts', row.id]" class="fw-semibold text-decoration-none">{{ row.name }}</a>
      </ng-template>
      <ng-template appColumn="collectionCenterName" let-row>{{ row.collectionCenterName ?? 'All centers' }}</ng-template>
      <ng-template appColumn="effectiveTo" let-row>{{ row.effectiveTo ? (row.effectiveTo | appDate) : 'Open' }}</ng-template>
      <ng-template appColumn="baseRatePerLiter" let-row>
        @if (row.calculationMethod === 'Formula') {
          {{ row.baseRatePerLiter | appCurrency }}
        } @else {
          <span class="text-muted">{{ row.detailCount }} slabs</span>
        }
      </ng-template>
      <ng-template appRowActions let-row>
        <a class="btn btn-sm btn-outline-secondary me-1" [routerLink]="['/collection/rate-charts', row.id]">
          @if (row.status === 'Draft') {
            <i class="bi bi-pencil"></i> Edit
          } @else {
            <i class="bi bi-eye"></i> View
          }
        </a>
        @if (row.status === 'Draft') {
          <button *appHasPermission="'ratechart.manage'" type="button" class="btn btn-sm btn-outline-success me-1" (click)="activate(row)">
            <i class="bi bi-check2-circle"></i> Activate
          </button>
        }
        @if (row.isActive) {
          <button *appHasPermission="'ratechart.manage'" type="button" class="btn btn-sm btn-outline-danger" (click)="remove(row)">
            <i class="bi bi-trash"></i> {{ row.status === 'Draft' ? 'Delete' : 'Deactivate' }}
          </button>
        }
      </ng-template>
    </app-data-table>
  `,
})
export class RateChartListComponent implements OnInit {
  private readonly svc = inject(RateChartService);
  private readonly lookup = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  // initial filters from the query string
  readonly status = input<string>();
  readonly milkType = input<string>();
  readonly center = input<string>();
  readonly centerId = input<string>();

  protected readonly milkTypes = MILK_TYPES;
  protected readonly statuses = RATE_CHART_STATUSES;
  protected readonly centers = toSignal(this.lookup.collectionCenters(), { initialValue: [] as LookupItem[] });
  protected readonly columns: TableColumn[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'milkType', label: 'Milk type', sortable: true },
    { key: 'collectionCenterName', label: 'Center', sortable: true },
    { key: 'effectiveFrom', label: 'Effective from', type: 'date', sortable: true },
    { key: 'effectiveTo', label: 'Effective to', sortable: true },
    { key: 'calculationMethod', label: 'Method' },
    { key: 'baseRatePerLiter', label: 'Base rate / slabs' },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
  ];

  protected readonly items = signal<RateChartListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected query: PagedQuery = { page: 1, pageSize: 20 };

  ngOnInit(): void {
    this.query = {
      ...this.query,
      status: this.status() || undefined,
      milkType: this.milkType() || undefined,
      centerId: toNumberOrNull(this.center() ?? this.centerId()) ?? undefined,
    };
    this.load();
  }

  protected onFilter(key: 'milkType' | 'status' | 'centerId', event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const next: PagedQuery = { ...this.query, page: 1 };
    next[key] = key === 'centerId' ? (toNumberOrNull(value) ?? undefined) : value || undefined;
    this.query = next;
    this.load();
  }

  protected onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.list(this.query).subscribe({
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

  protected async activate(row: RateChartListItem): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Activate rate chart',
      message: `Activate "${row.name}"? Overlapping active charts for the same milk type and center are superseded.`,
      confirmText: 'Activate',
    });
    if (!ok) {
      return;
    }
    this.svc.activate(row.id).subscribe((res) => {
      const n = res.supersededChartIds.length;
      this.toast.success(n > 0 ? `Rate chart activated; ${n} older chart(s) superseded.` : 'Rate chart activated.');
      this.load();
    });
  }

  protected async remove(row: RateChartListItem): Promise<void> {
    const draft = row.status === 'Draft';
    const ok = await this.confirmService.confirm({
      title: draft ? 'Delete draft' : 'Deactivate rate chart',
      message: draft
        ? `Delete draft "${row.name}"?`
        : `Deactivate "${row.name}"? Collections can no longer be priced with it.`,
      confirmText: draft ? 'Delete' : 'Deactivate',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc.remove(row.id).subscribe(() => {
      this.toast.success(draft ? 'Draft deleted.' : 'Rate chart deactivated.');
      this.load();
    });
  }
}
