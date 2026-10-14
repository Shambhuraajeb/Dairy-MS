import { Component, DestroyRef, ElementRef, computed, effect, inject, input, untracked, viewChild } from '@angular/core';
import Chart from 'chart.js/auto';
import type { ChartConfiguration, ChartType } from 'chart.js';

const PALETTE = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#0891b2', '#7c3aed', '#db2777', '#65a30d', '#ea580c', '#475569'];

/**
 * <app-chart type="line" [labels]="labels" [datasets]="[{ label: 'Litres', data: values }]" [height]="280" />
 * Colors are auto-assigned when the dataset has none. Re-renders when any input changes; destroys on teardown.
 */
@Component({
  selector: 'app-chart',
  standalone: true,
  template: `
    @if (hasData()) {
      <div class="chart-wrap" [style.height.px]="height()"><canvas #canvas></canvas></div>
    } @else {
      <div class="chart-empty" [style.height.px]="height()">
        <i class="bi bi-bar-chart-line"></i>
        <span>No data to display</span>
      </div>
    }
  `,
})
export class ChartComponent {
  readonly type = input<ChartType>('bar');
  readonly labels = input<readonly string[]>([]);
  readonly datasets = input<readonly any[]>([]);
  readonly options = input<any>(undefined);
  readonly height = input(280);

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private chart: Chart | null = null;

  protected readonly hasData = computed(() =>
    this.datasets().some((d) => Array.isArray(d?.data) && d.data.length > 0),
  );

  constructor() {
    effect(() => {
      const canvas = this.canvas()?.nativeElement;
      const type = this.type();
      const labels = this.labels();
      const datasets = this.datasets();
      const options = this.options();
      untracked(() => this.render(canvas, type, labels, datasets, options));
    });
    inject(DestroyRef).onDestroy(() => this.destroy());
  }

  private render(
    canvas: HTMLCanvasElement | undefined,
    type: ChartType,
    labels: readonly string[],
    datasets: readonly any[],
    options: any,
  ): void {
    this.destroy();
    if (!canvas) {
      return;
    }
    const circular = type === 'pie' || type === 'doughnut' || type === 'polarArea';
    const styled = datasets.map((d, i) => {
      if (circular) {
        return { backgroundColor: PALETTE, borderWidth: 1, ...d };
      }
      const color = PALETTE[i % PALETTE.length];
      return type === 'line'
        ? { borderColor: color, backgroundColor: color + '22', fill: true, tension: 0.3, pointRadius: 3, ...d }
        : { backgroundColor: color, borderRadius: 4, maxBarThickness: 40, ...d };
    });
    const defaults: any = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', display: circular || datasets.length > 1 } },
    };
    if (!circular) {
      defaults.scales = {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: '#eef0f3' } },
      };
    }
    const merged = {
      ...defaults,
      ...(options ?? {}),
      plugins: { ...defaults.plugins, ...(options?.plugins ?? {}) },
      ...(!circular ? { scales: { ...defaults.scales, ...(options?.scales ?? {}) } } : {}),
    };
    this.chart = new Chart(canvas, {
      type,
      data: { labels: [...labels], datasets: styled },
      options: merged,
    } as ChartConfiguration);
  }

  private destroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }
}
