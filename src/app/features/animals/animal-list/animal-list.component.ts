import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { ANIMAL_STATUSES, ANIMAL_TYPES, AnimalDueItem, AnimalListItem, isAnimalEditable } from '../animal.model';
import { AnimalService } from '../animal.service';

type ListMode = 'all' | 'vaccination' | 'deworming' | 'pregnancy';

@Component({
  selector: 'app-animal-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, HasPermissionDirective, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Animals" subtitle="Registered animals, health status and due reminders">
      <a routerLink="/animals/breeds" class="btn btn-outline-secondary"><i class="bi bi-diagram-3 me-1"></i>Breeds</a>
      <a *appHasPermission="'animal.create'" routerLink="/animals/new" class="btn btn-primary">
        <i class="bi bi-plus-lg me-1"></i>Register Animal
      </a>
    </app-page-header>

    <ul class="nav nav-pills mb-3 gap-1">
      @for (m of modes; track m.key) {
        <li class="nav-item">
          <button type="button" class="nav-link py-1" [class.active]="mode() === m.key" (click)="setMode(m.key)">
            <i class="bi {{ m.icon }} me-1"></i>{{ m.label }}
          </button>
        </li>
      }
    </ul>

    @if (mode() === 'all') {
      <app-data-table
        [columns]="columns"
        [items]="items()"
        [total]="total()"
        [loading]="loading()"
        [error]="error()"
        [page]="query.page ?? 1"
        [pageSize]="query.pageSize ?? 20"
        searchPlaceholder="Search tag, name or farmer..."
        emptyTitle="No animals found"
        (queryChange)="onQuery($event)"
        (retry)="load()"
      >
        <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2">
          <select class="form-select form-select-sm w-auto" formControlName="farmerId" aria-label="Farmer">
            <option value="">All farmers</option>
            @for (f of farmers(); track f.id) {
              <option [value]="f.id">{{ f.code }} - {{ f.name }}</option>
            }
          </select>
          <select class="form-select form-select-sm w-auto" formControlName="breedId" aria-label="Breed">
            <option value="">All breeds</option>
            @for (b of breeds(); track b.id) {
              <option [value]="b.id">{{ b.name }}</option>
            }
          </select>
          <select class="form-select form-select-sm w-auto" formControlName="animalType" aria-label="Type">
            <option value="">All types</option>
            @for (t of types; track t) {
              <option [value]="t">{{ t }}</option>
            }
          </select>
          <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
            <option value="">All statuses</option>
            @for (s of statuses; track s) {
              <option [value]="s">{{ s }}</option>
            }
          </select>
          <select class="form-select form-select-sm w-auto" formControlName="milkingStatus" aria-label="Milking status">
            <option value="">Any milking status</option>
            @for (s of milkingStatuses; track s) {
              <option [value]="s">{{ s }}</option>
            }
          </select>
          <select class="form-select form-select-sm w-auto" formControlName="pregnancyStatus" aria-label="Pregnancy status">
            <option value="">Any pregnancy status</option>
            <option value="Pregnant">Pregnant</option>
            <option value="NotPregnant">Not pregnant</option>
            <option value="Unknown">Unknown</option>
          </select>
        </div>

        <ng-template appColumn="tagNumber" let-row>
          <a [routerLink]="['/animals', row.id]" class="fw-semibold text-decoration-none">{{ row.tagNumber }}</a>
        </ng-template>
        <ng-template appColumn="farmerName" let-row>
          <a [routerLink]="['/farmers', row.farmerId]" class="text-decoration-none">{{ row.farmerName }}</a>
        </ng-template>
        <ng-template appColumn="ageMonths" let-row let-value="value">{{ ageText(value) }}</ng-template>
        <ng-template appRowActions let-row>
          <a [routerLink]="['/animals', row.id]" class="btn btn-sm btn-outline-primary me-1"><i class="bi bi-eye"></i> View</a>
          @if (editable(row.status)) {
            <a *appHasPermission="'animal.update'" [routerLink]="['/animals', row.id, 'edit']" class="btn btn-sm btn-outline-secondary">
              <i class="bi bi-pencil"></i> Edit
            </a>
          }
        </ng-template>
      </app-data-table>
    } @else {
      <app-data-table
        [columns]="dueColumns"
        [items]="dueItems()"
        [total]="total()"
        [loading]="loading()"
        [error]="error()"
        [page]="query.page ?? 1"
        [pageSize]="query.pageSize ?? 20"
        searchPlaceholder="Search tag, animal or farmer..."
        [emptyTitle]="'Nothing due: ' + mode()"
        emptyMessage="No animals have this reminder due in the selected window."
        (queryChange)="onQuery($event)"
        (retry)="load()"
      >
        <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2">
          <select class="form-select form-select-sm w-auto" formControlName="farmerId" aria-label="Farmer">
            <option value="">All farmers</option>
            @for (f of farmers(); track f.id) {
              <option [value]="f.id">{{ f.code }} - {{ f.name }}</option>
            }
          </select>
          <select class="form-select form-select-sm w-auto" formControlName="days" aria-label="Window">
            <option value="7">Next 7 days</option>
            <option value="15">Next 15 days</option>
            <option value="30">Next 30 days</option>
            <option value="60">Next 60 days</option>
            <option value="90">Next 90 days</option>
          </select>
        </div>

        <ng-template appColumn="tagNumber" let-row>
          <a [routerLink]="['/animals', row.animalId]" class="fw-semibold text-decoration-none">{{ row.tagNumber }}</a>
        </ng-template>
        <ng-template appColumn="daysRemaining" let-row let-value="value">
          @if (value < 0) {
            <span class="badge badge-soft badge-soft-danger">{{ -value }} d overdue</span>
          } @else if (value === 0) {
            <span class="badge badge-soft badge-soft-warning">Today</span>
          } @else {
            <span class="badge badge-soft badge-soft-info">in {{ value }} d</span>
          }
        </ng-template>
        <ng-template appRowActions let-row>
          <a [routerLink]="['/animals', row.animalId]" class="btn btn-sm btn-outline-primary"><i class="bi bi-eye"></i> View</a>
        </ng-template>
      </app-data-table>
    }
  `,
})
export class AnimalListComponent {
  private readonly svc = inject(AnimalService);
  private readonly lookups = inject(LookupService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly types = ANIMAL_TYPES;
  readonly statuses = ANIMAL_STATUSES;
  readonly milkingStatuses = ['Milking', 'Dry', 'Heifer', 'Calf', 'NotApplicable'];
  readonly modes: { key: ListMode; label: string; icon: string }[] = [
    { key: 'all', label: 'All animals', icon: 'bi-list-ul' },
    { key: 'vaccination', label: 'Vaccination due', icon: 'bi-shield-plus' },
    { key: 'deworming', label: 'Deworming due', icon: 'bi-bug' },
    { key: 'pregnancy', label: 'Delivery due', icon: 'bi-calendar-heart' },
  ];

  readonly farmers = toSignal(this.lookups.get('farmers'), { initialValue: [] as LookupItem[] });
  readonly breeds = toSignal(this.lookups.get('breeds'), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'tagNumber', label: 'Tag', sortable: true, width: '110px' },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'farmerName', label: 'Farmer', sortable: true },
    { key: 'breedName', label: 'Breed', sortable: true },
    { key: 'animalType', label: 'Type', sortable: true },
    { key: 'gender', label: 'Gender', sortable: true },
    { key: 'ageMonths', label: 'Age', sortable: true, sortKey: 'dateOfBirth' },
    { key: 'milkingStatus', label: 'Milking', sortable: true },
    { key: 'pregnancyStatus', label: 'Pregnancy', type: 'badge', sortable: true },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
  ];

  readonly dueColumns: TableColumn[] = [
    { key: 'tagNumber', label: 'Tag', sortable: true, width: '110px' },
    { key: 'animalName', label: 'Animal' },
    { key: 'farmerName', label: 'Farmer', sortable: true },
    { key: 'title', label: 'Reminder', sortable: true },
    { key: 'dueDate', label: 'Due date', type: 'date', sortable: true },
    { key: 'daysRemaining', label: 'When', type: 'template' },
    { key: 'status', label: 'Status', type: 'badge' },
  ];

  readonly filters = this.fb.group({
    farmerId: [''],
    breedId: [''],
    animalType: [''],
    status: [''],
    milkingStatus: [''],
    pregnancyStatus: [''],
    days: ['30'],
  });

  readonly mode = signal<ListMode>('all');
  readonly items = signal<AnimalListItem[]>([]);
  readonly dueItems = signal<AnimalDueItem[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  query: PagedQuery = { page: 1, pageSize: 20 };

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      const due = p.get('due');
      const initialMode: ListMode =
        due === 'vaccination' || due === 'deworming' || due === 'pregnancy'
          ? due
          : p.get('vaccinationDue') === 'true'
            ? 'vaccination'
            : 'all';
      this.filters.patchValue(
        {
          farmerId: p.get('farmerId') ?? '',
          breedId: p.get('breedId') ?? '',
          animalType: p.get('animalType') ?? '',
          status: p.get('status') ?? p.get('healthStatus') ?? '',
          milkingStatus: p.get('milkingStatus') ?? '',
          pregnancyStatus: p.get('pregnancyStatus') ?? '',
          days: p.get('days') ?? '30',
        },
        { emitEvent: false },
      );
      this.mode.set(initialMode);
      this.resetAndLoad();
    });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.resetAndLoad(false));
  }

  editable(status: string): boolean {
    return isAnimalEditable(status);
  }

  ageText(months: number | null | undefined): string {
    if (months === null || months === undefined) {
      return '—';
    }
    return months < 12 ? `${months} m` : `${Math.floor(months / 12)}y ${months % 12}m`;
  }

  setMode(m: ListMode): void {
    if (m !== this.mode()) {
      this.mode.set(m);
      this.items.set([]);
      this.dueItems.set([]);
      this.resetAndLoad();
    }
  }

  private resetAndLoad(resetSort = true): void {
    this.query = { ...this.query, page: 1, ...(resetSort ? { sortBy: undefined, sortDir: undefined } : {}) };
    this.load();
  }

  onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const { days, ...rest } = this.filters.getRawValue();
    const mode = this.mode();
    const done = (total: number) => {
      this.total.set(total);
      this.loading.set(false);
    };
    const fail = (err: unknown) => {
      this.error.set(errorMessage(err));
      this.loading.set(false);
    };
    if (mode === 'all') {
      this.svc.list({ ...this.query, ...rest }).subscribe({
        next: (res) => {
          this.items.set(res.items);
          done(res.total);
        },
        error: fail,
      });
    } else {
      this.svc.due({ ...this.query, type: mode, days, farmerId: rest.farmerId }).subscribe({
        next: (res) => {
          this.dueItems.set(res.items);
          done(res.total);
        },
        error: fail,
      });
    }
  }
}
