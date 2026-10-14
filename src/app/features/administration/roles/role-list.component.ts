import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { PagedList, orNull } from '../../../shared/utils/paged-list';
import { Role } from '../administration.model';
import { AdministrationService } from '../administration.service';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, ModalComponent, FormFieldComponent, StatusBadgeComponent, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Roles" subtitle="Define roles and the permissions they grant">
      <a routerLink="/administration/permissions" class="btn btn-outline-secondary"><i class="bi bi-key me-1"></i>Permission catalog</a>
      <button type="button" class="btn btn-primary" (click)="openCreate()"><i class="bi bi-plus-lg me-1"></i>New Role</button>
    </app-page-header>

    <app-data-table
      [columns]="columns"
      [items]="list.items()"
      [total]="list.total()"
      [loading]="list.loading()"
      [error]="list.error()"
      [page]="list.query.page ?? 1"
      [pageSize]="list.query.pageSize ?? 20"
      searchPlaceholder="Search roles..."
      emptyTitle="No roles found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <ng-template appColumn="name" let-row>
        <a [routerLink]="['/administration/roles', row.id]" class="fw-semibold text-decoration-none">{{ row.name }}</a>
        @if (row.description) {
          <div class="small text-muted">{{ row.description }}</div>
        }
      </ng-template>
      <ng-template appColumn="isSystem" let-row>
        @if (row.isSystem) {
          <app-status-badge status="info" label="System" />
        } @else {
          <app-status-badge status="secondary" label="Custom" />
        }
      </ng-template>
      <ng-template appRowActions let-row>
        <a [routerLink]="['/administration/roles', row.id]" class="btn btn-sm btn-outline-primary me-1">
          <i class="bi bi-shield-check"></i> Permissions
        </a>
        @if (!row.isSystem) {
          <button type="button" class="btn btn-sm btn-outline-danger" (click)="remove(row)"><i class="bi bi-trash"></i> Delete</button>
        }
      </ng-template>
    </app-data-table>

    <app-modal [open]="createOpen()" title="New Role" size="sm" (closed)="closeCreate()">
      <form id="roleForm" [formGroup]="form" (ngSubmit)="create()" novalidate>
        <app-form-field label="Name" inputId="roleName" [control]="form.controls.name">
          <input id="roleName" class="form-control" formControlName="name" maxlength="100" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Description" inputId="roleDesc" [control]="form.controls.description" hint="You can assign permissions after creating the role">
          <textarea id="roleDesc" rows="2" class="form-control" formControlName="description" maxlength="250"></textarea>
        </app-form-field>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeCreate()">Cancel</button>
        <button type="submit" form="roleForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Create
        </button>
      </div>
    </app-modal>
  `,
})
export class RoleListComponent {
  private readonly svc = inject(AdministrationService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly columns: TableColumn[] = [
    { key: 'name', label: 'Role', sortable: true },
    { key: 'isSystem', label: 'Type', sortable: true, width: '110px' },
    { key: 'userCount', label: 'Users', type: 'number', width: '90px' },
    { key: 'permissionCount', label: 'Permissions', type: 'number', width: '120px' },
    { key: 'isActive', label: 'Status', type: 'badge', sortable: true, width: '110px' },
  ];

  readonly list = new PagedList<Role>((q) => this.svc.listRoles(q));
  readonly createOpen = signal(false);
  readonly saving = signal(false);
  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(250)],
  });

  constructor() {
    this.list.load();
  }

  openCreate(): void {
    this.form.reset({ name: '', description: '' });
    this.createOpen.set(true);
  }

  closeCreate(): void {
    if (!this.saving()) {
      this.createOpen.set(false);
    }
  }

  create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.svc.createRole({ name: v.name.trim(), description: orNull(v.description.trim()) }).subscribe({
      next: (role) => {
        this.saving.set(false);
        this.createOpen.set(false);
        this.toast.success('Role created. Assign its permissions now.');
        this.lookups.clear('roles');
        this.router.navigate(['/administration/roles', role.id]);
      },
      error: () => this.saving.set(false),
    });
  }

  async remove(role: Role): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Delete role',
      message: `Delete role "${role.name}"? Roles that still have users cannot be deleted.`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc.deleteRole(role.id).subscribe(() => {
      this.toast.success('Role deleted.');
      this.lookups.clear('roles');
      this.list.load();
    });
  }
}
