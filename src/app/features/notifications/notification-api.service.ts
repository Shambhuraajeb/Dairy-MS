import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../core/models/api.model';
import { ApiService } from '../../core/services/api.service';
import { AppNotification } from './notification.model';

/**
 * HTTP access for the notifications page. The topbar bell uses the core `NotificationService`
 * (unread count polling); call its `refresh()` after any change made here.
 */
@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly api = inject(ApiService);

  list(q: PagedQuery): Observable<PagedResult<AppNotification>> {
    return this.api.getPaged<AppNotification>('notifications', q, { skipErrorToast: true });
  }

  markRead(id: number): Observable<AppNotification> {
    return this.api.post<AppNotification>(`notifications/${id}/read`);
  }

  markAllRead(): Observable<{ updated: number }> {
    return this.api.post<{ updated: number }>('notifications/read-all');
  }
}
