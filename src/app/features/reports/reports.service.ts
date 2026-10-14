import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, shareReplay, throwError } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ReportCatalogItem, ReportResult } from './report.model';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly api = inject(ApiService);
  private catalog$?: Observable<ReportCatalogItem[]>;

  catalog(): Observable<ReportCatalogItem[]> {
    if (!this.catalog$) {
      this.catalog$ = this.api.get<ReportCatalogItem[]>('reports/catalog', undefined, { skipErrorToast: true }).pipe(
        map((d) => d ?? []),
        catchError((err) => {
          this.catalog$ = undefined;
          return throwError(() => err);
        }),
        shareReplay(1),
      );
    }
    return this.catalog$;
  }

  run(code: string, params: Record<string, string>): Observable<ReportResult> {
    return this.api.get<ReportResult>(`reports/${encodeURIComponent(code)}`, params, { skipErrorToast: true });
  }

  exportCsv(code: string, params: Record<string, string>, filename: string): Observable<void> {
    return this.api.download(`reports/${encodeURIComponent(code)}`, { ...params, format: 'csv' }, filename);
  }
}
