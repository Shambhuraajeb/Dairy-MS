import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { toIsoDate } from '../../../shared/utils/format';
import { dateOnly, orNull } from '../../../shared/utils/paged-list';
import { CUSTOMER_TYPES, Customer, CustomerRequest } from '../customer.model';
import { CustomerService } from '../customer.service';

const MOBILE_PATTERN = /^\+?\d{10,13}$/;

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, FormFieldComponent, LoadingComponent, EmptyStateComponent],
  template: `
    <app-page-header [title]="isEdit() ? 'Edit Customer' : 'New Customer'" [subtitle]="isEdit() ? 'Update customer details' : 'Register a retail customer or distributor'">
      <a [routerLink]="isEdit() ? ['/customers', id()] : ['/customers']" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>Back</a>
    </app-page-header>

    @if (loading()) {
      <app-loading text="Loading customer..." />
    } @else if (loadError()) {
      <div class="card">
        <app-empty-state icon="bi-exclamation-octagon" title="Could not load customer" [message]="loadError()!">
          <button type="button" class="btn btn-outline-primary btn-sm" (click)="loadCustomer()">Retry</button>
        </app-empty-state>
      </div>
    } @else {
      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="card mb-3">
          <div class="card-body">
            <h2 class="section-title">Basic details</h2>
            <div class="row">
              @if (!isEdit()) {
                <div class="col-md-4">
                  <app-form-field label="Customer code" inputId="cCode" [control]="form.controls.customerCode" hint="Leave blank to auto-generate (CUS0001...)">
                    <input id="cCode" class="form-control" formControlName="customerCode" maxlength="20" autocomplete="off" />
                  </app-form-field>
                </div>
              }
              <div class="col-md-4">
                <app-form-field label="Customer type" inputId="cType" [control]="form.controls.customerType">
                  <select id="cType" class="form-select" formControlName="customerType">
                    @for (t of types; track t) {
                      <option [value]="t">{{ t }}</option>
                    }
                  </select>
                </app-form-field>
              </div>
              <div class="col-md-4">
                <app-form-field label="Branch" inputId="cBranch" [control]="form.controls.branchId">
                  <select id="cBranch" class="form-select" formControlName="branchId">
                    <option [ngValue]="null">-- none --</option>
                    @for (b of branches(); track b.id) {
                      <option [ngValue]="b.id">{{ b.name }}</option>
                    }
                  </select>
                </app-form-field>
              </div>
              <div class="col-md-6">
                <app-form-field label="Name" inputId="cName" [control]="form.controls.name">
                  <input id="cName" class="form-control" formControlName="name" maxlength="150" autocomplete="off" />
                </app-form-field>
              </div>
              <div class="col-md-6">
                <app-form-field label="Contact person" inputId="cContact" [control]="form.controls.contactPerson">
                  <input id="cContact" class="form-control" formControlName="contactPerson" maxlength="100" autocomplete="off" />
                </app-form-field>
              </div>
              <div class="col-md-4">
                <app-form-field label="Mobile" inputId="cMobile" [control]="form.controls.mobile" [messages]="{ pattern: 'Enter 10 to 13 digits, optional leading +.' }">
                  <input id="cMobile" class="form-control" formControlName="mobile" maxlength="14" inputmode="tel" autocomplete="off" />
                </app-form-field>
              </div>
              <div class="col-md-4">
                <app-form-field label="Alternate mobile" inputId="cAlt" [control]="form.controls.alternateMobile" [messages]="{ pattern: 'Enter 10 to 13 digits, optional leading +.' }">
                  <input id="cAlt" class="form-control" formControlName="alternateMobile" maxlength="14" inputmode="tel" autocomplete="off" />
                </app-form-field>
              </div>
              <div class="col-md-4">
                <app-form-field label="Email" inputId="cEmail" [control]="form.controls.email">
                  <input id="cEmail" type="email" class="form-control" formControlName="email" maxlength="150" autocomplete="off" />
                </app-form-field>
              </div>
              <div class="col-md-4">
                <app-form-field label="GST number" inputId="cGst" [control]="form.controls.gstNumber">
                  <input id="cGst" class="form-control text-uppercase" formControlName="gstNumber" maxlength="20" autocomplete="off" />
                </app-form-field>
              </div>
              <div class="col-md-4">
                <app-form-field label="Join date" inputId="cJoin" [control]="form.controls.joinDate">
                  <input id="cJoin" type="date" class="form-control" formControlName="joinDate" />
                </app-form-field>
              </div>
            </div>
          </div>
        </div>

        <div class="card mb-3">
          <div class="card-body">
            <h2 class="section-title">Credit &amp; pricing</h2>
            <div class="row">
              <div class="col-md-4">
                <app-form-field label="Credit limit" inputId="cLimit" [control]="form.controls.creditLimit" hint="0 = no credit">
                  <input id="cLimit" type="number" min="0" step="0.01" class="form-control" formControlName="creditLimit" />
                </app-form-field>
              </div>
              <div class="col-md-4">
                <app-form-field label="Credit days" inputId="cDays" [control]="form.controls.creditDays" hint="Invoice due date = invoice date + credit days">
                  <input id="cDays" type="number" min="0" max="365" step="1" class="form-control" formControlName="creditDays" />
                </app-form-field>
              </div>
              <div class="col-md-4">
                <app-form-field label="Discount %" inputId="cDisc" [control]="form.controls.discountPercent">
                  <input id="cDisc" type="number" min="0" max="100" step="0.01" class="form-control" formControlName="discountPercent" />
                </app-form-field>
              </div>
              <div class="col-12">
                <app-form-field label="Notes" inputId="cNotes" [control]="form.controls.notes">
                  <textarea id="cNotes" class="form-control" rows="2" formControlName="notes" maxlength="500"></textarea>
                </app-form-field>
              </div>
            </div>
          </div>
        </div>

        <div class="d-flex justify-content-end gap-2">
          <a [routerLink]="isEdit() ? ['/customers', id()] : ['/customers']" class="btn btn-light">Cancel</a>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm me-1"></span>
            }
            {{ isEdit() ? 'Save changes' : 'Create customer' }}
          </button>
        </div>
      </form>
    }
  `,
})
export class CustomerFormComponent implements OnInit {
  private readonly svc = inject(CustomerService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  /** present on /customers/:id/edit */
  readonly id = input<string>();
  readonly isEdit = computed(() => !!this.id());

  readonly types = CUSTOMER_TYPES;
  readonly branches = toSignal(this.lookups.get('branches'), { initialValue: [] as LookupItem[] });

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    customerCode: ['', Validators.maxLength(20)],
    customerType: ['Retail', Validators.required],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    contactPerson: ['', Validators.maxLength(100)],
    mobile: ['', [Validators.required, Validators.pattern(MOBILE_PATTERN)]],
    alternateMobile: ['', Validators.pattern(MOBILE_PATTERN)],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    gstNumber: ['', Validators.maxLength(20)],
    branchId: this.fb.control<number | null>(null),
    creditLimit: [0, [Validators.min(0)]],
    creditDays: [0, [Validators.min(0), Validators.max(365)]],
    discountPercent: [0, [Validators.min(0), Validators.max(100)]],
    joinDate: [toIsoDate()],
    notes: ['', Validators.maxLength(500)],
  });

  ngOnInit(): void {
    if (this.isEdit()) {
      this.loadCustomer();
    }
  }

  loadCustomer(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.get(this.id()!).subscribe({
      next: (c) => {
        this.fill(c);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  private fill(c: Customer): void {
    this.form.reset({
      customerCode: c.customerCode,
      customerType: c.customerType,
      name: c.name,
      contactPerson: c.contactPerson ?? '',
      mobile: c.mobile,
      alternateMobile: c.alternateMobile ?? '',
      email: c.email ?? '',
      gstNumber: c.gstNumber ?? '',
      branchId: c.branchId,
      creditLimit: c.creditLimit,
      creditDays: c.creditDays,
      discountPercent: c.discountPercent,
      joinDate: dateOnly(c.joinDate),
      notes: c.notes ?? '',
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: CustomerRequest = {
      customerType: v.customerType,
      name: v.name.trim(),
      contactPerson: orNull(v.contactPerson.trim()),
      mobile: v.mobile.trim(),
      alternateMobile: orNull(v.alternateMobile.trim()),
      email: orNull(v.email.trim()),
      gstNumber: orNull(v.gstNumber.trim().toUpperCase()),
      branchId: v.branchId,
      creditLimit: Number(v.creditLimit) || 0,
      creditDays: Number(v.creditDays) || 0,
      discountPercent: Number(v.discountPercent) || 0,
      joinDate: orNull(v.joinDate),
      notes: orNull(v.notes.trim()),
    };
    this.saving.set(true);
    if (this.isEdit()) {
      this.svc.update(this.id()!, body).subscribe({
        next: (c) => {
          this.toast.success('Customer updated.');
          void this.router.navigate(['/customers', c.id]);
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.svc.create({ ...body, customerCode: orNull(v.customerCode.trim()) }).subscribe({
        next: (c) => {
          this.toast.success(`Customer ${c.customerCode} created.`);
          void this.router.navigate(['/customers', c.id]);
        },
        error: () => this.saving.set(false),
      });
    }
  }
}
