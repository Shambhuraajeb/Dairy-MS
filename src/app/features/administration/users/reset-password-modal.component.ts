import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { orNull } from '../../../shared/utils/paged-list';
import { strongPasswordValidator } from '../../../shared/validators/app-validators';
import { UserAdmin } from '../administration.model';
import { AdministrationService } from '../administration.service';

/** Reset password modal; shows the generated temporary password once when the server created it. */
@Component({
  selector: 'app-reset-password-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent],
  template: `
    <app-modal [open]="user() !== null" title="Reset Password" size="md" (closed)="close()">
      @if (tempPassword(); as temp) {
        <div class="alert alert-success mb-0">
          <div class="mb-2">Password reset for <strong>{{ user()?.username }}</strong>. Share this temporary password securely. It is shown only once.</div>
          <div class="input-group">
            <input class="form-control font-monospace" [value]="temp" readonly aria-label="Temporary password" />
            <button type="button" class="btn btn-outline-secondary" (click)="copy(temp)"><i class="bi bi-clipboard"></i> Copy</button>
          </div>
        </div>
      } @else {
        <form id="resetPasswordForm" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <p class="mb-3">
            Reset the password of <strong>{{ user()?.username }}</strong>. Any lock or failed-login count is cleared.
          </p>
          <app-form-field
            label="New password"
            inputId="rpPassword"
            [control]="form.controls.newPassword"
            hint="Leave blank to generate a temporary password"
          >
            <input id="rpPassword" type="password" class="form-control" formControlName="newPassword" autocomplete="new-password" />
          </app-form-field>
          <div class="form-check form-switch">
            <input id="rpMustChange" type="checkbox" class="form-check-input" formControlName="mustChangePassword" />
            <label class="form-check-label" for="rpMustChange">Require password change at next sign-in</label>
          </div>
        </form>
      }
      <div modal-footer>
        @if (tempPassword()) {
          <button type="button" class="btn btn-primary" (click)="close()">Done</button>
        } @else {
          <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
          <button type="submit" form="resetPasswordForm" class="btn btn-warning" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm me-1"></span>
            }
            Reset password
          </button>
        }
      </div>
    </app-modal>
  `,
})
export class ResetPasswordModalComponent {
  private readonly svc = inject(AdministrationService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly user = input<UserAdmin | null>(null);
  readonly closed = output<void>();

  readonly saving = signal(false);
  readonly tempPassword = signal<string | null>(null);
  readonly form = this.fb.group({
    newPassword: ['', strongPasswordValidator()],
    mustChangePassword: [true],
  });

  constructor() {
    effect(() => {
      if (this.user()) {
        untracked(() => {
          this.form.reset({ newPassword: '', mustChangePassword: true });
          this.tempPassword.set(null);
        });
      }
    });
  }

  close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  submit(): void {
    const u = this.user();
    if (!u) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.svc.resetPassword(u.id, { newPassword: orNull(v.newPassword), mustChangePassword: v.mustChangePassword }).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res?.temporaryPassword) {
          this.tempPassword.set(res.temporaryPassword);
        } else {
          this.toast.success('Password reset.');
          this.closed.emit();
        }
      },
      error: () => this.saving.set(false),
    });
  }

  copy(text: string): void {
    navigator.clipboard?.writeText(text).then(
      () => this.toast.success('Copied to clipboard.'),
      () => this.toast.warning('Could not copy. Select the text and copy it manually.'),
    );
  }
}
