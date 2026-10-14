import { Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AppCurrencyPipe } from '../../../shared/pipes/app-pipes';
import { optText } from '../collection.util';
import { FarmerPayment, PayRequest } from '../models/settlement.model';
import { FarmerSettlementService } from '../services/farmer-settlement.service';

/** Pay an Approved settlement (full balance by default, partial allowed) with payment mode and reference. */
@Component({
  selector: 'app-pay-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent, AppCurrencyPipe],
  template: `
    <app-modal [open]="payment() !== null" [title]="'Pay ' + (payment()?.paymentNumber ?? '')" size="md" (closed)="close()">
      @if (payment(); as p) {
        <div class="alert alert-light border small">
          <div>{{ p.farmerCode }} - {{ p.farmerName }}</div>
          <div>Net payable <strong>{{ p.netPayable | appCurrency }}</strong>, paid {{ p.paidAmount | appCurrency }},
            balance <strong>{{ p.balanceAmount | appCurrency }}</strong></div>
        </div>
      }
      <form id="payForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-form-field label="Payment mode" inputId="payMode" [control]="form.controls.paymentModeId">
          <select id="payMode" class="form-select" formControlName="paymentModeId">
            <option [ngValue]="null">Select payment mode</option>
            @for (m of modes(); track m.id) {
              <option [ngValue]="m.id">{{ m.name }}</option>
            }
          </select>
        </app-form-field>
        <app-form-field label="Reference no." inputId="payRef" [control]="form.controls.referenceNo" [hint]="refRequired() ? 'Required for this payment mode' : ''">
          <input id="payRef" type="text" maxlength="100" class="form-control" formControlName="referenceNo" />
        </app-form-field>
        <app-form-field label="Amount to pay" inputId="payAmount" [control]="form.controls.paidAmount" hint="Defaults to the full balance">
          <input id="payAmount" type="number" step="0.01" class="form-control" formControlName="paidAmount" />
        </app-form-field>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="payForm" class="btn btn-success" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Confirm payment
        </button>
      </div>
    </app-modal>
  `,
})
export class PayModalComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(FarmerSettlementService);
  private readonly toast = inject(ToastService);
  private readonly lookup = inject(LookupService);

  readonly payment = input<FarmerPayment | null>(null);
  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly saving = signal(false);
  protected readonly modes = toSignal(this.lookup.paymentModes(), { initialValue: [] as LookupItem[] });

  protected readonly form = this.fb.group({
    paymentModeId: this.fb.control<number | null>(null),
    referenceNo: ['', Validators.maxLength(100)],
    paidAmount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
  });

  protected readonly refRequired = signal(false);

  constructor() {
    effect(() => {
      const p = this.payment();
      untracked(() => {
        if (p) {
          this.form.reset({ paymentModeId: p.paymentModeId, referenceNo: p.referenceNo ?? '', paidAmount: p.balanceAmount });
          this.applyModeRule(p.paymentModeId);
        }
        this.saving.set(false);
      });
    });
    this.form.controls.paymentModeId.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((id) => this.applyModeRule(id));
  }

  /** modes flagged "ReferenceRequired" (lookup extra) need a reference number */
  private applyModeRule(modeId: number | null): void {
    const mode = this.modes().find((m) => m.id === modeId);
    const required = mode?.['extra'] === 'ReferenceRequired';
    this.refRequired.set(required);
    const ref = this.form.controls.referenceNo;
    ref.setValidators(required ? [Validators.required, Validators.maxLength(100)] : [Validators.maxLength(100)]);
    ref.updateValueAndValidity();
  }

  protected close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  protected save(): void {
    const p = this.payment();
    if (!p) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: PayRequest = {
      paymentModeId: v.paymentModeId ?? undefined,
      referenceNo: optText(v.referenceNo),
      paidAmount: v.paidAmount ?? undefined,
    };
    this.saving.set(true);
    this.svc.pay(p.id, body).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(res.status === 'Paid' ? `${res.number} paid in full.` : `${res.number}: partial payment recorded, balance ${res.balanceAmount}.`);
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
