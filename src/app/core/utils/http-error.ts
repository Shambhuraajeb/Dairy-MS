import { HttpErrorResponse } from '@angular/common/http';
import { ApiFieldError } from '../models/api.model';

/** Best-effort human readable message from any thrown value (HttpErrorResponse with ApiResponse body, Error, string). */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return 'Cannot reach the server. Check your connection and try again.';
    }
    const body = err.error as { message?: string; errors?: ApiFieldError[] | null } | string | Blob | null;
    if (body && typeof body === 'object' && !(body instanceof Blob)) {
      const details = (body.errors ?? []).filter((e) => !!e?.message);
      if (details.length) {
        const list = details
          .slice(0, 3)
          .map((e) => (e.field ? `${e.field}: ${e.message}` : e.message))
          .join('; ');
        return body.message && body.message !== 'Validation failed.' ? `${body.message} ${list}` : list;
      }
      if (body.message) {
        return body.message;
      }
    }
    if (typeof body === 'string' && body.length > 0 && body.length < 300) {
      return body;
    }
    switch (err.status) {
      case 401:
        return 'Your session has expired. Please sign in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested record was not found.';
      default:
        return err.status >= 500 ? 'A server error occurred. Please try again later.' : fallback;
    }
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (typeof err === 'string' && err) {
    return err;
  }
  return fallback;
}

/** Field level errors from a 400 ApiResponse, keyed by camelCase field name (case-insensitive match for forms). */
export function fieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { errors?: ApiFieldError[] | null } | null;
    for (const e of body?.errors ?? []) {
      if (e?.field) {
        const key = e.field.charAt(0).toLowerCase() + e.field.slice(1);
        out[key] = e.message;
      }
    }
  }
  return out;
}
