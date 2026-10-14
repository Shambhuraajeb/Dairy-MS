import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { DashboardCharts, DashboardSummary, DashboardVariantData, DashboardVariantName } from './dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);

  summary(): Observable<DashboardSummary> {
    return this.api.get<DashboardSummary>('dashboard/summary', undefined, { skipErrorToast: true });
  }

  charts(): Observable<DashboardCharts> {
    return this.api.get<DashboardCharts>('dashboard/charts', undefined, { skipErrorToast: true });
  }

  variant(name: DashboardVariantName): Observable<DashboardVariantData> {
    return this.api.get<DashboardVariantData>(`dashboard/${name}`, undefined, { skipErrorToast: true });
  }
}
