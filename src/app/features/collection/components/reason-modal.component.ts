import { Component, effect, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

/** Generic "enter a reason, then confirm" dialog (cancel settlement, ...). */
@Component({
  selector: 'app-reason-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent],
  template: `
    <app-modal [open]="open()" [title]="title()" size="md" (closed)="closed.emit()">
      <p class="text-muted">{{ message() }}</p>
      <form id="reasonForm" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <app-form-field [label]="label()" inputId="reasonText" [control]="form.controls.reason" [messages]="{ pattern: 'Reason cannot be blank.' }">
          <textarea id="reasonText" class="form-control" rows="3" maxlength="500" formControlName="reason"></textarea>
        </app-form-field>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closed.emit()">Close</button>
        <button type="submit" form="reasonForm" [class]="'btn btn-' + variant()" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          {{ confirmText() }}
        </button>
      </div>
    </app-modal>
  `,
})
export class ReasonModalComponent {
  readonly open = input(false);
  readonly title = input('Reason');
  readonly message = input('');
  readonly label = input('Reason');
  readonly confirmText = input('Confirm');
  readonly variant = input<'primary' | 'danger' | 'warning'>('danger');
  readonly saving = input(false);
  readonly confirmed = output<string>();
  readonly closed = output<void>();

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    reason: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)]],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({ reason: '' });
      }
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.confirmed.emit(this.form.controls.reason.value.trim());
  }
}
