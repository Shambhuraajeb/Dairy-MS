import { Component, OnInit, inject, input, signal } from '@angular/core';
import { errorMessage } from '../../../../core/utils/http-error';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingComponent } from '../../../../shared/components/loading/loading.component';
import { AppDatePipe } from '../../../../shared/pipes/app-pipes';
import { LifecycleEvent } from '../../animal.model';
import { AnimalService } from '../../animal.service';

const ICONS: Record<string, { icon: string; color: string }> = {
  Registration: { icon: 'bi-journal-plus', color: 'primary' },
  Health: { icon: 'bi-heart-pulse', color: 'danger' },
  Vaccination: { icon: 'bi-shield-plus', color: 'success' },
  Deworming: { icon: 'bi-bug', color: 'info' },
  Breeding: { icon: 'bi-gender-ambiguous', color: 'primary' },
  Pregnancy: { icon: 'bi-calendar-heart', color: 'warning' },
  Delivery: { icon: 'bi-balloon-heart', color: 'success' },
  Sale: { icon: 'bi-cash-coin', color: 'secondary' },
  Death: { icon: 'bi-x-octagon', color: 'danger' },
  Archive: { icon: 'bi-archive', color: 'secondary' },
};

@Component({
  selector: 'app-animal-lifecycle-tab',
  standalone: true,
  imports: [AppDatePipe, LoadingComponent, EmptyStateComponent],
  template: `
    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span>Lifecycle timeline</span>
        <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="loading()" (click)="load()">
          <i class="bi bi-arrow-clockwise"></i> Refresh
        </button>
      </div>
      <div class="card-body">
        @if (loading()) {
          <app-loading text="Loading timeline..." />
        } @else if (error()) {
          <div class="text-center text-danger py-4">
            <div class="mb-2">{{ error() }}</div>
            <button type="button" class="btn btn-sm btn-outline-primary" (click)="load()">Retry</button>
          </div>
        } @else if (events().length === 0) {
          <app-empty-state icon="bi-clock-history" title="No events yet" message="Events appear as health, breeding and other records are added." />
        } @else {
          <ul class="list-unstyled mb-0 ms-2">
            @for (e of events(); track $index) {
              <li class="d-flex gap-3 pb-3 position-relative">
                <div class="flex-shrink-0 text-center" style="width: 2.5rem">
                  <span class="d-inline-flex align-items-center justify-content-center rounded-circle badge-soft-{{ style(e.eventType).color }}" style="width: 2.25rem; height: 2.25rem">
                    <i class="bi {{ style(e.eventType).icon }}"></i>
                  </span>
                </div>
                <div class="flex-grow-1 border-bottom pb-2">
                  <div class="d-flex justify-content-between flex-wrap">
                    <strong>{{ e.title }}</strong>
                    <span class="text-muted small">{{ e.eventDate | appDate }}</span>
                  </div>
                  <div class="small text-muted"><span class="badge text-bg-light border me-1">{{ e.eventType }}</span>{{ e.details }}</div>
                </div>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
})
export class AnimalLifecycleTabComponent implements OnInit {
  private readonly svc = inject(AnimalService);

  readonly animalId = input.required<number>();
  readonly events = signal<LifecycleEvent[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  style(type: string): { icon: string; color: string } {
    return ICONS[type] ?? { icon: 'bi-circle', color: 'secondary' };
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.lifecycle(this.animalId()).subscribe({
      next: (list) => {
        this.events.set(list ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
