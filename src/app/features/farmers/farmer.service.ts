import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../core/models/api.model';
import { ApiService } from '../../core/services/api.service';
import { AnimalListItem } from '../animals/animal.model';
import {
  AddressBody,
  AdvanceRequest,
  BankBody,
  FarmerAddress,
  FarmerAdvance,
  FarmerBankAccount,
  FarmerCollectionRow,
  FarmerDetail,
  FarmerDocument,
  FarmerListItem,
  FarmerLoan,
  FarmerLoanListItem,
  FarmerPaymentRow,
  FarmerRequest,
  FarmerSummary,
  LoanRequest,
} from './farmer.model';

@Injectable({ providedIn: 'root' })
export class FarmerService {
  private readonly api = inject(ApiService);

  // ---- farmers --------------------------------------------------------------
  list(q: PagedQuery): Observable<PagedResult<FarmerListItem>> {
    return this.api.getPaged<FarmerListItem>('farmers', q, { skipErrorToast: true });
  }

  get(id: number | string): Observable<FarmerDetail> {
    return this.api.get<FarmerDetail>(`farmers/${id}`, undefined, { skipErrorToast: true });
  }

  create(body: FarmerRequest): Observable<FarmerDetail> {
    return this.api.post<FarmerDetail>('farmers', body);
  }

  update(id: number | string, body: FarmerRequest): Observable<FarmerDetail> {
    return this.api.put<FarmerDetail>(`farmers/${id}`, body);
  }

  verify(id: number, approved: boolean, remarks: string | null): Observable<FarmerDetail> {
    return this.api.post<FarmerDetail>(`farmers/${id}/verify`, { approved, remarks });
  }

  activate(id: number): Observable<FarmerDetail> {
    return this.api.post<FarmerDetail>(`farmers/${id}/activate`);
  }

  deactivate(id: number, reason: string): Observable<FarmerDetail> {
    return this.api.post<FarmerDetail>(`farmers/${id}/deactivate`, { reason });
  }

  summary(id: number): Observable<FarmerSummary> {
    return this.api.get<FarmerSummary>(`farmers/${id}/summary`, undefined, { skipErrorToast: true });
  }

  // ---- addresses / bank accounts -------------------------------------------
  addAddress(id: number, body: AddressBody): Observable<FarmerAddress> {
    return this.api.post<FarmerAddress>(`farmers/${id}/addresses`, body);
  }

  updateAddress(id: number, addressId: number, body: AddressBody): Observable<FarmerAddress> {
    return this.api.put<FarmerAddress>(`farmers/${id}/addresses/${addressId}`, body);
  }

  deleteAddress(id: number, addressId: number): Observable<unknown> {
    return this.api.delete(`farmers/${id}/addresses/${addressId}`);
  }

  addBankAccount(id: number, body: BankBody): Observable<FarmerBankAccount> {
    return this.api.post<FarmerBankAccount>(`farmers/${id}/bank-accounts`, body);
  }

  updateBankAccount(id: number, bankAccountId: number, body: BankBody): Observable<FarmerBankAccount> {
    return this.api.put<FarmerBankAccount>(`farmers/${id}/bank-accounts/${bankAccountId}`, body);
  }

  deleteBankAccount(id: number, bankAccountId: number): Observable<unknown> {
    return this.api.delete(`farmers/${id}/bank-accounts/${bankAccountId}`);
  }

  // ---- documents ------------------------------------------------------------
  uploadDocument(id: number, form: FormData): Observable<FarmerDocument> {
    return this.api.post<FarmerDocument>(`farmers/${id}/documents`, form);
  }

  updateDocument(
    id: number,
    documentId: number,
    body: {
      documentTypeId: number | null;
      documentNumber: string | null;
      expiryDate: string | null;
      remarks: string | null;
      verificationStatus?: string;
    },
  ): Observable<FarmerDocument> {
    return this.api.put<FarmerDocument>(`farmers/${id}/documents/${documentId}`, body);
  }

  deleteDocument(id: number, documentId: number): Observable<unknown> {
    return this.api.delete(`farmers/${id}/documents/${documentId}`);
  }

  downloadDocument(id: number, doc: FarmerDocument): Observable<void> {
    return this.api.download(`farmers/${id}/documents/${doc.id}/download`, undefined, doc.fileName ?? `document-${doc.id}`);
  }

  // ---- detail-tab lists -----------------------------------------------------
  animals(id: number, q: PagedQuery): Observable<PagedResult<AnimalListItem>> {
    return this.api.getPaged<AnimalListItem>(`farmers/${id}/animals`, q, { skipErrorToast: true });
  }

  collections(id: number, q: PagedQuery): Observable<PagedResult<FarmerCollectionRow>> {
    return this.api.getPaged<FarmerCollectionRow>(`farmers/${id}/collections`, q, { skipErrorToast: true });
  }

  payments(id: number, q: PagedQuery): Observable<PagedResult<FarmerPaymentRow>> {
    return this.api.getPaged<FarmerPaymentRow>(`farmers/${id}/payments`, q, { skipErrorToast: true });
  }

  loansOf(id: number, q: PagedQuery): Observable<PagedResult<FarmerLoanListItem>> {
    return this.api.getPaged<FarmerLoanListItem>(`farmers/${id}/loans`, q, { skipErrorToast: true });
  }

  // ---- advances & loans -----------------------------------------------------
  advances(q: PagedQuery): Observable<PagedResult<FarmerAdvance>> {
    return this.api.getPaged<FarmerAdvance>('farmer-advances', q, { skipErrorToast: true });
  }

  createAdvance(body: AdvanceRequest): Observable<FarmerAdvance> {
    return this.api.post<FarmerAdvance>('farmer-advances', body);
  }

  loans(q: PagedQuery): Observable<PagedResult<FarmerLoanListItem>> {
    return this.api.getPaged<FarmerLoanListItem>('farmer-loans', q, { skipErrorToast: true });
  }

  loan(id: number | string): Observable<FarmerLoan> {
    return this.api.get<FarmerLoan>(`farmer-loans/${id}`, undefined, { skipErrorToast: true });
  }

  createLoan(body: LoanRequest): Observable<FarmerLoan> {
    return this.api.post<FarmerLoan>('farmer-loans', body);
  }

  payInstallment(loanId: number, installmentNo: number, amount: number | null): Observable<FarmerLoan> {
    return this.api.post<FarmerLoan>(
      `farmer-loans/${loanId}/installments/${installmentNo}/pay`,
      amount === null ? {} : { amount },
    );
  }
}
