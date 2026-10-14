import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { dateOnly, orNull } from '../../../shared/utils/paged-list';
import { positiveNumberValidator } from '../../../shared/validators/app-validators';
import { CustomerAddress, addressLine } from '../../customers/customer.model';
import { CustomerService } from '../../customers/customer.service';
import { SLOTS, SubscriptionDetail } from '../subscription.model';
import { SubscriptionService } from '../subscription.service';

@Component({
  selector: 'app-subscription-edit-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent],
  template: `
    <app-modal [open]="open()" title="Edit subscription" size="md" (closed)="close()">
      <form id="subEditForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-form-field label="Quantity per delivery" inputId="eQty" [control]="form.controls.quantity">
          <input id="eQty" type="number" min="0" step="0.5" class="form-control" formControlName="quantity" />
        </app-form-field>
        <app-form-field label="Delivery slot" inputId="eSlot" [control]="form.controls.deliverySlot">
          <select id="eSlot" class="form-select" formControlName="deliverySlot">
            @for (s of slots; track s) {
              <option [value]="s">{{ s }}</option>
            }
          </select>
        </app-form-field>
        <app-form-field label="Delivery address" inputId="eAddr" [control]="form.controls.customerAddressId">
          <select id="eAddr" class="form-select" formControlName="customerAddressId">
            @for (a of addresses(); track a.id) {
              <option [ngValue]="a.id">{{ a.addressType }}: {{ text(a) }}</option>
            }
          </select>
        </app-form-field>
        <app-form-field label="End date" inputId="eEnd" [control]="form.controls.endDate" hint="Clear to make the subscription open-ended">
          <input id="eEnd" type="date" class="form-control" formControlName="endDate" />
        </app-form-field>
        <app-form-field label="Remarks" inputId="eRemarks" [control]="form.controls.remarks">
          <textarea id="eRemarks" class="form-control" rows="2" formControlName="remarks" maxlength="255"></textarea>
        </app-form-field>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="subEditForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class SubscriptionEditModalComponent {
  private readonly svc = inject(SubscriptionService);
  private readonly customerSvc = inject(CustomerService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = input(false);
  readonly subscription = input.required<SubscriptionDetail>();
  readonly closed = output<void>();
  readonly saved = output<SubscriptionDetail>();

  readonly slots = SLOTS;
  readonly addresses = signal<CustomerAddress[]>([]);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    quantity: [1, [Validators.required, positiveNumberValidator()]],
    deliverySlot: ['Morning', Validators.required],
    customerAddressId: this.fb.control<number | null>(null, Validators.required),
    endDate: [''],
    remarks: [''],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.prepare());
      }
    });
  }

  text(a: CustomerAddress): string {
    return addressLine(a);
  }

  private prepare(): void {
    const s = this.subscription();
    this.form.reset({
      quantity: s.quantity,
      deliverySlot: s.deliverySlot,
      customerAddressId: s.customerAddressId,
      endDate: dateOnly(s.endDate),
      remarks: s.remarks ?? '',
    });
    this.customerSvc.addresses(s.customerId).subscribe({
      next: (list) => this.addresses.set(list),
      error: () => this.addresses.set([]),
    });
  }

  close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  save(): void {
    const s = this.subscription();
    const v = this.form.getRawValue();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (v.endDate && v.endDate < dateOnly(s.startDate)) {
      this.form.controls.endDate.setErrors({ dateRange: true });
      this.form.controls.endDate.markAsTouched();
      return;
    }
    this.saving.set(true);
    this.svc
      .update(s.id, {
        quantity: Number(v.quantity),
        endDate: orNull(v.endDate),
        deliverySlot: v.deliverySlot,
        customerAddressId: v.customerAddressId,
        remarks: orNull(v.remarks.trim()),
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.toast.success('Subscription updated.');
          this.saved.emit(updated);
        },
        error: () => this.saving.set(false),
      });
  }
}
