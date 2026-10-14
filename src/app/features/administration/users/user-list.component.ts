import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppDatePipe } from '../../../shared/pipes/app-pipes';
import { PagedList } from '../../../shared/utils/paged-list';
import { UserAdmin } from '../administration.model';
import { AdministrationService } from '../administration.service';
import { ResetPasswordModalComponent } from './reset-password-modal.component';
import { UserFormModalComponent } from './user-form-modal.component';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    AppDatePipe,
    UserFormModalComponent,
    ResetPasswordModalComponent,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Users" subtitle="Manage sign-in accounts, roles and linked records">
      <button *appHasPermission="'user.manage'" type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="bi bi-person-plus me-1"></i>New User
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
      searchPlaceholder="Search username, name, email or mobile..."
      emptyTitle="No users found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2">
        <select class="form-select form-select-sm w-auto" formControlName="roleId" aria-label="Role">
          <option value="">All roles</option>
          @for (r of roles(); track r.id) {
            <option [value]="r.id">{{ r.name }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="isActive" aria-label="Status">
          <option value="">Active and inactive</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="isLocked" aria-label="Locked">
          <option value="">Locked or not</option>
          <option value="true">Locked</option>
          <option value="false">Not locked</option>
        </select>
      </div>

      <ng-template appColumn="displayName" let-row>
        <div class="fw-semibold">{{ row.displayName }}</div>
        <div class="small text-muted">{{ row.email || row.mobile || '' }}</div>
      </ng-template>
      <ng-template appColumn="linked" let-row>
        @if (row.farmerName) {
          <div class="small"><i class="bi bi-person me-1"></i>Farmer: {{ row.farmerName }}</div>
        }
        @if (row.customerName) {
          <div class="small"><i class="bi bi-person-vcard me-1"></i>Customer: {{ row.customerName }}</div>
        }
        @if (row.employeeName) {
          <div class="small"><i class="bi bi-person-badge me-1"></i>Employee: {{ row.employeeName }}</div>
        }
        @if (!row.farmerName && !row.customerName && !row.employeeName) {
          <span class="text-muted">—</span>
        }
      </ng-template>
      <ng-template appColumn="lastLoginDate" let-row>{{ row.lastLoginDate | appDate: 'datetime' }}</ng-template>
      <ng-template appColumn="isActive" let-row>
        <app-status-badge [status]="row.isActive" />
        @if (row.isLocked) {
          <app-status-badge status="Locked" class="ms-1" />
        }
      </ng-template>
      <ng-template appRowActions let-row>
        <button type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="openEdit(row)"><i class="bi bi-pencil"></i> Edit</button>
        <button type="button" class="btn btn-sm btn-outline-warning me-1" (click)="resetTarget.set(row)"><i class="bi bi-key"></i> Reset</button>
        @if (row.isLocked) {
          <button type="button" class="btn btn-sm btn-outline-info me-1" (click)="unlock(row)"><i class="bi bi-unlock"></i> Unlock</button>
        }
        <button
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

    <app-user-form-modal [open]="formOpen()" [user]="editing()" (closed)="formOpen.set(false)" (saved)="onSaved()" />
    <app-reset-password-modal [user]="resetTarget()" (closed)="resetTarget.set(null)" />
  `,
})
export class UserListComponent {
  private readonly svc = inject(AdministrationService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly roles = toSignal(this.lookups.get('roles'), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'username', label: 'Username', sortable: true },
    { key: 'displayName', label: 'Name', sortable: true },
    { key: 'roleName', label: 'Role', sortable: true },
    { key: 'linked', label: 'Linked to' },
    { key: 'lastLoginDate', label: 'Last sign-in', sortable: true },
    { key: 'isActive', label: 'Status', sortable: true, width: '150px' },
  ];

  readonly filters = this.fb.group({ roleId: [''], isActive: [''], isLocked: [''] });
  readonly list = new PagedList<UserAdmin>(
    (q) => this.svc.listUsers(q),
    () => this.filters.getRawValue() as PagedQuery,
  );

  readonly formOpen = signal(false);
  readonly editing = signal<UserAdmin | null>(null);
  readonly resetTarget = signal<UserAdmin | null>(null);

  constructor() {
    this.list.load();
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
  }

  openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  openEdit(u: UserAdmin): void {
    this.editing.set(u);
    this.formOpen.set(true);
  }

  onSaved(): void {
    this.formOpen.set(false);
    this.list.load();
  }

  async toggleActive(u: UserAdmin): Promise<void> {
    const activate = !u.isActive;
    const ok = await this.confirmService.confirm({
      title: activate ? 'Activate user' : 'Deactivate user',
      message: activate
        ? `Allow "${u.username}" to sign in again?`
        : `Deactivate "${u.username}"? They will no longer be able to sign in.`,
      confirmText: activate ? 'Activate' : 'Deactivate',
      variant: activate ? 'primary' : 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc
      .updateUser(u.id, {
        displayName: u.displayName,
        email: u.email,
        mobile: u.mobile,
        roleId: u.roleId,
        farmerId: u.farmerId,
        customerId: u.customerId,
        employeeId: u.employeeId,
        branchId: u.branchId,
        collectionCenterId: u.collectionCenterId,
        isActive: activate,
      })
      .subscribe(() => {
        this.toast.success(activate ? 'User activated.' : 'User deactivated.');
        this.list.load();
      });
  }

  async unlock(u: UserAdmin): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Unlock user',
      message: `Unlock "${u.username}" and clear the failed sign-in count?`,
      confirmText: 'Unlock',
    });
    if (!ok) {
      return;
    }
    this.svc.unlockUser(u.id).subscribe(() => {
      this.toast.success('User unlocked.');
      this.list.load();
    });
  }
}
