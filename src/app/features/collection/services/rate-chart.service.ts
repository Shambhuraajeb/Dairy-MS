import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../../core/models/api.model';
import { ApiService } from '../../../core/services/api.service';
import { ActivateRateChartResult, RateChart, RateChartListItem, RateChartRequest } from '../models/rate-chart.model';

@Injectable({ providedIn: 'root' })
export class RateChartService {
  private readonly api = inject(ApiService);
  private readonly path = 'rate-charts';

  list(query: PagedQuery): Observable<PagedResult<RateChartListItem>> {
    return this.api.getPaged<RateChartListItem>(this.path, query, { skipErrorToast: true });
  }

  get(id: number): Observable<RateChart> {
    return this.api.get<RateChart>(`${this.path}/${id}`, undefined, { skipErrorToast: true });
  }

  create(body: RateChartRequest): Observable<RateChart> {
    return this.api.post<RateChart>(this.path, body);
  }

  update(id: number, body: RateChartRequest): Observable<RateChart> {
    return this.api.put<RateChart>(`${this.path}/${id}`, body);
  }

  activate(id: number): Observable<ActivateRateChartResult> {
    return this.api.post<ActivateRateChartResult>(`${this.path}/${id}/activate`);
  }

  remove(id: number): Observable<unknown> {
    return this.api.delete(`${this.path}/${id}`);
  }
}
