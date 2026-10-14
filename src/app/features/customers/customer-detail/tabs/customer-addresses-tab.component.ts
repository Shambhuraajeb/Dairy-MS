import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LookupItem } from '../../../../core/models/api.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { LookupService } from '../../../../core/services/lookup.service';
import { ToastService } from '../../../../core/services/toast.service';
import { errorMessage } from '../../../../core/utils/http-error';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { FormFieldComponent } from '../../../../shared/components/form-field/form-field.component';
import { LoadingComponent } from '../../../../shared/components/loading/loading.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { orNull } from '../../../../shared/utils/paged-list';
import { ADDRESS_TYPES, AddressRequest, CustomerAddress } from '../../customer.model';
import { CustomerService } from '../../customer.service';

@Component({
  selector: 'app-customer-addresses-tab',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, FormFieldComponent, LoadingComponent, ModalComponent, HasPermissionDirective],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="h6 mb-0">Delivery &amp; billing addresses</h2>
      <button *appHasPermission="['customer.create', 'customer.update']" type="button" class="btn btn-sm btn-primary" (click)="openCreate()">
        <i class="bi bi-plus-lg me-1"></i>Add address
      </button>
    </div>

    @if (loading()) {
      <app-loading text="Loading addresses..." />
    } @else if (error()) {
      <div class="card">
        <app-empty-state icon="bi-exclamation-octagon" title="Could not load addresses" [message]="error()!">
          <button type="button" class="btn btn-outline-primary btn-sm" (click)="load()">Retry</button>
        </app-empty-state>
      </div>
    } @else if (addresses().length === 0) {
      <div class="card"><app-empty-state icon="bi-geo-alt" title="No addresses" message="Add a delivery address before creating a subscription." /></div>
    } @else {
      <div class="row g-3">
        @for (a of addresses(); track a.id) {
          <div class="col-md-6 col-xl-4">
            <div class="card h-100">
              <div class="card-body">
                <div class="d-flex justify-content-between mb-2">
                  <span class="badge text-bg-light border">{{ a.addressType }}</span>
                  @if (a.isDefault) {
                    <span class="badge badge-soft badge-soft-success">Default</span>
                  }
                </div>
                <div class="fw-semibold">{{ a.line1 }}</div>
                @if (a.line2) {
                  <div>{{ a.line2 }}</div>
                }
                <div class="text-muted small">
                  {{ [a.landmark, a.city, a.state].filter(present).join(', ') }}@if (a.pincode) { - {{ a.pincode }} }
                </div>
                @if (a.contactName || a.contactMobile) {
                  <div class="small mt-2"><i class="bi bi-person me-1"></i>{{ [a.contactName, a.contactMobile].filter(present).join(' · ') }}</div>
                }
                @if (a.routeName) {
                  <div class="small"><i class="bi bi-signpost-split me-1"></i>Route: {{ a.routeName }}</div>
                }
                @if (a.deliveryInstructions) {
                  <div class="small text-muted mt-1"><i class="bi bi-info-circle me-1"></i>{{ a.deliveryInstructions }}</div>
                }
              </div>
              <div *appHasPermission="'customer.update'" class="card-footer bg-white border-0 pt-0 text-end">
                @if (!a.isDefault) {
                  <button type="button" class="btn btn-sm btn-outline-success me-1" [disabled]="saving()" (click)="makeDefault(a)">Make default</button>
                }
                <button type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="openEdit(a)"><i class="bi bi-pencil"></i> Edit</button>
                <button type="button" class="btn btn-sm btn-outline-danger" (click)="remove(a)"><i class="bi bi-trash"></i></button>
              </div>
            </div>
          </div>
        }
      </div>
    }

    <app-modal [open]="open()" [title]="editing() ? 'Edit address' : 'Add address'" size="lg" (closed)="close()">
      <form id="custAddressForm" [formGroup]="form" (ngSubmit)="save()" novalidate class="row g-0">
        <div class="col-md-4 pe-md-3">
          <app-form-field label="Type" inputId="caType" [control]="form.controls.addressType">
            <select id="caType" class="form-select" formControlName="addressType">
              @for (t of types; track t) {
                <option [value]="t">{{ t }}</option>
              }
            </select>
          </app-form-field>
        </div>
        <div class="col-md-4 pe-md-3">
          <app-form-field label="Contact name" inputId="caContact" [control]="form.controls.contactName">
            <input id="caContact" class="form-control" formControlName="contactName" maxlength="100" />
          </app-form-field>
        </div>
        <div class="col-md-4">
          <app-form-field label="Contact mobile" inputId="caMobile" [control]="form.controls.contactMobile" [messages]="{ pattern: 'Enter 10 to 13 digits.' }">
            <input id="caMobile" class="form-control" formControlName="contactMobile" maxlength="14" inputmode="tel" />
          </app-form-field>
        </div>
        <div class="col-md-6 pe-md-3">
          <app-form-field label="Address line 1" inputId="caLine1" [control]="form.controls.line1">
            <input id="caLine1" class="form-control" formControlName="line1" maxlength="200" />
          </app-form-field>
        </div>
        <div class="col-md-6">
          <app-form-field label="Address line 2" inputId="caLine2" [control]="form.controls.line2">
            <input id="caLine2" class="form-control" formControlName="line2" maxlength="200" />
          </app-form-field>
        </div>
        <div class="col-md-4 pe-md-3">
          <app-form-field label="Landmark" inputId="caLandmark" [control]="form.controls.landmark">
            <input id="caLandmark" class="form-control" formControlName="landmark" maxlength="150" />
          </app-form-field>
        </div>
        <div class="col-md-4 pe-md-3">
          <app-form-field label="City" inputId="caCity" [control]="form.controls.city">
            <input id="caCity" class="form-control" formControlName="city" maxlength="100" />
          </app-form-field>
        </div>
        <div class="col-md-4">
          <app-form-field label="State" inputId="caState" [control]="form.controls.state">
            <input id="caState" class="form-control" formControlName="state" maxlength="100" />
          </app-form-field>
        </div>
        <div class="col-md-4 pe-md-3">
          <app-form-field label="Pincode" inputId="caPin" [control]="form.controls.pincode" [messages]="{ pattern: 'Pincode must be 6 digits.' }">
            <input id="caPin" class="form-control" formControlName="pincode" maxlength="6" inputmode="numeric" />
          </app-form-field>
        </div>
        <div class="col-md-8">
          <app-form-field label="Delivery route" inputId="caRoute" [control]="form.controls.routeId">
            <select id="caRoute" class="form-select" formControlName="routeId">
              <option [ngValue]="null">-- not assigned --</option>
              @for (r of routes(); track r.id) {
                <option [ngValue]="r.id">{{ r.name }}</option>
              }
            </select>
          </app-form-field>
        </div>
        <div class="col-12">
          <app-form-field label="Delivery instructions" inputId="caInstr" [control]="form.controls.deliveryInstructions">
            <textarea id="caInstr" class="form-control" rows="2" formControlName="deliveryInstructions" maxlength="255"></textarea>
          </app-form-field>
        </div>
        <div class="col-12">
          <div class="form-check form-switch">
            <input id="caDefault" type="checkbox" class="form-check-input" formControlName="isDefault" />
            <label class="form-check-label" for="caDefault">Default address</label>
          </div>
        </div>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="custAddressForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class CustomerAddressesTabComponent implements OnInit {
  private readonly svc = inject(CustomerService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly customerId = input.required<number>();
  readonly changed = output<void>();

  readonly types = ADDRESS_TYPES;
  readonly routes = toSignal(this.lookups.get('routes'), { initialValue: [] as LookupItem[] });

  readonly addresses = signal<CustomerAddress[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly open = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<CustomerAddress | null>(null);

  readonly form = this.fb.group({
    addressType: ['Home'],
    contactName: [''],
    contactMobile: ['', Validators.pattern(/^\+?\d{10,13}$/)],
    line1: ['', [Validators.required, Validators.maxLength(200)]],
    line2: [''],
    landmark: [''],
    city: [''],
    state: [''],
    pincode: ['', Validators.pattern(/^\d{6}$/)],
    routeId: this.fb.control<number | null>(null),
    deliveryInstructions: [''],
    isDefault: [false],
  });

  readonly present = (v: string | null | undefined): boolean => !!v;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.addresses(this.customerId()).subscribe({
      next: (list) => {
        this.addresses.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({ addressType: 'Home', isDefault: this.addresses().length === 0 });
    this.open.set(true);
  }

  openEdit(a: CustomerAddress): void {
    this.editing.set(a);
    this.form.reset({
      addressType: a.addressType,
      contactName: a.contactName ?? '',
      contactMobile: a.contactMobile ?? '',
      line1: a.line1,
      line2: a.line2 ?? '',
      landmark: a.landmark ?? '',
      city: a.city ?? '',
      state: a.state ?? '',
      pincode: a.pincode ?? '',
      routeId: a.routeId,
      deliveryInstructions: a.deliveryInstructions ?? '',
      isDefault: a.isDefault,
    });
    this.open.set(true);
  }

  close(): void {
    if (!this.saving()) {
      this.open.set(false);
    }
  }

  private toRequest(a: CustomerAddress, isDefault: boolean): AddressRequest {
    return {
      addressType: a.addressType,
      contactName: a.contactName,
      contactMobile: a.contactMobile,
      line1: a.line1,
      line2: a.line2,
      landmark: a.landmark,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      latitude: a.latitude,
      longitude: a.longitude,
      routeId: a.routeId,
      deliveryInstructions: a.deliveryInstructions,
      isDefault,
    };
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const current = this.editing();
    const body: AddressRequest = {
      addressType: v.addressType,
      contactName: orNull(v.contactName.trim()),
      contactMobile: orNull(v.contactMobile.trim()),
      line1: v.line1.trim(),
      line2: orNull(v.line2.trim()),
      landmark: orNull(v.landmark.trim()),
      city: orNull(v.city.trim()),
      state: orNull(v.state.trim()),
      pincode: orNull(v.pincode.trim()),
      latitude: current?.latitude ?? null,
      longitude: current?.longitude ?? null,
      routeId: v.routeId,
      deliveryInstructions: orNull(v.deliveryInstructions.trim()),
      isDefault: v.isDefault,
    };
    this.saving.set(true);
    const request$ = current
      ? this.svc.updateAddress(this.customerId(), current.id, body)
      : this.svc.addAddress(this.customerId(), body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.open.set(false);
        this.toast.success(current ? 'Address updated.' : 'Address added.');
        this.load();
        this.changed.emit();
      },
      error: () => this.saving.set(false),
    });
  }

  makeDefault(a: CustomerAddress): void {
    this.saving.set(true);
    this.svc.updateAddress(this.customerId(), a.id, this.toRequest(a, true)).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Default address changed.');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  async remove(a: CustomerAddress): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Delete address',
      message: `Delete the address "${a.line1}"? Addresses used by active or paused subscriptions cannot be deleted.`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc.deleteAddress(this.customerId(), a.id).subscribe(() => {
      this.toast.success('Address deleted.');
      this.load();
      this.changed.emit();
    });
  }
}
