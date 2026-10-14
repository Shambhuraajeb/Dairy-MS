import { Component, OnInit, inject, input, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { PagedQuery } from '../../../core/models/api.model';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { CollectionDetailModalComponent } from '../components/collection-detail-modal.component';
import {
  CollectionFilterValue,
  CollectionFiltersComponent,
  emptyFilters,
  filtersToQuery,
  initialFilters,
} from '../components/collection-filters.component';
import { QualityModalComponent } from '../components/quality-modal.component';
import { qualityColor } from '../collection.util';
import { COLLECTION_STATUSES, CollectionListItem, ShiftDto } from '../models/collection.model';
import { CollectionShiftService } from '../services/collection-shift.service';
import { MilkCollectionService } from '../services/milk-collection.service';

/** Collections with their quality result; record a quality test for pending collections. */
@Component({
  selector: 'app-quality-tests',
  standalone: true,
  imports: [
    PageHeaderComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    CollectionFiltersComponent,
    CollectionDetailModalComponent,
    QualityModalComponent,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Quality Tests" subtitle="Record milk quality tests; a failed test blocks approval of the collection" />

    <app-collection-filters
      [value]="filters()"
      [shifts]="shifts()"
      [statuses]="statuses"
      [showFarmer]="true"
      (valueChange)="onFilters($event)"
    />

    <app-data-table
      [columns]="columns"
      [items]="items()"
      [total]="total()"
      [loading]="loading()"
      [error]="error()"
      [page]="query.page ?? 1"
      [pageSize]="query.pageSize ?? 20"
      searchPlaceholder="Search collection no., farmer name or code..."
      emptyTitle="No collections found"
      (queryChange)="onQuery($event)"
      (retry)="load()"
    >
      <ng-template appColumn="farmerName" let-row>
        {{ row.farmerName }} <span class="text-muted small">{{ row.farmerCode }}</span>
      </ng-template>
      <ng-template appColumn="qualityResult" let-row>
        @if (row.qualityResult) {
          <app-status-badge [status]="row.qualityResult" [color]="qualityColor(row.qualityResult)" />
        } @else {
          <span class="text-muted">Not tested</span>
        }
      </ng-template>
      <ng-template appRowActions let-row>
        <button type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="detailId.set(row.id)">
          <i class="bi bi-eye"></i> View
        </button>
        @if (row.status === 'Pending') {
          <button *appHasPermission="'collection.quality.record'" type="button" class="btn btn-sm btn-outline-primary" (click)="qualityTarget.set(row)">
            <i class="bi bi-eyedropper"></i> Record quality
          </button>
        }
      </ng-template>
    </app-data-table>

    <app-collection-detail-modal [collectionId]="detailId()" (closed)="detailId.set(null)" />
    <app-quality-modal [collection]="qualityTarget()" (closed)="qualityTarget.set(null)" (saved)="onSaved()" />
  `,
})
export class QualityTestsComponent implements OnInit {
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
  readonly farmer = input<string>();
  readonly farmerId = input<string>();

  protected readonly statuses = COLLECTION_STATUSES;
  protected readonly qualityColor = qualityColor;
  protected readonly columns: TableColumn[] = [
    { key: 'collectionNumber', label: 'Collection', sortable: true },
    { key: 'collectionDate', label: 'Date', type: 'date', sortable: true },
    { key: 'shiftName', label: 'Shift', sortable: true },
    { key: 'farmerName', label: 'Farmer', sortable: true },
    { key: 'milkType', label: 'Milk', sortable: true },
    { key: 'quantityLiters', label: 'Qty (L)', type: 'number', sortable: true },
    { key: 'fat', label: 'FAT', type: 'number', sortable: true },
    { key: 'snf', label: 'SNF', type: 'number', sortable: true },
    { key: 'clr', label: 'CLR', type: 'number' },
    { key: 'qualityResult', label: 'Quality' },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
  ];

  protected readonly shifts = signal<ShiftDto[]>([]);
  protected readonly filters = signal<CollectionFilterValue>(emptyFilters());
  protected readonly items = signal<CollectionListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected query: PagedQuery = { page: 1, pageSize: 20 };

  protected readonly detailId = signal<number | null>(null);
  protected readonly qualityTarget = signal<CollectionListItem | null>(null);

  ngOnInit(): void {
    this.shiftSvc
      .list()
      .pipe(catchError(() => of([] as ShiftDto[])))
      .subscribe((list) => {
        this.shifts.set(list);
        // no explicit filter in the link: show the collections waiting for a test
        const hasParams = !!(this.from() || this.to() || this.date() || this.status());
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
            { status: hasParams ? '' : 'Pending' },
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
    this.svc.list({ ...this.query, ...filtersToQuery(this.filters()) }).subscribe({
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

  protected onSaved(): void {
    this.qualityTarget.set(null);
    this.load();
  }
}
