import { Routes } from '@angular/router';

export const PRODUCTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./product-list/product-list.component').then((m) => m.ProductListComponent),
    data: { permission: 'product.view', title: 'Products', breadcrumb: 'Products' },
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('./product-categories/product-categories.component').then((m) => m.ProductCategoriesComponent),
    data: { permission: 'product.view', title: 'Product Categories', breadcrumb: 'Categories' },
  },
];
