import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PagedList, orNull } from '../../../shared/utils/paged-list';
import { ExpenseCategory } from '../expense.model';
import { ExpenseService } from '../expense.service';

@Component({
  selector: 'app-expense-category-list',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, ModalComponent, FormFieldComponent, HasPermissionDirective, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Expense Categories" subtitle="Classify expenses (feed, salaries, repairs, utilities...)">
      <button *appHasPermission="'expense.approve'" type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="bi bi-plus-lg me-1"></i>Add Category
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
      searchPlaceholder="Search code or name..."
      emptyTitle="No categories found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters">
        <select class="form-select form-select-sm w-auto" formControlName="isActive" aria-label="Status">
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <ng-template appRowActions let-row>
        <button *appHasPermission="'expense.approve'" type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="openEdit(row)">
          <i class="bi bi-pencil"></i> Edit
        </button>
        <button
          *appHasPermission="'expense.approve'"
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
        <app-form-field label="Code" inputId="catCode" [control]="form.controls.code">
          <input id="catCode" type="text" class="form-control" formControlName="code" maxlength="30" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Name" inputId="catName" [control]="form.controls.name">
          <input id="catName" type="text" class="form-control" formControlName="name" maxlength="100" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Description" inputId="catDesc" [control]="form.controls.description">
          <textarea id="catDesc" rows="2" class="form-control" formControlName="description" maxlength="250"></textarea>
        </app-form-field>
        @if (editing()) {
          <div class="form-check form-switch">
            <input id="catActive" type="checkbox" class="form-check-input" formControlName="isActive" />
            <label class="form-check-label" for="catActive">Active</label>
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
export class ExpenseCategoryListComponent {
  private readonly svc = inject(ExpenseService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly columns: TableColumn[] = [
    { key: 'code', label: 'Code', sortable: true, width: '160px' },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'description', label: 'Description' },
    { key: 'expenseCount', label: 'Expenses', type: 'number', width: '90px' },
    { key: 'isActive', label: 'Status', type: 'badge', sortable: true, width: '120px' },
  ];

  readonly filters = this.fb.group({ isActive: [''] });
  readonly list = new PagedList<ExpenseCategory>(
    (q) => this.svc.categories(q),
    () => ({ isActive: this.filters.controls.isActive.value || undefined }),
  );

  readonly modalOpen = signal(false);
  readonly editing = signal<ExpenseCategory | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    isActive: [true],
  });

  constructor() {
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
    this.list.load();
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({ code: '', name: '', description: '', isActive: true });
    this.modalOpen.set(true);
  }

  openEdit(row: ExpenseCategory): void {
    this.editing.set(row);
    this.form.reset({ code: row.code, name: row.name, description: row.description ?? '', isActive: row.isActive });
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
    const body = { code: v.code.trim(), name: v.name.trim(), description: orNull(v.description.trim()) };
    this.saving.set(true);
    const request$ = current ? this.svc.updateCategory(current.id, { ...body, isActive: v.isActive }) : this.svc.createCategory(body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.lookups.clear('expense-categories');
        this.toast.success(current ? 'Category updated.' : 'Category created.');
        this.list.load();
      },
      error: () => this.saving.set(false),
    });
  }

  async toggleActive(row: ExpenseCategory): Promise<void> {
    const activate = !row.isActive;
    const ok = await this.confirmService.confirm({
      title: activate ? 'Activate category' : 'Deactivate category',
      message: `${activate ? 'Activate' : 'Deactivate'} category "${row.name}"?`,
      confirmText: activate ? 'Activate' : 'Deactivate',
      variant: activate ? 'primary' : 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc
      .updateCategory(row.id, { code: row.code, name: row.name, description: row.description, isActive: activate })
      .subscribe(() => {
        this.lookups.clear('expense-categories');
        this.toast.success(activate ? 'Category activated.' : 'Category deactivated.');
        this.list.load();
      });
  }
}
