import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './core/guards/auth.guard';
import { ShellComponent } from './layout/shell/shell.component';

/** lazy feature prefix; `breadcrumbLink: false` because the prefix itself has no page */
const feature = (breadcrumb: string) => ({ breadcrumb, breadcrumbLink: false });

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    data: { title: 'Sign in' },
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    canActivateChild: [permissionGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        data: { title: 'Dashboard' },
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'profile',
        data: { title: 'My Profile' },
        loadComponent: () => import('./features/auth/profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'change-password',
        data: { title: 'Change Password' },
        loadComponent: () =>
          import('./features/auth/change-password/change-password.component').then((m) => m.ChangePasswordComponent),
      },
      {
        path: '403',
        data: { title: 'Access denied' },
        loadComponent: () => import('./features/errors/forbidden.component').then((m) => m.ForbiddenComponent),
      },
      {
        path: 'farmers',
        data: feature('Farmers'),
        loadChildren: () => import('./features/farmers/farmers.routes').then((m) => m.FARMERS_ROUTES),
      },
      {
        path: 'animals',
        data: feature('Animals'),
        loadChildren: () => import('./features/animals/animals.routes').then((m) => m.ANIMALS_ROUTES),
      },
      {
        path: 'collection',
        data: feature('Milk Collection'),
        loadChildren: () => import('./features/collection/collection.routes').then((m) => m.COLLECTION_ROUTES),
      },
      {
        path: 'inventory',
        data: feature('Inventory'),
        loadChildren: () => import('./features/inventory/inventory.routes').then((m) => m.INVENTORY_ROUTES),
      },
      {
        path: 'suppliers',
        data: feature('Suppliers'),
        loadChildren: () => import('./features/suppliers/suppliers.routes').then((m) => m.SUPPLIERS_ROUTES),
      },
      {
        path: 'customers',
        data: feature('Customers'),
        loadChildren: () => import('./features/customers/customers.routes').then((m) => m.CUSTOMERS_ROUTES),
      },
      {
        path: 'subscriptions',
        data: feature('Subscriptions'),
        loadChildren: () => import('./features/subscriptions/subscriptions.routes').then((m) => m.SUBSCRIPTIONS_ROUTES),
      },
      {
        path: 'products',
        data: feature('Products'),
        loadChildren: () => import('./features/products/products.routes').then((m) => m.PRODUCTS_ROUTES),
      },
      {
        path: 'orders',
        data: feature('Orders'),
        loadChildren: () => import('./features/orders/orders.routes').then((m) => m.ORDERS_ROUTES),
      },
      {
        path: 'delivery',
        data: feature('Delivery'),
        loadChildren: () => import('./features/delivery/delivery.routes').then((m) => m.DELIVERY_ROUTES),
      },
      {
        path: 'billing',
        data: feature('Billing'),
        loadChildren: () => import('./features/billing/billing.routes').then((m) => m.BILLING_ROUTES),
      },
      {
        path: 'employees',
        data: feature('Employees'),
        loadChildren: () => import('./features/employees/employees.routes').then((m) => m.EMPLOYEES_ROUTES),
      },
      {
        path: 'maintenance',
        data: feature('Maintenance'),
        loadChildren: () => import('./features/maintenance/maintenance.routes').then((m) => m.MAINTENANCE_ROUTES),
      },
      {
        path: 'expenses',
        data: feature('Finance'),
        loadChildren: () => import('./features/expenses/expenses.routes').then((m) => m.EXPENSES_ROUTES),
      },
      {
        path: 'reports',
        data: feature('Reports'),
        loadChildren: () => import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
      },
      {
        path: 'notifications',
        data: feature('Notifications'),
        loadChildren: () => import('./features/notifications/notifications.routes').then((m) => m.NOTIFICATIONS_ROUTES),
      },
      {
        path: 'administration',
        data: feature('Administration'),
        loadChildren: () => import('./features/administration/administration.routes').then((m) => m.ADMINISTRATION_ROUTES),
      },
      {
        path: '**',
        data: { title: 'Page not found' },
        loadComponent: () => import('./features/errors/not-found.component').then((m) => m.NotFoundComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
