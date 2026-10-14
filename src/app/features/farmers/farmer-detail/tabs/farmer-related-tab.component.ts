import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../../../core/models/api.model';
import { errorMessage } from '../../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { AppDatePipe } from '../../../../shared/pipes/app-pipes';
import { RouterLink } from '@angular/router';
import { FarmerService } from '../../farmer.service';

export type RelatedKind = 'animals' | 'collections' | 'payments' | 'loans';

interface KindConfig {
  columns: TableColumn[];
  statuses: string[];
  searchPlaceholder: string;
  empty: string;
}

const CONFIGS: Record<RelatedKind, KindConfig> = {
  animals: {
    statuses: ['Active', 'Sick', 'Sold', 'Dead', 'Archived'],
    searchPlaceholder: 'Search tag or name...',
    empty: 'No animals registered for this farmer',
    columns: [
      { key: 'tagNumber', label: 'Tag', sortable: true },
      { key: 'name', label: 'Name', sortable: true },
      { key: 'breedName', label: 'Breed', sortable: true },
      { key: 'animalType', label: 'Type', sortable: true },
      { key: 'milkingStatus', label: 'Milking', sortable: true },
      { key: 'pregnancyStatus', label: 'Pregnancy' },
      { key: 'status', label: 'Status', type: 'badge', sortable: true },
    ],
  },
  collections: {
    statuses: ['Pending', 'Approved', 'Rejected'],
    searchPlaceholder: 'Search collection no...',
    empty: 'No milk collections yet',
    columns: [
      { key: 'collectionDate', label: 'Date', type: 'date', sortable: true },
      { key: 'collectionNumber', label: 'Collection no.', sortable: true },
      { key: 'shiftName', label: 'Shift' },
      { key: 'quantityLiters', label: 'Litres', type: 'number', sortable: true },
      { key: 'fat', label: 'FAT', type: 'number' },
      { key: 'snf', label: 'SNF', type: 'number' },
      { key: 'rate', label: 'Rate', type: 'currency' },
      { key: 'amount', label: 'Amount', type: 'currency', sortable: true },
      { key: 'status', label: 'Status', type: 'badge', sortable: true },
      { key: 'settlementStatus', label: 'Settlement', type: 'badge' },
    ],
  },
  payments: {
    statuses: [],
    searchPlaceholder: 'Search payment no...',
    empty: 'No payments yet',
    columns: [
      { key: 'paymentDate', label: 'Date', type: 'date', sortable: true },
      { key: 'paymentNumber', label: 'Payment no.', sortable: true },
      { key: 'period', label: 'Period' },
      { key: 'totalQuantity', label: 'Litres', type: 'number' },
      { key: 'grossAmount', label: 'Gross', type: 'currency' },
      { key: 'deductionAmount', label: 'Deductions', type: 'currency' },
      { key: 'netPayable', label: 'Net payable', type: 'currency', sortable: true },
      { key: 'paidAmount', label: 'Paid', type: 'currency' },
      { key: 'balanceAmount', label: 'Balance', type: 'currency' },
      { key: 'status', label: 'Status', type: 'badge', sortable: true },
    ],
  },
  loans: {
    statuses: ['Active', 'Closed', 'Cancelled'],
    searchPlaceholder: 'Search loan no...',
    empty: 'No loans for this farmer',
    columns: [
      { key: 'loanNumber', label: 'Loan no.' },
      { key: 'loanDate', label: 'Date', type: 'date' },
      { key: 'principalAmount', label: 'Principal', type: 'currency' },
      { key: 'interestRate', label: 'Rate %', type: 'number' },
      { key: 'numberOfInstallments', label: 'Installments', type: 'number' },
      { key: 'outstandingAmount', label: 'Outstanding', type: 'currency' },
      { key: 'nextDueDate', label: 'Next due', type: 'date' },
      { key: 'status', label: 'Status', type: 'badge' },
    ],
  },
};

/** One paged read-only table for the animals / collections / payments / loans tabs of a farmer. */
@Component({
  selector: 'app-farmer-related-tab',
  standalone: true,
  imports: [RouterLink, AppDatePipe, ...DATA_TABLE_IMPORTS],
  template: `
    <app-data-table
      [columns]="columns()"
      [items]="items()"
      [total]="total()"
      [loading]="loading()"
      [error]="error()"
      [page]="query.page ?? 1"
      [pageSize]="query.pageSize ?? 10"
      [pageSizeOptions]="[10, 20, 50]"
      [searchPlaceholder]="config().searchPlaceholder"
      [emptyTitle]="config().empty"
      (queryChange)="onQuery($event)"
      (retry)="load()"
    >
      <div tableFilters [class.d-none]="config().statuses.length === 0">
        <select class="form-select form-select-sm w-auto" aria-label="Status" (change)="onStatus($event)">
          <option value="">All statuses</option>
          @for (s of config().statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
      </div>
      <ng-template appColumn="tagNumber" let-row>
        <a [routerLink]="['/animals', row.id]" class="fw-semibold text-decoration-none">{{ row.tagNumber }}</a>
      </ng-template>
      <ng-template appColumn="loanNumber" let-row>
        <a [routerLink]="['/farmers/loans', row.id]" class="fw-semibold text-decoration-none">{{ row.loanNumber }}</a>
      </ng-template>
      <ng-template appColumn="period" let-row>
        {{ row.periodFrom | appDate }} - {{ row.periodTo | appDate }}
      </ng-template>
    </app-data-table>
  `,
})
export class FarmerRelatedTabComponent implements OnInit {
  private readonly svc = inject(FarmerService);

  readonly farmerId = input.required<number>();
  readonly kind = input.required<RelatedKind>();

  readonly config = computed(() => CONFIGS[this.kind()]);
  readonly columns = computed(() => this.config().columns);

  readonly items = signal<unknown[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  query: PagedQuery = { page: 1, pageSize: 10 };
  private status = '';

  ngOnInit(): void {
    this.load();
  }

  onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  onStatus(event: Event): void {
    this.status = (event.target as HTMLSelectElement).value;
    this.query = { ...this.query, page: 1 };
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const q: PagedQuery = { ...this.query, status: this.status };
    this.fetch(q).subscribe({
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

  private fetch(q: PagedQuery): Observable<PagedResult<unknown>> {
    const id = this.farmerId();
    switch (this.kind()) {
      case 'animals':
        return this.svc.animals(id, q);
      case 'collections':
        return this.svc.collections(id, q);
      case 'payments':
        return this.svc.payments(id, q);
      default:
        return this.svc.loansOf(id, q);
    }
  }
}
