import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../core/models/api.model';
import { ApiService } from '../../core/services/api.service';
import {
  CreateOrderRequest,
  CustomerAddressLite,
  CustomerLite,
  OrderDetail,
  OrderListItem,
  UpdateOrderRequest,
} from './order.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly api = inject(ApiService);

  list(query: PagedQuery): Observable<PagedResult<OrderListItem>> {
    return this.api.getPaged<OrderListItem>('orders', query, { skipErrorToast: true });
  }

  get(id: number): Observable<OrderDetail> {
    return this.api.get<OrderDetail>(`orders/${id}`, undefined, { skipErrorToast: true });
  }

  create(body: CreateOrderRequest): Observable<OrderDetail> {
    return this.api.post<OrderDetail>('orders', body);
  }

  update(id: number, body: UpdateOrderRequest): Observable<OrderDetail> {
    return this.api.put<OrderDetail>(`orders/${id}`, body);
  }

  cancel(id: number, reason?: string | null): Observable<OrderDetail> {
    return this.api.post<OrderDetail>(`orders/${id}/cancel`, { reason: reason || null });
  }

  /** needs customer.view; callers should tolerate failure */
  customer(customerId: number): Observable<CustomerLite> {
    return this.api.get<CustomerLite>(`customers/${customerId}`, undefined, { skipErrorToast: true });
  }

  customerAddresses(customerId: number): Observable<CustomerAddressLite[]> {
    return this.api.get<CustomerAddressLite[]>(`customers/${customerId}/addresses`, undefined, { skipErrorToast: true });
  }
}
