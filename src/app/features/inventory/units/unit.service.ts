import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../../core/models/api.model';
import { ApiService } from '../../../core/services/api.service';
import { Unit, UnitRequest } from './unit.model';

@Injectable({ providedIn: 'root' })
export class UnitService {
  private readonly api = inject(ApiService);
  private readonly path = 'inventory/units';

  list(query: PagedQuery): Observable<PagedResult<Unit>> {
    // skipErrorToast: the table shows the error inline with a Retry button
    return this.api.getPaged<Unit>(this.path, query, { skipErrorToast: true });
  }

  create(body: UnitRequest): Observable<{ id: number }> {
    return this.api.post<{ id: number }>(this.path, body);
  }

  update(id: number, body: UnitRequest): Observable<unknown> {
    return this.api.put(`${this.path}/${id}`, body);
  }

  /** activate / deactivate = PUT with the flipped IsActive flag */
  setActive(unit: Unit, isActive: boolean): Observable<unknown> {
    return this.update(unit.id, { code: unit.code, name: unit.name, isActive });
  }
}
