import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../../core/models/api.model';
import { ApiService } from '../../../core/services/api.service';
import { MilkRejection } from '../models/collection.model';

@Injectable({ providedIn: 'root' })
export class MilkRejectionService {
  private readonly api = inject(ApiService);

  list(query: PagedQuery): Observable<PagedResult<MilkRejection>> {
    return this.api.getPaged<MilkRejection>('milk-rejections', query, { skipErrorToast: true });
  }
}
