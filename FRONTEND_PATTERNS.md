# Frontend patterns (Angular 20, standalone, signals) — read first, copy `src/app/features/inventory/units`

Paths below are relative to `src/app`. Imports: `core/...` = `../../core/...` etc. No NgModules, `inject()`, `@if/@for`, strict templates.

## Core API (`core/`)
- `ApiService` (`services/api.service.ts`): paths relative to API base, **no `/api` prefix** (`'farmers'`, `` `farmers/${id}` ``). All return unwrapped `data`.
  `get<T>(path, params?, opts?)`, `getPaged<T>(path, query: PagedQuery, opts?) -> {items,total,page,pageSize}`, `post<T>(path, body?, opts?)`, `put<T>`, `delete<T>(path, params?, opts?)`,
  `download(path, params?, filename?)` (CSV/blob; add `format:'csv'` to params). `opts = { skipErrorToast?, pageLevel? }`. null/''/undefined params are dropped.
- Errors: the interceptor already toasts 400/409/422/404/5xx/network (server `message` + field errors). Use `{skipErrorToast:true}` only when you render the error yourself. 401 -> logout. 403 -> toast (or `/403` with `pageLevel:true`).
  `errorMessage(err)` / `fieldErrors(err)` in `core/utils/http-error.ts`.
- `ToastService`: `success|error|warning|info(message, title?)`. `ConfirmService.confirm({title?,message,confirmText?,variant?:'danger'|'primary'|'warning'}) : Promise<boolean>` (or a plain string).
- `PermissionService`: `has(code)`, `hasAny(...codes)`, `hasAll(...)`, `check(string|string[]|undefined)` (array = any-of). `PERMISSIONS.FARMER_VIEW` etc. in `core/constants/permissions.ts`.
- `AuthService`: signals `user()`, `token()`, `isAuthenticated()`, `permissions()`; `logout()`. `LookupService.farmers()|customers()|products()|items()|routes()|vehicles()|employees()|designations()|roles()|units()|breeds()|paymentModes()|shifts()|collectionCenters()|branches()|dairies()|documentTypes()|get(name, params?)` -> `Observable<LookupItem[]>` (`{id, code?, name}`, cached).
- Models: `core/models/api.model.ts` -> `ApiResponse<T>`, `PagedResult<T>`, `PagedQuery {page,pageSize,search,sortBy,sortDir,[filters]}`, `LookupItem`.
- Dates are ISO strings (`yyyy-MM-dd` for dates). `toIsoDate()` in `shared/utils/format.ts`. Pipes (`shared/pipes/app-pipes.ts`): `appDate` (`:'datetime'`), `appCurrency` (INR, en-IN), `appNumber`.

## Routes (`features/<name>/<name>.routes.ts` exports `<NAME>_ROUTES`)
```ts
export const FARMERS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./farmer-list/farmer-list.component').then(m => m.FarmerListComponent),
    data: { permission: 'farmer.view', title: 'Farmers', breadcrumb: 'Farmers' } },
  { path: 'new', loadComponent: ..., data: { permission: 'farmer.create', title: 'New Farmer', breadcrumb: 'New' } },
  { path: ':id', ... }, { path: ':id/edit', ... },
];
```
- `app.routes.ts` already mounts the prefix (`/farmers`, ...) under the shell; the shell's `canActivateChild: [permissionGuard]` enforces `data.permission` (string or any-of string[]) automatically. Order literal paths (`loans`, `new`, `my`) before `:id`.
- Route params arrive as component inputs (`withComponentInputBinding`): `readonly id = input.required<string>()`. Query params too (`input<string>()`).
- Breadcrumb comes from `data.breadcrumb` (else `title`) per route level; the prefix label exists already. Sidebar entries already exist (`core/constants/menu.config.ts`).

## Shared components (`shared/components/<x>/<x>.component.ts`) — all standalone
- `<app-page-header title="" subtitle="">` content = right-side action buttons.
- `<app-data-table>` import `...DATA_TABLE_IMPORTS` (DataTableComponent + `appColumn`/`appRowActions` directives) and `TableColumn` from `data-table.component`.
  Inputs: `columns: TableColumn[]` (`{key,label,sortable?,sortKey?,type?:'text'|'number'|'date'|'datetime'|'currency'|'badge'|'template',width?,align?,cellTemplate?}`), `items`, `total`, `loading`, `error` (string|null),
  `page`, `pageSize`, `search`, `sortBy`, `sortDir` (initial/controlled), `searchable`, `searchPlaceholder`, `pageSizeOptions`, `showPageSize`, `showPagination`, `rowKey`('id'), `emptyTitle`, `emptyMessage`.
  Outputs: `queryChange: PagedQuery` (page/size/sort/debounced-search 300ms — use this one), `pageChange`, `sortChange`, `searchChange`, `retry`.
  Slots: `<ng-template appRowActions let-row>` (Actions column), `<ng-template appColumn="status" let-row let-value="value">` (custom cell), `<div tableFilters>` / `<div tableActions>` toolbar content.
  Parent owns data: call `load()` in constructor and on `(queryChange)`; keep extra filters in your `query` object and reset `page` to 1 when they change.
