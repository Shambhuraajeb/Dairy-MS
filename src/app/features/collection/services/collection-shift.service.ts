import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ShiftDashboard, ShiftDto } from '../models/collection.model';

@Injectable({ providedIn: 'root' })
export class CollectionShiftService {
  private readonly api = inject(ApiService);

  /** active shifts (centerId also returns shifts that apply to all centers) */
  list(centerId?: number | null): Observable<ShiftDto[]> {
    return this.api.get<ShiftDto[]>('collection-shifts', { centerId, isActive: true }, { skipErrorToast: true });
  }

  dashboard(params: { date?: string; centerId?: number | null; shiftId?: number | null }): Observable<ShiftDashboard> {
    return this.api.get<ShiftDashboard>('collection-shifts/dashboard', params, { skipErrorToast: true });
  }
}
