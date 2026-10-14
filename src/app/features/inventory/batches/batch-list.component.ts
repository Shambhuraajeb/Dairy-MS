import { Component, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { AppDatePipe, AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { PagedList, qp } from '../../../shared/utils/paged-list';
import { BATCH_STATUSES, InventoryBatch } from '../inventory.model';
import { InventoryService } from '../inventory.service';

@Component({
  selector: 'app-batch-list',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, StatusBadgeComponent, AppDatePipe, AppNumberPipe, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Batches" subtitle="Stock batches with expiry tracking (first-expiry-first-out)" />

    <app-data-table
      [columns]="columns"
      [items]="list.items()"
      [total]="list.total()"
      [loading]="list.loading()"
      [error]="list.error()"
      [page]="list.query.page ?? 1"
      [pageSize]="list.query.pageSize ?? 20"
      searchPlaceholder="Search batch, item or supplier..."
      emptyTitle="No batches found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
        <select class="form-select form-select-sm w-auto" formControlName="itemId" aria-label="Item">
          <option value="">All items</option>
          @for (i of items(); track i.id) {
            <option [value]="i.id">{{ i.name }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="view" aria-label="Expiry view">
          <option value="">All batches</option>
          <option value="available">Available stock</option>
          <option value="expiring">Expiring soon</option>
          <option value="expired">Expired (stock left)</option>
        </select>
        @if (filters.controls.view.value === 'expiring') {
          <select class="form-select form-select-sm w-auto" formControlName="days" aria-label="Within days">
            @for (d of dayOptions; track d) {
              <option [value]="d">Within {{ d }} days</option>
            }
          </select>
        }
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">Any status</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
      </div>

      <ng-template appColumn="itemName" let-row>
        <div class="fw-semibold">{{ row.itemName }}</div>
        <div class="small text-muted">{{ row.itemCode }}</div>
      </ng-template>
      <ng-template appColumn="expiryDate" let-row>
        @if (row.expiryDate) {
          <span [class.text-danger]="row.isExpired" class="me-1">{{ row.expiryDate | appDate }}</span>
          @if (row.isExpired) {
            <span class="badge badge-soft badge-soft-danger">Expired {{ -row.daysToExpiry }}d ago</span>
          } @else if (row.daysToExpiry !== null && row.daysToExpiry <= 7) {
            <span class="badge badge-soft badge-soft-danger">{{ row.daysToExpiry }}d left</span>
          } @else if (row.daysToExpiry !== null && row.daysToExpiry <= 30) {
            <span class="badge badge-soft badge-soft-warning">{{ row.daysToExpiry }}d left</span>
          }
        } @else {
          <span class="text-muted">No expiry</span>
        }
      </ng-template>
      <ng-template appColumn="quantityAvailable" let-row>
        {{ row.quantityAvailable | appNumber: 3 }} <span class="text-muted small">{{ row.unitName }}</span>
      </ng-template>
      <ng-template appColumn="status" let-row>
        <app-status-badge [status]="row.isExpired && row.status === 'Available' ? 'Expired' : row.status" />
      </ng-template>
    </app-data-table>
  `,
})
export class BatchListComponent {
  private readonly svc = inject(InventoryService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly statuses = BATCH_STATUSES;
  readonly dayOptions = [7, 15, 30, 60, 90];
  readonly items = toSignal(this.lookups.items(), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'itemName', label: 'Item', sortable: true },
    { key: 'batchNumber', label: 'Batch', sortable: true },
    { key: 'supplierName', label: 'Supplier' },
    { key: 'receivedDate', label: 'Received', type: 'date', sortable: true },
    { key: 'expiryDate', label: 'Expiry', type: 'template', sortable: true },
    { key: 'quantityAvailable', label: 'Available', type: 'template', sortable: true, align: 'end' },
    { key: 'stockValue', label: 'Value', type: 'currency' },
    { key: 'status', label: 'Status', type: 'template', sortable: true },
  ];

  readonly filters = this.fb.group({ itemId: [''], view: [''], days: ['30'], status: [''] });
  readonly list = new PagedList<InventoryBatch>(
    (q) => this.svc.batches(q),
    () => {
      const f = this.filters.getRawValue();
      return {
        itemId: f.itemId || undefined,
        status: f.status || undefined,
        available: f.view === 'available' ? true : undefined,
        expiring: f.view === 'expiring' ? true : undefined,
        expired: f.view === 'expired' ? true : undefined,
        days: f.view === 'expiring' ? f.days || undefined : undefined,
      };
    },
  );

  constructor() {
    const p = this.route.snapshot.queryParamMap;
    const view = (qp(p, 'type') || qp(p, 'view')).toLowerCase();
    const status = qp(p, 'status');
    // status=Expiring / Expired / Available from dashboard links map to the view filter; real batch statuses stay as status
    const statusAsView = ['expiring', 'expired', 'available'].includes(status.toLowerCase()) ? status.toLowerCase() : '';
    this.filters.patchValue({
      itemId: qp(p, 'itemId'),
      view: ['expiring', 'expired', 'available'].includes(view) ? view : statusAsView,
      days: qp(p, 'days') || '30',
      status: statusAsView ? '' : status,
    });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
    this.list.load();
  }
}
