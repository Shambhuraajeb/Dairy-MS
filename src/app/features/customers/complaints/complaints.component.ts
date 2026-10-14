import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PagedList } from '../../../shared/utils/paged-list';
import { COMPLAINT_CATEGORIES, COMPLAINT_PRIORITIES, COMPLAINT_STATUSES, Complaint } from '../complaint.model';
import { CustomerService } from '../customer.service';
import { ComplaintDetailModalComponent } from './complaint-detail-modal.component';
import { ComplaintFormModalComponent } from './complaint-form-modal.component';

@Component({
  selector: 'app-complaints',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    ComplaintFormModalComponent,
    ComplaintDetailModalComponent,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Customer Complaints" subtitle="Raise, assign, resolve and close customer complaints">
      <a routerLink="/customers" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>Customers</a>
      <button *appHasPermission="'complaint.create'" type="button" class="btn btn-primary" (click)="formOpen.set(true)">
        <i class="bi bi-plus-lg me-1"></i>Raise Complaint
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
      searchPlaceholder="Search number, subject or customer..."
      emptyTitle="No complaints found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2">
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="category" aria-label="Category">
          <option value="">All categories</option>
          @for (c of categories; track c) {
            <option [value]="c">{{ c }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="priority" aria-label="Priority">
          <option value="">All priorities</option>
          @for (p of priorities; track p) {
            <option [value]="p">{{ p }}</option>
          }
        </select>
        @if (customers().length > 1) {
          <select class="form-select form-select-sm w-auto" formControlName="customerId" aria-label="Customer">
            <option value="">All customers</option>
            @for (c of customers(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
        }
      </div>

      <ng-template appColumn="complaintNumber" let-row>
        <button type="button" class="btn btn-link p-0 fw-semibold text-decoration-none" (click)="view(row)">{{ row.complaintNumber }}</button>
      </ng-template>
      <ng-template appColumn="customerName" let-row>
        <a [routerLink]="['/customers', row.customerId]" class="text-decoration-none">{{ row.customerName }}</a>
      </ng-template>
      <ng-template appColumn="priority" let-row>
        <app-status-badge [status]="row.priority" [color]="priorityColor(row.priority)" />
      </ng-template>
      <ng-template appRowActions let-row>
        <button type="button" class="btn btn-sm btn-outline-primary" (click)="view(row)"><i class="bi bi-eye"></i> Open</button>
      </ng-template>
    </app-data-table>

    <app-complaint-form-modal
      [open]="formOpen()"
      [customerId]="customerIdParam()"
      (closed)="formOpen.set(false)"
      (saved)="onRaised($event)"
    />
    <app-complaint-detail-modal [complaint]="selected()" (closed)="selected.set(null)" (changed)="onChanged($event)" />
  `,
})
export class ComplaintsComponent {
  private readonly svc = inject(CustomerService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly statuses = COMPLAINT_STATUSES;
  readonly categories = COMPLAINT_CATEGORIES;
  readonly priorities = COMPLAINT_PRIORITIES;
  readonly customers = toSignal(this.lookups.customers(), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'complaintNumber', label: 'Complaint', sortable: true, width: '150px' },
    { key: 'customerName', label: 'Customer', sortable: true },
    { key: 'subject', label: 'Subject' },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'priority', label: 'Priority', sortable: true },
    { key: 'assignedToName', label: 'Assigned to' },
    { key: 'createdDate', label: 'Raised', type: 'date', sortable: true },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
  ];

  readonly filters = this.fb.group({ status: [''], category: [''], priority: [''], customerId: [''] });
  readonly list = new PagedList<Complaint>(
    (q) => this.svc.listComplaints(q),
    () => ({ ...this.filters.getRawValue() }),
  );

  readonly formOpen = signal(false);
  readonly selected = signal<Complaint | null>(null);
  readonly customerIdParam = signal<number | null>(null);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.filters.patchValue(
        {
          status: p.get('status') ?? '',
          category: p.get('category') ?? '',
          priority: p.get('priority') ?? '',
          customerId: p.get('customerId') ?? '',
        },
        { emitEvent: false },
      );
      const cid = Number(p.get('customerId'));
      this.customerIdParam.set(cid > 0 ? cid : null);
      this.list.refilter();
    });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
  }

  priorityColor(priority: string): 'secondary' | 'info' | 'warning' | 'danger' {
    switch (priority) {
      case 'Urgent':
        return 'danger';
      case 'High':
        return 'warning';
      case 'Medium':
        return 'info';
      default:
        return 'secondary';
    }
  }

  view(row: Complaint): void {
    this.selected.set(row);
  }

  onRaised(c: Complaint): void {
    this.formOpen.set(false);
    this.list.load();
    this.selected.set(c);
  }

  onChanged(c: Complaint): void {
    this.selected.set(c);
    this.list.load();
  }
}
