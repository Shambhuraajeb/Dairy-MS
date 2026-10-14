import { Routes } from '@angular/router';

export const EXPENSES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./expense-list/expense-list.component').then((m) => m.ExpenseListComponent),
    data: { permission: 'expense.view', title: 'Expenses', breadcrumb: 'Expenses' },
  },
  {
    path: 'categories',
    loadComponent: () => import('./categories/expense-category-list.component').then((m) => m.ExpenseCategoryListComponent),
    data: { permission: 'expense.view', title: 'Expense Categories', breadcrumb: 'Categories' },
  },
  {
    path: 'cash',
    loadComponent: () => import('./cash/cash-book.component').then((m) => m.CashBookComponent),
    data: { permission: 'cash.view', title: 'Cash Book', breadcrumb: 'Cash Book' },
  },
];
