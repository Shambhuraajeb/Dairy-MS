import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { PagedQuery, PagedResult } from '../../core/models/api.model';
import { ApiService } from '../../core/services/api.service';
import {
  Equipment,
  EquipmentRequest,
  MaintenanceRecord,
  MaintenanceSchedule,
  RecordRequest,
  RecordResult,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
} from './maintenance.model';

const OPTS = { skipErrorToast: true } as const;

@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private readonly api = inject(ApiService);

  equipment(q: PagedQuery): Observable<PagedResult<Equipment>> {
    return this.api.getPaged<Equipment>('maintenance/equipment', q, OPTS);
  }
  /** active, non-retired equipment for pickers (max 200) */
  equipmentOptions(): Observable<Equipment[]> {
    return this.equipment({ page: 1, pageSize: 200, isActive: true, sortBy: 'name', sortDir: 'asc' }).pipe(
      map((r) => r.items.filter((e) => e.status !== 'Retired')),
      catchError(() => of([] as Equipment[])),
    );
  }
  createEquipment(body: EquipmentRequest): Observable<Equipment> {
    return this.api.post<Equipment>('maintenance/equipment', body);
  }
  updateEquipment(id: number, body: EquipmentRequest): Observable<Equipment> {
    return this.api.put<Equipment>(`maintenance/equipment/${id}`, body);
  }

  schedules(q: PagedQuery): Observable<PagedResult<MaintenanceSchedule>> {
    return this.api.getPaged<MaintenanceSchedule>('maintenance/schedules', q, OPTS);
  }
  schedulesForEquipment(equipmentId: number): Observable<MaintenanceSchedule[]> {
    return this.schedules({ page: 1, pageSize: 200, equipmentId }).pipe(map((r) => r.items));
  }
  createSchedule(body: ScheduleCreateRequest): Observable<MaintenanceSchedule> {
    return this.api.post<MaintenanceSchedule>('maintenance/schedules', body);
  }
  updateSchedule(id: number, body: ScheduleUpdateRequest): Observable<MaintenanceSchedule> {
    return this.api.put<MaintenanceSchedule>(`maintenance/schedules/${id}`, body);
  }

  records(q: PagedQuery): Observable<PagedResult<MaintenanceRecord>> {
    return this.api.getPaged<MaintenanceRecord>('maintenance/records', q, OPTS);
  }
  recordMaintenance(body: RecordRequest): Observable<RecordResult> {
    return this.api.post<RecordResult>('maintenance/records', body);
  }
}
