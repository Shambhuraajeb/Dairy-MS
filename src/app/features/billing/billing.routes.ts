import { Routes } from '@angular/router';

export const BILLING_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'invoices' },
  {
    path: 'invoices',
    loadComponent: () => import('./invoices/invoice-list.component').then((m) => m.InvoiceListComponent),
    data: { permission: 'invoice.view', title: 'Invoices', breadcrumb: 'Invoices' },
  },
  {
    path: 'invoices/:id',
    loadComponent: () => import('./invoices/invoice-detail.component').then((m) => m.InvoiceDetailComponent),
    data: { permission: 'invoice.view', title: 'Invoice Details', breadcrumb: 'Invoice Details' },
  },
  {
    path: 'payments',
    loadComponent: () => import('./payments/payments.component').then((m) => m.PaymentsComponent),
    data: { permission: 'custpayment.view', title: 'Customer Payments', breadcrumb: 'Payments' },
  },
  {
    path: 'outstanding',
    loadComponent: () => import('./outstanding/outstanding.component').then((m) => m.OutstandingComponent),
    data: { permission: 'invoice.view', title: 'Outstanding', breadcrumb: 'Outstanding' },
  },
];
