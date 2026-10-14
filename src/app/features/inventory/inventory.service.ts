import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { PagedQuery, PagedResult } from '../../core/models/api.model';
import { ApiService } from '../../core/services/api.service';
import {
  AdjustmentRequest,
  AdjustmentResult,
  Consumption,
  ConsumptionRequest,
  ConsumptionResult,
  ExpiringAlert,
  InventoryBatch,
  InventoryItem,
  InventoryItemDetail,
  ItemCategory,
  ItemCategoryRequest,
  ItemRequest,
  LowStockAlert,
  Purchase,
  PurchaseCreated,
  PurchaseDetail,
  PurchaseRequest,
  StockTransaction,
} from './inventory.model';

const OPTS = { skipErrorToast: true } as const;

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly api = inject(ApiService);

  // categories
  categories(q: PagedQuery): Observable<PagedResult<ItemCategory>> {
    return this.api.getPaged<ItemCategory>('inventory/categories', q, OPTS);
  }
  createCategory(body: ItemCategoryRequest): Observable<{ id: number }> {
    return this.api.post<{ id: number }>('inventory/categories', body);
  }
  updateCategory(id: number, body: ItemCategoryRequest): Observable<unknown> {
    return this.api.put(`inventory/categories/${id}`, body);
  }

  // items
  items(q: PagedQuery): Observable<PagedResult<InventoryItem>> {
    return this.api.getPaged<InventoryItem>('inventory/items', q, OPTS);
  }
  /** active items for pickers (max 200), fresh each call so stock figures are current */
  itemOptions(): Observable<InventoryItem[]> {
    return this.items({ page: 1, pageSize: 200, isActive: true, sortBy: 'name', sortDir: 'asc' }).pipe(
      map((r) => r.items),
      catchError(() => of([] as InventoryItem[])),
    );
  }
  item(id: number): Observable<InventoryItemDetail> {
    return this.api.get<InventoryItemDetail>(`inventory/items/${id}`);
  }
  createItem(body: ItemRequest): Observable<InventoryItemDetail> {
    return this.api.post<InventoryItemDetail>('inventory/items', body);
  }
  updateItem(id: number, body: ItemRequest): Observable<InventoryItemDetail> {
    return this.api.put<InventoryItemDetail>(`inventory/items/${id}`, body);
  }

  // batches
  batches(q: PagedQuery): Observable<PagedResult<InventoryBatch>> {
    return this.api.getPaged<InventoryBatch>('inventory/batches', q, OPTS);
  }
  batchesForItem(itemId: number): Observable<InventoryBatch[]> {
    return this.batches({ page: 1, pageSize: 200, itemId }).pipe(map((r) => r.items));
  }

  // purchases
  purchases(q: PagedQuery): Observable<PagedResult<Purchase>> {
    return this.api.getPaged<Purchase>('inventory/purchases', q, OPTS);
  }
  purchase(id: number): Observable<PurchaseDetail> {
    return this.api.get<PurchaseDetail>(`inventory/purchases/${id}`);
  }
  createPurchase(body: PurchaseRequest): Observable<PurchaseCreated> {
    return this.api.post<PurchaseCreated>('inventory/purchases', body);
  }
  approvePurchase(id: number): Observable<PurchaseDetail> {
    return this.api.post<PurchaseDetail>(`inventory/purchases/${id}/approve`);
  }
  receivePurchase(id: number, receivedDate?: string | null): Observable<PurchaseDetail> {
    return this.api.post<PurchaseDetail>(`inventory/purchases/${id}/receive`, receivedDate ? { receivedDate } : {});
  }
  cancelPurchase(id: number, reason: string): Observable<PurchaseDetail> {
    return this.api.post<PurchaseDetail>(`inventory/purchases/${id}/cancel`, { reason });
  }

  // consumption
  consumption(q: PagedQuery): Observable<PagedResult<Consumption>> {
    return this.api.getPaged<Consumption>('inventory/consumption', q, OPTS);
  }
  recordConsumption(body: ConsumptionRequest): Observable<ConsumptionResult> {
    return this.api.post<ConsumptionResult>('inventory/consumption', body);
  }

  // adjustments + ledger
  adjustments(q: PagedQuery): Observable<PagedResult<StockTransaction>> {
    return this.api.getPaged<StockTransaction>('inventory/adjustments', q, OPTS);
  }
  adjustStock(body: AdjustmentRequest): Observable<AdjustmentResult> {
    return this.api.post<AdjustmentResult>('inventory/adjustments', body);
  }
  stockTransactions(q: PagedQuery): Observable<PagedResult<StockTransaction>> {
    return this.api.getPaged<StockTransaction>('inventory/stock-transactions', q, OPTS);
  }

  // alerts
  lowStock(): Observable<LowStockAlert[]> {
    return this.api.get<LowStockAlert[]>('inventory/alerts/low-stock', undefined, OPTS);
  }
  expiring(days?: number | null): Observable<ExpiringAlert[]> {
    return this.api.get<ExpiringAlert[]>('inventory/alerts/expiring', { days }, OPTS);
  }
}
