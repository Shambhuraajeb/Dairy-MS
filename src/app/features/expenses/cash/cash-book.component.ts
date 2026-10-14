import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AppCurrencyPipe } from '../../../shared/pipes/app-pipes';
import { toIsoDate } from '../../../shared/utils/format';
import { PagedList, qp } from '../../../shared/utils/paged-list';
import { CashSummary, CashTransaction } from '../expense.model';
import { ExpenseService } from '../expense.service';

@Component({
  selector: 'app-cash-book',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, KpiCardComponent, AppCurrencyPipe, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Cash Book" subtitle="Cash in and out, with running balance" />

    <div class="row g-3 mb-3">
      <div class="col-6 col-lg"><app-kpi-card title="Opening balance" [value]="summary()?.openingBalance" format="currency" icon="bi-wallet2" color="secondary" [loading]="summaryLoading()" /></div>
      <div class="col-6 col-lg"><app-kpi-card title="Total in" [value]="summary()?.totalIn" format="currency" icon="bi-arrow-down-circle" color="success" [loading]="summaryLoading()" /></div>
      <div class="col-6 col-lg"><app-kpi-card title="Total out" [value]="summary()?.totalOut" format="currency" icon="bi-arrow-up-circle" color="danger" [loading]="summaryLoading()" /></div>
      <div class="col-6 col-lg">
        <app-kpi-card
          title="Net change"
          [value]="summary()?.netChange"
          format="currency"
          icon="bi-graph-up-arrow"
          [color]="(summary()?.netChange ?? 0) >= 0 ? 'info' : 'warning'"
          [subtitle]="(summary()?.transactionCount ?? 0) + ' transactions'"
          [loading]="summaryLoading()"
        />
      </div>
      <div class="col-6 col-lg"><app-kpi-card title="Closing balance" [value]="summary()?.closingBalance" format="currency" icon="bi-safe" color="primary" [loading]="summaryLoading()" /></div>
    </div>
    @if (summaryError()) {
      <div class="alert alert-danger py-2">{{ summaryError() }} <button type="button" class="btn btn-sm btn-link" (click)="loadSummary()">Retry</button></div>
    }

    <div class="row g-3">
      <div [class]="(summary()?.byCategory?.length ?? 0) > 0 ? 'col-xl-9' : 'col-12'">
        <app-data-table
          [columns]="columns"
          [items]="list.items()"
          [total]="list.total()"
          [loading]="list.loading()"
          [error]="list.error()"
          [page]="list.query.page ?? 1"
          [pageSize]="list.query.pageSize ?? 20"
          searchPlaceholder="Search remarks or category..."
          emptyTitle="No cash transactions found"
          (queryChange)="list.onQuery($event)"
          (retry)="list.load()"
        >
          <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
            <input type="date" class="form-control form-control-sm w-auto" formControlName="from" aria-label="From date" />
            <input type="date" class="form-control form-control-sm w-auto" formControlName="to" aria-label="To date" />
            <select class="form-select form-select-sm w-auto" formControlName="type" aria-label="Type">
              <option value="">In and out</option>
              <option value="In">Cash in</option>
              <option value="Out">Cash out</option>
            </select>
            <select class="form-select form-select-sm w-auto" formControlName="category" aria-label="Category">
              <option value="">All categories</option>
              @for (c of summary()?.byCategory ?? []; track c.category) {
                <option [value]="c.category">{{ c.category }}</option>
              }
            </select>
            <select class="form-select form-select-sm w-auto" formControlName="paymentModeId" aria-label="Payment mode">
              <option value="">All payment modes</option>
              @for (m of paymentModes(); track m.id) {
                <option [value]="m.id">{{ m.name }}</option>
              }
            </select>
          </div>
          <ng-template appColumn="transactionType" let-row>
            <span class="badge badge-soft" [class.badge-soft-success]="row.transactionType === 'In'" [class.badge-soft-danger]="row.transactionType === 'Out'">
              {{ row.transactionType === 'In' ? 'Cash in' : 'Cash out' }}
            </span>
          </ng-template>
          <ng-template appColumn="amount" let-row>
            <span class="fw-semibold" [class.text-success]="row.transactionType === 'In'" [class.text-danger]="row.transactionType === 'Out'">
              {{ row.transactionType === 'In' ? '+' : '-' }}{{ row.amount | appCurrency }}
            </span>
          </ng-template>
          <ng-template appColumn="reference" let-row>
            @if (row.referenceType) {
              {{ row.referenceType }}{{ row.referenceId ? ' #' + row.referenceId : '' }}
            } @else {
              —
            }
          </ng-template>
        </app-data-table>
      </div>
      @if ((summary()?.byCategory?.length ?? 0) > 0) {
        <div class="col-xl-3">
          <div class="card">
            <div class="card-body">
              <div class="section-title">By category</div>
              <table class="table table-sm mb-0">
                <thead><tr><th>Category</th><th class="text-end">In</th><th class="text-end">Out</th></tr></thead>
                <tbody>
                  @for (c of summary()?.byCategory ?? []; track c.category) {
                    <tr>
                      <td>{{ c.category }}</td>
                      <td class="text-end text-success">{{ c.totalIn | appCurrency: 'INR' : 0 }}</td>
                      <td class="text-end text-danger">{{ c.totalOut | appCurrency: 'INR' : 0 }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class CashBookComponent {
  private readonly svc = inject(ExpenseService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly paymentModes = toSignal(this.lookups.paymentModes(), { initialValue: [] as LookupItem[] });
  readonly summary = signal<CashSummary | null>(null);
  readonly summaryLoading = signal(false);
  readonly summaryError = signal<string | null>(null);

  readonly columns: TableColumn[] = [
    { key: 'transactionDate', label: 'Date', type: 'datetime', sortable: true },
    { key: 'transactionType', label: 'Type', type: 'template', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'amount', label: 'Amount', type: 'template', sortable: true, align: 'end' },
    { key: 'balanceAfter', label: 'Balance', type: 'currency', sortable: true },
    { key: 'paymentModeName', label: 'Mode' },
    { key: 'reference', label: 'Reference', type: 'template' },
    { key: 'remarks', label: 'Remarks' },
    { key: 'createdByName', label: 'By' },
  ];

  readonly filters = this.fb.group({ from: [''], to: [''], type: [''], category: [''], paymentModeId: [''] });
  readonly list = new PagedList<CashTransaction>(
    (q) => this.svc.cashTransactions(q),
    () => {
      const f = this.filters.getRawValue();
      return {
        from: f.from || undefined,
        to: f.to || undefined,
        type: f.type || undefined,
        category: f.category || undefined,
        paymentModeId: f.paymentModeId || undefined,
      };
    },
  );

  constructor() {
    const p = this.route.snapshot.queryParamMap;
    const now = new Date();
    this.filters.patchValue({
      from: p.has('from') ? qp(p, 'from') : toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: p.has('to') ? qp(p, 'to') : toIsoDate(now),
      type: qp(p, 'type'),
      category: qp(p, 'category'),
      paymentModeId: qp(p, 'paymentModeId'),
    });
    let lastRange = this.rangeKey();
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.list.refilter();
      const key = this.rangeKey();
      if (key !== lastRange) {
        lastRange = key;
        this.loadSummary();
      }
    });
    this.list.load();
    this.loadSummary();
  }

  private rangeKey(): string {
    const f = this.filters.getRawValue();
    return `${f.from}|${f.to}`;
  }

  loadSummary(): void {
    const f = this.filters.getRawValue();
    this.summaryLoading.set(true);
    this.summaryError.set(null);
    this.svc.cashSummary(f.from || null, f.to || null).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.summaryLoading.set(false);
      },
      error: (e) => {
        this.summaryError.set(errorMessage(e));
        this.summaryLoading.set(false);
      },
    });
  }
}
