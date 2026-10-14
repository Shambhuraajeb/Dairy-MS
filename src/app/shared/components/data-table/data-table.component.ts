import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  Directive,
  TemplateRef,
  computed,
  contentChild,
  contentChildren,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { PagedQuery } from '../../../core/models/api.model';
import { AppCurrencyPipe, AppDatePipe, AppNumberPipe } from '../../pipes/app-pipes';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { PaginationComponent } from '../pagination/pagination.component';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

export interface TableColumn {
  /** property of the row (dot paths allowed: 'farmer.name') */
  key: string;
  label: string;
  sortable?: boolean;
  /** value sent as sortBy when different from key */
  sortKey?: string;
  type?: 'text' | 'number' | 'date' | 'datetime' | 'currency' | 'badge' | 'template';
  width?: string;
  align?: 'start' | 'center' | 'end';
  /** context: { $implicit: row, row, value, column } */
  cellTemplate?: TemplateRef<any>;
}

export interface SortChange {
  sortBy: string;
  sortDir: 'asc' | 'desc';
}

/** <ng-template appRowActions let-row> buttons... </ng-template> — renders in a trailing Actions column. */
@Directive({ selector: 'ng-template[appRowActions]', standalone: true })
export class RowActionsDirective {
  readonly template = inject<TemplateRef<any>>(TemplateRef);
}

/** <ng-template appColumn="status" let-row let-value="value"> ... </ng-template> — custom cell for column key. */
@Directive({ selector: 'ng-template[appColumn]', standalone: true })
export class ColumnTemplateDirective {
  readonly key = input.required<string>({ alias: 'appColumn' });
  readonly template = inject<TemplateRef<any>>(TemplateRef);
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    PaginationComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    AppDatePipe,
    AppCurrencyPipe,
    AppNumberPipe,
  ],
  templateUrl: './data-table.component.html',
})
export class DataTableComponent {
  readonly columns = input.required<TableColumn[]>();
  readonly items = input<readonly any[]>([]);
  readonly total = input(0);
  readonly loading = input(false);
  /** string = message, true = generic message */
  readonly error = input<string | boolean | null | undefined>(null);

  readonly pageIn = input(1, { alias: 'page' });
  readonly pageSizeIn = input(20, { alias: 'pageSize' });
  readonly searchIn = input('', { alias: 'search' });
  readonly sortByIn = input<string | null>(null, { alias: 'sortBy' });
  readonly sortDirIn = input<'asc' | 'desc'>('asc', { alias: 'sortDir' });

  readonly searchable = input(true);
  readonly searchPlaceholder = input('Search...');
  readonly pageSizeOptions = input<number[]>([10, 20, 50, 100]);
  readonly showPageSize = input(true);
  readonly showPagination = input(true);
  readonly rowKey = input('id');
  readonly emptyTitle = input('No records found');
  readonly emptyMessage = input('Try changing the search or filters.');

  readonly pageChange = output<number>();
  readonly sortChange = output<SortChange>();
  readonly searchChange = output<string>();
  /** fires after any of page/size/sort/search changes with the full query to send to the API */
  readonly queryChange = output<PagedQuery>();
  readonly retry = output<void>();

  protected readonly curPage = linkedSignal(() => this.pageIn());
  protected readonly curPageSize = linkedSignal(() => this.pageSizeIn());
  protected readonly searchText = linkedSignal(() => this.searchIn());
  protected readonly curSortBy = linkedSignal(() => this.sortByIn());
  protected readonly curSortDir = linkedSignal(() => this.sortDirIn());

  private readonly colTemplates = contentChildren(ColumnTemplateDirective);
  private readonly rowActions = contentChild(RowActionsDirective);
  private readonly search$ = new Subject<string>();

  protected readonly templateMap = computed(() => {
    const map = new Map<string, TemplateRef<any>>();
    for (const d of this.colTemplates()) {
      map.set(d.key(), d.template);
    }
    return map;
  });
  protected readonly actionsTpl = computed(() => this.rowActions()?.template ?? null);
  protected readonly colSpan = computed(() => this.columns().length + (this.actionsTpl() ? 1 : 0));
  protected readonly errorText = computed(() => {
    const e = this.error();
    if (!e) {
      return '';
    }
    return typeof e === 'string' ? e : 'Failed to load data.';
  });

  constructor() {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => {
        this.curPage.set(1);
        this.searchChange.emit(value);
        this.emitQuery();
      });
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchText.set(value);
    this.search$.next(value.trim());
  }

  protected onPage(page: number): void {
    this.curPage.set(page);
    this.pageChange.emit(page);
    this.emitQuery();
  }

  protected onPageSize(event: Event): void {
    this.curPageSize.set(Number((event.target as HTMLSelectElement).value));
    this.curPage.set(1);
    this.pageChange.emit(1);
    this.emitQuery();
  }

  protected toggleSort(col: TableColumn): void {
    if (!col.sortable) {
      return;
    }
    const key = col.sortKey ?? col.key;
    const dir: 'asc' | 'desc' = this.curSortBy() === key && this.curSortDir() === 'asc' ? 'desc' : 'asc';
    this.curSortBy.set(key);
    this.curSortDir.set(dir);
    this.curPage.set(1);
    this.sortChange.emit({ sortBy: key, sortDir: dir });
    this.emitQuery();
  }

  protected isSorted(col: TableColumn): boolean {
    return !!col.sortable && this.curSortBy() === (col.sortKey ?? col.key);
  }

  protected cellValue(row: any, key: string): any {
    if (!key.includes('.')) {
      return row?.[key];
    }
    return key.split('.').reduce((o: any, k) => o?.[k], row);
  }

  protected templateFor(col: TableColumn): TemplateRef<any> | null {
    return col.cellTemplate ?? this.templateMap().get(col.key) ?? null;
  }

  protected alignClass(col: TableColumn): string {
    const align = col.align ?? (col.type === 'number' || col.type === 'currency' ? 'end' : 'start');
    return align === 'end' ? 'text-end' : align === 'center' ? 'text-center' : '';
  }

  protected trackRow(index: number, row: any): unknown {
    return row?.[this.rowKey()] ?? index;
  }

  private emitQuery(): void {
    const search = this.searchText().trim();
    const sortBy = this.curSortBy();
    const query: PagedQuery = {
      page: this.curPage(),
      pageSize: this.curPageSize(),
      search: search || undefined,
      sortBy: sortBy || undefined,
      sortDir: sortBy ? this.curSortDir() : undefined,
    };
    this.queryChange.emit(query);
  }
}

/** import in a feature component: imports: [...DATA_TABLE_IMPORTS] */
export const DATA_TABLE_IMPORTS = [DataTableComponent, ColumnTemplateDirective, RowActionsDirective];