- `<app-modal [open]="sig()" title="" size="sm|md|lg|xl" (closed)="...">` body + `<div modal-footer>` buttons (submit with `<button type="submit" form="formId">`).
- `<app-form-field label="" [control]="form.controls.x" hint="" inputId="x" [messages]="{required:'..'}">` wraps the input; shows error when touched/dirty.
- `<app-status-badge [status]="row.status">` (booleans -> Active/Inactive, optional `[color]`, `[label]`), `<app-pagination [page] [pageSize] [total] (pageChange)>`,
  `<app-empty-state icon title message>`, `<app-loading [overlay] text>`.
- `<app-kpi-card title [value] icon="bi-x" color="primary|success|warning|danger|info|secondary" [format]="'number'|'currency'|'percent'|'none'" suffix subtitle [trend] [loading] link="/inventory/alerts" [queryParams]="{type:'low-stock'}">`.
- `<app-chart type="line|bar|pie|doughnut" [labels]="string[]" [datasets]="[{label,data}]" [options] [height]>` — pass **stable** (signal/computed) arrays, never build arrays in a template method.
- `*appHasPermission="'inventory.create'"` (or `['a','b']` any-of) from `shared/directives/has-permission.directive`.
- Validators (`shared/validators/app-validators.ts`): `mobileValidator()`, `strongPasswordValidator()`, `positiveNumberValidator(allowZero?)`, `dateRangeValidator(startKey,endKey)` (group), `matchFieldsValidator(a,b)` (group).

## List page (Units excerpt)
```ts
readonly columns: TableColumn[] = [{ key:'code', label:'Code', sortable:true }, { key:'name', label:'Name', sortable:true }, { key:'isActive', label:'Status', type:'badge' }];
items = signal<Unit[]>([]); total = signal(0); loading = signal(false); error = signal<string|null>(null);
query: PagedQuery = { page: 1, pageSize: 20 };
constructor() { this.load(); }
onQuery(q: PagedQuery) { this.query = { ...this.query, ...q }; this.load(); }   // keep your own filters in this.query
load() { this.loading.set(true); this.error.set(null);
  this.svc.list(this.query).subscribe({ next: r => { this.items.set(r.items); this.total.set(r.total); this.loading.set(false); },
                                        error: e => { this.error.set(errorMessage(e)); this.loading.set(false); } }); }
```
```html
<app-data-table [columns]="columns" [items]="items()" [total]="total()" [loading]="loading()" [error]="error()"
  [page]="query.page ?? 1" [pageSize]="query.pageSize ?? 20" (queryChange)="onQuery($event)" (retry)="load()">
  <ng-template appRowActions let-row><button *appHasPermission="'inventory.update'" class="btn btn-sm btn-outline-secondary" (click)="openEdit(row)">Edit</button></ng-template>
</app-data-table>
```
Service: `list(q) => this.api.getPaged<Unit>('inventory/units', q, { skipErrorToast: true })`.

## Form (modal or page)
```ts
form = inject(NonNullableFormBuilder).group({ code: ['', [Validators.required, Validators.maxLength(20)]], name: ['', Validators.required] });
save() { if (this.form.invalid) { this.form.markAllAsTouched(); return; } this.saving.set(true);
  (editing ? this.svc.update(id, v) : this.svc.create(v)).subscribe({ next: () => { this.toast.success('Saved.'); ... }, error: () => this.saving.set(false) }); }
if (await this.confirm.confirm({ message: 'Deactivate?', variant: 'danger' })) { ... }
```
Page forms: `<app-page-header>` + `<div class="card"><div class="card-body"><form [formGroup]="form" (ngSubmit)="save()">…<app-form-field>…`; navigate back with `inject(Router).navigate(['/farmers', id])`.

## Dashboard KPI link convention
Every KPI/widget links to a filtered list via `link` + `queryParams` (`from`,`to`,`status`,`type`...). List pages should read these as inputs (`readonly status = input<string>()`) or `ActivatedRoute` and apply them to `query`.
Dashboard JSON contract (summary/charts/variants): see `features/dashboard/dashboard.model.ts`.

## Misc
Bootstrap 5 classes + `bi bi-*` icons. Utility/layout classes in `src/styles.scss` (`.section-title`, `.card`, `.app-table`, `.badge-soft`). Keep component styles minimal. Skip `X-Skip-Error-Toast` header details — use `opts.skipErrorToast`.
