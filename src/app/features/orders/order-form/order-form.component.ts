import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AppCurrencyPipe, AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { toIsoDate } from '../../../shared/utils/format';
import { SearchSelectComponent } from '../../collection/components/search-select.component';
import { ProductService } from '../../products/product.service';
import {
  CreateOrderRequest,
  CustomerAddressLite,
  CustomerLite,
  ORDER_SLOTS,
  OrderSlot,
  addressLabel,
} from '../order.model';
import { OrderService } from '../order.service';

@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    FormFieldComponent,
    SearchSelectComponent,
    AppCurrencyPipe,
    AppNumberPipe,
  ],
  template: `
    <app-page-header title="New Order" subtitle="Create a sales order for delivery">
      <a routerLink="/orders" class="btn btn-outline-secondary"><i class="bi bi-arrow-left me-1"></i>Back to orders</a>
    </app-page-header>

    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="row g-3">
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-body">
              <div class="section-title mb-3">Customer &amp; delivery</div>

              <app-form-field label="Customer" inputId="ordCustomer" [control]="form.controls.customerId">
                <app-search-select
                  inputId="ordCustomer"
                  placeholder="Search customer by code or name..."
                  [options]="customers()"
                  [value]="form.controls.customerId.value"
                  [invalid]="form.controls.customerId.invalid && form.controls.customerId.touched"
                  (valueChange)="setCustomer($event)"
                />
              </app-form-field>

              @if (customerInfo(); as c) {
                <div class="small text-muted mb-3">
                  {{ c.customerType }} customer
                  @if (c.mobile) {
                    &middot; {{ c.mobile }}
                  }
                  <br />
                  Credit limit {{ c.creditLimit | appCurrency }} &middot; Outstanding {{ c.outstandingBalance | appCurrency }}
                </div>
              }

              <app-form-field label="Delivery address" inputId="ordAddress" [control]="form.controls.customerAddressId">
                <select id="ordAddress" class="form-select" formControlName="customerAddressId">
                  <option [ngValue]="null">Default address</option>
                  @for (a of addresses(); track a.id) {
                    <option [ngValue]="a.id">{{ label(a) }}</option>
                  }
                </select>
              </app-form-field>

              <div class="row">
                <div class="col-7">
                  <app-form-field label="Delivery date" inputId="ordDate" [control]="form.controls.deliveryDate" [messages]="{ min: 'Delivery date cannot be in the past.' }">
                    <input id="ordDate" type="date" class="form-control" formControlName="deliveryDate" [min]="today" />
                  </app-form-field>
                </div>
                <div class="col-5">
                  <app-form-field label="Slot" inputId="ordSlot" [control]="form.controls.deliverySlot">
                    <select id="ordSlot" class="form-select" formControlName="deliverySlot">
                      @for (s of slots; track s) {
                        <option [value]="s">{{ s }}</option>
                      }
                    </select>
                  </app-form-field>
                </div>
              </div>

              <app-form-field label="Remarks" inputId="ordRemarks" [control]="form.controls.remarks">
                <textarea id="ordRemarks" class="form-control" rows="2" maxlength="500" formControlName="remarks"></textarea>
              </app-form-field>
            </div>
          </div>
        </div>

        <div class="col-lg-8">
          <div class="card h-100">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <div class="section-title mb-0">Items</div>
                <button type="button" class="btn btn-sm btn-outline-primary" (click)="addLine()">
                  <i class="bi bi-plus-lg me-1"></i>Add item
                </button>
              </div>

              <div class="table-responsive">
                <table class="table align-middle app-table">
                  <thead>
                    <tr>
                      <th style="min-width: 240px">Product</th>
                      <th style="width: 130px">Quantity</th>
                      <th style="width: 140px" class="text-end">Unit price</th>
                      <th style="width: 70px" class="text-end">Tax %</th>
                      <th style="width: 130px" class="text-end">Amount</th>
                      <th style="width: 44px"></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (g of lines.controls; track g; let i = $index) {
                      <tr [formGroup]="g">
                        <td>
                          <app-search-select
                            placeholder="Search product..."
                            [options]="products()"
                            [value]="g.controls.productId.value"
                            [invalid]="g.controls.productId.invalid && g.controls.productId.touched"
                            (valueChange)="onProduct(g, $event)"
                          />
                          @if (g.controls.priceSource.value) {
                            <div class="form-text">{{ g.controls.priceSource.value === 'PriceList' ? 'Price list' : 'Default price' }}</div>
                          }
                        </td>
                        <td>
                          <div class="input-group">
                            <input
                              type="number"
                              class="form-control"
                              formControlName="quantity"
                              min="0"
                              step="0.001"
                              [class.is-invalid]="g.controls.quantity.invalid && g.controls.quantity.touched"
                              aria-label="Quantity"
                            />
                            @if (g.controls.unitCode.value) {
                              <span class="input-group-text">{{ g.controls.unitCode.value }}</span>
                            }
                          </div>
                        </td>
                        <td>
                          <input
                            type="number"
                            class="form-control text-end"
                            formControlName="unitPrice"
                            min="0"
                            step="0.01"
                            [readOnly]="!canEditPrice"
                            [class.is-invalid]="g.controls.unitPrice.invalid && g.controls.unitPrice.touched"
                            aria-label="Unit price"
                          />
                        </td>
                        <td class="text-end">{{ g.controls.taxPercent.value | appNumber }}</td>
                        <td class="text-end fw-semibold">{{ lineAmount(g) | appCurrency }}</td>
                        <td class="text-end">
                          <button type="button" class="btn btn-sm btn-outline-danger" (click)="removeLine(i)" [disabled]="lines.length === 1" aria-label="Remove item">
                            <i class="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <div class="row justify-content-end">
                <div class="col-md-5">
                  <div class="d-flex justify-content-between"><span class="text-muted">Subtotal</span><span>{{ totals().sub | appCurrency }}</span></div>
                  <div class="d-flex justify-content-between"><span class="text-muted">Tax</span><span>{{ totals().tax | appCurrency }}</span></div>
                  <hr class="my-2" />
                  <div class="d-flex justify-content-between fs-5 fw-semibold"><span>Total</span><span>{{ totals().total | appCurrency }}</span></div>
                  <div class="form-text text-end">Estimate. Final amount (discounts, charges) is calculated on save.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="d-flex justify-content-end gap-2 mt-3">
        <a routerLink="/orders" class="btn btn-light">Cancel</a>
        <button type="submit" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Place Order
        </button>
      </div>
    </form>
  `,
})
export class OrderFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(OrderService);
  private readonly productSvc = inject(ProductService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly perm = inject(PermissionService);

  /** optional ?customerId= preset */
  readonly customerId = input<string>();

  readonly today = toIsoDate();
  readonly slots = ORDER_SLOTS;
  readonly canEditPrice = this.perm.has('order.update');
  readonly customers = toSignal(this.lookups.customers(), { initialValue: [] as LookupItem[] });
  readonly products = toSignal(this.lookups.products(), { initialValue: [] as LookupItem[] });

  readonly addresses = signal<CustomerAddressLite[]>([]);
  readonly customerInfo = signal<CustomerLite | null>(null);
  readonly saving = signal(false);
  readonly totals = signal({ sub: 0, tax: 0, total: 0 });
  private readonly customerType = computed(() => this.customerInfo()?.customerType ?? 'Retail');

  readonly lines = this.fb.array([this.newLine()], Validators.minLength(1));
  readonly form = this.fb.group({
    customerId: this.fb.control<number | null>(null, Validators.required),
    customerAddressId: this.fb.control<number | null>(null),
    deliveryDate: [
      this.today,
      [Validators.required, (c: AbstractControl): ValidationErrors | null => (c.value && String(c.value) < this.today ? { min: { min: this.today } } : null)],
    ],
    deliverySlot: ['Morning' as OrderSlot, Validators.required],
    remarks: ['', Validators.maxLength(500)],
    lines: this.lines,
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.recalc());
    this.form.controls.deliveryDate.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.refreshPrices(true));
  }

  ngOnInit(): void {
    this.lookups.customers().subscribe((list) => {
      const preset = Number(this.customerId());
      if (preset && list.some((c) => c.id === preset)) {
        this.setCustomer(preset);
      } else if (list.length === 1 && this.form.controls.customerId.value === null) {
        this.setCustomer(list[0].id);
      }
    });
  }

  newLine() {
    return this.fb.group({
      productId: this.fb.control<number | null>(null, Validators.required),
      unitCode: [''],
      quantity: [1, [Validators.required, Validators.min(0.001)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      taxPercent: [0],
      priceSource: [''],
    });
  }

  label(a: CustomerAddressLite): string {
    return addressLabel(a);
  }

  addLine(): void {
    this.lines.push(this.newLine());
  }

  removeLine(index: number): void {
    if (this.lines.length > 1) {
      this.lines.removeAt(index);
    }
  }

  lineAmount(g: ReturnType<OrderFormComponent['newLine']>): number {
    return (Number(g.controls.quantity.value) || 0) * (Number(g.controls.unitPrice.value) || 0);
  }

  setCustomer(id: number | null): void {
    this.form.controls.customerId.setValue(id);
    this.form.controls.customerId.markAsTouched();
    this.form.controls.customerAddressId.setValue(null);
    this.addresses.set([]);
    this.customerInfo.set(null);
    if (id === null) {
      return;
    }
    this.svc.customerAddresses(id).subscribe({
      next: (list) => {
        if (this.form.controls.customerId.value !== id) {
          return;
        }
        this.addresses.set(list);
        const def = list.find((a) => a.isDefault);
        if (def) {
          this.form.controls.customerAddressId.setValue(def.id);
        }
      },
      error: () => this.addresses.set([]),
    });
    this.svc.customer(id).subscribe({
      next: (c) => {
        if (this.form.controls.customerId.value === id) {
          this.customerInfo.set(c);
          this.refreshPrices(true);
        }
      },
      error: () => this.customerInfo.set(null),
    });
  }

  onProduct(g: ReturnType<OrderFormComponent['newLine']>, productId: number | null): void {
    g.controls.productId.setValue(productId);
    g.controls.productId.markAsTouched();
    g.controls.unitPrice.markAsPristine();
    g.controls.priceSource.setValue('');
    g.controls.unitCode.setValue('');
    if (productId === null) {
      return;
    }
    const lookup = this.products().find((p) => p.id === productId);
    const unit = lookup?.['extra'];
    g.controls.unitCode.setValue(typeof unit === 'string' ? unit : '');
    this.fetchPrice(g);
  }

  private refreshPrices(onlyAuto: boolean): void {
    for (const g of this.lines.controls) {
      if (g.controls.productId.value !== null && (!onlyAuto || !g.controls.unitPrice.dirty)) {
        this.fetchPrice(g);
      }
    }
  }

  private fetchPrice(g: ReturnType<OrderFormComponent['newLine']>): void {
    const productId = g.controls.productId.value;
    if (productId === null) {
      return;
    }
    const date = this.form.controls.deliveryDate.value || this.today;
    this.productSvc.priceFor(productId, this.customerType(), date).subscribe({
      next: (info) => {
        if (g.controls.productId.value !== productId) {
          return;
        }
        g.controls.unitPrice.setValue(Number(info.price));
        g.controls.taxPercent.setValue(Number(info.taxPercent) || 0);
        g.controls.priceSource.setValue(info.source);
        g.controls.unitPrice.markAsPristine();
      },
      error: () => this.toast.warning('Could not fetch the price for the selected product. Enter it manually if allowed.'),
    });
  }

  private recalc(): void {
    let sub = 0;
    let tax = 0;
    for (const g of this.lines.controls) {
      const amount = this.lineAmount(g);
      sub += amount;
      tax += (amount * (Number(g.controls.taxPercent.value) || 0)) / 100;
    }
    this.totals.set({ sub, tax, total: sub + tax });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please complete the highlighted fields.');
      return;
    }
    const v = this.form.getRawValue();
    const body: CreateOrderRequest = {
      customerId: v.customerId,
      customerAddressId: v.customerAddressId,
      deliveryDate: v.deliveryDate,
      deliverySlot: v.deliverySlot,
      remarks: v.remarks.trim() || null,
      items: this.lines.controls.map((g) => ({
        productId: Number(g.controls.productId.value),
        quantity: Number(g.controls.quantity.value),
        unitPrice: this.canEditPrice && g.controls.unitPrice.dirty ? Number(g.controls.unitPrice.value) : null,
      })),
    };
    this.saving.set(true);
    this.svc.create(body).subscribe({
      next: (order) => {
        this.saving.set(false);
        this.toast.success(`Order ${order.orderNumber} created.`);
        void this.router.navigate(['/orders', order.id]);
      },
      error: () => this.saving.set(false),
    });
  }
}
