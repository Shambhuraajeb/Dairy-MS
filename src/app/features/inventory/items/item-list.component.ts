import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { PagedList, qp } from '../../../shared/utils/paged-list';
import { InventoryItem } from '../inventory.model';
import { InventoryService } from '../inventory.service';
import { ItemDetailModalComponent } from './item-detail-modal.component';
import { ItemFormModalComponent } from './item-form-modal.component';

@Component({
  selector: 'app-item-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    AppNumberPipe,
    ItemFormModalComponent,
    ItemDetailModalComponent,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Inventory Items" subtitle="Feed, medicines, packaging and other stock items">
      <button *appHasPermission="'inventory.create'" type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="bi bi-plus-lg me-1"></i>Add Item
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
      searchPlaceholder="Search code, name or barcode..."
      emptyTitle="No items found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
        <select class="form-select form-select-sm w-auto" formControlName="categoryId" aria-label="Category">
          <option value="">All categories</option>
          @for (c of categories(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="isActive" aria-label="Status">
          <option value="">Active and inactive</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <div class="form-check form-check-inline mb-0">
          <input id="lowOnly" type="checkbox" class="form-check-input" formControlName="lowStockOnly" />
          <label class="form-check-label small" for="lowOnly">Low stock only</label>
        </div>
      </div>

      <ng-template appColumn="name" let-row>
        <button type="button" class="btn btn-link p-0 fw-semibold text-decoration-none text-start" (click)="openDetail(row)">{{ row.name }}</button>
        @if (row.barcode) {
          <div class="small text-muted">{{ row.barcode }}</div>
        }
      </ng-template>
      <ng-template appColumn="currentStock" let-row>
        <span [class.text-danger]="row.stockStatus === 'OutOfStock'" [class.text-warning]="row.stockStatus === 'Low'" class="fw-semibold">
          {{ row.currentStock | appNumber: 3 }}
        </span>
        <span class="text-muted small">{{ row.unitName }}</span>
      </ng-template>
      <ng-template appColumn="stockStatus" let-row>
        <app-status-badge [status]="row.stockStatus" />
      </ng-template>
      <ng-template appRowActions let-row>
        <button type="button" class="btn btn-sm btn-outline-primary me-1" (click)="openDetail(row)"><i class="bi bi-eye"></i> View</button>
        <button *appHasPermission="'inventory.update'" type="button" class="btn btn-sm btn-outline-secondary" (click)="openEdit(row)">
          <i class="bi bi-pencil"></i> Edit
        </button>
      </ng-template>
    </app-data-table>

    <app-item-form-modal [open]="formOpen()" [item]="editing()" (closed)="formOpen.set(false)" (saved)="onSaved()" />
    <app-item-detail-modal [itemId]="detailId()" (closed)="detailId.set(null)" />
  `,
})
export class ItemListComponent {
  private readonly svc = inject(InventoryService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly categories = toSignal(this.lookups.get('item-categories'), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'itemCode', label: 'Code', sortable: true, width: '110px' },
    { key: 'name', label: 'Item', sortable: true },
    { key: 'categoryName', label: 'Category', sortable: true },
    { key: 'currentStock', label: 'Stock', sortable: true, type: 'template', align: 'end' },
    { key: 'reorderLevel', label: 'Reorder at', sortable: true, type: 'number' },
    { key: 'unitCost', label: 'Unit cost', sortable: true, type: 'currency' },
    { key: 'stockValue', label: 'Stock value', sortable: true, type: 'currency' },
    { key: 'stockStatus', label: 'Level', type: 'template', width: '110px' },
    { key: 'isActive', label: 'Status', type: 'badge', sortable: true, width: '100px' },
  ];

  readonly filters = this.fb.group({ categoryId: [''], isActive: [''], lowStockOnly: [false] });
  readonly list = new PagedList<InventoryItem>(
    (q) => this.svc.items(q),
    () => {
      const f = this.filters.getRawValue();
      return {
        categoryId: f.categoryId || undefined,
        isActive: f.isActive || undefined,
        lowStockOnly: f.lowStockOnly ? true : undefined,
      };
    },
  );

  readonly formOpen = signal(false);
  readonly editing = signal<InventoryItem | null>(null);
  readonly detailId = signal<number | null>(null);

  constructor() {
    const p = this.route.snapshot.queryParamMap;
    const type = qp(p, 'type');
    const status = qp(p, 'status').toLowerCase();
    this.filters.patchValue({
      categoryId: qp(p, 'categoryId'),
      isActive: qp(p, 'isActive'),
      lowStockOnly: type === 'low-stock' || status === 'low' || status === 'lowstock' || p.get('lowStockOnly') === 'true',
    });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
    this.list.load();
  }

  openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  openEdit(row: InventoryItem): void {
    this.editing.set(row);
    this.formOpen.set(true);
  }

  openDetail(row: InventoryItem): void {
    this.detailId.set(row.id);
  }

  onSaved(): void {
    this.formOpen.set(false);
    this.list.load();
  }
}
