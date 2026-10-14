import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

const SUPER_ADMIN = 'Super Admin';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);

  /** Reads signals, so it is reactive inside computed()/effect()/templates. */
  has(code: string): boolean {
    const user = this.auth.user();
    if (!user) {
      return false;
    }
    return user.role === SUPER_ADMIN || user.permissions.includes(code);
  }

  hasAny(...codes: string[]): boolean {
    return codes.some((c) => this.has(c));
  }

  hasAll(...codes: string[]): boolean {
    return codes.every((c) => this.has(c));
  }

  /** undefined/empty = allowed; string = that permission; array = any of them. */
  check(permission: string | readonly string[] | null | undefined): boolean {
    if (permission === null || permission === undefined) {
      return true;
    }
    if (typeof permission === 'string') {
      return permission === '' ? true : this.has(permission);
    }
    return permission.length === 0 ? true : permission.some((c) => this.has(c));
  }

  isInRole(...roles: string[]): boolean {
    const role = this.auth.user()?.role;
    return !!role && roles.includes(role);
  }
}
