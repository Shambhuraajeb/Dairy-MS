import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../core/models/api.model';
import { ApiService } from '../../core/services/api.service';
import { OrderListItem } from '../orders/order.model';
import {
  BulkDeliveryRequest,
  BulkDeliveryResult,
  ConfirmDeliveryRequest,
  CreateDeliveryRequest,
  DeliveryDetail,
  DeliveryListItem,
  DeliveryRoute,
  DeliverySchedule,
  RouteRequest,
  ScheduleRequest,
  Vehicle,
  VehicleRequest,
} from './delivery.model';

@Injectable({ providedIn: 'root' })
export class DeliveryService {
  private readonly api = inject(ApiService);

  // routes
  routes(query: PagedQuery): Observable<PagedResult<DeliveryRoute>> {
    return this.api.getPaged<DeliveryRoute>('routes', query, { skipErrorToast: true });
  }
  createRoute(body: RouteRequest): Observable<{ id: number }> {
    return this.api.post<{ id: number }>('routes', body);
  }
  updateRoute(id: number, body: RouteRequest): Observable<DeliveryRoute> {
    return this.api.put<DeliveryRoute>(`routes/${id}`, body);
  }
  removeRoute(id: number): Observable<unknown> {
    return this.api.delete(`routes/${id}`);
  }

  // vehicles
  vehicles(query: PagedQuery): Observable<PagedResult<Vehicle>> {
    return this.api.getPaged<Vehicle>('vehicles', query, { skipErrorToast: true });
  }
  createVehicle(body: VehicleRequest): Observable<{ id: number }> {
    return this.api.post<{ id: number }>('vehicles', body);
  }
  updateVehicle(id: number, body: VehicleRequest): Observable<Vehicle> {
    return this.api.put<Vehicle>(`vehicles/${id}`, body);
  }
  removeVehicle(id: number): Observable<unknown> {
    return this.api.delete(`vehicles/${id}`);
  }

  // schedules
  schedules(query: PagedQuery): Observable<PagedResult<DeliverySchedule>> {
    return this.api.getPaged<DeliverySchedule>('delivery-schedules', query, { skipErrorToast: true });
  }
  createSchedule(body: ScheduleRequest): Observable<{ id: number }> {
    return this.api.post<{ id: number }>('delivery-schedules', body);
  }
  updateSchedule(id: number, body: ScheduleRequest): Observable<DeliverySchedule> {
    return this.api.put<DeliverySchedule>(`delivery-schedules/${id}`, body);
  }
  removeSchedule(id: number): Observable<unknown> {
    return this.api.delete(`delivery-schedules/${id}`);
  }

  // deliveries
  list(query: PagedQuery): Observable<PagedResult<DeliveryListItem>> {
    return this.api.getPaged<DeliveryListItem>('deliveries', query, { skipErrorToast: true });
  }
  get(id: number): Observable<DeliveryDetail> {
    return this.api.get<DeliveryDetail>(`deliveries/${id}`, undefined, { skipErrorToast: true });
  }
  my(date: string): Observable<DeliveryListItem[]> {
    return this.api.get<DeliveryListItem[]>('deliveries/my', { date }, { skipErrorToast: true });
  }
  pendingOrders(query: PagedQuery): Observable<PagedResult<OrderListItem>> {
    return this.api.getPaged<OrderListItem>('deliveries/pending-orders', query, { skipErrorToast: true });
  }
  create(body: CreateDeliveryRequest): Observable<DeliveryDetail> {
    return this.api.post<DeliveryDetail>('deliveries', body);
  }
  bulk(body: BulkDeliveryRequest): Observable<BulkDeliveryResult> {
    return this.api.post<BulkDeliveryResult>('deliveries/bulk', body);
  }
  dispatch(id: number): Observable<DeliveryDetail> {
    return this.api.post<DeliveryDetail>(`deliveries/${id}/dispatch`);
  }
  confirm(id: number, body: ConfirmDeliveryRequest): Observable<DeliveryDetail> {
    return this.api.post<DeliveryDetail>(`deliveries/${id}/confirm`, body);
  }
}
