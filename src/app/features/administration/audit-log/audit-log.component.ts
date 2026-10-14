import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { PagedQuery } from '../../../core/models/api.model';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { BadgeColor, StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { AppDatePipe } from '../../../shared/pipes/app-pipes';
import { PagedList } from '../../../shared/utils/paged-list';
import { AuditLogDetail, AuditLogItem } from '../administration.model';
import { AdministrationService } from '../administration.service';
import { DiffRow, buildDiff, prettyJson } from './audit-diff.util';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    ModalComponent,
    LoadingComponent,
    StatusBadgeComponent,
    AppDatePipe,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Audit Log" subtitle="Who did what, when, and what changed" />

    <app-data-table
      [columns]="columns"
      [items]="list.items()"
      [total]="list.total()"
      [loading]="list.loading()"
      [error]="list.error()"
      [page]="list.query.page ?? 1"
      [pageSize]="list.query.pageSize ?? 20"
      sortBy="createdDate"
      sortDir="desc"
      searchPlaceholder="Search..."
      emptyTitle="No audit entries found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
        <input type="date" class="form-control form-control-sm w-auto" formControlName="from" aria-label="From date" />
        <input type="date" class="form-control form-control-sm w-auto" formControlName="to" aria-label="To date" />
        <input type="search" class="form-control form-control-sm w-auto" style="width: 140px !important" formControlName="user" placeholder="User" aria-label="User" />
        <select class="form-select form-select-sm w-auto" formControlName="action" aria-label="Action">
          <option value="">All actions</option>
          @for (a of actions(); track a) {
            <option [value]="a">{{ a }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="entity" aria-label="Entity">
          <option value="">All entities</option>
          @for (e of entities(); track e) {
            <option [value]="e">{{ e }}</option>
          }
        </select>
      </div>

      <ng-template appColumn="action" let-row>
        <app-status-badge [status]="row.action" [color]="actionColor(row.action)" />
      </ng-template>
      <ng-template appRowActions let-row>
        <button type="button" class="btn btn-sm btn-outline-primary" (click)="openDetail(row)"><i class="bi bi-eye"></i> Details</button>
      </ng-template>
    </app-data-table>

    <app-modal [open]="detailOpen()" title="Audit Entry" size="xl" (closed)="closeDetail()">
      @if (detailLoading()) {
        <app-loading text="Loading entry..." />
      } @else if (detailError()) {
        <div class="alert alert-danger mb-0">{{ detailError() }}</div>
      } @else if (detail(); as d) {
        <dl class="row mb-3 small">
          <dt class="col-sm-2">When</dt>
          <dd class="col-sm-4">{{ d.createdDate | appDate: 'datetime' }}</dd>
          <dt class="col-sm-2">User</dt>
          <dd class="col-sm-4">{{ d.username || '—' }}</dd>
          <dt class="col-sm-2">Action</dt>
          <dd class="col-sm-4">{{ d.action }}</dd>
          <dt class="col-sm-2">Entity</dt>
          <dd class="col-sm-4">{{ d.entityName || '—' }}{{ d.entityId ? ' #' + d.entityId : '' }}</dd>
          <dt class="col-sm-2">IP address</dt>
          <dd class="col-sm-4">{{ d.ipAddress || '—' }}</dd>
          <dt class="col-sm-2">Device</dt>
          <dd class="col-sm-4 text-break">{{ d.userAgent || '—' }}</dd>
        </dl>

        @if (diff().length === 0) {
          <div class="text-muted text-center py-3">No old or new values were recorded for this entry.</div>
        } @else {
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0">Changes <span class="text-muted fw-normal small">({{ changedCount() }} of {{ diff().length }} fields differ)</span></h6>
            <div class="form-check form-switch mb-0">
              <input id="auditUnchanged" type="checkbox" class="form-check-input" [checked]="showUnchanged()" (change)="toggleUnchanged($event)" />
              <label class="form-check-label small" for="auditUnchanged">Show unchanged</label>
            </div>
          </div>
          <div class="table-responsive mb-3">
            <table class="table table-sm table-bordered align-middle mb-0">
              <thead>
                <tr>
                  <th style="width: 28%">Field</th>
                  <th style="width: 36%">Old value</th>
                  <th style="width: 36%">New value</th>
                </tr>
              </thead>
              <tbody>
                @for (r of visibleDiff(); track r.path) {
                  <tr [class]="rowClass(r)">
                    <td class="fw-semibold text-break">{{ r.path }}</td>
                    <td class="text-break font-monospace small">{{ r.kind === 'added' ? '—' : r.oldValue }}</td>
                    <td class="text-break font-monospace small">{{ r.kind === 'removed' ? '—' : r.newValue }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="3" class="text-center text-muted py-3">No differences.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="row g-3">
            <div class="col-md-6">
              <h6>Old values (JSON)</h6>
              <pre class="border rounded p-2 small mb-0 bg-body-tertiary" style="max-height: 260px; overflow: auto">{{ oldJson() || '(none)' }}</pre>
            </div>
            <div class="col-md-6">
              <h6>New values (JSON)</h6>
              <pre class="border rounded p-2 small mb-0 bg-body-tertiary" style="max-height: 260px; overflow: auto">{{ newJson() || '(none)' }}</pre>
            </div>
          </div>
        }
      }
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeDetail()">Close</button>
      </div>
    </app-modal>
  `,
})
export class AuditLogComponent {
  private readonly svc = inject(AdministrationService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly columns: TableColumn[] = [
    { key: 'createdDate', label: 'When', type: 'datetime', sortable: true, width: '180px' },
    { key: 'username', label: 'User', sortable: true },
    { key: 'action', label: 'Action', sortable: true },
    { key: 'entityName', label: 'Entity', sortable: true },
    { key: 'entityId', label: 'Entity Id' },
    { key: 'ipAddress', label: 'IP address' },
  ];

  readonly actions = signal<string[]>([]);
  readonly entities = signal<string[]>([]);

  readonly filters = this.fb.group({ from: [''], to: [''], user: [''], action: [''], entity: [''] });
  readonly list = new PagedList<AuditLogItem>(
    (q) => this.svc.listAudit(q),
    () => this.filters.getRawValue() as PagedQuery,
    { sortBy: 'createdDate', sortDir: 'desc' },
  );

  readonly detailOpen = signal(false);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly detail = signal<AuditLogDetail | null>(null);
  readonly showUnchanged = signal(false);

  readonly diff = computed<DiffRow[]>(() => {
    const d = this.detail();
    return d ? buildDiff(d.oldValues, d.newValues) : [];
  });
  readonly changedCount = computed(() => this.diff().filter((r) => r.kind !== 'same').length);
  readonly visibleDiff = computed(() => (this.showUnchanged() ? this.diff() : this.diff().filter((r) => r.kind !== 'same')));
  readonly oldJson = computed(() => prettyJson(this.detail()?.oldValues));
  readonly newJson = computed(() => prettyJson(this.detail()?.newValues));

  constructor() {
    this.list.load();
    this.filters.valueChanges.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.list.refilter());
    this.svc.auditFilters().subscribe({
      next: (f) => {
        this.actions.set(f.actions ?? []);
        this.entities.set(f.entities ?? []);
      },
      error: () => undefined, // filter lists are optional; the table still works
    });
  }

  actionColor(action: string): BadgeColor {
    const a = (action ?? '').toLowerCase();
    if (/delete|reject|deactivat|fail|lock/.test(a)) {
      return 'danger';
    }
    if (/create|approve|payment|login|activat/.test(a)) {
      return 'success';
    }
    if (/update|change|adjust|reset/.test(a)) {
      return 'warning';
    }
    return 'info';
  }

  rowClass(r: DiffRow): string {
    switch (r.kind) {
      case 'added':
        return 'table-success';
      case 'removed':
        return 'table-danger';
      case 'changed':
        return 'table-warning';
      default:
        return '';
    }
  }

  openDetail(row: AuditLogItem): void {
    this.detail.set(null);
    this.detailError.set(null);
    this.showUnchanged.set(false);
    this.detailLoading.set(true);
    this.detailOpen.set(true);
    this.svc.getAudit(row.id).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.detailLoading.set(false);
      },
      error: (err) => {
        this.detailError.set(errorMessage(err));
        this.detailLoading.set(false);
      },
    });
  }

  closeDetail(): void {
    this.detailOpen.set(false);
  }

  toggleUnchanged(ev: Event): void {
    this.showUnchanged.set((ev.target as HTMLInputElement).checked);
  }
}
