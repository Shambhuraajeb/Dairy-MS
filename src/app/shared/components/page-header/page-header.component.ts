import { Component, input } from '@angular/core';

/** <app-page-header title="Units" subtitle="..."> <button class="btn btn-primary">Add</button> </app-page-header> (content = right-side actions) */
@Component({
  selector: 'app-page-header',
  standalone: true,
  host: { '[attr.title]': 'null' },
  template: `
    <div class="page-header">
      <div class="page-header-text">
        <h1 class="page-title">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="page-subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="page-actions"><ng-content /></div>
    </div>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
