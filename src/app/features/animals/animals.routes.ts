import { Routes } from '@angular/router';

export const ANIMALS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./animal-list/animal-list.component').then((m) => m.AnimalListComponent),
    data: { permission: 'animal.view', title: 'Animals', breadcrumb: 'Animals' },
  },
  {
    path: 'new',
    loadComponent: () => import('./animal-form/animal-form.component').then((m) => m.AnimalFormComponent),
    data: { permission: 'animal.create', title: 'Register Animal', breadcrumb: 'New' },
  },
  {
    path: 'breeds',
    loadComponent: () => import('./breeds/breeds.component').then((m) => m.BreedsComponent),
    data: { permission: 'animal.view', title: 'Breeds', breadcrumb: 'Breeds' },
  },
  {
    path: ':id',
    loadComponent: () => import('./animal-detail/animal-detail.component').then((m) => m.AnimalDetailComponent),
    data: { permission: 'animal.view', title: 'Animal Details', breadcrumb: 'Details' },
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./animal-form/animal-form.component').then((m) => m.AnimalFormComponent),
    data: { permission: 'animal.update', title: 'Edit Animal', breadcrumb: 'Edit' },
  },
];
