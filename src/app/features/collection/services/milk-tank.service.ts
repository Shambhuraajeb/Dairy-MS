import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../../core/models/api.model';
import { ApiService } from '../../../core/services/api.service';
import { CreateTankRequest, Tank, TankTxn, TankTxnRequest, UpdateTankRequest } from '../models/tank.model';

@Injectable({ providedIn: 'root' })
export class MilkTankService {
  private readonly api = inject(ApiService);
  private readonly path = 'milk-tanks';

  list(query: PagedQuery): Observable<PagedResult<Tank>> {
    return this.api.getPaged<Tank>(this.path, query, { skipErrorToast: true });
  }

  create(body: CreateTankRequest): Observable<Tank> {
    return this.api.post<Tank>(this.path, body);
  }

  update(id: number, body: UpdateTankRequest): Observable<Tank> {
    return this.api.put<Tank>(`${this.path}/${id}`, body);
  }

  transactions(id: number, query: PagedQuery): Observable<PagedResult<TankTxn>> {
    return this.api.getPaged<TankTxn>(`${this.path}/${id}/transactions`, query, { skipErrorToast: true });
  }

  addTransaction(id: number, body: TankTxnRequest): Observable<TankTxn> {
    return this.api.post<TankTxn>(`${this.path}/${id}/transactions`, body);
  }
}
