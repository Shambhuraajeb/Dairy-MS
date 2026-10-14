import { Routes } from '@angular/router';

export const DELIVERY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./delivery-list/delivery-list.component').then((m) => m.DeliveryListComponent),
    data: { permission: 'delivery.view', title: 'Deliveries', breadcrumb: 'Deliveries' },
  },
  {
    path: 'routes',
    loadComponent: () => import('./routes/routes.component').then((m) => m.RoutesComponent),
    data: { permission: 'route.view', title: 'Delivery Routes', breadcrumb: 'Routes' },
  },
  {
    path: 'vehicles',
    loadComponent: () => import('./vehicles/vehicles.component').then((m) => m.VehiclesComponent),
    data: { permission: 'route.view', title: 'Vehicles', breadcrumb: 'Vehicles' },
  },
  {
    path: 'schedules',
    loadComponent: () => import('./schedules/schedules.component').then((m) => m.SchedulesComponent),
    data: { permission: 'route.view', title: 'Delivery Schedules', breadcrumb: 'Schedules' },
  },
  {
    path: 'my',
    loadComponent: () => import('./my-deliveries/my-deliveries.component').then((m) => m.MyDeliveriesComponent),
    data: { permission: 'delivery.confirm', title: 'My Deliveries', breadcrumb: 'My Deliveries' },
  },
  {
    path: ':id',
    loadComponent: () => import('./delivery-detail/delivery-detail.component').then((m) => m.DeliveryDetailComponent),
    data: { permission: 'delivery.view', title: 'Delivery Details', breadcrumb: 'Details' },
  },
];
