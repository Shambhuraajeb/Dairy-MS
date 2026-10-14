import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../../core/models/api.model';
import { ApiService } from '../../../core/services/api.service';
import {
  AdjustCollectionRequest,
  BulkApproveResult,
  CollectionDetail,
  CollectionListItem,
  CreateCollectionRequest,
  CreateCollectionResult,
  QualityRequest,
  QualityTest,
  RatePreview,
  RatePreviewParams,
  RejectCollectionRequest,
} from '../models/collection.model';

@Injectable({ providedIn: 'root' })
export class MilkCollectionService {
  private readonly api = inject(ApiService);
  private readonly path = 'milk-collections';

  list(query: PagedQuery): Observable<PagedResult<CollectionListItem>> {
    return this.api.getPaged<CollectionListItem>(this.path, query, { skipErrorToast: true });
  }

  pendingApprovals(query: PagedQuery): Observable<PagedResult<CollectionListItem>> {
    return this.api.getPaged<CollectionListItem>(`${this.path}/pending-approvals`, query, { skipErrorToast: true });
  }

  get(id: number): Observable<CollectionDetail> {
    return this.api.get<CollectionDetail>(`${this.path}/${id}`);
  }

  /** the caller renders 422 (no effective chart / slab) inline, so no global toast */
  ratePreview(params: RatePreviewParams): Observable<RatePreview> {
    return this.api.get<RatePreview>(`${this.path}/rate-preview`, params, { skipErrorToast: true });
  }

  create(body: CreateCollectionRequest): Observable<CreateCollectionResult> {
    return this.api.post<CreateCollectionResult>(this.path, body);
  }

  adjust(id: number, body: AdjustCollectionRequest): Observable<CollectionDetail> {
    return this.api.put<CollectionDetail>(`${this.path}/${id}`, body);
  }

  approve(id: number): Observable<{ id: number; number: string; status: string }> {
    return this.api.post<{ id: number; number: string; status: string }>(`${this.path}/${id}/approve`);
  }

  reject(id: number, body: RejectCollectionRequest): Observable<{ id: number; number: string; rejectedQuantity: number }> {
    return this.api.post<{ id: number; number: string; rejectedQuantity: number }>(`${this.path}/${id}/reject`, body);
  }

  bulkApprove(ids: number[]): Observable<BulkApproveResult> {
    return this.api.post<BulkApproveResult>(`${this.path}/bulk-approve`, { ids });
  }

  qualityTests(id: number): Observable<QualityTest[]> {
    return this.api.get<QualityTest[]>(`${this.path}/${id}/quality`);
  }

  recordQuality(id: number, body: QualityRequest): Observable<QualityTest> {
    return this.api.post<QualityTest>(`${this.path}/${id}/quality`, body);
  }

  /** default milk type of a farmer (needs farmer.view; failures are ignored by callers) */
  farmerMilkType(farmerId: number): Observable<{ milkType?: string }> {
    return this.api.get<{ milkType?: string }>(`farmers/${farmerId}`, undefined, { skipErrorToast: true });
  }
}
