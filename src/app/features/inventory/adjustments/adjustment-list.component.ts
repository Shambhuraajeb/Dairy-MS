import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { PagedList, qp } from '../../../shared/utils/paged-list';
import { StockTransaction } from '../inventory.model';
import { InventoryService } from '../inventory.service';
import { AdjustmentModalComponent } from './adjustment-modal.component';

@Component({
  selector: 'app-adjustment-list',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, HasPermissionDirective, AppNumberPipe, AdjustmentModalComponent, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Stock Adjustments" subtitle="Manual corrections to stock (audited)">
      <button *appHasPermission="'inventory.adjust'" type="button" class="btn btn-primary" (click)="modalOpen.set(true)">
        <i class="bi bi-sliders me-1"></i>Adjust Stock
      </button>
    </app-page-header>

    <app-data-table
      [columns]="columns"
      [items]="list.items()"
      [total]="list.total()"
      [loading]="list.loading()"
      [error]="list.error()"
      [page]="list.query.page ?? 1"
      [pageSize]="list.query.pageSize ?? 20"
      searchPlaceholder="Search item, batch or reason..."
      emptyTitle="No adjustments recorded"
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
        <input type="date" class="form-control form-control-sm w-auto" formControlName="from" aria-label="From date" />
        <input type="date" class="form-control form-control-sm w-auto" formControlName="to" aria-label="To date" />
      </div>

      <ng-template appColumn="itemName" let-row>
        <div class="fw-semibold">{{ row.itemName }}</div>
        <div class="small text-muted">{{ row.itemCode }}</div>
      </ng-template>
      <ng-template appColumn="quantity" let-row>
        <span class="fw-semibold" [class.text-success]="row.quantity > 0" [class.text-danger]="row.quantity < 0">
          {{ row.quantity > 0 ? '+' : '' }}{{ row.quantity | appNumber: 3 }}
        </span>
        <span class="text-muted small">{{ row.unitName }}</span>
      </ng-template>
    </app-data-table>

    <app-adjustment-modal [open]="modalOpen()" (closed)="modalOpen.set(false)" (saved)="onSaved()" />
  `,
})
export class AdjustmentListComponent {
  private readonly svc = inject(InventoryService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly items = toSignal(this.lookups.items(), { initialValue: [] as LookupItem[] });
  readonly modalOpen = signal(false);

  readonly columns: TableColumn[] = [
    { key: 'transactionDate', label: 'Date', type: 'datetime', sortable: true },
    { key: 'itemName', label: 'Item', sortable: true },
    { key: 'batchNumber', label: 'Batch' },
    { key: 'quantity', label: 'Change', type: 'template', sortable: true, align: 'end' },
    { key: 'balanceAfter', label: 'Balance after', type: 'number', align: 'end' },
    { key: 'remarks', label: 'Reason' },
    { key: 'createdByName', label: 'By' },
  ];

  readonly filters = this.fb.group({ itemId: [''], from: [''], to: [''] });
  readonly list = new PagedList<StockTransaction>(
    (q) => this.svc.adjustments(q),
    () => {
      const f = this.filters.getRawValue();
      return { itemId: f.itemId || undefined, from: f.from || undefined, to: f.to || undefined };
    },
  );

  constructor() {
    const p = this.route.snapshot.queryParamMap;
    this.filters.patchValue({ itemId: qp(p, 'itemId'), from: qp(p, 'from'), to: qp(p, 'to') });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
    this.list.load();
  }

  onSaved(): void {
    this.modalOpen.set(false);
    this.list.load();
  }
}
