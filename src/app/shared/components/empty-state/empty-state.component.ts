import { Component, input } from '@angular/core';

/** <app-empty-state icon="bi-inbox" title="Nothing here" message="..."> <button ...>optional action</button> </app-empty-state> */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  host: { '[attr.title]': 'null' },
  template: `
    <div class="empty-state">
      <i class="bi {{ icon() }}"></i>
      <div class="empty-title">{{ title() }}</div>
      @if (message()) {
        <div class="empty-message">{{ message() }}</div>
      }
      <div class="empty-action"><ng-content /></div>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input('bi-inbox');
  readonly title = input('No data');
  readonly message = input('');
}
