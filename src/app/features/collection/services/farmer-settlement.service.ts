import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  CreateSettlementRequest,
  CreateSettlementResult,
  PayRequest,
  PayResult,
  PendingFarmer,
  SettlementPreview,
} from '../models/settlement.model';

@Injectable({ providedIn: 'root' })
export class FarmerSettlementService {
  private readonly api = inject(ApiService);
  private readonly path = 'farmer-settlements';

  preview(farmerId: number, from: string, to: string): Observable<SettlementPreview> {
    return this.api.get<SettlementPreview>(`${this.path}/preview`, { farmerId, from, to }, { skipErrorToast: true });
  }

  pendingFarmers(params: { from: string; to: string; centerId?: number | null; search?: string }): Observable<PendingFarmer[]> {
    return this.api.get<PendingFarmer[]>(`${this.path}/pending-farmers`, params, { skipErrorToast: true });
  }

  create(body: CreateSettlementRequest): Observable<CreateSettlementResult> {
    return this.api.post<CreateSettlementResult>(this.path, body);
  }

  approve(id: number): Observable<{ id: number; number: string; status: string; netPayable: number }> {
    return this.api.post<{ id: number; number: string; status: string; netPayable: number }>(`${this.path}/${id}/approve`);
  }

  pay(id: number, body: PayRequest): Observable<PayResult> {
    return this.api.post<PayResult>(`${this.path}/${id}/pay`, body);
  }

  cancel(id: number, reason: string): Observable<{ id: number; number: string; status: string; releasedCollections: number }> {
    return this.api.post<{ id: number; number: string; status: string; releasedCollections: number }>(
      `${this.path}/${id}/cancel`,
      { reason },
    );
  }
}
