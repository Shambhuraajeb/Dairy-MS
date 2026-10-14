import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { PermissionService } from '../services/permission.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.checkExpiry() && auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.checkExpiry() && auth.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};

function requiredPermission(route: ActivatedRouteSnapshot): string | string[] | undefined {
  for (let r: ActivatedRouteSnapshot | null = route; r; r = r.parent) {
    const p = r.data?.['permission'] as string | string[] | undefined;
    if (p) {
      return p;
    }
  }
  return undefined;
}

/** Reads `data.permission` (string | string[] = any-of) from the route or the nearest ancestor. */
export const permissionGuard: CanActivateFn = (route) => {
  const perm = inject(PermissionService);
  const router = inject(Router);
  const required = requiredPermission(route);
  return perm.check(required) ? true : router.createUrlTree(['/403']);
};
