import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../../core/models/api.model';
import { ApiService } from '../../../core/services/api.service';
import { FarmerPayment, FarmerPaymentDetail } from '../models/settlement.model';

@Injectable({ providedIn: 'root' })
export class FarmerPaymentService {
  private readonly api = inject(ApiService);
  private readonly path = 'farmer-payments';

  list(query: PagedQuery): Observable<PagedResult<FarmerPayment>> {
    return this.api.getPaged<FarmerPayment>(this.path, query, { skipErrorToast: true });
  }

  get(id: number): Observable<FarmerPaymentDetail> {
    return this.api.get<FarmerPaymentDetail>(`${this.path}/${id}`);
  }
}
