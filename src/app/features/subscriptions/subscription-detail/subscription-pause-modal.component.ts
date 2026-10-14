import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { toIsoDate } from '../../../shared/utils/format';
import { orNull } from '../../../shared/utils/paged-list';
import { dateRangeValidator } from '../../../shared/validators/app-validators';
import { SubscriptionDetail } from '../subscription.model';
import { SubscriptionService } from '../subscription.service';

@Component({
  selector: 'app-subscription-pause-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent],
  template: `
    <app-modal [open]="open()" title="Pause subscription" size="md" (closed)="close()">
      <form id="pauseForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <p class="text-muted small">No orders are generated while the subscription is paused. Leave the end date blank to pause until you resume it manually.</p>
        <div class="row">
          <div class="col-md-6">
            <app-form-field label="Pause from" inputId="pFrom" [control]="form.controls.pauseFrom">
              <input id="pFrom" type="date" class="form-control" formControlName="pauseFrom" [min]="today" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Pause until" inputId="pTo" [control]="form.controls.pauseTo">
              <input id="pTo" type="date" class="form-control" formControlName="pauseTo" [min]="form.controls.pauseFrom.value" />
            </app-form-field>
          </div>
        </div>
        @if (form.hasError('dateRange')) {
          <div class="invalid-feedback d-block mb-3">The end date cannot be before the start date.</div>
        }
        <app-form-field label="Reason" inputId="pReason" [control]="form.controls.reason">
          <input id="pReason" class="form-control" formControlName="reason" maxlength="255" autocomplete="off" />
        </app-form-field>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="pauseForm" class="btn btn-warning" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Pause
        </button>
      </div>
    </app-modal>
  `,
})
export class SubscriptionPauseModalComponent {
  private readonly svc = inject(SubscriptionService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = input(false);
  readonly subscriptionId = input.required<number>();
  readonly closed = output<void>();
  readonly paused = output<SubscriptionDetail>();

  readonly today = toIsoDate();
  readonly saving = signal(false);

  readonly form = this.fb.group(
    {
      pauseFrom: [toIsoDate(), Validators.required],
      pauseTo: [''],
      reason: ['', Validators.maxLength(255)],
    },
    { validators: dateRangeValidator('pauseFrom', 'pauseTo') },
  );

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.form.reset({ pauseFrom: toIsoDate(), pauseTo: '', reason: '' }));
      }
    });
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
      .pause(this.subscriptionId(), { pauseFrom: orNull(v.pauseFrom), pauseTo: orNull(v.pauseTo), reason: orNull(v.reason.trim()) })
      .subscribe({
        next: (s) => {
          this.saving.set(false);
          this.toast.success('Subscription paused.');
          this.paused.emit(s);
        },
        error: () => this.saving.set(false),
      });
  }
}
