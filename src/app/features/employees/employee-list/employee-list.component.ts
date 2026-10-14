import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { toIsoDate } from '../../../shared/utils/format';
import { PagedList, orNull } from '../../../shared/utils/paged-list';
import { EMPLOYEE_STATUSES, Employee } from '../employee.model';
import { EmployeeService } from '../employee.service';

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, ModalComponent, FormFieldComponent, HasPermissionDirective, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Employees" subtitle="Staff records, designations and salary defaults">
      <a *appHasPermission="'employee.view'" routerLink="/employees/designations" class="btn btn-outline-secondary">
        <i class="bi bi-award me-1"></i>Designations
      </a>
      <a *appHasPermission="'employee.create'" routerLink="/employees/new" class="btn btn-primary">
        <i class="bi bi-plus-lg me-1"></i>New Employee
      </a>
    </app-page-header>

    <app-data-table
      [columns]="columns"
      [items]="list.items()"
      [total]="list.total()"
      [loading]="list.loading()"
      [error]="list.error()"
      [page]="list.query.page ?? 1"
      [pageSize]="list.query.pageSize ?? 20"
      searchPlaceholder="Search name, code, mobile or email..."
      emptyTitle="No employees found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2">
        <select class="form-select form-select-sm w-auto" formControlName="designationId" aria-label="Designation">
          <option value="">All designations</option>
          @for (d of designations(); track d.id) {
            <option [value]="d.id">{{ d.name }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
      </div>

      <ng-template appColumn="fullName" let-row>
        <div class="fw-semibold">{{ row.fullName }}</div>
        @if (row.email) {
          <div class="small text-muted">{{ row.email }}</div>
        }
      </ng-template>
      <ng-template appRowActions let-row>
        <a *appHasPermission="'employee.update'" [routerLink]="['/employees', row.id, 'edit']" class="btn btn-sm btn-outline-secondary me-1">
          <i class="bi bi-pencil"></i> Edit
        </a>
        @if (row.status === 'Active') {
          <button *appHasPermission="'employee.update'" type="button" class="btn btn-sm btn-outline-danger" (click)="openDeactivate(row)">
            Deactivate
          </button>
        } @else {
          <button *appHasPermission="'employee.update'" type="button" class="btn btn-sm btn-outline-success" (click)="activate(row)">
            Activate
          </button>
        }
      </ng-template>
    </app-data-table>

    <app-modal [open]="deactivating() !== null" title="Deactivate Employee" size="sm" (closed)="closeDeactivate()">
      <form id="deactivateForm" [formGroup]="deactivateForm" (ngSubmit)="confirmDeactivate()" novalidate>
        <p class="mb-3">
          Deactivate <strong>{{ deactivating()?.fullName }}</strong>?
        </p>
        <app-form-field label="New status" inputId="deStatus" [control]="deactivateForm.controls.status">
          <select id="deStatus" class="form-select" formControlName="status">
            <option value="Inactive">Inactive</option>
            <option value="Terminated">Terminated</option>
          </select>
        </app-form-field>
        <app-form-field label="Exit date" inputId="deExit" [control]="deactivateForm.controls.exitDate">
          <input id="deExit" type="date" class="form-control" formControlName="exitDate" />
        </app-form-field>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeDeactivate()">Cancel</button>
        <button type="submit" form="deactivateForm" class="btn btn-danger" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Deactivate
        </button>
      </div>
    </app-modal>
  `,
})
export class EmployeeListComponent {
  private readonly svc = inject(EmployeeService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly statuses = EMPLOYEE_STATUSES;
  readonly designations = toSignal(this.lookups.get('designations'), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'employeeCode', label: 'Code', sortable: true, width: '110px' },
    { key: 'fullName', label: 'Employee', sortable: true },
    { key: 'mobile', label: 'Mobile', sortable: true },
    { key: 'designationName', label: 'Designation', sortable: true },
    { key: 'joinDate', label: 'Joined', type: 'date', sortable: true },
    { key: 'basicSalary', label: 'Basic Salary', type: 'currency', sortable: true },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
  ];

  readonly filters = this.fb.group({ designationId: [''], status: [''] });
  readonly list = new PagedList<Employee>(
    (q) => this.svc.list(q),
    () => this.filterQuery(),
  );

  readonly deactivating = signal<Employee | null>(null);
  readonly saving = signal(false);
  readonly deactivateForm = this.fb.group({
    status: ['Inactive' as 'Inactive' | 'Terminated', Validators.required],
    exitDate: [toIsoDate()],
  });

  constructor() {
    this.list.load();
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
  }

  private filterQuery(): PagedQuery {
    const v = this.filters.getRawValue();
    return { designationId: v.designationId, status: v.status };
  }

  openDeactivate(emp: Employee): void {
    this.deactivateForm.reset({ status: 'Inactive', exitDate: toIsoDate() });
    this.deactivating.set(emp);
  }

  closeDeactivate(): void {
    if (!this.saving()) {
      this.deactivating.set(null);
    }
  }

  confirmDeactivate(): void {
    const emp = this.deactivating();
    if (!emp || this.deactivateForm.invalid) {
      return;
    }
    const v = this.deactivateForm.getRawValue();
    this.saving.set(true);
    this.svc.deactivate(emp.id, { status: v.status, exitDate: orNull(v.exitDate) }).subscribe({
      next: () => {
        this.saving.set(false);
        this.deactivating.set(null);
        this.toast.success('Employee deactivated.');
        this.list.load();
      },
      error: () => this.saving.set(false),
    });
  }

  async activate(emp: Employee): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Activate employee',
      message: `Re-activate "${emp.fullName}"? The exit date will be cleared.`,
      confirmText: 'Activate',
    });
    if (!ok) {
      return;
    }
    this.svc.activate(emp.id).subscribe(() => {
      this.toast.success('Employee activated.');
      this.list.load();
    });
  }
}
