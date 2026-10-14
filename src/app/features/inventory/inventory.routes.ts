import { Routes } from '@angular/router';

export const INVENTORY_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'items' },
  {
    path: 'items',
    loadComponent: () => import('./items/item-list.component').then((m) => m.ItemListComponent),
    data: { permission: 'inventory.view', title: 'Inventory Items', breadcrumb: 'Items' },
  },
  {
    path: 'categories',
    loadComponent: () => import('./categories/category-list.component').then((m) => m.CategoryListComponent),
    data: { permission: 'inventory.view', title: 'Item Categories', breadcrumb: 'Categories' },
  },
  {
    path: 'units',
    loadComponent: () => import('./units/units.component').then((m) => m.UnitsComponent),
    data: { permission: 'inventory.view', title: 'Units', breadcrumb: 'Units' },
  },
  {
    path: 'purchases',
    loadComponent: () => import('./purchases/purchase-list.component').then((m) => m.PurchaseListComponent),
    data: { permission: 'purchase.view', title: 'Purchases', breadcrumb: 'Purchases' },
  },
  {
    path: 'purchases/new',
    loadComponent: () => import('./purchases/purchase-form.component').then((m) => m.PurchaseFormComponent),
    data: { permission: 'purchase.create', title: 'New Purchase', breadcrumb: 'New Purchase' },
  },
  {
    path: 'batches',
    loadComponent: () => import('./batches/batch-list.component').then((m) => m.BatchListComponent),
    data: { permission: 'inventory.view', title: 'Batches', breadcrumb: 'Batches' },
  },
  {
    path: 'stock',
    loadComponent: () => import('./stock/stock-ledger.component').then((m) => m.StockLedgerComponent),
    data: { permission: 'inventory.view', title: 'Stock Ledger', breadcrumb: 'Stock Ledger' },
  },
  {
    path: 'consumption',
    loadComponent: () => import('./consumption/consumption-list.component').then((m) => m.ConsumptionListComponent),
    data: { permission: 'inventory.view', title: 'Consumption', breadcrumb: 'Consumption' },
  },
  {
    path: 'adjustments',
    loadComponent: () => import('./adjustments/adjustment-list.component').then((m) => m.AdjustmentListComponent),
    data: { permission: 'inventory.view', title: 'Stock Adjustments', breadcrumb: 'Adjustments' },
  },
  {
    path: 'alerts',
    loadComponent: () => import('./alerts/alerts.component').then((m) => m.AlertsComponent),
    data: { permission: 'inventory.view', title: 'Inventory Alerts', breadcrumb: 'Alerts' },
  },
];
