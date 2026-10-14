import { Component, OnInit, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { isoDay, toNumberOrNull } from '../collection.util';
import { CollectionDetailModalComponent } from '../components/collection-detail-modal.component';
import { MilkRejection, REJECTION_REASONS } from '../models/collection.model';
import { MilkRejectionService } from '../services/milk-rejection.service';

@Component({
  selector: 'app-rejections',
  standalone: true,
  imports: [PageHeaderComponent, StatusBadgeComponent, CollectionDetailModalComponent, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Milk Rejections" subtitle="Fully or partially rejected collections and the reason for each" />

    <app-data-table
      [columns]="columns"
      [items]="items()"
      [total]="total()"
      [loading]="loading()"
      [error]="error()"
      [page]="query.page ?? 1"
      [pageSize]="query.pageSize ?? 20"
      searchPlaceholder="Search collection no. or farmer..."
      emptyTitle="No rejections found"
      emptyMessage="No rejected milk for the selected filters."
      (queryChange)="onQuery($event)"
      (retry)="load()"
    >
      <div tableFilters class="d-flex flex-wrap gap-2 align-items-center">
        <input type="date" class="form-control form-control-sm w-auto" aria-label="From" [value]="qs('from')" (change)="onFilter('from', $event)" />
        <input type="date" class="form-control form-control-sm w-auto" aria-label="To" [value]="qs('to')" (change)="onFilter('to', $event)" />
        <select class="form-select form-select-sm w-auto" aria-label="Center" (change)="onFilter('centerId', $event)">
          <option value="" [selected]="!query['centerId']">All centers</option>
          @for (c of centers(); track c.id) {
            <option [value]="c.id" [selected]="query['centerId'] === c.id">{{ c.name }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" aria-label="Reason" (change)="onFilter('reasonCode', $event)">
          <option value="" [selected]="!query['reasonCode']">All reasons</option>
          @for (r of reasons; track r.code) {
            <option [value]="r.code" [selected]="query['reasonCode'] === r.code">{{ r.label }}</option>
          }
        </select>
      </div>
      <ng-template appColumn="farmerName" let-row>
        {{ row.farmerName }} <span class="text-muted small">{{ row.farmerCode }}</span>
      </ng-template>
      <ng-template appColumn="reasonCode" let-row>
        <app-status-badge [status]="row.reasonCode" color="danger" />
      </ng-template>
      <ng-template appRowActions let-row>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="detailId.set(row.milkCollectionId)">
          <i class="bi bi-eye"></i> Collection
        </button>
      </ng-template>
    </app-data-table>

    <app-collection-detail-modal [collectionId]="detailId()" (closed)="detailId.set(null)" />
  `,
})
export class RejectionsComponent implements OnInit {
  private readonly svc = inject(MilkRejectionService);
  private readonly lookup = inject(LookupService);

  // initial filters from the query string
  readonly from = input<string>();
  readonly to = input<string>();
  readonly date = input<string>();
  readonly center = input<string>();
  readonly centerId = input<string>();
  readonly reasonCode = input<string>();
  readonly farmer = input<string>();
  readonly farmerId = input<string>();

  protected readonly reasons = REJECTION_REASONS;
  protected readonly centers = toSignal(this.lookup.collectionCenters(), { initialValue: [] as LookupItem[] });
  protected readonly columns: TableColumn[] = [
    { key: 'collectionNumber', label: 'Collection', sortable: true },
    { key: 'rejectionDate', label: 'Rejected on', type: 'date', sortable: true },
    { key: 'farmerName', label: 'Farmer', sortable: true },
    { key: 'collectionCenterName', label: 'Center', sortable: true },
    { key: 'reasonCode', label: 'Reason code', sortable: true },
    { key: 'reason', label: 'Reason' },
    { key: 'quantityLiters', label: 'Qty (L)', type: 'number', sortable: true },
    { key: 'disposalMethod', label: 'Disposal' },
    { key: 'rejectedByName', label: 'Rejected by' },
  ];

  protected readonly items = signal<MilkRejection[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected query: PagedQuery = { page: 1, pageSize: 20 };
  protected readonly detailId = signal<number | null>(null);

  ngOnInit(): void {
    const from = this.from() ?? this.date();
    const to = this.to() ?? this.date();
    this.query = {
      ...this.query,
      from: from ? isoDay(from) : undefined,
      to: to ? isoDay(to) : undefined,
      centerId: toNumberOrNull(this.center() ?? this.centerId()) ?? undefined,
      reasonCode: this.reasonCode() || undefined,
      farmerId: toNumberOrNull(this.farmer() ?? this.farmerId()) ?? undefined,
    };
    this.load();
  }

  protected qs(key: string): string {
    const v = this.query[key];
    return v === undefined || v === null ? '' : String(v);
  }

  protected onFilter(key: 'from' | 'to' | 'centerId' | 'reasonCode', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
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
}
