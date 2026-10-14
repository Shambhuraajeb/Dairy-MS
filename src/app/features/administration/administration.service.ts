import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../core/models/api.model';
import { ApiService } from '../../core/services/api.service';
import {
  AuditFilterOptions,
  AuditLogDetail,
  AuditLogItem,
  OrgPath,
  PermissionGroup,
  ResetPasswordRequest,
  Role,
  RoleDetail,
  RoleRequest,
  Setting,
  UserAdmin,
  UserCreateRequest,
  UserUpdateRequest,
} from './administration.model';

/** One service for the whole administration area: users, roles, permissions, settings, audit log, org master data. */
@Injectable({ providedIn: 'root' })
export class AdministrationService {
  private readonly api = inject(ApiService);
  // lists render their own errors inline (Retry button)
  private readonly quiet = { skipErrorToast: true };

  // ---- users
  listUsers(q: PagedQuery): Observable<PagedResult<UserAdmin>> {
    return this.api.getPaged<UserAdmin>('admin/users', q, this.quiet);
  }
  createUser(body: UserCreateRequest): Observable<UserAdmin> {
    return this.api.post<UserAdmin>('admin/users', body);
  }
  updateUser(id: number, body: UserUpdateRequest): Observable<UserAdmin> {
    return this.api.put<UserAdmin>(`admin/users/${id}`, body);
  }
  resetPassword(id: number, body: ResetPasswordRequest): Observable<{ temporaryPassword: string | null }> {
    return this.api.post<{ temporaryPassword: string | null }>(`admin/users/${id}/reset-password`, body);
  }
  unlockUser(id: number): Observable<UserAdmin> {
    return this.api.post<UserAdmin>(`admin/users/${id}/unlock`);
  }

  // ---- roles
  listRoles(q: PagedQuery): Observable<PagedResult<Role>> {
    return this.api.getPaged<Role>('admin/roles', q, this.quiet);
  }
  getRole(id: number | string): Observable<RoleDetail> {
    return this.api.get<RoleDetail>(`admin/roles/${id}`, undefined, this.quiet);
  }
  createRole(body: RoleRequest): Observable<RoleDetail> {
    return this.api.post<RoleDetail>('admin/roles', body);
  }
  updateRole(id: number, body: RoleRequest): Observable<RoleDetail> {
    return this.api.put<RoleDetail>(`admin/roles/${id}`, body);
  }
  deleteRole(id: number): Observable<unknown> {
    return this.api.delete(`admin/roles/${id}`);
  }
  setRolePermissions(id: number, codes: string[]): Observable<RoleDetail> {
    return this.api.put<RoleDetail>(`admin/roles/${id}/permissions`, { codes });
  }

  // ---- permissions
  listPermissions(): Observable<PermissionGroup[]> {
    return this.api.get<PermissionGroup[]>('admin/permissions', undefined, this.quiet);
  }

  // ---- settings
  listSettings(): Observable<Setting[]> {
    return this.api.get<Setting[]>('admin/settings', undefined, this.quiet);
  }
  saveSettings(items: { key: string; value: string }[]): Observable<Setting[]> {
    return this.api.put<Setting[]>('admin/settings', { items });
  }

  // ---- audit log
  listAudit(q: PagedQuery): Observable<PagedResult<AuditLogItem>> {
    return this.api.getPaged<AuditLogItem>('admin/audit-logs', q, this.quiet);
  }
  auditFilters(): Observable<AuditFilterOptions> {
    return this.api.get<AuditFilterOptions>('admin/audit-logs/filters', undefined, this.quiet);
  }
  getAudit(id: number): Observable<AuditLogDetail> {
    return this.api.get<AuditLogDetail>(`admin/audit-logs/${id}`);
  }

  // ---- organization master data (dairy / branches / collection-centers)
  listOrg<T>(path: OrgPath, q: PagedQuery): Observable<PagedResult<T>> {
    return this.api.getPaged<T>(`admin/${path}`, q, this.quiet);
  }
  createOrg<T>(path: OrgPath, body: object): Observable<T> {
    return this.api.post<T>(`admin/${path}`, body);
  }
  updateOrg<T>(path: OrgPath, id: number, body: object): Observable<T> {
    return this.api.put<T>(`admin/${path}/${id}`, body);
  }
}
