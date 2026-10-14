import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AppCurrencyPipe } from '../../../shared/pipes/app-pipes';
import { dateRangeValidator, positiveNumberValidator } from '../../../shared/validators/app-validators';
import { toIsoDate } from '../../../shared/utils/format';
import { orNull } from '../../../shared/utils/paged-list';
import { CustomerAddress, addressLine } from '../../customers/customer.model';
import { CustomerService } from '../../customers/customer.service';
import { SLOTS, SubscriptionPlan } from '../subscription.model';
import { SubscriptionService } from '../subscription.service';

@Component({
  selector: 'app-subscription-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, FormFieldComponent, AppCurrencyPipe],
  template: `
    <app-page-header title="New Subscription" subtitle="Customer, delivery address, plan, product and schedule">
      <a routerLink="/subscriptions" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>Back</a>
    </app-page-header>

    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="row g-3">
        <div class="col-lg-7">
          <div class="card h-100">
            <div class="card-body">
              <h2 class="section-title">Customer &amp; delivery address</h2>
              <app-form-field label="Customer" inputId="sCustomer" [control]="form.controls.customerId">
                <select id="sCustomer" class="form-select" formControlName="customerId">
                  <option [ngValue]="null">-- select customer --</option>
                  @for (c of customers(); track c.id) {
                    <option [ngValue]="c.id">{{ c.code }} - {{ c.name }}</option>
                  }
                </select>
              </app-form-field>

              <app-form-field label="Delivery address" inputId="sAddress" [control]="form.controls.customerAddressId">
                <select id="sAddress" class="form-select" formControlName="customerAddressId">
                  <option [ngValue]="null">
                    {{ !form.controls.customerId.value ? '-- select a customer first --' : addressesLoading() ? 'Loading addresses...' : '-- select address --' }}
                  </option>
                  @for (a of addresses(); track a.id) {
                    <option [ngValue]="a.id">{{ a.addressType }}: {{ addressText(a) }}{{ a.isDefault ? ' (default)' : '' }}</option>
                  }
                </select>
              </app-form-field>
              @if (form.controls.customerId.value && !addressesLoading() && addresses().length === 0) {
                <div class="alert alert-warning py-2 small">
                  {{ addressError() || 'This customer has no delivery address yet.' }}
                  <a [routerLink]="['/customers', form.controls.customerId.value]">Add an address</a> first.
                </div>
              }

              <h2 class="section-title mt-3">Plan &amp; product</h2>
              <app-form-field label="Plan" inputId="sPlan" [control]="form.controls.subscriptionPlanId">
                <select id="sPlan" class="form-select" formControlName="subscriptionPlanId">
                  <option [ngValue]="null">-- select plan --</option>
                  @for (p of plans(); track p.id) {
                    <option [ngValue]="p.id">{{ p.planCode }} - {{ p.name }} ({{ p.frequency }})</option>
                  }
                </select>
              </app-form-field>
              <div class="row">
                <div class="col-md-8">
                  <app-form-field label="Product" inputId="sProduct" [control]="form.controls.productId">
                    <select id="sProduct" class="form-select" formControlName="productId">
                      <option [ngValue]="null">-- select product --</option>
                      @for (p of products(); track p.id) {
                        <option [ngValue]="p.id">{{ productLabel(p) }}</option>
                      }
                    </select>
                  </app-form-field>
                </div>
                <div class="col-md-4">
                  <app-form-field label="Quantity per delivery" inputId="sQty" [control]="form.controls.quantity">
                    <input id="sQty" type="number" min="0" step="0.5" class="form-control" formControlName="quantity" />
                  </app-form-field>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-5">
          <div class="card mb-3">
            <div class="card-body">
              <h2 class="section-title">Schedule</h2>
              <app-form-field label="Start date" inputId="sStart" [control]="form.controls.startDate">
                <input id="sStart" type="date" class="form-control" formControlName="startDate" [min]="today" />
              </app-form-field>
              <app-form-field label="End date" inputId="sEnd" [control]="form.controls.endDate" hint="Leave blank for an open-ended subscription">
                <input id="sEnd" type="date" class="form-control" formControlName="endDate" [min]="form.controls.startDate.value" />
              </app-form-field>
              @if (form.hasError('dateRange') && form.controls.endDate.dirty) {
                <div class="invalid-feedback d-block mb-3">End date cannot be before the start date.</div>
              }
              <app-form-field label="Delivery slot" inputId="sSlot" [control]="form.controls.deliverySlot">
                <select id="sSlot" class="form-select" formControlName="deliverySlot">
                  @for (s of slots; track s) {
                    <option [value]="s">{{ s }}</option>
                  }
                </select>
              </app-form-field>
            </div>
          </div>

          @if (selectedPlan(); as p) {
            <div class="card">
              <div class="card-body small">
                <h2 class="section-title">Plan summary</h2>
                <div class="d-flex justify-content-between"><span class="text-muted">Frequency</span><span>{{ p.frequency }}{{ p.daysOfWeek ? ' (' + p.daysOfWeek + ')' : '' }}</span></div>
                <div class="d-flex justify-content-between"><span class="text-muted">Billing</span><span>{{ p.billingCycle }}</span></div>
                <div class="d-flex justify-content-between">
                  <span class="text-muted">Price / unit</span>
                  <span>{{ p.pricePerUnit !== null ? (p.pricePerUnit | appCurrency) : 'Price list' }}</span>
                </div>
                <div class="d-flex justify-content-between"><span class="text-muted">Discount</span><span>{{ p.discountPercent }}%</span></div>
                @if (p.minimumDays > 0) {
                  <div class="d-flex justify-content-between"><span class="text-muted">Minimum days</span><span>{{ p.minimumDays }}</span></div>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <div class="d-flex justify-content-end gap-2 mt-3">
        <a routerLink="/subscriptions" class="btn btn-light">Cancel</a>
        <button type="submit" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Create subscription
        </button>
      </div>
    </form>
  `,
})
export class SubscriptionFormComponent implements OnInit {
  private readonly svc = inject(SubscriptionService);
  private readonly customerSvc = inject(CustomerService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  /** ?customerId= query param */
  readonly customerId = input<string>();

  readonly slots = SLOTS;
  readonly today = toIsoDate();
  readonly customers = toSignal(this.lookups.customers(), { initialValue: [] as LookupItem[] });
  readonly products = toSignal(this.lookups.products(), { initialValue: [] as LookupItem[] });
  readonly plans = signal<SubscriptionPlan[]>([]);
  readonly addresses = signal<CustomerAddress[]>([]);
  readonly addressesLoading = signal(false);
  readonly addressError = signal<string | null>(null);
  readonly saving = signal(false);
  private readonly planId = signal<number | null>(null);
  readonly selectedPlan = computed(() => this.plans().find((p) => p.id === this.planId()) ?? null);

  readonly form = this.fb.group(
    {
      customerId: this.fb.control<number | null>(null, Validators.required),
      customerAddressId: this.fb.control<number | null>(null, Validators.required),
      subscriptionPlanId: this.fb.control<number | null>(null, Validators.required),
      productId: this.fb.control<number | null>(null, Validators.required),
      quantity: [1, [Validators.required, positiveNumberValidator()]],
      startDate: [toIsoDate(), Validators.required],
      endDate: [''],
      deliverySlot: ['Morning', Validators.required],
    },
    { validators: dateRangeValidator('startDate', 'endDate') },
  );

  constructor() {
    this.form.controls.customerId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => this.loadAddresses(id));
    this.form.controls.subscriptionPlanId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => this.onPlanChange(id));
  }

  ngOnInit(): void {
    this.svc.listPlans({ page: 1, pageSize: 200, isActive: true, sortBy: 'name', sortDir: 'asc' }).subscribe({
      next: (r) => this.plans.set(r.items),
      error: (err) => this.toast.error(errorMessage(err)),
    });
    const preset = Number(this.customerId());
    if (preset > 0) {
      this.form.controls.customerId.setValue(preset);
    }
  }

  productLabel(p: LookupItem): string {
    const unit = p['extra'];
    return typeof unit === 'string' && unit ? `${p.name} (${unit})` : p.name;
  }

  addressText(a: CustomerAddress): string {
    return addressLine(a);
  }

  private loadAddresses(customerId: number | null): void {
    this.addresses.set([]);
    this.addressError.set(null);
    this.form.controls.customerAddressId.setValue(null);
    if (!customerId) {
      return;
    }
    this.addressesLoading.set(true);
    this.customerSvc.addresses(customerId).subscribe({
      next: (list) => {
        if (this.form.controls.customerId.value !== customerId) {
          return;
        }
        this.addresses.set(list);
        this.addressesLoading.set(false);
        const preferred = list.find((a) => a.isDefault) ?? list[0];
        if (preferred) {
          this.form.controls.customerAddressId.setValue(preferred.id);
        }
      },
      error: (err) => {
        this.addressError.set(errorMessage(err));
        this.addressesLoading.set(false);
      },
    });
  }

  private onPlanChange(id: number | null): void {
    this.planId.set(id);
    const plan = this.plans().find((p) => p.id === id);
    if (plan) {
      if (plan.productId) {
        this.form.controls.productId.setValue(plan.productId);
      }
      this.form.controls.quantity.setValue(plan.defaultQuantity);
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
      .create({
        customerId: v.customerId!,
        subscriptionPlanId: v.subscriptionPlanId!,
        customerAddressId: v.customerAddressId!,
        productId: v.productId,
        quantity: Number(v.quantity),
        startDate: orNull(v.startDate),
        endDate: orNull(v.endDate),
        deliverySlot: v.deliverySlot,
      })
      .subscribe({
        next: (s) => {
          this.toast.success(`Subscription ${s.subscriptionNumber} created.`);
          void this.router.navigate(['/subscriptions', s.id]);
        },
        error: () => this.saving.set(false),
      });
  }
}
