import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AppCurrencyPipe, AppDatePipe } from '../../../shared/pipes/app-pipes';
import { toIsoDate } from '../../../shared/utils/format';
import { orNull } from '../../../shared/utils/paged-list';
import { positiveNumberValidator } from '../../../shared/validators/app-validators';
import { CustomerPaymentDetail, Invoice } from '../billing.model';
import { BillingService } from '../billing.service';

/**
 * Record a customer payment (allocated to one invoice, or oldest open invoices first) and show the allocation result.
 * Parent keeps `open` and handles (closed); (recorded) fires as soon as the payment is saved (refresh lists there).
 */
@Component({
  selector: 'app-record-payment-modal',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ModalComponent, FormFieldComponent, AppCurrencyPipe, AppDatePipe],
  template: `
    <app-modal [open]="open()" [title]="result() ? 'Payment recorded' : 'Record customer payment'" size="lg" (closed)="close()">
      @if (result(); as r) {
        <div class="alert alert-success d-flex align-items-center gap-2 py-2">
          <i class="bi bi-check-circle-fill fs-5"></i>
          <div>Payment <strong>{{ r.paymentNumber }}</strong> of <strong>{{ r.amount | appCurrency }}</strong> recorded for {{ r.customerName }}.</div>
        </div>
        <div class="row g-3 mb-3 text-center">
          <div class="col-4"><div class="text-muted small">Amount</div><div class="fs-5 fw-semibold">{{ r.amount | appCurrency }}</div></div>
          <div class="col-4"><div class="text-muted small">Allocated to invoices</div><div class="fs-5 fw-semibold text-success">{{ r.allocatedAmount | appCurrency }}</div></div>
          <div class="col-4">
            <div class="text-muted small">Unallocated credit</div>
            <div class="fs-5 fw-semibold" [class.text-warning]="r.unallocatedAmount > 0">{{ r.unallocatedAmount | appCurrency }}</div>
          </div>
        </div>
        @if (r.allocations.length > 0) {
          <div class="table-responsive">
            <table class="table table-sm align-middle app-table">
              <thead>
                <tr><th>Invoice</th><th>Invoice date</th><th class="text-end">Invoice total</th><th class="text-end">Allocated</th></tr>
              </thead>
              <tbody>
                @for (a of r.allocations; track a.id) {
                  <tr>
                    <td><a [routerLink]="['/billing/invoices', a.invoiceId]" (click)="close()" class="text-decoration-none">{{ a.invoiceNumber }}</a></td>
                    <td>{{ a.invoiceDate | appDate }}</td>
                    <td class="text-end">{{ a.invoiceTotal | appCurrency }}</td>
                    <td class="text-end fw-semibold">{{ a.amount | appCurrency }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="text-muted mb-0">No open invoices were settled. The full amount is kept as customer credit.</p>
        }
      } @else {
        <form id="recordPaymentForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <div class="row">
            <div class="col-md-6">
              <app-form-field label="Customer" inputId="rpCustomer" [control]="form.controls.customerId">
                <select id="rpCustomer" class="form-select" formControlName="customerId">
                  <option [ngValue]="null">-- select customer --</option>
                  @for (c of customers(); track c.id) {
                    <option [ngValue]="c.id">{{ c.code }} - {{ c.name }}</option>
                  }
                </select>
              </app-form-field>
            </div>
            <div class="col-md-6">
              <app-form-field label="Invoice" inputId="rpInvoice" [control]="form.controls.invoiceId" hint="Optional. Blank = oldest open invoices are settled first.">
                <select id="rpInvoice" class="form-select" formControlName="invoiceId">
                  <option [ngValue]="null">{{ invoicesLoading() ? 'Loading invoices...' : 'Oldest open invoices first' }}</option>
                  @for (i of openInvoices(); track i.id) {
                    <option [ngValue]="i.id">{{ i.invoiceNumber }} - balance {{ i.balanceAmount | appCurrency }}</option>
                  }
                </select>
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Amount" inputId="rpAmount" [control]="form.controls.amount" [messages]="{ pattern: 'Use at most 2 decimal places.' }">
                <input id="rpAmount" type="number" min="0" step="0.01" class="form-control" formControlName="amount" />
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Payment date" inputId="rpDate" [control]="form.controls.paymentDate">
                <input id="rpDate" type="date" class="form-control" formControlName="paymentDate" [max]="today" />
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Payment mode" inputId="rpMode" [control]="form.controls.paymentModeId">
                <select id="rpMode" class="form-select" formControlName="paymentModeId">
                  <option [ngValue]="null">-- select mode --</option>
                  @for (m of modes(); track m.id) {
                    <option [ngValue]="m.id">{{ m.name }}</option>
                  }
                </select>
              </app-form-field>
            </div>
            <div class="col-md-6">
              <app-form-field label="Reference no." inputId="rpRef" [control]="form.controls.referenceNo" [hint]="refRequired() ? 'Required for this payment mode' : 'Cheque / UPI / transaction reference'">
                <input id="rpRef" class="form-control" formControlName="referenceNo" maxlength="50" autocomplete="off" />
              </app-form-field>
            </div>
            <div class="col-md-6">
              <app-form-field label="Remarks" inputId="rpRemarks" [control]="form.controls.remarks">
                <input id="rpRemarks" class="form-control" formControlName="remarks" maxlength="255" autocomplete="off" />
              </app-form-field>
            </div>
          </div>
        </form>
      }
      <div modal-footer>
        @if (result()) {
          <button type="button" class="btn btn-primary" (click)="close()">Done</button>
        } @else {
          <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
          <button type="submit" form="recordPaymentForm" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm me-1"></span>
            }
            Record payment
          </button>
        }
      </div>
    </app-modal>
  `,
})
export class RecordPaymentModalComponent {
  private readonly svc = inject(BillingService);
  private readonly lookups = inject(LookupService);
  private readonly perm = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = input(false);
  /** preselect (and lock) the customer */
  readonly customerId = input<number | null>(null);
  /** preselect an invoice (its balance becomes the suggested amount) */
  readonly invoiceId = input<number | null>(null);
  readonly closed = output<void>();
  readonly recorded = output<CustomerPaymentDetail>();

