import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { AppDatePipe } from '../../../shared/pipes/app-pipes';
import { Setting } from '../administration.model';
import { AdministrationService } from '../administration.service';

interface SettingGroup {
  name: string;
  items: Setting[];
}

/** Editable key/value table grouped by prefix; saves only the changed values in one request. */
@Component({
  selector: 'app-settings-editor',
  standalone: true,
  imports: [LoadingComponent, EmptyStateComponent, AppDatePipe],
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <input type="search" class="form-control form-control-sm" style="max-width: 280px" placeholder="Search key or description..." (input)="onSearch($event)" aria-label="Search settings" />
      <div class="ms-auto d-flex align-items-center gap-2">
        @if (dirtyCount() > 0) {
          <span class="badge badge-soft badge-soft-warning">{{ dirtyCount() }} unsaved change(s)</span>
        }
        <button type="button" class="btn btn-sm btn-light" [disabled]="dirtyCount() === 0 || saving()" (click)="discard()">Discard</button>
        <button type="button" class="btn btn-sm btn-primary" [disabled]="dirtyCount() === 0 || hasInvalid() || saving()" (click)="save()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          <i class="bi bi-save me-1"></i>Save changes
        </button>
      </div>
    </div>

    @if (loading()) {
      <app-loading text="Loading settings..." />
    } @else if (error()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center">
        <span>{{ error() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="load()">Retry</button>
      </div>
    } @else if (groups().length === 0) {
      <app-empty-state icon="bi-sliders2" title="No settings found" message="Try a different search term." />
    } @else {
      @for (g of groups(); track g.name) {
        <div class="card mb-3">
          <div class="card-header text-capitalize fw-semibold">{{ g.name }}</div>
          <div class="table-responsive">
            <table class="table align-middle mb-0 app-table">
              <thead>
                <tr>
                  <th style="width: 34%">Setting</th>
                  <th>Value</th>
                  <th style="width: 160px">Last changed</th>
                </tr>
              </thead>
              <tbody>
                @for (s of g.items; track s.key) {
                  <tr [class.table-warning]="isDirty(s)">
                    <td>
                      <code>{{ s.key }}</code>
                      @if (s.description) {
                        <div class="small text-muted">{{ s.description }}</div>
                      }
                    </td>
                    <td>
                      @switch (s.dataType) {
                        @case ('bool') {
                          <div class="form-check form-switch">
                            <input
                              type="checkbox"
                              class="form-check-input"
                              [id]="'set-' + s.key"
                              [checked]="valueOf(s) === 'true'"
                              (change)="onCheck(s, $event)"
                            />
                            <label class="form-check-label" [for]="'set-' + s.key">{{ valueOf(s) === 'true' ? 'Enabled' : 'Disabled' }}</label>
                          </div>
                        }
                        @case ('number') {
                          <input
                            type="number"
                            step="any"
                            class="form-control form-control-sm"
                            style="max-width: 220px"
                            [class.is-invalid]="isInvalid(s)"
                            [value]="valueOf(s)"
                            (input)="onInput(s, $event)"
                            [attr.aria-label]="s.key"
                          />
                          @if (isInvalid(s)) {
                            <div class="invalid-feedback d-block">Enter a valid number.</div>
                          }
                        }
                        @case ('json') {
                          <textarea
                            rows="3"
                            class="form-control form-control-sm font-monospace"
                            [class.is-invalid]="isInvalid(s)"
                            [value]="valueOf(s)"
                            (input)="onInput(s, $event)"
                            [attr.aria-label]="s.key"
                          ></textarea>
                          @if (isInvalid(s)) {
                            <div class="invalid-feedback d-block">Enter valid JSON.</div>
                          }
                        }
                        @default {
                          <input
                            type="text"
                            class="form-control form-control-sm"
                            [value]="valueOf(s)"
                            (input)="onInput(s, $event)"
                            [attr.aria-label]="s.key"
                          />
                        }
                      }
                    </td>
                    <td class="small text-muted">{{ s.modifiedDate | appDate: 'datetime' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    }
  `,
})
export class SettingsEditorComponent implements OnInit {
  private readonly svc = inject(AdministrationService);
  private readonly toast = inject(ToastService);

  readonly settings = signal<Setting[]>([]);
  /** edited values keyed by setting key; only entries that differ from the server value are kept */
  readonly drafts = signal<Record<string, string>>({});
  readonly search = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly dirtyCount = computed(() => Object.keys(this.drafts()).length);
  readonly hasInvalid = computed(() => this.settings().some((s) => s.key in this.drafts() && this.isInvalid(s)));
  readonly groups = computed<SettingGroup[]>(() => {
    const q = this.search().trim().toLowerCase();
    const map = new Map<string, Setting[]>();
    for (const s of this.settings()) {
      if (q && !s.key.toLowerCase().includes(q) && !(s.description ?? '').toLowerCase().includes(q)) {
        continue;
      }
      const name = s.group || s.key.split(/[._:]/)[0] || 'general';
      (map.get(name) ?? map.set(name, []).get(name)!).push(s);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, items]) => ({ name, items }));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.listSettings().subscribe({
      next: (list) => {
        this.settings.set(list);
        this.drafts.set({});
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  valueOf(s: Setting): string {
    return this.drafts()[s.key] ?? s.value ?? '';
  }

  isDirty(s: Setting): boolean {
    return s.key in this.drafts();
  }

  isInvalid(s: Setting): boolean {
    const v = this.valueOf(s).trim();
    if (s.dataType === 'number') {
      return v === '' || isNaN(Number(v));
    }
    if (s.dataType === 'json') {
      try {
        JSON.parse(v);
        return false;
      } catch {
        return true;
      }
    }
    return false;
  }

  onSearch(ev: Event): void {
    this.search.set((ev.target as HTMLInputElement).value);
  }

  onInput(s: Setting, ev: Event): void {
    this.setDraft(s, (ev.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  onCheck(s: Setting, ev: Event): void {
    this.setDraft(s, (ev.target as HTMLInputElement).checked ? 'true' : 'false');
  }

  private setDraft(s: Setting, value: string): void {
    this.drafts.update((d) => {
      const next = { ...d };
      if (value === (s.value ?? '')) {
        delete next[s.key];
      } else {
        next[s.key] = value;
      }
      return next;
    });
  }

  discard(): void {
    this.drafts.set({});
  }

  save(): void {
    const items = Object.entries(this.drafts()).map(([key, value]) => ({ key, value }));
    if (items.length === 0 || this.hasInvalid()) {
      return;
    }
    this.saving.set(true);
    this.svc.saveSettings(items).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(`${items.length} setting(s) saved.`);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
