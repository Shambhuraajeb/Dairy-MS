import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Subscription, catchError, of, switchMap, timer } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ApiService } from './api.service';
import { PermissionService } from './permission.service';

const POLL_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly perm = inject(PermissionService);

  private readonly _unread = signal(0);
  readonly unreadCount = this._unread.asReadonly();
  private sub: Subscription | undefined;

  constructor() {
    effect(() => {
      const enabled = this.auth.isAuthenticated() && this.perm.has('notification.view');
      untracked(() => (enabled ? this.start() : this.stop()));
    });
  }

  /** Re-fetch immediately (e.g. after mark-read). */
  refresh(): void {
    if (!this.auth.isAuthenticated() || !this.perm.has('notification.view')) {
      return;
    }
    this.api
      .get<unknown>('notifications/unread-count', undefined, { skipErrorToast: true })
      .pipe(catchError(() => of(null)))
      .subscribe((d) => this._unread.set(this.parse(d)));
  }

  private start(): void {
    if (this.sub) {
      return;
    }
    this.sub = timer(0, POLL_MS)
      .pipe(
        switchMap(() =>
          this.api.get<unknown>('notifications/unread-count', undefined, { skipErrorToast: true }).pipe(catchError(() => of(null))),
        ),
      )
      .subscribe((d) => {
        if (d !== null) {
          this._unread.set(this.parse(d));
        }
      });
  }

  private stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
    this._unread.set(0);
  }

  private parse(d: unknown): number {
    if (typeof d === 'number') {
      return d;
    }
    if (d && typeof d === 'object') {
      const o = d as Record<string, unknown>;
      const v = o['count'] ?? o['unreadCount'] ?? o['unread'] ?? 0;
      return typeof v === 'number' ? v : Number(v) || 0;
    }
    return 0;
  }
}
