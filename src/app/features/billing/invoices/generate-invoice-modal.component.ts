import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AppCurrencyPipe, AppDatePipe } from '../../../shared/pipes/app-pipes';
import { toIsoDate } from '../../../shared/utils/format';
import { orNull } from '../../../shared/utils/paged-list';
import { dateRangeValidator } from '../../../shared/validators/app-validators';
import { BillableOrder, InvoiceDetail } from '../billing.model';
import { BillingService } from '../billing.service';

function monthStart(): string {
  const d = new Date();
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

@Component({
  selector: 'app-generate-invoice-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent, AppCurrencyPipe, AppDatePipe],
  template: `
    <app-modal [open]="open()" title="Generate invoice" size="lg" (closed)="close()">
      <form id="generateInvoiceForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <p class="text-muted small">Bills delivered orders that are not invoiced yet. More than one order creates a consolidated invoice; the due date follows the customer's credit days.</p>
        <app-form-field label="Customer" inputId="giCustomer" [control]="form.controls.customerId">
          <select id="giCustomer" class="form-select" formControlName="customerId">
            <option [ngValue]="null">-- select customer --</option>
            @for (c of customers(); track c.id) {
              <option [ngValue]="c.id">{{ c.code }} - {{ c.name }}</option>
            }
          </select>
        </app-form-field>
        <div class="row">
          <div class="col-md-6">
            <app-form-field label="Period from" inputId="giFrom" [control]="form.controls.periodFrom" [required]="!form.controls.pickOrders.value">
              <input id="giFrom" type="date" class="form-control" formControlName="periodFrom" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Period to" inputId="giTo" [control]="form.controls.periodTo" [required]="!form.controls.pickOrders.value">
              <input id="giTo" type="date" class="form-control" formControlName="periodTo" [min]="form.controls.periodFrom.value" />
            </app-form-field>
          </div>
        </div>
        @if (form.hasError('dateRange')) {
          <div class="invalid-feedback d-block mb-3">Period end cannot be before the start.</div>
        }

        @if (canPickOrders()) {
          <div class="form-check form-switch mb-3">
            <input id="giPick" type="checkbox" class="form-check-input" formControlName="pickOrders" />
            <label class="form-check-label" for="giPick">Select specific delivered orders</label>
          </div>
        }

        @if (form.controls.pickOrders.value) {
          @if (!form.controls.customerId.value) {
            <div class="alert alert-info py-2 small">Select a customer to list their delivered orders.</div>
          } @else if (ordersLoading()) {
            <div class="text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Loading orders...</div>
          } @else if (ordersError()) {
            <div class="alert alert-danger py-2 small">{{ ordersError() }}</div>
          } @else if (orders().length === 0) {
            <div class="alert alert-warning py-2 small">No delivered, un-invoiced orders found for this customer and period.</div>
          } @else {
            <div class="table-responsive border rounded" style="max-height: 280px; overflow-y: auto">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th style="width: 40px">
                      <input type="checkbox" class="form-check-input" [checked]="allSelected()" (change)="toggleAll($event)" aria-label="Select all orders" />
                    </th>
                    <th>Order</th>
                    <th>Delivery date</th>
                    <th>Slot</th>
                    <th class="text-end">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  @for (o of orders(); track o.id) {
                    <tr>
                      <td>
                        <input type="checkbox" class="form-check-input" [checked]="selected().has(o.id)" (change)="toggle(o.id)" [attr.aria-label]="'Select ' + o.orderNumber" />
                      </td>
                      <td>{{ o.orderNumber }}</td>
                      <td>{{ o.deliveryDate | appDate }}</td>
                      <td>{{ o.deliverySlot }}</td>
                      <td class="text-end">{{ o.totalAmount | appCurrency }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="d-flex justify-content-between small mt-2">
              <span class="text-muted">{{ selected().size }} of {{ orders().length }} selected</span>
              <span class="fw-semibold">{{ selectedTotal() | appCurrency }}</span>
            </div>
            @if (selectionInvalid()) {
              <div class="invalid-feedback d-block">Select at least one order.</div>
            }
          }
        }
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="generateInvoiceForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Generate invoice
        </button>
      </div>
    </app-modal>
  `,
})
export class GenerateInvoiceModalComponent {
  private readonly svc = inject(BillingService);
  private readonly lookups = inject(LookupService);
  private readonly perm = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = input(false);
  /** preselect the customer */
  readonly customerId = input<number | null>(null);
  readonly closed = output<void>();
  readonly generated = output<InvoiceDetail>();

  readonly customers = toSignal(this.lookups.customers(), { initialValue: [] as LookupItem[] });
  readonly canPickOrders = computed(() => this.perm.has('order.view'));

  readonly orders = signal<BillableOrder[]>([]);
  readonly ordersLoading = signal(false);
  readonly ordersError = signal<string | null>(null);
  readonly selected = signal<ReadonlySet<number>>(new Set<number>());
  readonly selectionInvalid = signal(false);
  readonly saving = signal(false);

  readonly allSelected = computed(() => this.orders().length > 0 && this.selected().size === this.orders().length);
  readonly selectedTotal = computed(() =>
    this.orders()
      .filter((o) => this.selected().has(o.id))
      .reduce((sum, o) => sum + o.totalAmount, 0),
  );

  readonly form = this.fb.group(
    {
      customerId: this.fb.control<number | null>(null, Validators.required),
      periodFrom: [monthStart()],
      periodTo: [toIsoDate()],
      pickOrders: [false],
    },
    { validators: dateRangeValidator('periodFrom', 'periodTo') },
  );

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.reset());
      }
    });
    const reload = () => this.loadOrders();
    this.form.controls.customerId.valueChanges.pipe(takeUntilDestroyed()).subscribe(reload);
    this.form.controls.periodFrom.valueChanges.pipe(takeUntilDestroyed()).subscribe(reload);
    this.form.controls.periodTo.valueChanges.pipe(takeUntilDestroyed()).subscribe(reload);
    this.form.controls.pickOrders.valueChanges.pipe(takeUntilDestroyed()).subscribe(reload);
  }

  private reset(): void {
    this.orders.set([]);
    this.selected.set(new Set<number>());
    this.selectionInvalid.set(false);
    this.ordersError.set(null);
    this.form.reset({ customerId: this.customerId(), periodFrom: monthStart(), periodTo: toIsoDate(), pickOrders: false });
    if (!this.customerId() && this.customers().length === 1) {
      this.form.controls.customerId.setValue(this.customers()[0].id);
    }
  }

  private loadOrders(): void {
    const v = this.form.getRawValue();
    this.orders.set([]);
    this.selected.set(new Set<number>());
    this.ordersError.set(null);
    if (!v.pickOrders || !v.customerId) {
      return;
    }
    this.ordersLoading.set(true);
    this.svc.deliveredOrders(v.customerId, orNull(v.periodFrom), orNull(v.periodTo)).subscribe({
      next: (res) => {
        const billable = res.items.filter((o) => !o.invoiceId);
        this.orders.set(billable);
        this.selected.set(new Set(billable.map((o) => o.id)));
        this.ordersLoading.set(false);
      },
      error: (err) => {
        this.ordersError.set(errorMessage(err));
        this.ordersLoading.set(false);
      },
    });
  }

  toggle(id: number): void {
    const next = new Set(this.selected());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selected.set(next);
    this.selectionInvalid.set(false);
  }

  toggleAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selected.set(checked ? new Set(this.orders().map((o) => o.id)) : new Set<number>());
    this.selectionInvalid.set(false);
  }

  close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  save(): void {
    const v = this.form.getRawValue();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    let salesOrderIds: number[] | null = null;
    if (v.pickOrders) {
      if (this.selected().size === 0) {
        this.selectionInvalid.set(true);
        return;
      }
      salesOrderIds = [...this.selected()];
    } else if (!v.periodFrom || !v.periodTo) {
      this.form.controls.periodFrom.markAsTouched();
      this.form.controls.periodTo.markAsTouched();
      if (!v.periodFrom) {
        this.form.controls.periodFrom.setErrors({ required: true });
      }
      if (!v.periodTo) {
        this.form.controls.periodTo.setErrors({ required: true });
      }
      return;
    }
    this.saving.set(true);
    this.svc
      .generateInvoice({
        customerId: v.customerId!,
        periodFrom: orNull(v.periodFrom),
        periodTo: orNull(v.periodTo),
        salesOrderIds,
      })
      .subscribe({
        next: (inv) => {
          this.saving.set(false);
          this.toast.success(`Invoice ${inv.invoiceNumber} generated.`);
          this.generated.emit(inv);
        },
        error: () => this.saving.set(false),
      });
  }
}
