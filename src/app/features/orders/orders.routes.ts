import { Routes } from '@angular/router';

export const ORDERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./order-list/order-list.component').then((m) => m.OrderListComponent),
    data: { permission: 'order.view', title: 'Orders', breadcrumb: 'Orders' },
  },
  {
    path: 'new',
    loadComponent: () => import('./order-form/order-form.component').then((m) => m.OrderFormComponent),
    data: { permission: 'order.create', title: 'New Order', breadcrumb: 'New' },
  },
  {
    path: ':id',
    loadComponent: () => import('./order-detail/order-detail.component').then((m) => m.OrderDetailComponent),
    data: { permission: 'order.view', title: 'Order Details', breadcrumb: 'Details' },
  },
];
