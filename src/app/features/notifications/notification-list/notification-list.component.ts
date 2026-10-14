import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PagedQuery } from '../../../core/models/api.model';
import { NotificationService } from '../../../core/services/notification.service';
import { ToastService } from '../../../core/services/toast.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { PagedList } from '../../../shared/utils/paged-list';
import { NotificationApiService } from '../notification-api.service';
import { AppNotification, NOTIFICATION_SEVERITIES } from '../notification.model';

@Component({
  selector: 'app-notification-list',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, StatusBadgeComponent, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Notifications" subtitle="Alerts and messages for you and your role">
      <button type="button" class="btn btn-outline-primary" [disabled]="markingAll()" (click)="markAllRead()">
        @if (markingAll()) {
          <span class="spinner-border spinner-border-sm me-1"></span>
        } @else {
          <i class="bi bi-check2-all me-1"></i>
        }
        Mark all as read
        @if (bell.unreadCount() > 0) {
          <span class="badge text-bg-primary ms-1">{{ bell.unreadCount() }}</span>
        }
      </button>
    </app-page-header>

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
      searchPlaceholder="Search notifications..."
      emptyTitle="No notifications"
      emptyMessage="You are all caught up."
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-3 align-items-center">
        <div class="form-check form-switch mb-0">
          <input id="notifUnread" type="checkbox" class="form-check-input" formControlName="unreadOnly" />
          <label class="form-check-label small" for="notifUnread">Unread only</label>
        </div>
        <select class="form-select form-select-sm w-auto" formControlName="severity" aria-label="Severity">
          <option value="">All severities</option>
          @for (s of severities; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
      </div>

      <ng-template appColumn="severity" let-row>
        <app-status-badge [status]="row.severity" />
      </ng-template>
      <ng-template appColumn="title" let-row>
        <div class="d-flex align-items-start gap-2">
          @if (!row.isRead) {
            <span class="mt-2 flex-shrink-0 rounded-circle bg-primary" style="width: 8px; height: 8px" title="Unread"></span>
          }
          <div>
            <a href="#" class="text-decoration-none" [class.fw-bold]="!row.isRead" [class.text-body]="row.isRead" (click)="open(row, $event)">
              {{ row.title }}
            </a>
            <div class="small text-muted">{{ row.message }}</div>
          </div>
        </div>
      </ng-template>
      <ng-template appColumn="isRead" let-row>
        <app-status-badge [status]="row.isRead ? 'Read' : 'Unread'" />
      </ng-template>
      <ng-template appRowActions let-row>
        @if (row.link) {
          <button type="button" class="btn btn-sm btn-outline-primary me-1" (click)="open(row)"><i class="bi bi-box-arrow-up-right"></i> Open</button>
        }
        @if (!row.isRead) {
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="markRead(row)"><i class="bi bi-check2"></i> Mark read</button>
        }
      </ng-template>
    </app-data-table>
  `,
})
export class NotificationListComponent {
  private readonly svc = inject(NotificationApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly bell = inject(NotificationService);

  readonly severities = NOTIFICATION_SEVERITIES;

  readonly columns: TableColumn[] = [
    { key: 'severity', label: 'Severity', sortable: true, width: '110px' },
    { key: 'title', label: 'Notification', sortable: true },
    { key: 'createdDate', label: 'Received', type: 'datetime', sortable: true, width: '180px' },
    { key: 'isRead', label: 'Status', sortable: true, width: '100px' },
  ];

  readonly filters = this.fb.group({ unreadOnly: [false], severity: [''] });
  readonly list = new PagedList<AppNotification>(
    (q) => this.svc.list(q),
    () => this.filterQuery(),
    { sortBy: 'createdDate', sortDir: 'desc' },
  );
  readonly markingAll = signal(false);

  constructor() {
    this.list.load();
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
  }

  private filterQuery(): PagedQuery {
    const v = this.filters.getRawValue();
    return { unreadOnly: v.unreadOnly ? 'true' : undefined, severity: v.severity };
  }

  /** click-through: marks the notification read, then follows its link (if any) */
  open(n: AppNotification, event?: Event): void {
    event?.preventDefault();
    const go = (): void => {
      if (!n.link) {
        return;
      }
      if (/^https?:\/\//i.test(n.link)) {
        window.open(n.link, '_blank', 'noopener');
      } else {
        this.router.navigateByUrl(n.link);
      }
    };
    if (n.isRead) {
      go();
      return;
    }
    this.svc.markRead(n.id).subscribe({
      next: () => {
        this.bell.refresh();
        go();
        if (!n.link) {
          this.list.load();
        }
      },
      error: () => go(), // still follow the link; the error interceptor already toasted
    });
  }

  markRead(n: AppNotification): void {
    this.svc.markRead(n.id).subscribe(() => {
      this.bell.refresh();
      this.list.load();
    });
  }

  markAllRead(): void {
    this.markingAll.set(true);
    this.svc.markAllRead().subscribe({
      next: (res) => {
        this.markingAll.set(false);
        this.toast.success(res?.updated ? `${res.updated} notification(s) marked as read.` : 'Nothing to mark as read.');
        this.bell.refresh();
        this.list.load();
      },
      error: () => this.markingAll.set(false),
    });
  }
}
