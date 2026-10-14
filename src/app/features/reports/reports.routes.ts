import { Routes } from '@angular/router';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./report-center/report-center.component').then((m) => m.ReportCenterComponent),
    data: { permission: 'report.view', title: 'Report Center', breadcrumb: 'Report Center' },
  },
  {
    path: ':code',
    loadComponent: () => import('./report-viewer/report-viewer.component').then((m) => m.ReportViewerComponent),
    data: { permission: 'report.view', title: 'Report', breadcrumb: 'Report' },
  },
];