  readonly today = toIsoDate();
  readonly customers = toSignal(this.lookups.customers(), { initialValue: [] as LookupItem[] });
  readonly modes = toSignal(this.lookups.paymentModes(), { initialValue: [] as LookupItem[] });
  readonly openInvoices = signal<Invoice[]>([]);
  readonly invoicesLoading = signal(false);
  readonly saving = signal(false);
  readonly result = signal<CustomerPaymentDetail | null>(null);
  readonly refRequired = signal(false);

  readonly form = this.fb.group({
    customerId: this.fb.control<number | null>(null, Validators.required),
    invoiceId: this.fb.control<number | null>(null),
    amount: this.fb.control<number | null>(null, [Validators.required, positiveNumberValidator(), Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
    paymentDate: [toIsoDate(), Validators.required],
    paymentModeId: this.fb.control<number | null>(null, Validators.required),
    referenceNo: ['', Validators.maxLength(50)],
    remarks: ['', Validators.maxLength(255)],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.reset());
      }
    });
    this.form.controls.customerId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => this.loadInvoices(id));
    this.form.controls.invoiceId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      const inv = this.openInvoices().find((i) => i.id === id);
      if (inv) {
        this.form.controls.amount.setValue(inv.balanceAmount);
      }
    });
    this.form.controls.paymentModeId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => this.applyMode(id));
  }

  private reset(): void {
    this.result.set(null);
    this.openInvoices.set([]);
    this.refRequired.set(false);
    this.form.reset({ paymentDate: toIsoDate() });
    this.form.controls.referenceNo.setValidators(Validators.maxLength(50));
    const locked = this.customerId();
    const ctrl = this.form.controls.customerId;
    if (locked) {
      ctrl.setValue(locked);
      ctrl.disable({ emitEvent: false });
    } else {
      ctrl.enable({ emitEvent: false });
      // single customer visible (customer roles): preselect
      const only = this.customers();
      if (only.length === 1) {
        ctrl.setValue(only[0].id);
      }
    }
  }

  private loadInvoices(customerId: number | null): void {
    this.openInvoices.set([]);
    this.form.controls.invoiceId.setValue(null, { emitEvent: false });
    if (!customerId || !this.perm.has('invoice.view')) {
      return;
    }
    this.invoicesLoading.set(true);
    this.svc.customerInvoices(customerId).subscribe({
      next: (res) => {
        this.invoicesLoading.set(false);
        const open = res.items.filter((i) => i.balanceAmount > 0 && i.status !== 'Cancelled' && i.status !== 'Draft');
        this.openInvoices.set(open);
        const preset = this.invoiceId();
        if (preset && open.some((i) => i.id === preset) && this.form.controls.invoiceId.value === null) {
          this.form.controls.invoiceId.setValue(preset);
        }
      },
      error: () => this.invoicesLoading.set(false),
    });
  }

  private applyMode(modeId: number | null): void {
    const mode = this.modes().find((m) => m.id === modeId);
    const required = mode?.['extra'] === 'ReferenceRequired';
    this.refRequired.set(required);
    const ctrl = this.form.controls.referenceNo;
    ctrl.setValidators(required ? [Validators.required, Validators.maxLength(50)] : [Validators.maxLength(50)]);
    ctrl.updateValueAndValidity();
  }

  close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.svc
      .recordPayment({
        customerId: v.customerId!,
        paymentDate: orNull(v.paymentDate),
        amount: Number(v.amount),
        paymentModeId: v.paymentModeId!,
        referenceNo: orNull(v.referenceNo.trim()),
        invoiceId: v.invoiceId,
        remarks: orNull(v.remarks.trim()),
      })
      .subscribe({
        next: (p) => {
          this.saving.set(false);
          this.result.set(p);
          this.toast.success(`Payment ${p.paymentNumber} recorded.`);
          this.recorded.emit(p);
        },
        error: () => this.saving.set(false),
      });
  }
}
