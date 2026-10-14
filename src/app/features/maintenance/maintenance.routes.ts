import { Routes } from '@angular/router';

export const MAINTENANCE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'equipment' },
  {
    path: 'equipment',
    loadComponent: () => import('./equipment/equipment-list.component').then((m) => m.EquipmentListComponent),
    data: { permission: 'maintenance.view', title: 'Equipment', breadcrumb: 'Equipment' },
  },
  {
    path: 'schedules',
    loadComponent: () => import('./schedules/schedule-list.component').then((m) => m.ScheduleListComponent),
    data: { permission: 'maintenance.view', title: 'Maintenance Schedules', breadcrumb: 'Schedules' },
  },
  {
    path: 'history',
    loadComponent: () => import('./history/record-list.component').then((m) => m.RecordListComponent),
    data: { permission: 'maintenance.view', title: 'Maintenance History', breadcrumb: 'History' },
  },
];
