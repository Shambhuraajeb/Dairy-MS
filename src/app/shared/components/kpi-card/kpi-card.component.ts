import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { formatCurrency, formatNumber } from '../../utils/format';

export type KpiColor = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'secondary';

/**
 * <app-kpi-card title="Low stock" [value]="12" icon="bi-exclamation-triangle" color="warning"
 *   subtitle="items below reorder level" link="/inventory/alerts" [queryParams]="{ type: 'low-stock' }" />
 * format: 'number' (default for numbers) | 'currency' | 'percent' | 'none' (value shown as given)
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink],
  host: { '[attr.title]': 'null' },
  template: `
    <ng-template #body>
      <div class="kpi-icon kpi-{{ color() }}"><i class="bi {{ icon() }}"></i></div>
      <div class="kpi-body">
        <div class="kpi-title">{{ title() }}</div>
        @if (loading()) {
          <div class="kpi-value"><span class="placeholder-glow"><span class="placeholder col-6"></span></span></div>
        } @else {
          <div class="kpi-value">{{ display() }}@if (suffix()) {<small class="kpi-suffix"> {{ suffix() }}</small>}</div>
        }
        @if (subtitle() || trend() !== null) {
          <div class="kpi-sub">
            @if (trend() !== null) {
              <span [class]="trendUp() ? 'text-success' : 'text-danger'">
                <i class="bi" [class.bi-arrow-up-short]="trendUp()" [class.bi-arrow-down-short]="!trendUp()"></i>{{ trendAbs() }}%
              </span>
            }
            {{ subtitle() }}
          </div>
        }
      </div>
    </ng-template>
    @if (link()) {
      <a class="kpi-card kpi-link" [routerLink]="link()" [queryParams]="queryParams()">
        <ng-container *ngTemplateOutlet="body" />
      </a>
    } @else {
      <div class="kpi-card"><ng-container *ngTemplateOutlet="body" /></div>
    }
  `,
})
export class KpiCardComponent {
  readonly title = input.required<string>();
  readonly value = input<number | string | null | undefined>(null);
  readonly icon = input<string>('bi-activity');
  readonly color = input<KpiColor>('primary');
  readonly subtitle = input<string>('');
  readonly suffix = input<string>('');
  readonly trend = input<number | null>(null);
  readonly format = input<'number' | 'currency' | 'percent' | 'none'>('number');
  readonly loading = input<boolean>(false);
  readonly link = input<string | any[] | null>(null);
  readonly queryParams = input<Params | null>(null);

  readonly trendUp = computed(() => (this.trend() ?? 0) >= 0);
  readonly trendAbs = computed(() => Math.abs(this.trend() ?? 0));

  readonly display = computed(() => {
    const v = this.value();
    if (v === null || v === undefined || v === '') {
      return '—';
    }
    const f = this.format();
    if (f === 'none' || typeof v === 'string' && isNaN(Number(v))) {
      return String(v);
    }
    switch (f) {
      case 'currency':
        return formatCurrency(v, 'INR', 0);
      case 'percent':
        return `${formatNumber(v, 1)}%`;
      default:
        return formatNumber(v, 2);
    }
  });
}
