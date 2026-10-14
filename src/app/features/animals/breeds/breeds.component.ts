import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PagedQuery } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { numOrNull, nullIfEmpty } from '../../farmers/farmer.model';
import { ANIMAL_TYPES, Breed } from '../animal.model';
import { AnimalService } from '../animal.service';

@Component({
  selector: 'app-breeds',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, ModalComponent, FormFieldComponent, HasPermissionDirective, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Breeds" subtitle="Cattle, buffalo and goat breeds used when registering animals">
      <a routerLink="/animals" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>Animals</a>
      <button *appHasPermission="'animal.create'" type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="bi bi-plus-lg me-1"></i>Add Breed
      </button>
    </app-page-header>

    <app-data-table
      [columns]="columns"
      [items]="items()"
      [total]="total()"
      [loading]="loading()"
      [error]="error()"
      [page]="query.page ?? 1"
      [pageSize]="query.pageSize ?? 20"
      searchPlaceholder="Search code or name..."
      emptyTitle="No breeds found"
      (queryChange)="onQuery($event)"
      (retry)="load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2">
        <select class="form-select form-select-sm w-auto" formControlName="animalType" aria-label="Animal type">
          <option value="">All types</option>
          @for (t of types; track t) {
            <option [value]="t">{{ t }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="isActive" aria-label="Status">
          <option value="">Any status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <ng-template appRowActions let-row>
        <button *appHasPermission="'animal.update'" type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="openEdit(row)">
          <i class="bi bi-pencil"></i> Edit
        </button>
        <button
          *appHasPermission="'animal.update'"
          type="button"
          class="btn btn-sm"
          [class.btn-outline-danger]="row.isActive"
          [class.btn-outline-success]="!row.isActive"
          (click)="toggleActive(row)"
        >
          {{ row.isActive ? 'Deactivate' : 'Activate' }}
        </button>
      </ng-template>
    </app-data-table>

    <app-modal [open]="modalOpen()" [title]="editing() ? 'Edit Breed' : 'Add Breed'" (closed)="closeModal()">
      <form id="breedForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row">
          <div class="col-md-4">
            <app-form-field label="Code" inputId="brCode" [control]="form.controls.code">
              <input id="brCode" class="form-control text-uppercase" formControlName="code" maxlength="20" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-8">
            <app-form-field label="Name" inputId="brName" [control]="form.controls.name">
              <input id="brName" class="form-control" formControlName="name" maxlength="100" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Animal type" inputId="brType" [control]="form.controls.animalType">
              <select id="brType" class="form-select" formControlName="animalType">
                @for (t of types; track t) {
                  <option [value]="t">{{ t }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Average daily yield (L)" inputId="brYield" [control]="form.controls.averageDailyYield">
              <input id="brYield" type="number" min="0" step="0.1" class="form-control" formControlName="averageDailyYield" />
            </app-form-field>
          </div>
        </div>
        <app-form-field label="Description" inputId="brDesc" [control]="form.controls.description">
          <textarea id="brDesc" class="form-control" rows="2" formControlName="description" maxlength="300"></textarea>
        </app-form-field>
        @if (editing()) {
          <div class="form-check form-switch">
            <input id="brActive" type="checkbox" class="form-check-input" formControlName="isActive" />
            <label class="form-check-label" for="brActive">Active</label>
          </div>
        }
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeModal()">Cancel</button>
        <button type="submit" form="breedForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class BreedsComponent {
  private readonly svc = inject(AnimalService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly types = ANIMAL_TYPES;
  readonly columns: TableColumn[] = [
    { key: 'code', label: 'Code', sortable: true, width: '140px' },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'animalType', label: 'Type', sortable: true },
    { key: 'averageDailyYield', label: 'Avg yield (L/day)', type: 'number', sortable: true, align: 'end' },
    { key: 'description', label: 'Description' },
    { key: 'isActive', label: 'Status', type: 'badge', sortable: true },
  ];

  readonly filters = this.fb.group({ animalType: [''], isActive: [''] });
  readonly items = signal<Breed[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  query: PagedQuery = { page: 1, pageSize: 20 };

  readonly modalOpen = signal(false);
  readonly editing = signal<Breed | null>(null);
  readonly saving = signal(false);
  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(20)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    animalType: ['Cow', Validators.required],
    averageDailyYield: [null as number | null, Validators.min(0)],
    description: [''],
    isActive: [true],
  });

  constructor() {
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.query = { ...this.query, page: 1 };
      this.load();
    });
    this.load();
  }

  onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.breeds({ ...this.query, ...this.filters.getRawValue() }).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({ animalType: this.filters.controls.animalType.value || 'Cow', isActive: true });
    this.modalOpen.set(true);
  }

  openEdit(b: Breed): void {
    this.editing.set(b);
    this.form.reset({
      code: b.code,
      name: b.name,
      animalType: b.animalType,
      averageDailyYield: b.averageDailyYield,
      description: b.description ?? '',
      isActive: b.isActive,
    });
    this.modalOpen.set(true);
  }

  closeModal(): void {
    if (!this.saving()) {
      this.modalOpen.set(false);
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const current = this.editing();
    const body = {
      code: v.code.trim().toUpperCase(),
      name: v.name.trim(),
      animalType: v.animalType,
      averageDailyYield: numOrNull(v.averageDailyYield),
      description: nullIfEmpty(v.description),
    };
    this.saving.set(true);
    const request$ = current ? this.svc.updateBreed(current.id, { ...body, isActive: v.isActive }) : this.svc.createBreed(body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.lookups.clear('breeds');
        this.toast.success(current ? 'Breed updated.' : 'Breed created.');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  async toggleActive(b: Breed): Promise<void> {
    const activate = !b.isActive;
    const ok = await this.confirmService.confirm({
      title: activate ? 'Activate breed' : 'Deactivate breed',
      message: `${activate ? 'Activate' : 'Deactivate'} breed "${b.name}"?`,
      confirmText: activate ? 'Activate' : 'Deactivate',
      variant: activate ? 'primary' : 'danger',
    });
    if (!ok) {
      return;
    }
    const request$ = activate
      ? this.svc.updateBreed(b.id, {
          code: b.code,
          name: b.name,
          animalType: b.animalType,
          averageDailyYield: b.averageDailyYield,
          description: b.description,
          isActive: true,
        })
      : this.svc.deactivateBreed(b.id);
    request$.subscribe(() => {
      this.lookups.clear('breeds');
      this.toast.success(activate ? 'Breed activated.' : 'Breed deactivated.');
      this.load();
    });
  }
}
