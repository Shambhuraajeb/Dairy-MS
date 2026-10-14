import { Routes } from '@angular/router';

export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./notification-list/notification-list.component').then((m) => m.NotificationListComponent),
    data: { permission: 'notification.view', title: 'Notifications', breadcrumb: 'Notifications' },
  },
];
