import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div class="app-toast app-toast-{{ t.type }}" role="alert">
          <i class="bi toast-icon {{ icon(t.type) }}"></i>
          <div class="toast-text">
            @if (t.title) {
              <div class="toast-title">{{ t.title }}</div>
            }
            <div>{{ t.message }}</div>
          </div>
          <button type="button" class="btn-close btn-close-sm" aria-label="Close" (click)="toasts.dismiss(t.id)"></button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  protected readonly toasts = inject(ToastService);

  protected icon(type: string): string {
    switch (type) {
      case 'success':
        return 'bi-check-circle-fill';
      case 'danger':
        return 'bi-x-octagon-fill';
      case 'warning':
        return 'bi-exclamation-triangle-fill';
      default:
        return 'bi-info-circle-fill';
    }
  }
}
