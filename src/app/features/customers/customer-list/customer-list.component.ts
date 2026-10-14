import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PagedList } from '../../../shared/utils/paged-list';
import { CUSTOMER_STATUSES, CUSTOMER_TYPES, Customer } from '../customer.model';
import { CustomerService } from '../customer.service';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, HasPermissionDirective, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Customers" subtitle="Retail customers and distributors (B2B)">
      <a *appHasPermission="'complaint.view'" routerLink="/customers/complaints" class="btn btn-outline-secondary">
        <i class="bi bi-chat-left-dots me-1"></i>Complaints
      </a>
      <a *appHasPermission="'customer.create'" routerLink="/customers/new" class="btn btn-primary">
        <i class="bi bi-plus-lg me-1"></i>New Customer
      </a>
    </app-page-header>

    <app-data-table
      [columns]="columns"
      [items]="list.items()"
      [total]="list.total()"
      [loading]="list.loading()"
      [error]="list.error()"
      [page]="list.query.page ?? 1"
      [pageSize]="list.query.pageSize ?? 20"
      searchPlaceholder="Search code, name, mobile or email..."
      emptyTitle="No customers found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2">
        <select class="form-select form-select-sm w-auto" formControlName="type" aria-label="Customer type">
          <option value="">All types</option>
          @for (t of types; track t) {
            <option [value]="t">{{ t }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
      </div>

      <ng-template appColumn="name" let-row>
        <a [routerLink]="['/customers', row.id]" class="fw-semibold text-decoration-none">{{ row.name }}</a>
        @if (row.contactPerson) {
          <div class="small text-muted">{{ row.contactPerson }}</div>
        }
      </ng-template>
      <ng-template appRowActions let-row>
        <a [routerLink]="['/customers', row.id]" class="btn btn-sm btn-outline-primary me-1"><i class="bi bi-eye"></i> View</a>
        <a *appHasPermission="'customer.update'" [routerLink]="['/customers', row.id, 'edit']" class="btn btn-sm btn-outline-secondary">
          <i class="bi bi-pencil"></i> Edit
        </a>
      </ng-template>
    </app-data-table>
  `,
})
export class CustomerListComponent {
  private readonly svc = inject(CustomerService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly types = CUSTOMER_TYPES;
  readonly statuses = CUSTOMER_STATUSES;

  readonly columns: TableColumn[] = [
    { key: 'customerCode', label: 'Code', sortable: true, width: '110px' },
    { key: 'name', label: 'Customer', sortable: true },
    { key: 'customerType', label: 'Type', sortable: true, width: '110px' },
    { key: 'mobile', label: 'Mobile', sortable: true },
    { key: 'activeSubscriptions', label: 'Subscriptions', type: 'number', width: '120px' },
    { key: 'outstandingBalance', label: 'Outstanding', type: 'currency', sortable: true },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
  ];

  readonly filters = this.fb.group({ type: [''], status: [''] });
  readonly list = new PagedList<Customer>(
    (q) => this.svc.list(q),
    () => ({ ...this.filters.getRawValue() }),
  );

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.filters.patchValue({ type: p.get('type') ?? '', status: p.get('status') ?? '' }, { emitEvent: false });
      this.list.refilter();
    });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
  }
}
