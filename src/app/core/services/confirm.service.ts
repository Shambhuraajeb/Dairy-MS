import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'warning' | 'success';
}

export interface ConfirmState extends Required<ConfirmOptions> {
  resolve: (result: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _state = signal<ConfirmState | null>(null);
  readonly state = this._state.asReadonly();

  /** Resolves true when the user confirms, false on cancel/close. */
  confirm(options: string | ConfirmOptions): Promise<boolean> {
    const o: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
    this._state()?.resolve(false);
    return new Promise<boolean>((resolve) => {
      this._state.set({
        title: o.title ?? 'Please confirm',
        message: o.message,
        confirmText: o.confirmText ?? 'Confirm',
        cancelText: o.cancelText ?? 'Cancel',
        variant: o.variant ?? 'primary',
        resolve,
      });
    });
  }

  resolve(result: boolean): void {
    const s = this._state();
    this._state.set(null);
    s?.resolve(result);
  }
}
