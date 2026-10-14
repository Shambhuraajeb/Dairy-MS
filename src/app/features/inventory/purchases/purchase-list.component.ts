import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PagedList, qp } from '../../../shared/utils/paged-list';
import { PAYMENT_STATUSES, PURCHASE_STATUSES, Purchase } from '../inventory.model';
import { InventoryService } from '../inventory.service';
import { PurchaseDetailModalComponent } from './purchase-detail-modal.component';

@Component({
  selector: 'app-purchase-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    ModalComponent,
    FormFieldComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    PurchaseDetailModalComponent,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Purchases" subtitle="Purchase orders: draft, approve, receive into stock">
      <a *appHasPermission="'purchase.create'" routerLink="/inventory/purchases/new" class="btn btn-primary">
        <i class="bi bi-plus-lg me-1"></i>New Purchase
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
      searchPlaceholder="Search number, supplier or invoice..."
      emptyTitle="No purchases found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
        <select class="form-select form-select-sm w-auto" formControlName="supplierId" aria-label="Supplier">
          <option value="">All suppliers</option>
          @for (s of suppliers(); track s.id) {
            <option [value]="s.id">{{ s.name }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="paymentStatus" aria-label="Payment status">
          <option value="">All payments</option>
          @for (s of paymentStatuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
        <input type="date" class="form-control form-control-sm w-auto" formControlName="from" aria-label="From date" />
        <input type="date" class="form-control form-control-sm w-auto" formControlName="to" aria-label="To date" />
      </div>

      <ng-template appColumn="status" let-row><app-status-badge [status]="row.status" /></ng-template>
      <ng-template appColumn="paymentStatus" let-row><app-status-badge [status]="row.paymentStatus" /></ng-template>
      <ng-template appRowActions let-row>
        <button type="button" class="btn btn-sm btn-outline-primary me-1" (click)="detailId.set(row.id)">
          <i class="bi bi-eye"></i> View
        </button>
        @if (row.status === 'Draft') {
          <button *appHasPermission="'purchase.approve'" type="button" class="btn btn-sm btn-outline-success me-1" (click)="approve(row)">
            <i class="bi bi-check2-circle"></i> Approve
          </button>
        }
        @if (row.status === 'Approved') {
          <button *appHasPermission="'purchase.receive'" type="button" class="btn btn-sm btn-outline-success me-1" (click)="receive(row)">
            <i class="bi bi-box-arrow-in-down"></i> Receive
          </button>
        }
        @if (row.status === 'Draft' || row.status === 'Approved') {
          <button
            *appHasPermission="['purchase.approve', 'purchase.create']"
            type="button"
            class="btn btn-sm btn-outline-danger"
            (click)="openCancel(row)"
          >
            <i class="bi bi-x-circle"></i> Cancel
          </button>
        }
      </ng-template>
    </app-data-table>

    <app-purchase-detail-modal [purchaseId]="detailId()" (closed)="detailId.set(null)" />

    <app-modal [open]="cancelTarget() !== null" title="Cancel purchase" (closed)="closeCancel()">
      <form id="cancelPurchaseForm" [formGroup]="cancelForm" (ngSubmit)="confirmCancel()" novalidate>
        <p class="mb-3">
          Cancel purchase <strong>{{ cancelTarget()?.purchaseNumber }}</strong> from {{ cancelTarget()?.supplierName }}? This cannot be undone.
        </p>
        <app-form-field label="Reason" inputId="cancelReason" [control]="cancelForm.controls.reason">
          <textarea id="cancelReason" rows="3" class="form-control" formControlName="reason" maxlength="250"></textarea>
        </app-form-field>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeCancel()">Keep purchase</button>
        <button type="submit" form="cancelPurchaseForm" class="btn btn-danger" [disabled]="cancelling()">
          @if (cancelling()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Cancel purchase
        </button>
      </div>
    </app-modal>
  `,
})
export class PurchaseListComponent {
  private readonly svc = inject(InventoryService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly statuses = PURCHASE_STATUSES;
  readonly paymentStatuses = PAYMENT_STATUSES;
  readonly suppliers = toSignal(this.lookups.get('suppliers'), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'purchaseNumber', label: 'Number', sortable: true, width: '140px' },
    { key: 'purchaseDate', label: 'Date', type: 'date', sortable: true },
    { key: 'supplierName', label: 'Supplier', sortable: true },
    { key: 'lineCount', label: 'Lines', type: 'number', width: '80px' },
    { key: 'totalAmount', label: 'Total', type: 'currency', sortable: true },
    { key: 'status', label: 'Status', type: 'template', sortable: true },
    { key: 'paymentStatus', label: 'Payment', type: 'template', sortable: true },
  ];

  readonly filters = this.fb.group({ supplierId: [''], status: [''], paymentStatus: [''], from: [''], to: [''] });
  readonly list = new PagedList<Purchase>(
    (q) => this.svc.purchases(q),
    () => {
      const f = this.filters.getRawValue();
      return {
        supplierId: f.supplierId || undefined,
        status: f.status || undefined,
        paymentStatus: f.paymentStatus || undefined,
        from: f.from || undefined,
        to: f.to || undefined,
      };
    },
  );

  readonly detailId = signal<number | null>(null);
  readonly cancelTarget = signal<Purchase | null>(null);
  readonly cancelling = signal(false);
  readonly cancelForm = this.fb.group({ reason: ['', [Validators.required, Validators.maxLength(250)]] });

  constructor() {
    const p = this.route.snapshot.queryParamMap;
    this.filters.patchValue({
      supplierId: qp(p, 'supplierId'),
      status: qp(p, 'status'),
      paymentStatus: qp(p, 'paymentStatus'),
      from: qp(p, 'from'),
      to: qp(p, 'to'),
    });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
    this.list.load();
  }

  async approve(row: Purchase): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Approve purchase',
      message: `Approve purchase ${row.purchaseNumber} (${row.supplierName})?`,
      confirmText: 'Approve',
      variant: 'primary',
    });
    if (!ok) {
      return;
    }
    this.svc.approvePurchase(row.id).subscribe(() => {
      this.toast.success(`Purchase ${row.purchaseNumber} approved.`);
      this.list.load();
    });
  }

  async receive(row: Purchase): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Receive purchase',
      message: `Receive purchase ${row.purchaseNumber}? Batches will be created and stock will increase.`,
      confirmText: 'Receive stock',
      variant: 'primary',
    });
    if (!ok) {
      return;
    }
    this.svc.receivePurchase(row.id).subscribe(() => {
      this.toast.success(`Purchase ${row.purchaseNumber} received into stock.`);
      this.list.load();
    });
  }

  openCancel(row: Purchase): void {
    this.cancelForm.reset({ reason: '' });
    this.cancelTarget.set(row);
  }

  closeCancel(): void {
    if (!this.cancelling()) {
      this.cancelTarget.set(null);
    }
  }

  confirmCancel(): void {
    const target = this.cancelTarget();
    if (!target) {
      return;
    }
    if (this.cancelForm.invalid) {
      this.cancelForm.markAllAsTouched();
      return;
    }
    this.cancelling.set(true);
    this.svc.cancelPurchase(target.id, this.cancelForm.getRawValue().reason.trim()).subscribe({
      next: () => {
        this.cancelling.set(false);
        this.cancelTarget.set(null);
        this.toast.success(`Purchase ${target.purchaseNumber} cancelled.`);
        this.list.load();
      },
      error: () => this.cancelling.set(false),
    });
  }
}
