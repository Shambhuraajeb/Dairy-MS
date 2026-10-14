import { Component, DestroyRef, HostListener, effect, inject, input, output } from '@angular/core';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/body-lock';

/**
 * <app-modal [open]="show()" title="Edit unit" size="md" (closed)="show.set(false)">
 *   ...body (form)...
 *   <div modal-footer> <button class="btn btn-light" (click)="..">Cancel</button> <button class="btn btn-primary">Save</button> </div>
 * </app-modal>
 * Plain Angular, no bootstrap JS. Closes on Esc, X, and backdrop click (unless [backdropClose]="false").
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  host: { '[attr.title]': 'null' },
  template: `
    @if (open()) {
      <div class="modal-backdrop fade show"></div>
      <div class="modal fade show d-block" tabindex="-1" role="dialog" aria-modal="true" (mousedown)="onBackdrop($event)">
        <div
          class="modal-dialog modal-dialog-centered modal-dialog-scrollable"
          [class.modal-sm]="size() === 'sm'"
          [class.modal-lg]="size() === 'lg'"
          [class.modal-xl]="size() === 'xl'"
        >
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">{{ title() }}</h5>
              <button type="button" class="btn-close" aria-label="Close" (click)="close()"></button>
            </div>
            <div class="modal-body"><ng-content /></div>
            <div class="modal-footer"><ng-content select="[modal-footer]" /></div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  readonly backdropClose = input(true);
  readonly closed = output<void>();

  private locked = false;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      if (isOpen && !this.locked) {
        lockBodyScroll();
        this.locked = true;
      } else if (!isOpen && this.locked) {
        unlockBodyScroll();
        this.locked = false;
      }
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.locked) {
        unlockBodyScroll();
        this.locked = false;
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.close();
    }
  }

  onBackdrop(event: MouseEvent): void {
    if (this.backdropClose() && event.target === event.currentTarget) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit();
  }
}
