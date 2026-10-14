import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { LookupItem } from '../models/api.model';
import { ApiService } from './api.service';

/** Cached `GET /api/lookups/<name>` helpers. Each call returns a LookupItem[] ({id, code?, name, ...}). */
@Injectable({ providedIn: 'root' })
export class LookupService {
  private readonly api = inject(ApiService);
  private readonly cache = new Map<string, Observable<LookupItem[]>>();

  get(name: string, params?: Record<string, string | number | boolean | null | undefined>): Observable<LookupItem[]> {
    const key = `${name}?${params ? JSON.stringify(params) : ''}`;
    let obs = this.cache.get(key);
    if (!obs) {
      obs = this.api.get<LookupItem[] | { items: LookupItem[] }>(`lookups/${name}`, params, { skipErrorToast: true }).pipe(
        map((d) => (Array.isArray(d) ? d : (d?.items ?? []))),
        catchError(() => {
          this.cache.delete(key);
          return of([] as LookupItem[]);
        }),
        shareReplay(1),
      );
      this.cache.set(key, obs);
    }
    return obs;
  }

  clear(name?: string): void {
    if (!name) {
      this.cache.clear();
      return;
    }
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(`${name}?`)) {
        this.cache.delete(key);
      }
    }
  }

  dairies() { return this.get('dairies'); }
  branches(dairyId?: number) { return this.get('branches', { parentId: dairyId }); }
  collectionCenters(branchId?: number) { return this.get('collection-centers', { parentId: branchId }); }
  shifts() { return this.get('shifts'); }
  units() { return this.get('units'); }
  breeds() { return this.get('breeds'); }
  paymentModes() { return this.get('payment-modes'); }
  documentTypes() { return this.get('document-types'); }
  farmers() { return this.get('farmers'); }
  customers() { return this.get('customers'); }
  products() { return this.get('products'); }
  items() { return this.get('items'); }
  routes() { return this.get('routes'); }
  vehicles() { return this.get('vehicles'); }
  employees() { return this.get('employees'); }
  designations() { return this.get('designations'); }
  roles() { return this.get('roles'); }
}
