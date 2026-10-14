import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PagedQuery, PagedResult, RequestOptions } from '../models/api.model';

/**
 * Thin typed wrapper over HttpClient. Paths are relative to the API base, e.g. 'inventory/units'
 * (a leading '/', '/api/' or 'api/' is tolerated). All methods return the unwrapped `data` of ApiResponse<T>.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  url(path: string): string {
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    const clean = path.replace(/^\/+/, '').replace(/^api\//i, '');
    return `${environment.apiUrl}/${clean}`;
  }

  get<T>(path: string, params?: object, opts?: RequestOptions): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(this.url(path), { params: this.toParams(params), headers: this.headers(opts) })
      .pipe(map((res) => this.unwrap<T>(res)));
  }

  getPaged<T>(path: string, query?: PagedQuery, opts?: RequestOptions): Observable<PagedResult<T>> {
    return this.get<PagedResult<T> | T[]>(path, query, opts).pipe(
      map((data) => {
        if (Array.isArray(data)) {
          return { items: data, total: data.length, page: 1, pageSize: data.length } as PagedResult<T>;
        }
        return {
          items: data?.items ?? [],
          total: data?.total ?? 0,
          page: data?.page ?? query?.page ?? 1,
          pageSize: data?.pageSize ?? query?.pageSize ?? 20,
        };
      }),
    );
  }

  post<T = unknown>(path: string, body?: unknown, opts?: RequestOptions): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(this.url(path), body ?? {}, { headers: this.headers(opts) })
      .pipe(map((res) => this.unwrap<T>(res)));
  }

  put<T = unknown>(path: string, body?: unknown, opts?: RequestOptions): Observable<T> {
    return this.http
      .put<ApiResponse<T>>(this.url(path), body ?? {}, { headers: this.headers(opts) })
      .pipe(map((res) => this.unwrap<T>(res)));
  }

  delete<T = unknown>(path: string, params?: object, opts?: RequestOptions): Observable<T> {
    return this.http
      .delete<ApiResponse<T>>(this.url(path), { params: this.toParams(params), headers: this.headers(opts) })
      .pipe(map((res) => this.unwrap<T>(res)));
  }

  /** Downloads a file (e.g. CSV report) as a browser download. Include `format: 'csv'` in params if the endpoint needs it. */
  download(path: string, params?: object, filename?: string, opts?: RequestOptions): Observable<void> {
    return this.http
      .get(this.url(path), {
        params: this.toParams(params),
        headers: this.headers(opts),
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((res) => {
          const name = filename ?? this.fileNameFrom(res.headers.get('Content-Disposition')) ?? 'download.csv';
          const blob = res.body ?? new Blob();
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objectUrl;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        }),
      );
  }

  private unwrap<T>(res: ApiResponse<T> | null): T {
    return (res as ApiResponse<T> | null)?.data as T;
  }

  private headers(opts?: RequestOptions): HttpHeaders {
    let h = new HttpHeaders();
    if (opts?.skipErrorToast) {
      h = h.set('X-Skip-Error-Toast', '1');
    }
    if (opts?.pageLevel) {
      h = h.set('X-Page-Level', '1');
    }
    return h;
  }

  private toParams(params?: object): HttpParams {
    let p = new HttpParams();
    if (!params) {
      return p;
    }
    for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
      if (value === null || value === undefined || value === '') {
        continue;
      }
      if (Array.isArray(value)) {
        for (const v of value) {
          p = p.append(key, String(v));
        }
      } else if (value instanceof Date) {
        p = p.set(key, value.toISOString());
      } else {
        p = p.set(key, String(value));
      }
    }
    return p;
  }

  private fileNameFrom(disposition: string | null): string | null {
    if (!disposition) {
      return null;
    }
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    return m ? decodeURIComponent(m[1]) : null;
  }
}
