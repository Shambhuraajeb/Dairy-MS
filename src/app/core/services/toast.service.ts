import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'danger' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  title?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  success(message: string, title?: string): void {
    this.show('success', message, title, 3500);
  }

  error(message: string, title?: string): void {
    this.show('danger', message, title, 6500);
  }

  warning(message: string, title?: string): void {
    this.show('warning', message, title, 5000);
  }

  info(message: string, title?: string): void {
    this.show('info', message, title, 4000);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  clear(): void {
    this._toasts.set([]);
  }

  private show(type: ToastType, message: string, title: string | undefined, ms: number): void {
    if (!message || this._toasts().some((t) => t.type === type && t.message === message)) {
      return;
    }
    const id = this.nextId++;
    this._toasts.update((list) => [...list.slice(-4), { id, type, message, title }]);
    setTimeout(() => this.dismiss(id), ms);
  }
}
