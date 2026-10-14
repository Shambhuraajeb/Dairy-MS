import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const isEmpty = (v: unknown): boolean => v === null || v === undefined || v === '';

/** 10-digit Indian mobile (starts 6-9). Empty is valid (combine with Validators.required). Error key: `mobile`. */
export function mobileValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isEmpty(control.value)) {
      return null;
    }
    return /^[6-9]\d{9}$/.test(String(control.value).trim()) ? null : { mobile: true };
  };
}

/** Min 8 chars with upper, lower, digit, symbol. Error key: `strongPassword`. */
export function strongPasswordValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = control.value as string | null;
    if (isEmpty(v)) {
      return null;
    }
    const s = String(v);
    const ok = s.length >= 8 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[^A-Za-z0-9]/.test(s);
    return ok ? null : { strongPassword: true };
  };
}

/** Number must be > 0 (or >= 0 when allowZero). Error key: `positiveNumber`. */
export function positiveNumberValidator(allowZero = false): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isEmpty(control.value)) {
      return null;
    }
    const n = Number(control.value);
    if (isNaN(n)) {
      return { positiveNumber: true };
    }
    return (allowZero ? n >= 0 : n > 0) ? null : { positiveNumber: true };
  };
}

/** Group validator: end >= start (yyyy-MM-dd strings compare lexicographically). Error key on the group: `dateRange`. */
export function dateRangeValidator(startKey: string, endKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start = group.get(startKey)?.value as string | null;
    const end = group.get(endKey)?.value as string | null;
    if (isEmpty(start) || isEmpty(end)) {
      return null;
    }
    return String(end) >= String(start) ? null : { dateRange: true };
  };
}

/** Group validator: two controls must be equal (e.g. password confirmation). Error key on the group: `mismatch`. */
export function matchFieldsValidator(key: string, confirmKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(key)?.value;
    const b = group.get(confirmKey)?.value;
    return a === b ? null : { mismatch: true };
  };
}
