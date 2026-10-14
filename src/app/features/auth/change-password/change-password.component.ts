import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { matchFieldsValidator, strongPasswordValidator } from '../../../shared/validators/app-validators';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, FormFieldComponent],
  template: `
    <app-page-header title="Change password" subtitle="Use a strong password you do not use elsewhere" />
    <div class="card" style="max-width: 520px">
      <div class="card-body">
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <app-form-field label="Current password" inputId="cur" [control]="form.controls.currentPassword">
            <input id="cur" type="password" class="form-control" formControlName="currentPassword" autocomplete="current-password" />
          </app-form-field>
          <app-form-field
            label="New password"
            inputId="new"
            [control]="form.controls.newPassword"
            hint="Min 8 characters with upper and lower case, a digit and a symbol."
          >
            <input id="new" type="password" class="form-control" formControlName="newPassword" autocomplete="new-password" />
          </app-form-field>
          <app-form-field label="Confirm new password" inputId="confirm" [control]="form.controls.confirmPassword">
            <input id="confirm" type="password" class="form-control" formControlName="confirmPassword" autocomplete="new-password" />
            @if (form.hasError('mismatch') && form.controls.confirmPassword.touched) {
              <div class="invalid-feedback d-block">Passwords do not match.</div>
            }
          </app-form-field>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm me-1"></span>
            }
            Update password
          </button>
        </form>
      </div>
    </div>
  `,
})
export class ChangePasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly saving = signal(false);
  readonly form = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, strongPasswordValidator()]],
      confirmPassword: ['', Validators.required],
    },
    { validators: matchFieldsValidator('newPassword', 'confirmPassword') },
  );

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.auth.changePassword(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Password changed successfully.');
        this.form.reset();
        void this.router.navigateByUrl('/dashboard');
      },
      error: () => this.saving.set(false),
    });
  }
}
