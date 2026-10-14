import { Component, input } from '@angular/core';
import { AbstractControl, Validators } from '@angular/forms';

/**
 * <app-form-field label="Code" [control]="form.controls.code" hint="optional" inputId="code">
 *   <input id="code" class="form-control" formControlName="code" />
 * </app-form-field>
 * Shows the first validation message once the control is touched/dirty. `messages` overrides per error key.
 */
@Component({
  selector: 'app-form-field',
  standalone: true,
  template: `
    <div class="form-field mb-3">
      @if (label()) {
        <label class="form-label" [attr.for]="inputId() || null">
          {{ label() }}
          @if (isRequired()) {
            <span class="text-danger">*</span>
          }
        </label>
      }
      <ng-content />
      @if (showError()) {
        <div class="invalid-feedback d-block">{{ errorText() }}</div>
      } @else if (hint()) {
        <div class="form-text">{{ hint() }}</div>
      }
    </div>
  `,
})
export class FormFieldComponent {
  readonly label = input('');
  readonly control = input<AbstractControl | null>(null);
  readonly hint = input('');
  readonly inputId = input('');
  readonly required = input<boolean | null>(null);
  readonly messages = input<Record<string, string>>({});

  isRequired(): boolean {
    const explicit = this.required();
    if (explicit !== null) {
      return explicit;
    }
    return this.control()?.hasValidator(Validators.required) ?? false;
  }

  showError(): boolean {
    const c = this.control();
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  errorText(): string {
    const errors = this.control()?.errors;
    if (!errors) {
      return '';
    }
    const key = Object.keys(errors)[0];
    const custom = this.messages()[key];
    if (custom) {
      return custom;
    }
    const e = errors[key] as Record<string, unknown> | true;
    const detail = typeof e === 'object' && e !== null ? e : {};
    switch (key) {
      case 'required':
        return 'This field is required.';
      case 'email':
        return 'Enter a valid email address.';
      case 'minlength':
        return `Minimum ${String(detail['requiredLength'])} characters required.`;
      case 'maxlength':
        return `Maximum ${String(detail['requiredLength'])} characters allowed.`;
      case 'min':
        return `Value must be at least ${String(detail['min'])}.`;
      case 'max':
        return `Value must be at most ${String(detail['max'])}.`;
      case 'pattern':
        return 'Invalid format.';
      case 'mobile':
        return 'Enter a valid 10-digit mobile number.';
      case 'strongPassword':
        return 'Min 8 characters with upper, lower case, digit and symbol.';
      case 'positiveNumber':
        return 'Enter a number greater than zero.';
      case 'dateRange':
        return 'End date cannot be before start date.';
      case 'mismatch':
        return 'Values do not match.';
      case 'server':
        return typeof errors[key] === 'string' ? (errors[key] as string) : 'Invalid value.';
      default:
        return typeof detail['message'] === 'string' ? (detail['message'] as string) : 'Invalid value.';
    }
  }
}
