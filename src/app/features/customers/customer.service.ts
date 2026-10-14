import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { PagedQuery, PagedResult } from '../../core/models/api.model';
import { ApiService } from '../../core/services/api.service';
import { AssignableUser, Complaint, ComplaintRequest } from './complaint.model';
import {
  AddressRequest,
  Customer,
  CustomerAddress,
  CustomerRequest,
  CustomerSummary,
  RelatedKind,
} from './customer.model';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly api = inject(ApiService);

  // ---- customers
  list(query: PagedQuery): Observable<PagedResult<Customer>> {
    return this.api.getPaged<Customer>('customers', query, { skipErrorToast: true });
  }

  get(id: number | string): Observable<Customer> {
    return this.api.get<Customer>(`customers/${id}`, undefined, { skipErrorToast: true });
  }

  create(body: CustomerRequest): Observable<Customer> {
    return this.api.post<Customer>('customers', body);
  }

  update(id: number | string, body: CustomerRequest): Observable<Customer> {
    return this.api.put<Customer>(`customers/${id}`, body);
  }

  activate(id: number): Observable<Customer> {
    return this.api.post<Customer>(`customers/${id}/activate`);
  }

  deactivate(id: number): Observable<Customer> {
    return this.api.post<Customer>(`customers/${id}/deactivate`);
  }

  summary(id: number | string): Observable<CustomerSummary> {
    return this.api.get<CustomerSummary>(`customers/${id}/summary`, undefined, { skipErrorToast: true });
  }

  // ---- addresses
  addresses(customerId: number | string): Observable<CustomerAddress[]> {
    return this.api.get<CustomerAddress[]>(`customers/${customerId}/addresses`, undefined, { skipErrorToast: true });
  }

  addAddress(customerId: number, body: AddressRequest): Observable<CustomerAddress> {
    return this.api.post<CustomerAddress>(`customers/${customerId}/addresses`, body);
  }

  updateAddress(customerId: number, addressId: number, body: AddressRequest): Observable<CustomerAddress> {
    return this.api.put<CustomerAddress>(`customers/${customerId}/addresses/${addressId}`, body);
  }

  deleteAddress(customerId: number, addressId: number): Observable<unknown> {
    return this.api.delete(`customers/${customerId}/addresses/${addressId}`);
  }

  // ---- convenience lists on the details page
  related<T>(customerId: number | string, kind: RelatedKind, query: PagedQuery): Observable<PagedResult<T>> {
    return this.api.getPaged<T>(`customers/${customerId}/${kind}`, query, { skipErrorToast: true });
  }

  // ---- complaints
  listComplaints(query: PagedQuery): Observable<PagedResult<Complaint>> {
    return this.api.getPaged<Complaint>('customer-complaints', query, { skipErrorToast: true });
  }

  getComplaint(id: number): Observable<Complaint> {
    return this.api.get<Complaint>(`customer-complaints/${id}`);
  }

  createComplaint(body: ComplaintRequest): Observable<Complaint> {
    return this.api.post<Complaint>('customer-complaints', body);
  }

  assignComplaint(id: number, assignedTo: number): Observable<Complaint> {
    return this.api.post<Complaint>(`customer-complaints/${id}/assign`, { assignedTo });
  }

  setComplaintStatus(id: number, status: string, assignedTo?: number | null): Observable<Complaint> {
    return this.api.post<Complaint>(`customer-complaints/${id}/status`, { status, assignedTo: assignedTo ?? null });
  }

  resolveComplaint(id: number, resolution: string): Observable<Complaint> {
    return this.api.post<Complaint>(`customer-complaints/${id}/resolve`, { resolution });
  }

  closeComplaint(id: number): Observable<Complaint> {
    return this.api.post<Complaint>(`customer-complaints/${id}/close`);
  }

  complaintFeedback(id: number, rating: number, comments: string | null): Observable<Complaint> {
    return this.api.post<Complaint>(`customer-complaints/${id}/feedback`, { rating, comments });
  }

  /** staff that can be assigned; needs user.manage, so an empty list is returned (silently) for other roles */
  assignableUsers(): Observable<AssignableUser[]> {
    return this.api
      .get<PagedResult<AssignableUser>>('admin/users', { pageSize: 200, isActive: true, sortBy: 'displayName', sortDir: 'asc' }, { skipErrorToast: true })
      .pipe(
        map((r) => (r?.items ?? []).filter((u) => u.roleName !== 'Customer' && u.roleName !== 'Distributor / B2B Customer' && u.roleName !== 'Farmer')),
        catchError(() => of([] as AssignableUser[])),
      );
  }
}
