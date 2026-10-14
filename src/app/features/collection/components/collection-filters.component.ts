import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { isoDay, resolveShiftId, shiftLabel, shiftsForCenter, toNumberOrNull } from '../collection.util';
import { ShiftDto } from '../models/collection.model';
import { SearchSelectComponent } from './search-select.component';

export interface CollectionFilterValue {
  from: string;
  to: string;
  centerId: number | null;
  shiftId: number | null;
  status: string;
  farmerId: number | null;
}

/** raw query-string inputs of a list page (all optional strings) */
export interface CollectionFilterInputs {
  from?: string;
  to?: string;
  date?: string;
  center?: string;
  centerId?: string;
  shift?: string;
  status?: string;
  farmer?: string;
  farmerId?: string;
}

export function emptyFilters(): CollectionFilterValue {
  return { from: '', to: '', centerId: null, shiftId: null, status: '', farmerId: null };
}

/** turns query-string inputs into filter values; `shift` may be an id or a shift name */
export function initialFilters(i: CollectionFilterInputs, shifts: ShiftDto[], defaults: Partial<CollectionFilterValue> = {}): CollectionFilterValue {
  const centerId = toNumberOrNull(i.center ?? i.centerId) ?? defaults.centerId ?? null;
  const from = i.from ?? i.date;
  return {
    from: from ? isoDay(from) : (defaults.from ?? ''),
    to: i.to ? isoDay(i.to) : i.date ? isoDay(i.date) : (defaults.to ?? ''),
    centerId,
    shiftId: resolveShiftId(shifts, i.shift, centerId) ?? defaults.shiftId ?? null,
    status: i.status ?? defaults.status ?? '',
    farmerId: toNumberOrNull(i.farmer ?? i.farmerId) ?? defaults.farmerId ?? null,
  };
}

/** filter values as API query params (empty values are dropped by ApiService) */
export function filtersToQuery(f: CollectionFilterValue): PagedQuery {
  return {
    from: f.from || undefined,
    to: f.to || undefined,
    centerId: f.centerId ?? undefined,
    shiftId: f.shiftId ?? undefined,
    status: f.status || undefined,
    farmerId: f.farmerId ?? undefined,
  };
}

/** Filter bar shared by history / quality / approval pages. Emits a new value object on every change. */
@Component({
  selector: 'app-collection-filters',
  standalone: true,
  imports: [SearchSelectComponent],
  template: `
    <div class="card mb-3">
      <div class="card-body py-2">
        <div class="row g-2 align-items-end">
          <div class="col-6 col-md-2">
            <label class="form-label small mb-1" for="fltFrom">From</label>
            <input id="fltFrom" type="date" class="form-control form-control-sm" [value]="value().from" (change)="onText('from', $event)" />
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label small mb-1" for="fltTo">To</label>
            <input id="fltTo" type="date" class="form-control form-control-sm" [value]="value().to" (change)="onText('to', $event)" />
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label small mb-1" for="fltCenter">Center</label>
            <select id="fltCenter" class="form-select form-select-sm" (change)="onCenter($event)">
              <option value="" [selected]="value().centerId === null">All centers</option>
              @for (c of centers(); track c.id) {
                <option [value]="c.id" [selected]="value().centerId === c.id">{{ c.name }}</option>
              }
            </select>
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label small mb-1" for="fltShift">Shift</label>
            <select id="fltShift" class="form-select form-select-sm" (change)="onShift($event)">
              <option value="" [selected]="value().shiftId === null">All shifts</option>
              @for (s of shiftOptions(); track s.id) {
                <option [value]="s.id" [selected]="value().shiftId === s.id">{{ shiftLabel(s) }}</option>
              }
            </select>
          </div>
          @if (statuses().length > 0) {
            <div class="col-6 col-md-2">
              <label class="form-label small mb-1" for="fltStatus">Status</label>
              <select id="fltStatus" class="form-select form-select-sm" (change)="onText('status', $event)">
                <option value="" [selected]="value().status === ''">All</option>
                @for (s of statuses(); track s) {
                  <option [value]="s" [selected]="value().status === s">{{ s }}</option>
                }
              </select>
            </div>
          }
          @if (showFarmer()) {
            <div class="col-12 col-md-3">
              <label class="form-label small mb-1" for="fltFarmer">Farmer</label>
              <app-search-select inputId="fltFarmer" placeholder="All farmers" [options]="farmers()" [value]="value().farmerId" (valueChange)="onFarmer($event)" />
            </div>
          }
          <div class="col-auto">
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="clear()">Reset</button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CollectionFiltersComponent {
  private readonly lookup = inject(LookupService);

  readonly value = input.required<CollectionFilterValue>();
  readonly shifts = input<ShiftDto[]>([]);
  /** status options; empty array hides the status filter */
  readonly statuses = input<readonly string[]>([]);
  readonly showFarmer = input(false);
  readonly valueChange = output<CollectionFilterValue>();

  protected readonly centers = toSignal(this.lookup.collectionCenters(), { initialValue: [] as LookupItem[] });
  protected readonly farmers = toSignal(this.lookup.farmers(), { initialValue: [] as LookupItem[] });
  protected readonly shiftOptions = computed(() => shiftsForCenter(this.shifts(), this.value().centerId));
  protected readonly shiftLabel = shiftLabel;

  protected onText(key: 'from' | 'to' | 'status', event: Event): void {
    const v = (event.target as HTMLInputElement | HTMLSelectElement).value;
    const next = { ...this.value() };
    next[key] = v;
    this.valueChange.emit(next);
  }

  protected onCenter(event: Event): void {
    const centerId = toNumberOrNull((event.target as HTMLSelectElement).value);
    const cur = this.value();
    const valid = cur.shiftId !== null && shiftsForCenter(this.shifts(), centerId).some((s) => s.id === cur.shiftId);
    this.valueChange.emit({ ...cur, centerId, shiftId: valid ? cur.shiftId : null });
  }

  protected onShift(event: Event): void {
    this.valueChange.emit({ ...this.value(), shiftId: toNumberOrNull((event.target as HTMLSelectElement).value) });
  }

  protected onFarmer(farmerId: number | null): void {
    if (farmerId !== this.value().farmerId) {
      this.valueChange.emit({ ...this.value(), farmerId });
    }
  }

  protected clear(): void {
    this.valueChange.emit(emptyFilters());
  }
}
