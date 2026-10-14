export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: ApiFieldError[] | null;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PagedQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  /** extra filters, e.g. status, from, to, farmerId */
  [key: string]: string | number | boolean | null | undefined;
}

export interface LookupItem {
  id: number;
  code?: string;
  name: string;
  [key: string]: unknown;
}

export interface RequestOptions {
  /** do not show the global error toast (caller handles the error) */
  skipErrorToast?: boolean;
  /** a 403 on this request navigates to /403 instead of toasting */
  pageLevel?: boolean;
}
