import { Routes } from '@angular/router';

export const CUSTOMERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./customer-list/customer-list.component').then((m) => m.CustomerListComponent),
    data: { permission: 'customer.view', title: 'Customers', breadcrumb: 'Customers' },
  },
  {
    path: 'new',
    loadComponent: () => import('./customer-form/customer-form.component').then((m) => m.CustomerFormComponent),
    data: { permission: 'customer.create', title: 'New Customer', breadcrumb: 'New' },
  },
  {
    path: 'complaints',
    loadComponent: () => import('./complaints/complaints.component').then((m) => m.ComplaintsComponent),
    data: { permission: 'complaint.view', title: 'Customer Complaints', breadcrumb: 'Complaints' },
  },
  {
    path: ':id',
    loadComponent: () => import('./customer-detail/customer-detail.component').then((m) => m.CustomerDetailComponent),
    data: { permission: 'customer.view', title: 'Customer Details', breadcrumb: 'Details' },
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./customer-form/customer-form.component').then((m) => m.CustomerFormComponent),
    data: { permission: 'customer.update', title: 'Edit Customer', breadcrumb: 'Edit' },
  },
];
