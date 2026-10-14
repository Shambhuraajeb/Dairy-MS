import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { PagedQuery } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
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
import { RejectCollectionModalComponent } from '../components/reject-collection-modal.component';
import { qualityColor } from '../collection.util';
import { BulkApproveResult, CollectionListItem, ShiftDto } from '../models/collection.model';
import { CollectionShiftService } from '../services/collection-shift.service';
import { MilkCollectionService } from '../services/milk-collection.service';

const MAX_BULK = 200;

@Component({
  selector: 'app-approval',
  standalone: true,
  imports: [
    PageHeaderComponent,
    StatusBadgeComponent,
    ModalComponent,
    HasPermissionDirective,
    CollectionFiltersComponent,
    CollectionDetailModalComponent,
    RejectCollectionModalComponent,
    ...DATA_TABLE_IMPORTS,
  ],
  templateUrl: './approval.component.html',
})
export class ApprovalComponent implements OnInit {
  private readonly svc = inject(MilkCollectionService);
  private readonly shiftSvc = inject(CollectionShiftService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly perm = inject(PermissionService);

  // initial filters from the query string
  readonly from = input<string>();
  readonly to = input<string>();
  readonly date = input<string>();
  readonly center = input<string>();
  readonly centerId = input<string>();
  readonly shift = input<string>();
  readonly farmer = input<string>();
  readonly farmerId = input<string>();

  protected readonly qualityColor = qualityColor;
  private readonly baseColumns: TableColumn[] = [
    { key: 'collectionNumber', label: 'Collection', sortable: true },
    { key: 'collectionDate', label: 'Date', type: 'date', sortable: true },
    { key: 'shiftName', label: 'Shift', sortable: true },
    { key: 'collectionCenterName', label: 'Center', sortable: true },
    { key: 'farmerName', label: 'Farmer', sortable: true },
    { key: 'milkType', label: 'Milk', sortable: true },
    { key: 'quantityLiters', label: 'Qty (L)', type: 'number', sortable: true },
    { key: 'fat', label: 'FAT', type: 'number', sortable: true },
    { key: 'snf', label: 'SNF', type: 'number', sortable: true },
    { key: 'amount', label: 'Amount', type: 'currency', sortable: true },
    { key: 'qualityResult', label: 'Quality' },
  ];
  protected readonly columns = computed<TableColumn[]>(() =>
    this.perm.has('collection.approve') ? [{ key: 'select', label: '', width: '40px' }, ...this.baseColumns] : this.baseColumns,
  );

  protected readonly shifts = signal<ShiftDto[]>([]);
  protected readonly filters = signal<CollectionFilterValue>(emptyFilters());
  protected readonly items = signal<CollectionListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected query: PagedQuery = { page: 1, pageSize: 20 };

  protected readonly selected = signal<ReadonlySet<number>>(new Set<number>());
  protected readonly selectedCount = computed(() => this.selected().size);
  protected readonly working = signal(false);

  protected readonly detailId = signal<number | null>(null);
  protected readonly rejectTarget = signal<CollectionListItem | null>(null);
  protected readonly bulkResult = signal<BulkApproveResult | null>(null);

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
    this.svc.pendingApprovals({ ...this.query, ...filtersToQuery(this.filters()) }).subscribe({
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

  // ---- selection ----
  protected isSelected(id: number): boolean {
    return this.selected().has(id);
  }

  protected canSelect(row: CollectionListItem): boolean {
    return row.qualityResult !== 'Fail';
  }

  protected toggle(id: number): void {
    const next = new Set(this.selected());
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= MAX_BULK) {
        this.toast.warning(`You can approve at most ${MAX_BULK} collections at once.`);
        return;
      }
      next.add(id);
    }
    this.selected.set(next);
  }

  protected selectPage(): void {
    const next = new Set(this.selected());
    for (const row of this.items()) {
      if (this.canSelect(row) && next.size < MAX_BULK) {
        next.add(row.id);
      }
    }
    this.selected.set(next);
  }

  protected clearSelection(): void {
    this.selected.set(new Set<number>());
  }

  // ---- actions ----
  protected async approveOne(row: CollectionListItem): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Approve collection',
      message: `Approve ${row.collectionNumber} (${row.farmerName}, ${row.quantityLiters} L, amount ${row.amount})?`,
      confirmText: 'Approve',
    });
    if (!ok) {
      return;
    }
    this.working.set(true);
    this.svc.approve(row.id).subscribe({
      next: (res) => {
        this.working.set(false);
        this.toast.success(`${res.number} approved.`);
        this.deselect([row.id]);
        this.load();
      },
      error: () => this.working.set(false),
    });
  }

  protected async approveSelected(): Promise<void> {
    const ids = [...this.selected()];
    if (ids.length === 0) {
      return;
    }
    const ok = await this.confirmService.confirm({
      title: 'Approve selected',
      message: `Approve ${ids.length} selected collection(s)? Each one is approved independently.`,
      confirmText: `Approve ${ids.length}`,
    });
    if (!ok) {
      return;
    }
    this.working.set(true);
    this.svc.bulkApprove(ids).subscribe({
      next: (res) => {
        this.working.set(false);
        const done = res.results.filter((r) => r.success).map((r) => r.id);
        this.deselect(done);
        if (res.failed > 0) {
          this.bulkResult.set(res);
          this.toast.warning(`${res.approved} of ${res.total} approved, ${res.failed} failed.`);
        } else {
          this.toast.success(`${res.approved} collection(s) approved.`);
        }
        this.load();
      },
      error: () => this.working.set(false),
    });
  }

  protected onRejected(): void {
    const t = this.rejectTarget();
    this.rejectTarget.set(null);
    if (t) {
      this.deselect([t.id]);
    }
    this.load();
  }

  protected failedRows(): BulkApproveResult['results'] {
    return (this.bulkResult()?.results ?? []).filter((r) => !r.success);
  }

  private deselect(ids: number[]): void {
    const next = new Set(this.selected());
    ids.forEach((id) => next.delete(id));
    this.selected.set(next);
  }
}
