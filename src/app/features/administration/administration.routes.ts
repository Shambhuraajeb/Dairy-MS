import { Routes } from '@angular/router';

export const ADMINISTRATION_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'users' },
  {
    path: 'users',
    loadComponent: () => import('./users/user-list.component').then((m) => m.UserListComponent),
    data: { permission: 'user.manage', title: 'Users', breadcrumb: 'Users' },
  },
  {
    path: 'roles',
    loadComponent: () => import('./roles/role-list.component').then((m) => m.RoleListComponent),
    data: { permission: 'role.manage', title: 'Roles', breadcrumb: 'Roles' },
  },
  {
    path: 'roles/:id',
    loadComponent: () => import('./roles/role-editor.component').then((m) => m.RoleEditorComponent),
    data: { permission: 'role.manage', title: 'Edit Role', breadcrumb: 'Edit Role' },
  },
  {
    path: 'permissions',
    loadComponent: () => import('./permissions/permissions.component').then((m) => m.PermissionsComponent),
    data: { permission: 'role.manage', title: 'Permissions', breadcrumb: 'Permissions' },
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings.component').then((m) => m.SettingsComponent),
    data: { permission: 'settings.manage', title: 'Settings', breadcrumb: 'Settings' },
  },
  {
    path: 'audit-log',
    loadComponent: () => import('./audit-log/audit-log.component').then((m) => m.AuditLogComponent),
    data: { permission: 'audit.view', title: 'Audit Log', breadcrumb: 'Audit Log' },
  },
];
