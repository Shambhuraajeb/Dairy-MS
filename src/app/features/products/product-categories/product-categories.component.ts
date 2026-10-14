import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { PagedQuery } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { ProductCategory } from '../product.model';
import { ProductService } from '../product.service';

@Component({
  selector: 'app-product-categories',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    ModalComponent,
    FormFieldComponent,
    HasPermissionDirective,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Product Categories" subtitle="Group products for browsing and reporting">
      <a routerLink="/products" class="btn btn-outline-secondary"><i class="bi bi-basket me-1"></i>Products</a>
      <button *appHasPermission="'product.create'" type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="bi bi-plus-lg me-1"></i>Add Category
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
      emptyTitle="No categories found"
      (queryChange)="onQuery($event)"
      (retry)="load()"
    >
      <div tableFilters [formGroup]="filters">
        <select class="form-select form-select-sm w-auto" formControlName="isActive" aria-label="Status">
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <ng-template appRowActions let-row>
        <button *appHasPermission="'product.update'" type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="openEdit(row)">
          <i class="bi bi-pencil"></i> Edit
        </button>
        <button
          *appHasPermission="'product.update'"
          type="button"
          class="btn btn-sm"
          [class.btn-outline-danger]="row.isActive"
          [class.btn-outline-success]="!row.isActive"
          (click)="toggleActive(row)"
        >
          {{ row.isActive ? 'Deactivate' : 'Activate' }}
        </button>
      </ng-template>
    </app-data-table>

    <app-modal [open]="modalOpen()" [title]="editing() ? 'Edit Category' : 'Add Category'" (closed)="closeModal()">
      <form id="categoryForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-form-field label="Code" inputId="pcCode" [control]="form.controls.code" [hint]="editing() ? '' : 'Leave blank to auto-generate'">
          <input id="pcCode" type="text" class="form-control" formControlName="code" maxlength="20" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Name" inputId="pcName" [control]="form.controls.name">
          <input id="pcName" type="text" class="form-control" formControlName="name" maxlength="100" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Description" inputId="pcDesc" [control]="form.controls.description">
          <textarea id="pcDesc" class="form-control" rows="2" formControlName="description" maxlength="255"></textarea>
        </app-form-field>
        @if (editing()) {
          <div class="form-check form-switch">
            <input id="pcActive" type="checkbox" class="form-check-input" formControlName="isActive" />
            <label class="form-check-label" for="pcActive">Active</label>
          </div>
        }
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeModal()">Cancel</button>
        <button type="submit" form="categoryForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class ProductCategoriesComponent {
  private readonly svc = inject(ProductService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly columns: TableColumn[] = [
    { key: 'code', label: 'Code', sortable: true, width: '140px' },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'description', label: 'Description' },
    { key: 'productCount', label: 'Products', type: 'number', width: '100px' },
    { key: 'isActive', label: 'Status', type: 'badge', sortable: true, width: '110px' },
  ];

  readonly filters = this.fb.group({ isActive: [''] });
  readonly items = signal<ProductCategory[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  query: PagedQuery = { page: 1, pageSize: 20 };

  readonly modalOpen = signal(false);
  readonly editing = signal<ProductCategory | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    code: ['', [Validators.maxLength(20)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(255)]],
    isActive: [true],
  });

  constructor() {
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.query = { ...this.query, page: 1 };
      this.load();
    });
    this.load();
  }

  onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.categories({ ...this.query, ...this.filters.getRawValue() }).subscribe({
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
    this.form.controls.code.setValidators([Validators.maxLength(20)]);
    this.form.reset({ code: '', name: '', description: '', isActive: true });
    this.modalOpen.set(true);
  }

  openEdit(c: ProductCategory): void {
    this.editing.set(c);
    this.form.controls.code.setValidators([Validators.required, Validators.maxLength(20)]);
    this.form.reset({ code: c.code, name: c.name, description: c.description ?? '', isActive: c.isActive });
    this.modalOpen.set(true);
  }

  closeModal(): void {
    if (!this.saving()) {
      this.modalOpen.set(false);
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const current = this.editing();
    const common = { code: v.code.trim() || null, name: v.name.trim(), description: v.description.trim() || null };
    this.saving.set(true);
    const request$: Observable<unknown> = current
      ? this.svc.updateCategory(current.id, { ...common, isActive: v.isActive })
      : this.svc.createCategory(common);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.lookups.clear('product-categories');
        this.toast.success(current ? 'Category updated.' : 'Category created.');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  async toggleActive(c: ProductCategory): Promise<void> {
    const activate = !c.isActive;
    const ok = await this.confirmService.confirm({
      title: activate ? 'Activate category' : 'Deactivate category',
      message: `${activate ? 'Activate' : 'Deactivate'} category "${c.name}"?`,
      confirmText: activate ? 'Activate' : 'Deactivate',
      variant: activate ? 'primary' : 'danger',
    });
    if (!ok) {
      return;
    }
    const request$: Observable<unknown> = activate
      ? this.svc.updateCategory(c.id, { code: c.code, name: c.name, description: c.description, isActive: true })
      : this.svc.removeCategory(c.id);
    request$.subscribe(() => {
      this.lookups.clear('product-categories');
      this.toast.success(activate ? 'Category activated.' : 'Category deactivated.');
      this.load();
    });
  }
}
