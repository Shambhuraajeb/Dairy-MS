import { Routes } from '@angular/router';

export const EMPLOYEES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./employee-list/employee-list.component').then((m) => m.EmployeeListComponent),
    data: { permission: 'employee.view', title: 'Employees', breadcrumb: 'Employees' },
  },
  {
    path: 'new',
    loadComponent: () => import('./employee-form/employee-form.component').then((m) => m.EmployeeFormComponent),
    data: { permission: 'employee.create', title: 'New Employee', breadcrumb: 'New' },
  },
  {
    path: 'attendance',
    loadComponent: () => import('./attendance/attendance.component').then((m) => m.AttendanceComponent),
    data: { permission: 'attendance.view', title: 'Attendance', breadcrumb: 'Attendance' },
  },
  {
    path: 'leave',
    loadComponent: () => import('./leave/leave.component').then((m) => m.LeaveComponent),
    data: { permission: 'leave.view', title: 'Leave Requests', breadcrumb: 'Leave' },
  },
  {
    path: 'salary',
    loadComponent: () => import('./salary/salary.component').then((m) => m.SalaryComponent),
    data: { permission: 'salary.view', title: 'Salary', breadcrumb: 'Salary' },
  },
  {
    path: 'designations',
    loadComponent: () => import('./designations/designations.component').then((m) => m.DesignationsComponent),
    data: { permission: 'employee.view', title: 'Designations', breadcrumb: 'Designations' },
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./employee-form/employee-form.component').then((m) => m.EmployeeFormComponent),
    data: { permission: 'employee.update', title: 'Edit Employee', breadcrumb: 'Edit' },
  },
];
