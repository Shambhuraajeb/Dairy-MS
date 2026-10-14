import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { PagedQuery } from '../../../../core/models/api.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { errorMessage } from '../../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS } from '../../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { toIsoDate } from '../../../../shared/utils/format';
import { positiveNumberValidator } from '../../../../shared/validators/app-validators';
import { dateOnly, nullIfEmpty, numOrNull } from '../../../farmers/farmer.model';
import { AnimalDetail } from '../../animal.model';
import { AnimalRecordRow, AnimalService } from '../../animal.service';
import { RECORD_CONFIGS, RecordField, RecordKind } from '../animal-records.config';

/**
 * Generic CRUD tab for the per-animal record resources (health, vaccinations, dewormings, breedings,
 * pregnancies, milk-production). Columns and form fields come from animal-records.config.ts.
 */
@Component({
  selector: 'app-animal-records-tab',
  standalone: true,
  imports: [ReactiveFormsModule, FormFieldComponent, ModalComponent, HasPermissionDirective, ...DATA_TABLE_IMPORTS],
  template: `
    <app-data-table
      [columns]="config().columns"
      [items]="items()"
      [total]="total()"
      [loading]="loading()"
      [error]="error()"
      [page]="query.page ?? 1"
      [pageSize]="query.pageSize ?? 10"
      [pageSizeOptions]="[10, 20, 50]"
      [searchable]="false"
      [emptyTitle]="'No ' + config().title.toLowerCase() + ' yet'"
      emptyMessage="Use the Add button to record the first entry."
      (queryChange)="onQuery($event)"
      (retry)="load()"
    >
      <div tableFilters [formGroup]="dateFilter" class="d-flex flex-wrap align-items-center gap-2">
        <span class="small text-muted"><i class="bi {{ config().icon }} me-1"></i>{{ config().title }}</span>
        <input type="date" class="form-control form-control-sm w-auto" formControlName="dateFrom" aria-label="From date" />
        <span class="small text-muted">to</span>
        <input type="date" class="form-control form-control-sm w-auto" formControlName="dateTo" aria-label="To date" />
      </div>
      <div tableActions>
        @if (canWrite()) {
          <button *appHasPermission="['animal.create', 'animal.update']" type="button" class="btn btn-sm btn-primary" (click)="openCreate()">
            <i class="bi bi-plus-lg me-1"></i>Add
          </button>
        }
      </div>
      <ng-template appRowActions let-row>
        @if (canWrite()) {
          <ng-container *appHasPermission="'animal.update'">
            <button type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="openEdit(row)"><i class="bi bi-pencil"></i></button>
            <button type="button" class="btn btn-sm btn-outline-danger" (click)="remove(row)"><i class="bi bi-trash"></i></button>
          </ng-container>
        }
      </ng-template>
    </app-data-table>

    <app-modal [open]="modalOpen()" [title]="(editing() ? 'Edit ' : 'Add ') + config().singular" size="lg" (closed)="closeModal()">
      <form id="recordForm" [formGroup]="form" (ngSubmit)="save()" novalidate class="row g-0">
        @for (f of config().fields; track f.key) {
          <div [class]="'col-md-' + (f.col ?? 6) + ' pe-md-3'">
            <app-form-field [label]="f.label" [inputId]="'rec-' + f.key" [control]="ctrl(f.key)" [hint]="f.hint ?? ''" [required]="isRequired(f)">
              @switch (f.type) {
                @case ('select') {
                  <select class="form-select" [id]="'rec-' + f.key" [formControlName]="f.key">
                    @if (!f.required) {
                      <option value="">-</option>
                    }
                    @for (o of f.options ?? []; track o) {
                      <option [value]="o">{{ optionLabel(o) }}</option>
                    }
                  </select>
                }
                @case ('textarea') {
                  <textarea class="form-control" rows="2" [id]="'rec-' + f.key" [formControlName]="f.key" maxlength="500"></textarea>
                }
                @case ('number') {
                  <input type="number" class="form-control" min="0" [attr.step]="f.step ?? '1'" [id]="'rec-' + f.key" [formControlName]="f.key" />
                }
                @case ('date') {
                  <input type="date" class="form-control" [id]="'rec-' + f.key" [formControlName]="f.key" />
                }
                @default {
                  <input type="text" class="form-control" maxlength="200" [id]="'rec-' + f.key" [formControlName]="f.key" />
                }
              }
            </app-form-field>
          </div>
        }
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeModal()">Cancel</button>
        <button type="submit" form="recordForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class AnimalRecordsTabComponent implements OnInit {
  private readonly svc = inject(AnimalService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly animal = input.required<AnimalDetail>();
  readonly kind = input.required<RecordKind>();
  /** false when the animal is Sold/Dead/Archived or the user cannot write */
  readonly canWrite = input(true);
  readonly changed = output<void>();

  readonly config = computed(() => RECORD_CONFIGS[this.kind()]);

  readonly items = signal<AnimalRecordRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  query: PagedQuery = { page: 1, pageSize: 10 };
  readonly dateFilter = this.fb.group({ dateFrom: [''], dateTo: [''] });

  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<AnimalRecordRow | null>(null);
  form = new FormGroup<Record<string, FormControl<unknown>>>({});

  constructor() {
    this.dateFilter.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.query = { ...this.query, page: 1 };
      this.load();
    });
  }

  ngOnInit(): void {
    this.buildForm();
    this.load();
  }

  private buildForm(): void {
    const controls: Record<string, FormControl<unknown>> = {};
    for (const f of this.config().fields) {
      const validators: ValidatorFn[] = [];
      if (f.required) {
        validators.push(Validators.required);
      }
      if (f.type === 'number') {
        validators.push(f.positive ? positiveNumberValidator() : Validators.min(0));
      }
      controls[f.key] = new FormControl<unknown>('', { validators, nonNullable: true });
    }
    this.form = new FormGroup(controls);
  }

  ctrl(key: string): AbstractControl {
    return this.form.controls[key];
  }

  isRequired(f: RecordField): boolean {
    if (f.required) {
      return true;
    }
    return !!f.requiredWhen && this.form.controls[f.requiredWhen.field]?.value === f.requiredWhen.value;
  }

  optionLabel(o: string): string {
    return o.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.records(this.animal().id, this.config().resource, { ...this.query, ...this.dateFilter.getRawValue() }).subscribe({
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
    const values: Record<string, unknown> = {};
    for (const f of this.config().fields) {
      values[f.key] = f.default === 'today' ? toIsoDate() : (f.default ?? '');
    }
    this.form.reset(values);
    this.editing.set(null);
    this.modalOpen.set(true);
  }

  openEdit(row: AnimalRecordRow): void {
    const values: Record<string, unknown> = {};
    for (const f of this.config().fields) {
      const v = row[f.key];
      values[f.key] = v === null || v === undefined ? '' : f.type === 'date' ? dateOnly(String(v)) : v;
    }
    this.form.reset(values);
    this.editing.set(row);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    if (!this.saving()) {
      this.modalOpen.set(false);
    }
  }

  private isBlank(v: unknown): boolean {
    return v === null || v === undefined || String(v).trim() === '';
  }

  save(): void {
    const fields = this.config().fields;
    for (const f of fields) {
      if (f.requiredWhen && this.form.controls[f.requiredWhen.field].value === f.requiredWhen.value && this.isBlank(this.form.controls[f.key].value)) {
        this.form.controls[f.key].setErrors({ required: true });
      }
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      const v = raw[f.key];
      body[f.key] = f.type === 'number' ? numOrNull(v as string | number | null) : nullIfEmpty(this.isBlank(v) ? '' : String(v));
    }
    const current = this.editing();
    const animalId = this.animal().id;
    const resource = this.config().resource;
    this.saving.set(true);
    const request$ = current
      ? this.svc.updateRecord(animalId, resource, current.id, body)
      : this.svc.createRecord(animalId, resource, body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.toast.success(current ? 'Record updated.' : 'Record added.');
        this.load();
        this.changed.emit();
      },
      error: () => this.saving.set(false),
    });
  }

  async remove(row: AnimalRecordRow): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Delete record',
      message: `Delete this ${this.config().singular}?`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc.deleteRecord(this.animal().id, this.config().resource, row.id).subscribe(() => {
      this.toast.success('Record deleted.');
      this.load();
      this.changed.emit();
    });
  }
}
