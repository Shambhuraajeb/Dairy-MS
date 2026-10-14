import { Component, computed, effect, input, model, signal } from '@angular/core';
import { LookupItem } from '../../../core/models/api.model';

/**
 * Searchable single select over LookupItem[] (matches code or name).
 * <app-search-select [options]="farmers()" [value]="form.controls.farmerId.value" (valueChange)="form.controls.farmerId.setValue($event)" />
 */
@Component({
  selector: 'app-search-select',
  standalone: true,
  template: `
    <div class="position-relative">
      <input
        type="text"
        class="form-control"
        autocomplete="off"
        [id]="inputId()"
        [class.is-invalid]="invalid()"
        [placeholder]="placeholder()"
        [disabled]="disabled()"
        [value]="text()"
        (focus)="onFocus($event)"
        (input)="onInput($event)"
        (keydown)="onKey($event)"
        (blur)="onBlur()"
      />
      @if (open()) {
        <div class="list-group position-absolute w-100 shadow-sm" style="z-index: 1055; max-height: 260px; overflow-y: auto">
          @for (o of filtered(); track o.id; let i = $index) {
            <button
              type="button"
              class="list-group-item list-group-item-action py-1"
              [class.active]="i === active()"
              (mousedown)="pick(o, $event)"
            >
              @if (o.code) {
                <strong>{{ o.code }}</strong>
                -
              }
              {{ o.name }}
            </button>
          } @empty {
            <div class="list-group-item text-muted small">No matches</div>
          }
        </div>
      }
    </div>
  `,
})
export class SearchSelectComponent {
  readonly options = input<LookupItem[]>([]);
  readonly value = model<number | null>(null);
  readonly placeholder = input('Type to search...');
  readonly inputId = input('');
  readonly disabled = input(false);
  readonly invalid = input(false);

  protected readonly text = signal('');
  protected readonly open = signal(false);
  protected readonly active = signal(0);
  private readonly query = signal('');

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.options();
    const list = q ? all.filter((o) => (o.code ?? '').toLowerCase().includes(q) || o.name.toLowerCase().includes(q)) : all;
    return list.slice(0, 50);
  });

  constructor() {
    // keep the visible text in sync with the selected value while the dropdown is closed
    effect(() => {
      const v = this.value();
      const opts = this.options();
      if (!this.open()) {
        const sel = v === null ? undefined : opts.find((o) => o.id === v);
        this.text.set(sel ? this.label(sel) : '');
      }
    });
  }

  private label(o: LookupItem): string {
    return o.code ? `${o.code} - ${o.name}` : o.name;
  }

  protected onFocus(event: FocusEvent): void {
    this.query.set('');
    this.active.set(0);
    this.open.set(true);
    (event.target as HTMLInputElement).select();
  }

  protected onInput(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.text.set(v);
    this.query.set(v);
    this.active.set(0);
    this.open.set(true);
    if (v === '' && this.value() !== null) {
      this.value.set(null);
    }
  }

  protected onKey(event: KeyboardEvent): void {
    const list = this.filtered();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open.set(true);
      this.active.set(Math.min(list.length - 1, this.active() + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.active.set(Math.max(0, this.active() - 1));
    } else if (event.key === 'Enter') {
      if (this.open() && list.length > 0) {
        event.preventDefault();
        this.pick(list[Math.min(this.active(), list.length - 1)]);
      }
    } else if (event.key === 'Escape') {
      this.open.set(false);
    }
  }

  protected onBlur(): void {
    this.open.set(false);
  }

  protected pick(o: LookupItem, event?: Event): void {
    event?.preventDefault();
    this.value.set(o.id);
    this.text.set(this.label(o));
    this.open.set(false);
  }
}
