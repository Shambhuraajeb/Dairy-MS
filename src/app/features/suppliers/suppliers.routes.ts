import { Routes } from '@angular/router';

export const SUPPLIERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./supplier-list/supplier-list.component').then((m) => m.SupplierListComponent),
    data: { permission: 'supplier.view', title: 'Suppliers', breadcrumb: 'Suppliers' },
  },
];
