import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../core/models/api.model';
import { ApiService } from '../../core/services/api.service';
import {
  CashSummary,
  CashTransaction,
  Expense,
  ExpenseCategory,
  ExpenseCategoryRequest,
  ExpenseCreated,
  ExpenseRequest,
} from './expense.model';

const OPTS = { skipErrorToast: true } as const;

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly api = inject(ApiService);

  list(q: PagedQuery): Observable<PagedResult<Expense>> {
    return this.api.getPaged<Expense>('expenses', q, OPTS);
  }
  create(body: ExpenseRequest): Observable<ExpenseCreated> {
    return this.api.post<ExpenseCreated>('expenses', body);
  }
  approve(id: number, remarks?: string | null): Observable<Expense> {
    return this.api.post<Expense>(`expenses/${id}/approve`, remarks ? { remarks } : {});
  }
  reject(id: number, reason: string): Observable<Expense> {
    return this.api.post<Expense>(`expenses/${id}/reject`, { reason });
  }

  categories(q: PagedQuery): Observable<PagedResult<ExpenseCategory>> {
    return this.api.getPaged<ExpenseCategory>('expense-categories', q, OPTS);
  }
  createCategory(body: ExpenseCategoryRequest): Observable<{ id: number }> {
    return this.api.post<{ id: number }>('expense-categories', body);
  }
  updateCategory(id: number, body: ExpenseCategoryRequest): Observable<unknown> {
    return this.api.put(`expense-categories/${id}`, body);
  }

  cashTransactions(q: PagedQuery): Observable<PagedResult<CashTransaction>> {
    return this.api.getPaged<CashTransaction>('cash-transactions', q, OPTS);
  }
  cashSummary(from?: string | null, to?: string | null): Observable<CashSummary> {
    return this.api.get<CashSummary>('cash-transactions/summary', { from, to }, OPTS);
  }
}
