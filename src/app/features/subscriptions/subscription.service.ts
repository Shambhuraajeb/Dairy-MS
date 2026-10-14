import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../core/models/api.model';
import { ApiService } from '../../core/services/api.service';
import {
  GenerateOrdersResult,
  PauseRequest,
  PlanRequest,
  Subscription,
  SubscriptionCreateRequest,
  SubscriptionDetail,
  SubscriptionPlan,
  SubscriptionUpdateRequest,
} from './subscription.model';

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly api = inject(ApiService);

  // ---- plans
  listPlans(query: PagedQuery): Observable<PagedResult<SubscriptionPlan>> {
    return this.api.getPaged<SubscriptionPlan>('subscription-plans', query, { skipErrorToast: true });
  }

  createPlan(body: PlanRequest): Observable<SubscriptionPlan> {
    return this.api.post<SubscriptionPlan>('subscription-plans', body);
  }

  updatePlan(id: number, body: PlanRequest): Observable<SubscriptionPlan> {
    return this.api.put<SubscriptionPlan>(`subscription-plans/${id}`, body);
  }

  deletePlan(id: number): Observable<unknown> {
    return this.api.delete(`subscription-plans/${id}`);
  }

  // ---- subscriptions
  list(query: PagedQuery): Observable<PagedResult<Subscription>> {
    return this.api.getPaged<Subscription>('subscriptions', query, { skipErrorToast: true });
  }

  get(id: number | string): Observable<SubscriptionDetail> {
    return this.api.get<SubscriptionDetail>(`subscriptions/${id}`, undefined, { skipErrorToast: true });
  }

  create(body: SubscriptionCreateRequest): Observable<SubscriptionDetail> {
    return this.api.post<SubscriptionDetail>('subscriptions', body);
  }

  update(id: number, body: SubscriptionUpdateRequest): Observable<SubscriptionDetail> {
    return this.api.put<SubscriptionDetail>(`subscriptions/${id}`, body);
  }

  pause(id: number, body: PauseRequest): Observable<SubscriptionDetail> {
    return this.api.post<SubscriptionDetail>(`subscriptions/${id}/pause`, body);
  }

  resume(id: number): Observable<SubscriptionDetail> {
    return this.api.post<SubscriptionDetail>(`subscriptions/${id}/resume`);
  }

  cancel(id: number, reason: string | null): Observable<SubscriptionDetail> {
    return this.api.post<SubscriptionDetail>(`subscriptions/${id}/cancel`, { reason });
  }

  generateOrders(forDate: string | null): Observable<GenerateOrdersResult> {
    return this.api.post<GenerateOrdersResult>('subscriptions/generate-orders', { forDate });
  }
}
