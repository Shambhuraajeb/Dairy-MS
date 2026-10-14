import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { PagedQuery } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppCurrencyPipe, AppDatePipe } from '../../../shared/pipes/app-pipes';
import { FarmerPayment, PAYMENT_STATUSES } from '../models/settlement.model';
import { FarmerPaymentService } from '../services/farmer-payment.service';
import { FarmerSettlementService } from '../services/farmer-settlement.service';
import { PayModalComponent } from './pay-modal.component';
import { PaymentDetailModalComponent } from './payment-detail-modal.component';
import { ReasonModalComponent } from './reason-modal.component';

/** Farmer payments / settlements table with filters and permission-gated approve, pay, cancel actions. */
@Component({
  selector: 'app-payments-list',
  standalone: true,
  imports: [
    ...DATA_TABLE_IMPORTS,
    HasPermissionDirective,
    AppDatePipe,
    AppCurrencyPipe,
    PaymentDetailModalComponent,
    PayModalComponent,
    ReasonModalComponent,
  ],
  template: `
    <app-data-table
      [columns]="columns"
      [items]="items()"
      [total]="total()"
      [loading]="loading()"
      [error]="error()"
      [page]="query.page ?? 1"
      [pageSize]="query.pageSize ?? 20"
      searchPlaceholder="Search payment no. or farmer..."
      emptyTitle="No payments found"
      (queryChange)="onQuery($event)"
      (retry)="load()"
    >
      <div tableFilters class="d-flex flex-wrap gap-2 align-items-center">
        <select class="form-select form-select-sm w-auto" aria-label="Status" (change)="onFilter('status', $event)">
          <option value="" [selected]="!query['status']">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s" [selected]="query['status'] === s">{{ s }}</option>
          }
        </select>
        <input type="date" class="form-control form-control-sm w-auto" aria-label="From" [value]="qs('from')" (change)="onFilter('from', $event)" />
        <input type="date" class="form-control form-control-sm w-auto" aria-label="To" [value]="qs('to')" (change)="onFilter('to', $event)" />
      </div>

      <ng-template appColumn="farmerName" let-row>
        <div>{{ row.farmerName }}</div>
        <div class="text-muted small">{{ row.farmerCode }}</div>
      </ng-template>
      <ng-template appColumn="periodFrom" let-row>
        <span class="text-nowrap">{{ row.periodFrom | appDate }} - {{ row.periodTo | appDate }}</span>
      </ng-template>
      <ng-template appColumn="balanceAmount" let-row>
        <span [class.text-danger]="row.balanceAmount > 0 && row.status !== 'Cancelled'">{{ row.balanceAmount | appCurrency }}</span>
      </ng-template>

      <ng-template appRowActions let-row>
        <button type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="detailId.set(row.id)">
          <i class="bi bi-eye"></i> Details
        </button>
        @if (row.status === 'Draft') {
          <button *appHasPermission="'payment.approve'" type="button" class="btn btn-sm btn-outline-primary me-1" (click)="approve(row)">
            <i class="bi bi-check2"></i> Approve
          </button>
        }
        @if (row.status === 'Approved') {
          <button *appHasPermission="'payment.create'" type="button" class="btn btn-sm btn-success me-1" (click)="payTarget.set(row)">
            <i class="bi bi-cash-coin"></i> Pay
          </button>
        }
        @if ((row.status === 'Draft' || row.status === 'Approved') && row.paidAmount === 0) {
          <button *appHasPermission="'payment.approve'" type="button" class="btn btn-sm btn-outline-danger" (click)="cancelTarget.set(row)">
            Cancel
          </button>
        }
      </ng-template>
    </app-data-table>

    <app-payment-detail-modal [paymentId]="detailId()" (closed)="detailId.set(null)" />
    <app-pay-modal
      [payment]="payTarget()"
      (closed)="payTarget.set(null)"
      (saved)="payTarget.set(null); afterChange()"
    />
    <app-reason-modal
      [open]="cancelTarget() !== null"
      title="Cancel settlement"
      [message]="'Cancel ' + (cancelTarget()?.paymentNumber ?? '') + '? Its collections are released and become payable again.'"
      label="Reason for cancellation"
      confirmText="Cancel settlement"
      [saving]="cancelling()"
      (confirmed)="cancel($event)"
      (closed)="cancelTarget.set(null)"
    />
  `,
})
export class PaymentsListComponent implements OnInit {
  private readonly svc = inject(FarmerPaymentService);
  private readonly settlements = inject(FarmerSettlementService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly initialStatus = input<string | null | undefined>(null);
  readonly initialFrom = input<string | null | undefined>(null);
  readonly initialTo = input<string | null | undefined>(null);
  readonly initialFarmerId = input<number | null | undefined>(null);
  /** emitted after approve / pay / cancel so a parent can refresh related data */
  readonly changed = output<void>();

  protected readonly statuses = PAYMENT_STATUSES;
  protected readonly columns: TableColumn[] = [
    { key: 'paymentNumber', label: 'Payment no.', sortable: true },
    { key: 'farmerName', label: 'Farmer', sortable: true },
    { key: 'periodFrom', label: 'Period' },
    { key: 'paymentDate', label: 'Date', type: 'date', sortable: true },
    { key: 'grossAmount', label: 'Gross', type: 'currency', sortable: true },
    { key: 'deductionAmount', label: 'Deductions', type: 'currency', sortable: true },
    { key: 'netPayable', label: 'Net payable', type: 'currency', sortable: true },
    { key: 'paidAmount', label: 'Paid', type: 'currency', sortable: true },
    { key: 'balanceAmount', label: 'Balance', type: 'currency', sortable: true },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
  ];

  protected readonly items = signal<FarmerPayment[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected query: PagedQuery = { page: 1, pageSize: 20 };

  protected readonly detailId = signal<number | null>(null);
  protected readonly payTarget = signal<FarmerPayment | null>(null);
  protected readonly cancelTarget = signal<FarmerPayment | null>(null);
  protected readonly cancelling = signal(false);

  ngOnInit(): void {
    this.query = {
      ...this.query,
      status: this.initialStatus() ?? undefined,
      from: this.initialFrom() ?? undefined,
      to: this.initialTo() ?? undefined,
      farmerId: this.initialFarmerId() ?? undefined,
    };
    this.load();
  }

  /** set the status filter from outside and reload */
  setStatus(status: string | null): void {
    this.query = { ...this.query, status: status ?? undefined, page: 1 };
    this.load();
  }

  reload(): void {
    this.load();
  }

  protected onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  protected onFilter(key: 'status' | 'from' | 'to', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    const next: PagedQuery = { ...this.query, page: 1 };
    next[key] = value || undefined;
    this.query = next;
    this.load();
  }

  protected qs(key: string): string {
    const v = this.query[key];
    return v === undefined || v === null ? '' : String(v);
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.list(this.query).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected afterChange(): void {
    this.load();
    this.changed.emit();
  }

  protected async approve(p: FarmerPayment): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Approve settlement',
      message: `Approve ${p.paymentNumber} for ${p.farmerName}? Net payable is ${p.netPayable}.`,
      confirmText: 'Approve',
    });
    if (!ok) {
      return;
    }
    this.settlements.approve(p.id).subscribe(() => {
      this.toast.success(`${p.paymentNumber} approved.`);
      if (this.query['status'] === 'Draft') {
        this.query = { ...this.query, status: 'Approved', page: 1 };
      }
      this.afterChange();
    });
  }

  protected cancel(reason: string): void {
    const p = this.cancelTarget();
    if (!p) {
      return;
    }
    this.cancelling.set(true);
    this.settlements.cancel(p.id, reason).subscribe({
      next: (res) => {
        this.cancelling.set(false);
        this.cancelTarget.set(null);
        this.toast.success(`${p.paymentNumber} cancelled. ${res.releasedCollections} collections released.`);
        this.afterChange();
      },
      error: () => this.cancelling.set(false),
    });
  }
}
