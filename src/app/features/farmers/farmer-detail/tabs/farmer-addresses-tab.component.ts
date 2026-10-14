import { Component, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { FormFieldComponent } from '../../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { AddressBody, FarmerAddress, FarmerDetail, nullIfEmpty } from '../../farmer.model';
import { FarmerService } from '../../farmer.service';

@Component({
  selector: 'app-farmer-addresses-tab',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, FormFieldComponent, ModalComponent, HasPermissionDirective],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="h6 mb-0">Addresses</h2>
      <button *appHasPermission="'farmer.update'" type="button" class="btn btn-sm btn-primary" (click)="openCreate()">
        <i class="bi bi-plus-lg me-1"></i>Add address
      </button>
    </div>

    @if (farmer().addresses.length === 0) {
      <div class="card"><app-empty-state icon="bi-geo-alt" title="No addresses" message="Add the farmer's home or farm address." /></div>
    } @else {
      <div class="row g-3">
        @for (a of farmer().addresses; track a.id) {
          <div class="col-md-6 col-xl-4">
            <div class="card h-100">
              <div class="card-body">
                <div class="d-flex justify-content-between mb-2">
                  <span class="badge text-bg-light border">{{ a.addressType }}</span>
                  @if (a.isDefault) {
                    <span class="badge badge-soft badge-soft-success">Default</span>
                  }
                </div>
                <div>{{ a.line1 }}</div>
                @if (a.line2) {
                  <div>{{ a.line2 }}</div>
                }
                <div class="text-muted small">
                  {{ [a.village, a.taluka, a.district, a.city, a.state].filter(present).join(', ') }}
                  @if (a.pincode) {
                    <span> - {{ a.pincode }}</span>
                  }
                </div>
              </div>
              <div *appHasPermission="'farmer.update'" class="card-footer bg-white border-0 pt-0 text-end">
                <button type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="openEdit(a)"><i class="bi bi-pencil"></i> Edit</button>
                <button type="button" class="btn btn-sm btn-outline-danger" (click)="remove(a)"><i class="bi bi-trash"></i></button>
              </div>
            </div>
          </div>
        }
      </div>
    }

    <app-modal [open]="open()" [title]="editing() ? 'Edit address' : 'Add address'" size="lg" (closed)="close()">
      <form id="addressForm" [formGroup]="form" (ngSubmit)="save()" novalidate class="row g-0">
        <div class="col-md-4 pe-md-3">
          <app-form-field label="Type" inputId="aType" [control]="form.controls.addressType">
            <select id="aType" class="form-select" formControlName="addressType">
              <option value="Home">Home</option>
              <option value="Farm">Farm</option>
              <option value="Billing">Billing</option>
            </select>
          </app-form-field>
        </div>
        <div class="col-md-8">
          <app-form-field label="Line 1" inputId="aLine1" [control]="form.controls.line1">
            <input id="aLine1" class="form-control" formControlName="line1" maxlength="200" />
          </app-form-field>
        </div>
        <div class="col-12">
          <app-form-field label="Line 2" inputId="aLine2" [control]="form.controls.line2">
            <input id="aLine2" class="form-control" formControlName="line2" maxlength="200" />
          </app-form-field>
        </div>
        <div class="col-md-4 pe-md-3">
          <app-form-field label="Village" inputId="aVillage" [control]="form.controls.village">
            <input id="aVillage" class="form-control" formControlName="village" maxlength="100" />
          </app-form-field>
        </div>
        <div class="col-md-4 pe-md-3">
          <app-form-field label="Taluka" inputId="aTaluka" [control]="form.controls.taluka">
            <input id="aTaluka" class="form-control" formControlName="taluka" maxlength="100" />
          </app-form-field>
        </div>
        <div class="col-md-4">
          <app-form-field label="District" inputId="aDistrict" [control]="form.controls.district">
            <input id="aDistrict" class="form-control" formControlName="district" maxlength="100" />
          </app-form-field>
        </div>
        <div class="col-md-4 pe-md-3">
          <app-form-field label="City" inputId="aCity" [control]="form.controls.city">
            <input id="aCity" class="form-control" formControlName="city" maxlength="100" />
          </app-form-field>
        </div>
        <div class="col-md-4 pe-md-3">
          <app-form-field label="State" inputId="aState" [control]="form.controls.state">
            <input id="aState" class="form-control" formControlName="state" maxlength="100" />
          </app-form-field>
        </div>
        <div class="col-md-4">
          <app-form-field label="Pincode" inputId="aPin" [control]="form.controls.pincode" [messages]="{ pattern: 'Pincode must be 6 digits.' }">
            <input id="aPin" class="form-control" formControlName="pincode" maxlength="6" inputmode="numeric" />
          </app-form-field>
        </div>
        <div class="col-12">
          <div class="form-check form-switch">
            <input id="aDefault" type="checkbox" class="form-check-input" formControlName="isDefault" />
            <label class="form-check-label" for="aDefault">Default address</label>
          </div>
        </div>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="addressForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class FarmerAddressesTabComponent {
  private readonly svc = inject(FarmerService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly farmer = input.required<FarmerDetail>();
  readonly changed = output<void>();

  readonly open = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<FarmerAddress | null>(null);

  readonly form = this.fb.group({
    addressType: ['Home'],
    line1: ['', [Validators.required, Validators.maxLength(200)]],
    line2: [''],
    village: [''],
    taluka: [''],
    district: [''],
    city: [''],
    state: [''],
    pincode: ['', Validators.pattern(/^\d{6}$/)],
    isDefault: [false],
  });

  readonly present = (s: string | null): boolean => !!s;

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({ addressType: 'Home', isDefault: this.farmer().addresses.length === 0 });
    this.open.set(true);
  }

  openEdit(a: FarmerAddress): void {
    this.editing.set(a);
    this.form.reset({
      addressType: a.addressType,
      line1: a.line1,
      line2: a.line2 ?? '',
      village: a.village ?? '',
      taluka: a.taluka ?? '',
      district: a.district ?? '',
      city: a.city ?? '',
      state: a.state ?? '',
      pincode: a.pincode ?? '',
      isDefault: a.isDefault,
    });
    this.open.set(true);
  }

  close(): void {
    if (!this.saving()) {
      this.open.set(false);
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: AddressBody = {
      addressType: v.addressType,
      line1: v.line1.trim(),
      line2: nullIfEmpty(v.line2),
      village: nullIfEmpty(v.village),
      taluka: nullIfEmpty(v.taluka),
      district: nullIfEmpty(v.district),
      city: nullIfEmpty(v.city),
      state: nullIfEmpty(v.state),
      pincode: nullIfEmpty(v.pincode),
      isDefault: v.isDefault,
    };
    const current = this.editing();
    const farmerId = this.farmer().id;
    this.saving.set(true);
    const request$ = current ? this.svc.updateAddress(farmerId, current.id, body) : this.svc.addAddress(farmerId, body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.open.set(false);
        this.toast.success(current ? 'Address updated.' : 'Address added.');
        this.changed.emit();
      },
      error: () => this.saving.set(false),
    });
  }

  async remove(a: FarmerAddress): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Delete address',
      message: `Delete the ${a.addressType.toLowerCase()} address "${a.line1}"?`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc.deleteAddress(this.farmer().id, a.id).subscribe(() => {
      this.toast.success('Address deleted.');
      this.changed.emit();
    });
  }
}
