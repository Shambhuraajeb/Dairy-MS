import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { ApiService } from '../services/api.service';
import { ToastService } from '../services/toast.service';
import { AuthUser, ChangePasswordRequest, LoginRequest, LoginResponse } from './auth.model';

const TOKEN_KEY = 'dms.token';
const EXPIRES_KEY = 'dms.expiresAt';
const USER_KEY = 'dms.user';
const MAX_TIMEOUT = 2_000_000_000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _token = signal<string | null>(null);
  private readonly _expiresAt = signal<number | null>(null);
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  readonly user = this._user.asReadonly();
  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token() && !!this._user());
  readonly permissions = computed<string[]>(() => this._user()?.permissions ?? []);

  constructor() {
    this.loadFromStorage();
  }

  login(request: LoginRequest): Observable<AuthUser> {
    return this.api.post<LoginResponse>('auth/login', request, { skipErrorToast: true }).pipe(
      tap((res) => this.setSession(res)),
      map((res) => res.user),
    );
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.api.post<unknown>('auth/change-password', request).pipe(
      tap(() => {
        const u = this._user();
        if (u?.mustChangePassword) {
          this.persistUser({ ...u, mustChangePassword: false });
        }
      }),
      map(() => undefined),
    );
  }

  logout(redirect = true, returnUrl?: string): void {
    this.clearSession();
    if (redirect) {
      void this.router.navigate(['/login'], { queryParams: returnUrl ? { returnUrl } : undefined });
    }
  }

  loadFromStorage(): void {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const userJson = localStorage.getItem(USER_KEY);
      const expires = Number(localStorage.getItem(EXPIRES_KEY));
      if (!token || !userJson || !expires || expires <= Date.now()) {
        this.clearSession();
        return;
      }
      const user = JSON.parse(userJson) as AuthUser;
      user.permissions = user.permissions ?? [];
      this._token.set(token);
      this._expiresAt.set(expires);
      this._user.set(user);
      this.scheduleExpiry(expires);
    } catch {
      this.clearSession();
    }
  }

  /** true when a stored token exists but has passed its expiry (logs out as a side effect) */
  checkExpiry(): boolean {
    const exp = this._expiresAt();
    if (exp !== null && exp <= Date.now()) {
      this.clearSession();
      return true;
    }
    return false;
  }

  private setSession(res: LoginResponse): void {
    let expires = Date.parse(res.expiresAt);
    if (Number.isNaN(expires)) {
      expires = Date.now() + 60 * 60 * 1000;
    }
    const user: AuthUser = { ...res.user, permissions: res.user.permissions ?? [] };
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    localStorage.setItem(EXPIRES_KEY, String(expires));
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this._token.set(res.accessToken);
    this._expiresAt.set(expires);
    this._user.set(user);
    this.scheduleExpiry(expires);
  }

  private persistUser(user: AuthUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this._user.set(user);
  }

  private clearSession(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = undefined;
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._expiresAt.set(null);
    this._user.set(null);
  }

  private scheduleExpiry(expires: number): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
    }
    const ms = expires - Date.now();
    this.expiryTimer = setTimeout(() => {
      if (this._expiresAt() !== null && this._expiresAt()! <= Date.now() + 1000) {
        this.toast.warning('Your session has expired. Please sign in again.');
        this.logout(true);
      } else if (this._expiresAt() !== null) {
        this.scheduleExpiry(this._expiresAt()!);
      }
    }, Math.max(0, Math.min(ms, MAX_TIMEOUT)));
  }
}
