import { Routes } from '@angular/router';

// literal paths first, `:id` last
export const COLLECTION_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./shift-dashboard/shift-dashboard.component').then((m) => m.ShiftDashboardComponent),
    data: { permission: 'collection.view', title: 'Shift Dashboard', breadcrumb: 'Shift Dashboard' },
  },
  {
    path: 'entry',
    loadComponent: () => import('./collection-entry/collection-entry.component').then((m) => m.CollectionEntryComponent),
    data: { permission: 'collection.create', title: 'Collection Entry', breadcrumb: 'Entry' },
  },
  {
    path: 'history',
    loadComponent: () => import('./collection-history/collection-history.component').then((m) => m.CollectionHistoryComponent),
    data: { permission: 'collection.view', title: 'Collection History', breadcrumb: 'History' },
  },
  {
    path: 'quality',
    loadComponent: () => import('./quality-tests/quality-tests.component').then((m) => m.QualityTestsComponent),
    data: { permission: ['collection.quality.record', 'collection.view'], title: 'Quality Tests', breadcrumb: 'Quality' },
  },
  {
    path: 'rejections',
    loadComponent: () => import('./rejections/rejections.component').then((m) => m.RejectionsComponent),
    data: { permission: 'collection.view', title: 'Rejections', breadcrumb: 'Rejections' },
  },
  {
    path: 'approval',
    loadComponent: () => import('./approval/approval.component').then((m) => m.ApprovalComponent),
    data: { permission: ['collection.approve', 'collection.reject'], title: 'Collection Approval', breadcrumb: 'Approval' },
  },
  {
    path: 'rate-charts',
    pathMatch: 'full',
    loadComponent: () => import('./rate-charts/rate-chart-list.component').then((m) => m.RateChartListComponent),
    data: { permission: 'ratechart.view', title: 'Rate Charts', breadcrumb: 'Rate Charts' },
  },
  {
    path: 'rate-charts/new',
    loadComponent: () => import('./rate-charts/rate-chart-editor.component').then((m) => m.RateChartEditorComponent),
    data: { permission: 'ratechart.manage', title: 'New Rate Chart', breadcrumb: 'New Rate Chart' },
  },
  {
    path: 'rate-charts/:id',
    loadComponent: () => import('./rate-charts/rate-chart-editor.component').then((m) => m.RateChartEditorComponent),
    data: { permission: 'ratechart.view', title: 'Rate Chart', breadcrumb: 'Rate Chart' },
  },
  {
    path: 'tanks',
    loadComponent: () => import('./tanks/milk-tanks.component').then((m) => m.MilkTanksComponent),
    data: { permission: 'collection.view', title: 'Milk Tanks', breadcrumb: 'Milk Tanks' },
  },
  {
    path: 'settlement',
    loadComponent: () => import('./settlement/settlement.component').then((m) => m.SettlementComponent),
    data: { permission: 'payment.view', title: 'Farmer Settlement', breadcrumb: 'Settlement' },
  },
  {
    path: 'payments',
    loadComponent: () => import('./payments/payments-page.component').then((m) => m.PaymentsPageComponent),
    data: { permission: 'payment.view', title: 'Farmer Payments', breadcrumb: 'Payments' },
  },
];
