import { Routes } from '@angular/router';

export const SUBSCRIPTIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./subscription-list/subscription-list.component').then((m) => m.SubscriptionListComponent),
    data: { permission: 'subscription.view', title: 'Subscriptions', breadcrumb: 'Subscriptions' },
  },
  {
    path: 'plans',
    loadComponent: () => import('./plans/plans.component').then((m) => m.PlansComponent),
    data: { permission: 'subscription.view', title: 'Subscription Plans', breadcrumb: 'Plans' },
  },
  {
    path: 'new',
    loadComponent: () => import('./subscription-form/subscription-form.component').then((m) => m.SubscriptionFormComponent),
    data: { permission: 'subscription.create', title: 'New Subscription', breadcrumb: 'New' },
  },
  {
    path: ':id',
    loadComponent: () => import('./subscription-detail/subscription-detail.component').then((m) => m.SubscriptionDetailComponent),
    data: { permission: 'subscription.view', title: 'Subscription Details', breadcrumb: 'Details' },
  },
];
