import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PagedQuery } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PagedList, orNull } from '../../../shared/utils/paged-list';
import { Designation } from '../employee.model';
import { EmployeeService } from '../employee.service';

@Component({
  selector: 'app-designations',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, ModalComponent, FormFieldComponent, HasPermissionDirective, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Designations" subtitle="Job titles and departments used by employees">
      <a routerLink="/employees" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>Employees</a>
      <button *appHasPermission="'employee.create'" type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="bi bi-plus-lg me-1"></i>Add Designation
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
      searchPlaceholder="Search designation or department..."
      emptyTitle="No designations found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters">
        <select class="form-select form-select-sm w-auto" formControlName="isActive" aria-label="Status">
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <ng-template appRowActions let-row>
        <button *appHasPermission="'employee.update'" type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="openEdit(row)">
          <i class="bi bi-pencil"></i> Edit
        </button>
        @if (row.isActive) {
          <button *appHasPermission="'employee.update'" type="button" class="btn btn-sm btn-outline-danger" (click)="deactivate(row)">Deactivate</button>
        } @else {
          <button *appHasPermission="'employee.update'" type="button" class="btn btn-sm btn-outline-success" (click)="activate(row)">Activate</button>
        }
      </ng-template>
    </app-data-table>

    <app-modal [open]="modalOpen()" [title]="editing() ? 'Edit Designation' : 'Add Designation'" (closed)="closeModal()">
      <form id="designationForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-form-field label="Name" inputId="desName" [control]="form.controls.name">
          <input id="desName" class="form-control" formControlName="name" maxlength="100" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Department" inputId="desDept" [control]="form.controls.department">
          <input id="desDept" class="form-control" formControlName="department" maxlength="100" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Description" inputId="desDesc" [control]="form.controls.description">
          <textarea id="desDesc" rows="2" class="form-control" formControlName="description" maxlength="250"></textarea>
        </app-form-field>
        @if (editing()) {
          <div class="form-check form-switch">
            <input id="desActive" type="checkbox" class="form-check-input" formControlName="isActive" />
            <label class="form-check-label" for="desActive">Active</label>
          </div>
        }
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeModal()">Cancel</button>
        <button type="submit" form="designationForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class DesignationsComponent {
  private readonly svc = inject(EmployeeService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly columns: TableColumn[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'department', label: 'Department', sortable: true },
    { key: 'description', label: 'Description' },
    { key: 'employeeCount', label: 'Active Employees', type: 'number', width: '150px' },
    { key: 'isActive', label: 'Status', type: 'badge', sortable: true, width: '120px' },
  ];

  readonly filters = this.fb.group({ isActive: [''] });
  readonly list = new PagedList<Designation>(
    (q) => this.svc.listDesignations(q),
    () => ({ isActive: this.filters.getRawValue().isActive }) as PagedQuery,
  );

  readonly modalOpen = signal(false);
  readonly editing = signal<Designation | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    department: ['', Validators.maxLength(100)],
    description: ['', Validators.maxLength(250)],
    isActive: [true],
  });

  constructor() {
    this.list.load();
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({ name: '', department: '', description: '', isActive: true });
    this.modalOpen.set(true);
  }

  openEdit(d: Designation): void {
    this.editing.set(d);
    this.form.reset({ name: d.name, department: d.department ?? '', description: d.description ?? '', isActive: d.isActive });
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
    const body = { name: v.name.trim(), department: orNull(v.department.trim()), description: orNull(v.description.trim()) };
    const current = this.editing();
    this.saving.set(true);
    const request$ = current ? this.svc.updateDesignation(current.id, { ...body, isActive: v.isActive }) : this.svc.createDesignation(body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.toast.success(current ? 'Designation updated.' : 'Designation created.');
        this.lookups.clear('designations');
        this.list.load();
      },
      error: () => this.saving.set(false),
    });
  }

  async deactivate(d: Designation): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Deactivate designation',
      message: `Deactivate "${d.name}"? This is blocked while active employees hold it.`,
      confirmText: 'Deactivate',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc.deactivateDesignation(d.id).subscribe(() => {
      this.toast.success('Designation deactivated.');
      this.lookups.clear('designations');
      this.list.load();
    });
  }

  activate(d: Designation): void {
    this.svc
      .updateDesignation(d.id, { name: d.name, department: d.department, description: d.description, isActive: true })
      .subscribe(() => {
        this.toast.success('Designation activated.');
        this.lookups.clear('designations');
        this.list.load();
      });
  }
}
