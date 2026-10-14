import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../core/models/api.model';
import { ApiService } from '../../core/services/api.service';
import {
  BillableOrder,
  BillingSummary,
  CustomerPayment,
  CustomerPaymentDetail,
  GenerateInvoiceRequest,
  Invoice,
  InvoiceDetail,
  OutstandingRow,
  RecordPaymentRequest,
} from './billing.model';

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly api = inject(ApiService);

  // ---- invoices
  listInvoices(query: PagedQuery): Observable<PagedResult<Invoice>> {
    return this.api.getPaged<Invoice>('invoices', query, { skipErrorToast: true });
  }

  getInvoice(id: number | string): Observable<InvoiceDetail> {
    return this.api.get<InvoiceDetail>(`invoices/${id}`, undefined, { skipErrorToast: true });
  }

  generateInvoice(body: GenerateInvoiceRequest): Observable<InvoiceDetail> {
    return this.api.post<InvoiceDetail>('invoices', body);
  }

  cancelInvoice(id: number, reason: string | null): Observable<InvoiceDetail> {
    return this.api.post<InvoiceDetail>(`invoices/${id}/cancel`, { reason });
  }

  /** open invoices of a customer (used by the payment form) */
  customerInvoices(customerId: number): Observable<PagedResult<Invoice>> {
    return this.api.getPaged<Invoice>('invoices', { customerId, page: 1, pageSize: 100, sortBy: 'invoiceDate', sortDir: 'asc' }, { skipErrorToast: true });
  }

  /** delivered orders in a period (client filters the ones that are not invoiced yet) */
  deliveredOrders(customerId: number, from: string | null, to: string | null): Observable<PagedResult<BillableOrder>> {
    return this.api.getPaged<BillableOrder>(
      'orders',
      { customerId, status: 'Delivered', from, to, page: 1, pageSize: 200, sortBy: 'deliveryDate', sortDir: 'asc' },
      { skipErrorToast: true },
    );
  }

  summary(): Observable<BillingSummary> {
    return this.api.get<BillingSummary>('billing/summary', undefined, { skipErrorToast: true });
  }

  // ---- payments
  listPayments(query: PagedQuery): Observable<PagedResult<CustomerPayment>> {
    return this.api.getPaged<CustomerPayment>('payments', query, { skipErrorToast: true });
  }

  getPayment(id: number): Observable<CustomerPaymentDetail> {
    return this.api.get<CustomerPaymentDetail>(`payments/${id}`);
  }

  recordPayment(body: RecordPaymentRequest): Observable<CustomerPaymentDetail> {
    return this.api.post<CustomerPaymentDetail>('payments', body);
  }

  // ---- outstanding
  outstanding(customerId?: number | null): Observable<OutstandingRow[]> {
    return this.api.get<OutstandingRow[]>('billing/outstanding', { customerId }, { skipErrorToast: true });
  }
}
