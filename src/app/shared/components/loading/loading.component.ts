import { Component, input } from '@angular/core';

/** <app-loading /> inline block spinner ; <app-loading [overlay]="true" text="Saving..." /> covers the nearest `position-relative` parent */
@Component({
  selector: 'app-loading',
  standalone: true,
  template: `
    <div class="app-loading" [class.app-loading-overlay]="overlay()">
      <div class="spinner-border text-primary" role="status" [class.spinner-border-sm]="small()"></div>
      @if (text()) {
        <span class="app-loading-text">{{ text() }}</span>
      }
    </div>
  `,
})
export class LoadingComponent {
  readonly text = input('');
  readonly overlay = input(false);
  readonly small = input(false);
}
