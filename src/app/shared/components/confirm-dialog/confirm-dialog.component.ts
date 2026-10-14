import { Component, inject } from '@angular/core';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ModalComponent } from '../modal/modal.component';

/** Single host instance lives in AppComponent. Use ConfirmService.confirm(...) from code. */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [ModalComponent],
  template: `
    @let s = svc.state();
    <app-modal [open]="!!s" [title]="s?.title ?? ''" size="sm" (closed)="svc.resolve(false)">
      <p class="mb-0">{{ s?.message }}</p>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="svc.resolve(false)">{{ s?.cancelText }}</button>
        <button type="button" class="btn btn-{{ s?.variant ?? 'primary' }}" (click)="svc.resolve(true)">{{ s?.confirmText }}</button>
      </div>
    </app-modal>
  `,
})
export class ConfirmDialogComponent {
  protected readonly svc = inject(ConfirmService);
}
