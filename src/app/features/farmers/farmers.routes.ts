import { Routes } from '@angular/router';

export const FARMERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./farmer-list/farmer-list.component').then((m) => m.FarmerListComponent),
    data: { permission: 'farmer.view', title: 'Farmers', breadcrumb: 'Farmers' },
  },
  {
    path: 'new',
    loadComponent: () => import('./farmer-form/farmer-form.component').then((m) => m.FarmerFormComponent),
    data: { permission: 'farmer.create', title: 'New Farmer', breadcrumb: 'New' },
  },
  {
    path: 'loans',
    loadComponent: () => import('./loans/loans.component').then((m) => m.LoansComponent),
    data: { permission: 'loan.view', title: 'Advances & Loans', breadcrumb: 'Advances & Loans' },
  },
  {
    path: 'loans/:id',
    loadComponent: () => import('./loans/loan-detail.component').then((m) => m.LoanDetailComponent),
    data: { permission: 'loan.view', title: 'Loan Details', breadcrumb: 'Loan Details' },
  },
  {
    path: ':id',
    loadComponent: () => import('./farmer-detail/farmer-detail.component').then((m) => m.FarmerDetailComponent),
    data: { permission: 'farmer.view', title: 'Farmer Details', breadcrumb: 'Details' },
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./farmer-form/farmer-form.component').then((m) => m.FarmerFormComponent),
    data: { permission: 'farmer.update', title: 'Edit Farmer', breadcrumb: 'Edit' },
  },
];
