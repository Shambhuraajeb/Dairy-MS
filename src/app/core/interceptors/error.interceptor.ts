import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../services/toast.service';
import { errorMessage } from '../utils/http-error';

const SKIP_HEADER = 'X-Skip-Error-Toast';
const PAGE_HEADER = 'X-Page-Level';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const auth = inject(AuthService);
  const router = inject(Router);

  const skipToast = req.headers.has(SKIP_HEADER);
  const pageLevel = req.headers.has(PAGE_HEADER);
  const outgoing = req.clone({ headers: req.headers.delete(SKIP_HEADER).delete(PAGE_HEADER) });
  const isLogin = /\/auth\/login(\?|$)/i.test(req.url);

  return next(outgoing).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => err);
      }
      switch (err.status) {
        case 0:
          if (!skipToast) {
            toast.error(errorMessage(err), 'Network error');
          }
          break;
        case 401:
          if (!isLogin) {
            if (auth.isAuthenticated()) {
              toast.warning('Your session has expired. Please sign in again.');
            }
            auth.logout(true, router.url && !router.url.startsWith('/login') ? router.url : undefined);
          }
          break;
        case 403:
          if (pageLevel) {
            void router.navigate(['/403']);
          } else if (!skipToast) {
            toast.error(errorMessage(err), 'Access denied');
          }
          break;
        default:
          if (!skipToast) {
            toast.error(errorMessage(err));
          }
      }
      return throwError(() => err);
    }),
  );
};
