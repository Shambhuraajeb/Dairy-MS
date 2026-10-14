import { signal } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../core/models/api.model';
import { errorMessage } from '../../core/utils/http-error';

/**
 * State holder for a server-side paged list page. `filterSource` returns the current extra filters
 * (usually built from a filter FormGroup) and is merged into every request.
 *
 *   readonly list = new PagedList<Foo>((q) => this.svc.list(q), () => this.filterQuery());
 *   <app-data-table [items]="list.items()" ... (queryChange)="list.onQuery($event)" (retry)="list.load()">
 */
export class PagedList<T> {
  readonly items = signal<T[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  query: PagedQuery;
  private seq = 0;

  constructor(
    private readonly fetcher: (q: PagedQuery) => Observable<PagedResult<T>>,
    private readonly filterSource: () => PagedQuery = () => ({}),
    initial: PagedQuery = {},
  ) {
    this.query = { page: 1, pageSize: 20, ...initial };
  }

  /** from the data table: page / pageSize / sort / search */
  onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  /** filters changed: back to page 1 */
  refilter(): void {
    this.query = { ...this.query, page: 1 };
    this.load();
  }

  load(): void {
    const id = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    this.fetcher({ ...this.query, ...this.filterSource() }).subscribe({
      next: (res) => {
        if (id !== this.seq) {
          return;
        }
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        if (id !== this.seq) {
          return;
        }
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}

/** yyyy-MM-dd from an ISO date / datetime string (for <input type="date">); '' when empty */
export function dateOnly(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

/** '' / undefined -> null (for optional request fields) */
export function orNull<T>(value: T | '' | null | undefined): T | null {
  return value === '' || value === undefined || value === null ? null : value;
}

/** query param helper: read a string query param ('' when missing) */
export function qp(params: { get(name: string): string | null }, name: string): string {
  return params.get(name) ?? '';
}
