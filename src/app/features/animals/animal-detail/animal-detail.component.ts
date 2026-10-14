import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../../../core/utils/http-error';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AnimalDetail, isAnimalEditable } from '../animal.model';
import { AnimalService } from '../animal.service';
import { AnimalActionDialogComponent, AnimalAction } from './animal-action-dialog.component';
import { RecordKind } from './animal-records.config';
import { AnimalLifecycleTabComponent } from './tabs/animal-lifecycle-tab.component';
import { AnimalOverviewTabComponent } from './tabs/animal-overview-tab.component';
import { AnimalRecordsTabComponent } from './tabs/animal-records-tab.component';

type TabKey = 'overview' | RecordKind | 'lifecycle';

interface TabDef {
  key: TabKey;
  label: string;
  icon: string;
  femaleOnly?: boolean;
}

const TABS: TabDef[] = [
  { key: 'overview', label: 'Overview', icon: 'bi-speedometer2' },
  { key: 'health', label: 'Health', icon: 'bi-heart-pulse' },
  { key: 'vaccinations', label: 'Vaccination', icon: 'bi-shield-plus' },
  { key: 'dewormings', label: 'Deworming', icon: 'bi-bug' },
  { key: 'breedings', label: 'Breeding', icon: 'bi-gender-ambiguous', femaleOnly: true },
  { key: 'pregnancies', label: 'Pregnancy', icon: 'bi-calendar-heart', femaleOnly: true },
  { key: 'milk-production', label: 'Milk Yield', icon: 'bi-moisture', femaleOnly: true },
  { key: 'lifecycle', label: 'Lifecycle', icon: 'bi-clock-history' },
];

@Component({
  selector: 'app-animal-detail',
  standalone: true,
  imports: [
    RouterLink,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    AnimalOverviewTabComponent,
    AnimalRecordsTabComponent,
    AnimalLifecycleTabComponent,
    AnimalActionDialogComponent,
  ],
  template: `
    @if (loading()) {
      <app-loading text="Loading animal..." />
    } @else if (error()) {
      <div class="card">
        <app-empty-state icon="bi-exclamation-octagon" title="Could not load animal" [message]="error()!">
          <button type="button" class="btn btn-outline-primary btn-sm me-2" (click)="load()">Retry</button>
          <a routerLink="/animals" class="btn btn-light btn-sm">Back to animals</a>
        </app-empty-state>
      </div>
    } @else if (animal(); as a) {
      <app-page-header
        [title]="'Animal ' + a.tagNumber + (a.name ? ' - ' + a.name : '')"
        [subtitle]="a.animalType + ' · ' + (a.breedName || 'Unknown breed') + ' · ' + a.gender + ' · owner ' + a.farmerName"
      >
        <a routerLink="/animals" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>Back</a>
        @if (editable()) {
          <ng-container *appHasPermission="'animal.update'">
            <a [routerLink]="['/animals', a.id, 'edit']" class="btn btn-outline-secondary"><i class="bi bi-pencil me-1"></i>Edit</a>
            <button type="button" class="btn btn-outline-primary" (click)="dialogAction.set('sale')"><i class="bi bi-cash-coin me-1"></i>Sell</button>
            <button type="button" class="btn btn-outline-danger" (click)="dialogAction.set('death')"><i class="bi bi-x-octagon me-1"></i>Death</button>
            <button type="button" class="btn btn-outline-secondary" (click)="dialogAction.set('archive')"><i class="bi bi-archive me-1"></i>Archive</button>
          </ng-container>
        }
      </app-page-header>

      <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
        <span class="text-muted small">Status</span><app-status-badge [status]="a.status" />
        <span class="text-muted small ms-2">Milking</span><app-status-badge [status]="a.milkingStatus" color="info" />
        @if (a.pregnancyStatus === 'Pregnant') {
          <app-status-badge status="Pregnant" />
          @if (a.expectedDeliveryDate) {
            <span class="text-muted small">expected {{ a.expectedDeliveryDate.substring(0, 10) }}</span>
          }
        }
        <a [routerLink]="['/farmers', a.farmerId]" class="small ms-2 text-decoration-none"><i class="bi bi-person me-1"></i>{{ a.farmerName }}</a>
      </div>

      @if (!editable()) {
        <div class="alert alert-secondary py-2 small">This animal is {{ a.status.toLowerCase() }}. Records are read-only.</div>
      }

      <ul class="nav nav-tabs mb-3 flex-nowrap overflow-auto">
        @for (t of tabs(); track t.key) {
          <li class="nav-item">
            <button type="button" class="nav-link text-nowrap" [class.active]="tab() === t.key" (click)="tab.set(t.key)">
              <i class="bi {{ t.icon }} me-1"></i>{{ t.label }}
            </button>
          </li>
        }
      </ul>

      @switch (tab()) {
        @case ('overview') {
          <app-animal-overview-tab [animal]="a" />
        }
        @case ('lifecycle') {
          <app-animal-lifecycle-tab [animalId]="a.id" />
        }
        @default {
          @for (k of [tab()]; track k) {
            <app-animal-records-tab [animal]="a" [kind]="recordKind()" [canWrite]="editable()" (changed)="reload()" />
          }
        }
      }

      @if (dialogAction(); as act) {
        <app-animal-action-dialog [animal]="a" [action]="act" (closed)="dialogAction.set(null)" (done)="onActionDone($event)" />
      }
    }
  `,
})
export class AnimalDetailComponent implements OnInit {
  private readonly svc = inject(AnimalService);

  readonly id = input.required<string>();

  readonly animal = signal<AnimalDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly tab = signal<TabKey>('overview');
  readonly dialogAction = signal<AnimalAction | null>(null);

  readonly editable = computed(() => isAnimalEditable(this.animal()?.status));
  readonly tabs = computed(() => {
    const female = this.animal()?.gender === 'Female';
    return TABS.filter((t) => !t.femaleOnly || female);
  });
  readonly recordKind = computed(() => this.tab() as RecordKind);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.get(this.id()).subscribe({
      next: (a) => {
        this.animal.set(a);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  /** silent refresh after a record changed (animal status / pregnancy may follow the record) */
  reload(): void {
    this.svc.get(this.id()).subscribe((a) => this.animal.set(a));
  }

  onActionDone(updated: AnimalDetail): void {
    this.dialogAction.set(null);
    this.animal.set(updated);
    this.tab.set('lifecycle');
  }
}
