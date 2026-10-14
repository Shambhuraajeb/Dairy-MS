import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { ProductFormModalComponent } from '../product-form/product-form-modal.component';
import { ProductPricesModalComponent } from '../product-prices/product-prices-modal.component';
import { Product } from '../product.model';
import { ProductService } from '../product.service';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    HasPermissionDirective,
    ProductFormModalComponent,
    ProductPricesModalComponent,
    AppNumberPipe,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Products" subtitle="Sellable products, stock and price list">
      <a routerLink="/products/categories" class="btn btn-outline-secondary"><i class="bi bi-tags me-1"></i>Categories</a>
      <button *appHasPermission="'product.create'" type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="bi bi-plus-lg me-1"></i>Add Product
      </button>
    </app-page-header>

    <app-data-table
      [columns]="columns"
      [items]="items()"
      [total]="total()"
      [loading]="loading()"
      [error]="error()"
      [page]="query.page ?? 1"
      [pageSize]="query.pageSize ?? 20"
      searchPlaceholder="Search code or name..."
      emptyTitle="No products found"
      (queryChange)="onQuery($event)"
      (retry)="load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2">
        <select class="form-select form-select-sm w-auto" formControlName="categoryId" aria-label="Category">
          <option value="">All categories</option>
          @for (c of categories(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="isActive" aria-label="Status">
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="isMilkBased" aria-label="Milk based">
          <option value="">Milk / non-milk</option>
          <option value="true">Milk based</option>
          <option value="false">Non-milk</option>
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="lowStock" aria-label="Stock">
          <option value="">All stock levels</option>
          <option value="true">Low stock only</option>
        </select>
      </div>

      <ng-template appColumn="name" let-row>
        <div class="fw-semibold">{{ row.name }}</div>
        @if (row.isMilkBased) {
          <span class="badge rounded-pill badge-soft badge-soft-info">Milk based</span>
        }
      </ng-template>
      <ng-template appColumn="currentStock" let-row>
        {{ row.currentStock | appNumber: 3 }} {{ row.unitCode }}
        @if (row.reorderLevel > 0 && row.currentStock <= row.reorderLevel) {
          <span class="badge rounded-pill badge-soft badge-soft-warning ms-1">Low</span>
        }
      </ng-template>
      <ng-template appRowActions let-row>
        <button type="button" class="btn btn-sm btn-outline-primary me-1" (click)="openPrices(row)">
          <i class="bi bi-currency-rupee"></i> Prices
        </button>
        <button *appHasPermission="'product.update'" type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="openEdit(row)">
          <i class="bi bi-pencil"></i> Edit
        </button>
        @if (row.isActive) {
          <button *appHasPermission="'product.update'" type="button" class="btn btn-sm btn-outline-danger" (click)="deactivate(row)">
            Deactivate
          </button>
        }
      </ng-template>
    </app-data-table>

    <app-product-form-modal [open]="formOpen()" [product]="editing()" (saved)="onSaved()" (closed)="formOpen.set(false)" />
    <app-product-prices-modal [open]="pricesOpen()" [product]="priced()" (changed)="load()" (closed)="pricesOpen.set(false)" />
  `,
})
export class ProductListComponent {
  private readonly svc = inject(ProductService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly categories = toSignal(this.lookups.get('product-categories'), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'productCode', label: 'Code', sortable: true, width: '110px' },
    { key: 'name', label: 'Product', sortable: true },
    { key: 'categoryName', label: 'Category', sortable: true },
    { key: 'currentPrice', label: 'Retail price', type: 'currency' },
    { key: 'distributorPrice', label: 'Distributor', type: 'currency' },
    { key: 'taxPercent', label: 'Tax %', type: 'number', width: '80px' },
    { key: 'currentStock', label: 'Stock', sortable: true, align: 'end' },
    { key: 'isActive', label: 'Status', type: 'badge', sortable: true, width: '100px' },
  ];

  readonly filters = this.fb.group({ categoryId: [''], isActive: [''], isMilkBased: [''], lowStock: [''] });

  readonly items = signal<Product[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  query: PagedQuery = { page: 1, pageSize: 20 };

  readonly formOpen = signal(false);
  readonly editing = signal<Product | null>(null);
  readonly pricesOpen = signal(false);
  readonly priced = signal<Product | null>(null);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.filters.patchValue(
        {
          categoryId: p.get('categoryId') ?? '',
          isActive: p.get('isActive') ?? '',
          isMilkBased: p.get('isMilkBased') ?? '',
          lowStock: p.get('lowStock') ?? '',
        },
        { emitEvent: false },
      );
      this.query = { ...this.query, page: 1 };
      this.load();
    });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.query = { ...this.query, page: 1 };
      this.load();
    });
  }

  onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.list({ ...this.query, ...this.filters.getRawValue() }).subscribe({
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

  openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  openEdit(p: Product): void {
    this.editing.set(p);
    this.formOpen.set(true);
  }

  openPrices(p: Product): void {
    this.priced.set(p);
    this.pricesOpen.set(true);
  }

  onSaved(): void {
    this.formOpen.set(false);
    this.load();
  }

  async deactivate(p: Product): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Deactivate product',
      message: `Deactivate "${p.name}"? It will no longer be available for new orders.`,
      confirmText: 'Deactivate',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc.remove(p.id).subscribe(() => {
      this.lookups.clear('products');
      this.toast.success('Product deactivated.');
      this.load();
    });
  }
}
