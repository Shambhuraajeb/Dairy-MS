import { Component, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { PagedList, qp } from '../../../shared/utils/paged-list';
import { StockTransaction, TRANSACTION_TYPES } from '../inventory.model';
import { InventoryService } from '../inventory.service';

@Component({
  selector: 'app-stock-ledger',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, AppNumberPipe, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Stock Ledger" subtitle="Every stock movement: purchases, consumption and adjustments" />

    <app-data-table
      [columns]="columns"
      [items]="list.items()"
      [total]="list.total()"
      [loading]="list.loading()"
      [error]="list.error()"
      [page]="list.query.page ?? 1"
      [pageSize]="list.query.pageSize ?? 20"
      searchPlaceholder="Search item, batch or remarks..."
      emptyTitle="No stock movements found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
        <select class="form-select form-select-sm w-auto" formControlName="itemId" aria-label="Item">
          <option value="">All items</option>
          @for (i of items(); track i.id) {
            <option [value]="i.id">{{ i.name }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="type" aria-label="Transaction type">
          <option value="">All types</option>
          @for (t of types; track t) {
            <option [value]="t">{{ t }}</option>
          }
        </select>
        <input type="date" class="form-control form-control-sm w-auto" formControlName="from" aria-label="From date" />
        <input type="date" class="form-control form-control-sm w-auto" formControlName="to" aria-label="To date" />
      </div>

      <ng-template appColumn="itemName" let-row>
        <div class="fw-semibold">{{ row.itemName }}</div>
        <div class="small text-muted">{{ row.itemCode }}</div>
      </ng-template>
      <ng-template appColumn="transactionType" let-row>
        <span class="badge badge-soft" [class.badge-soft-success]="row.quantity > 0" [class.badge-soft-danger]="row.quantity < 0">
          {{ row.transactionType }}
        </span>
      </ng-template>
      <ng-template appColumn="quantity" let-row>
        <span class="fw-semibold" [class.text-success]="row.quantity > 0" [class.text-danger]="row.quantity < 0">
          {{ row.quantity > 0 ? '+' : '' }}{{ row.quantity | appNumber: 3 }}
        </span>
        <span class="text-muted small">{{ row.unitName }}</span>
      </ng-template>
      <ng-template appColumn="reference" let-row>
        @if (row.referenceType) {
          {{ row.referenceType }}{{ row.referenceId ? ' #' + row.referenceId : '' }}
        } @else {
          —
        }
      </ng-template>
    </app-data-table>
  `,
})
export class StockLedgerComponent {
  private readonly svc = inject(InventoryService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly types = TRANSACTION_TYPES;
  readonly items = toSignal(this.lookups.items(), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'transactionDate', label: 'Date', type: 'datetime', sortable: true },
    { key: 'itemName', label: 'Item', sortable: true },
    { key: 'batchNumber', label: 'Batch' },
    { key: 'transactionType', label: 'Type', type: 'template', sortable: true },
    { key: 'quantity', label: 'Quantity', type: 'template', sortable: true, align: 'end' },
    { key: 'balanceAfter', label: 'Balance', type: 'number', align: 'end' },
    { key: 'unitCost', label: 'Unit cost', type: 'currency' },
    { key: 'reference', label: 'Reference', type: 'template' },
    { key: 'remarks', label: 'Remarks' },
    { key: 'createdByName', label: 'By' },
  ];

  readonly filters = this.fb.group({ itemId: [''], type: [''], from: [''], to: [''] });
  readonly list = new PagedList<StockTransaction>(
    (q) => this.svc.stockTransactions(q),
    () => {
      const f = this.filters.getRawValue();
      return { itemId: f.itemId || undefined, type: f.type || undefined, from: f.from || undefined, to: f.to || undefined };
    },
  );

  constructor() {
    const p = this.route.snapshot.queryParamMap;
    this.filters.patchValue({ itemId: qp(p, 'itemId'), type: qp(p, 'type'), from: qp(p, 'from'), to: qp(p, 'to') });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
    this.list.load();
  }
}
