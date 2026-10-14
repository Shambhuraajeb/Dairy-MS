import { Component, OnInit, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { PagedQuery } from '../../../core/models/api.model';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AdjustCollectionModalComponent } from '../components/adjust-collection-modal.component';
import { CollectionDetailModalComponent } from '../components/collection-detail-modal.component';
import {
  CollectionFilterValue,
  CollectionFiltersComponent,
  emptyFilters,
  filtersToQuery,
  initialFilters,
} from '../components/collection-filters.component';
import { qualityColor } from '../collection.util';
import { COLLECTION_STATUSES, CollectionDetail, CollectionListItem, ShiftDto } from '../models/collection.model';
import { CollectionShiftService } from '../services/collection-shift.service';
import { MilkCollectionService } from '../services/milk-collection.service';

@Component({
  selector: 'app-collection-history',
  standalone: true,
  imports: [
    RouterLink,
    PageHeaderComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    CollectionFiltersComponent,
    CollectionDetailModalComponent,
    AdjustCollectionModalComponent,
    ...DATA_TABLE_IMPORTS,
  ],
  templateUrl: './collection-history.component.html',
})
export class CollectionHistoryComponent implements OnInit {
  private readonly svc = inject(MilkCollectionService);
  private readonly shiftSvc = inject(CollectionShiftService);

  // initial filters from the query string
  readonly from = input<string>();
  readonly to = input<string>();
  readonly date = input<string>();
  readonly center = input<string>();
  readonly centerId = input<string>();
  readonly shift = input<string>();
  readonly status = input<string>();
  readonly settlementStatus = input<string>();
  readonly farmer = input<string>();
  readonly farmerId = input<string>();

  protected readonly statuses = COLLECTION_STATUSES;
  protected readonly qualityColor = qualityColor;
  protected readonly columns: TableColumn[] = [
    { key: 'collectionNumber', label: 'Collection', sortable: true },
    { key: 'collectionDate', label: 'Date', type: 'date', sortable: true },
    { key: 'shiftName', label: 'Shift', sortable: true },
    { key: 'collectionCenterName', label: 'Center', sortable: true },
    { key: 'farmerName', label: 'Farmer', sortable: true },
    { key: 'milkType', label: 'Milk', sortable: true },
    { key: 'quantityLiters', label: 'Qty (L)', type: 'number', sortable: true },
    { key: 'fat', label: 'FAT', type: 'number', sortable: true },
    { key: 'snf', label: 'SNF', type: 'number', sortable: true },
    { key: 'finalRate', label: 'Rate', type: 'currency' },
    { key: 'amount', label: 'Amount', type: 'currency', sortable: true },
    { key: 'qualityResult', label: 'Quality' },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
    { key: 'settlementStatus', label: 'Settlement', type: 'badge', sortable: true },
  ];

  protected readonly shifts = signal<ShiftDto[]>([]);
  protected readonly filters = signal<CollectionFilterValue>(emptyFilters());
  protected readonly items = signal<CollectionListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected query: PagedQuery = { page: 1, pageSize: 20 };

  protected readonly detailId = signal<number | null>(null);
  protected readonly adjustTarget = signal<CollectionListItem | null>(null);
  private readonly detailModal = viewChild(CollectionDetailModalComponent);

  ngOnInit(): void {
    this.shiftSvc
      .list()
      .pipe(catchError(() => of([] as ShiftDto[])))
      .subscribe((list) => {
        this.shifts.set(list);
        this.filters.set(
          initialFilters(
            {
              from: this.from(),
              to: this.to(),
              date: this.date(),
              center: this.center(),
              centerId: this.centerId(),
              shift: this.shift(),
              status: this.status(),
              farmer: this.farmer(),
              farmerId: this.farmerId(),
            },
            list,
          ),
        );
        this.load();
      });
  }

  protected onFilters(value: CollectionFilterValue): void {
    this.filters.set(value);
    this.query = { ...this.query, page: 1 };
    this.load();
  }

  protected onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    const q: PagedQuery = { ...this.query, ...filtersToQuery(this.filters()), settlementStatus: this.settlementStatus() };
    this.svc.list(q).subscribe({
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

  protected canAdjust(row: CollectionListItem): boolean {
    return (row.status === 'Pending' || row.status === 'Approved') && row.settlementStatus === 'Unsettled';
  }

  protected openAdjust(detail: CollectionDetail | CollectionListItem): void {
    this.adjustTarget.set(detail);
  }

  protected onAdjusted(): void {
    this.adjustTarget.set(null);
    this.load();
    if (this.detailId() !== null) {
      this.detailModal()?.reload();
    }
  }
}
