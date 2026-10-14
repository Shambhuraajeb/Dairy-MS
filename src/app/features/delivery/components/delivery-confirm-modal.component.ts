import { Component, effect, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ConfirmDeliveryRequest, DeliveryDetail, DeliveryListItem } from '../delivery.model';
import { DeliveryService } from '../delivery.service';

interface Coords {
  latitude: number;
  longitude: number;
}

const FAIL_REASONS = ['Customer not available', 'Address not found', 'Order refused by customer', 'Vehicle breakdown'];

/** Confirm a delivery as delivered (mode 'deliver') or failed (mode 'fail'); optionally captures geolocation. */
@Component({
  selector: 'app-delivery-confirm-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent],
  template: `
    <app-modal
      [open]="open()"
      [title]="mode() === 'deliver' ? 'Confirm delivery' : 'Mark delivery as failed'"
      (closed)="close()"
    >
      @if (delivery(); as d) {
        <div class="mb-3">
          <div class="fw-semibold">{{ d.deliveryNumber }} &middot; {{ d.customerName }}</div>
          <div class="small text-muted">{{ d.addressText || 'No address' }}</div>
        </div>
      }
      <form id="deliveryConfirmForm" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (mode() === 'deliver') {
          <app-form-field label="Received by" inputId="dcReceived" [control]="form.controls.receivedBy" hint="Name of the person who accepted the delivery">
            <input id="dcReceived" type="text" class="form-control" formControlName="receivedBy" maxlength="100" autocomplete="off" />
          </app-form-field>
        } @else {
          <app-form-field label="Failure reason" inputId="dcReason" [control]="form.controls.failureReason" [messages]="{ pattern: 'Reason cannot be blank.' }">
            <textarea id="dcReason" class="form-control" rows="2" maxlength="255" formControlName="failureReason"></textarea>
          </app-form-field>
          <div class="d-flex flex-wrap gap-1 mb-3">
            @for (r of reasons; track r) {
              <button type="button" class="btn btn-sm btn-outline-secondary" (click)="form.controls.failureReason.setValue(r)">{{ r }}</button>
            }
          </div>
        }
        <app-form-field label="Remarks" inputId="dcRemarks" [control]="form.controls.remarks">
          <textarea id="dcRemarks" class="form-control" rows="2" maxlength="255" formControlName="remarks"></textarea>
        </app-form-field>
        <div class="form-check">
          <input id="dcLocation" type="checkbox" class="form-check-input" formControlName="captureLocation" />
          <label class="form-check-label" for="dcLocation">Capture my current location</label>
        </div>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="deliveryConfirmForm" [class]="'btn ' + (mode() === 'deliver' ? 'btn-success' : 'btn-danger')" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          {{ mode() === 'deliver' ? 'Mark delivered' : 'Mark failed' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class DeliveryConfirmModalComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(DeliveryService);
  private readonly toast = inject(ToastService);

  readonly open = input(false);
  readonly delivery = input<DeliveryListItem | null>(null);
  readonly mode = input<'deliver' | 'fail'>('deliver');
  readonly done = output<DeliveryDetail>();
  readonly closed = output<void>();

  readonly reasons = FAIL_REASONS;
  readonly saving = signal(false);

  readonly form = this.fb.group({
    receivedBy: ['', Validators.maxLength(100)],
    failureReason: [''],
    remarks: ['', Validators.maxLength(255)],
    captureLocation: [true],
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      const fail = this.mode() === 'fail';
      this.form.controls.failureReason.setValidators(
        fail ? [Validators.required, Validators.pattern(/\S/), Validators.maxLength(255)] : [],
      );
      this.form.reset({
        receivedBy: this.delivery()?.customerName ?? '',
        failureReason: '',
        remarks: '',
        captureLocation: typeof navigator !== 'undefined' && 'geolocation' in navigator,
      });
    });
  }

  close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  async submit(): Promise<void> {
    const d = this.delivery();
    if (!d) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const deliver = this.mode() === 'deliver';
    this.saving.set(true);
    const coords = v.captureLocation ? await this.locate() : null;
    const body: ConfirmDeliveryRequest = {
      isDelivered: deliver,
      receivedBy: deliver ? v.receivedBy.trim() || null : null,
      failureReason: deliver ? null : v.failureReason.trim(),
      remarks: v.remarks.trim() || null,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    };
    this.svc.confirm(d.id, body).subscribe({
      next: (detail) => {
        this.saving.set(false);
        this.toast.success(deliver ? 'Delivery confirmed.' : 'Delivery marked as failed.');
        this.done.emit(detail);
      },
      error: () => this.saving.set(false),
    });
  }

  private locate(): Promise<Coords | null> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return Promise.resolve(null);
    }
    return new Promise<Coords | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => {
          this.toast.info('Location is unavailable. Continuing without it.');
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      );
    });
  }
}
