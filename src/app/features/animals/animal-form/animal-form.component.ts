import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { toIsoDate } from '../../../shared/utils/format';
import { dateOnly, nullIfEmpty, numOrNull } from '../../farmers/farmer.model';
import { ANIMAL_TYPES, AnimalDetail, AnimalRequest, isAnimalEditable } from '../animal.model';
import { AnimalService } from '../animal.service';

@Component({
  selector: 'app-animal-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, FormFieldComponent, LoadingComponent],
  template: `
    <app-page-header [title]="isEdit() ? 'Edit Animal' : 'Register Animal'" subtitle="Tag, owner, breed and reproductive details">
      <a [routerLink]="isEdit() ? ['/animals', id()] : ['/animals']" class="btn btn-light">Cancel</a>
    </app-page-header>

    @if (loading()) {
      <app-loading text="Loading animal..." />
    } @else if (loadError()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center">
        <span>{{ loadError() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="loadAnimal()">Retry</button>
      </div>
    } @else {
      @if (readOnly()) {
        <div class="alert alert-warning">This animal is {{ statusText() }} and can no longer be edited.</div>
      }
      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="card mb-3">
          <div class="card-header">Identification</div>
          <div class="card-body row g-0">
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Tag number" inputId="tagNumber" [control]="form.controls.tagNumber" hint="Must be unique">
                <input id="tagNumber" class="form-control" formControlName="tagNumber" maxlength="30" autocomplete="off" />
              </app-form-field>
            </div>
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Name" inputId="name" [control]="form.controls.name">
                <input id="name" class="form-control" formControlName="name" maxlength="100" />
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Farmer (owner)" inputId="farmerId" [control]="form.controls.farmerId" hint="Only active farmers are listed">
                <select id="farmerId" class="form-select" formControlName="farmerId">
                  <option value="">Select farmer</option>
                  @for (f of farmerOptions(); track f.id) {
                    <option [value]="f.id">{{ f.code ? f.code + ' - ' : '' }}{{ f.name }}</option>
                  }
                </select>
              </app-form-field>
            </div>
            <div class="col-md-3 pe-md-3">
              <app-form-field label="Animal type" inputId="animalType" [control]="form.controls.animalType">
                <select id="animalType" class="form-select" formControlName="animalType">
                  @for (t of types; track t) {
                    <option [value]="t">{{ t }}</option>
                  }
                </select>
              </app-form-field>
            </div>
            <div class="col-md-3 pe-md-3">
              <app-form-field label="Breed" inputId="breedId" [control]="form.controls.breedId">
                <select id="breedId" class="form-select" formControlName="breedId">
                  <option value="">Select breed</option>
                  @for (b of breeds(); track b.id) {
                    <option [value]="b.id">{{ b.name }}</option>
                  }
                </select>
              </app-form-field>
            </div>
            <div class="col-md-3 pe-md-3">
              <app-form-field label="Gender" inputId="gender" [control]="form.controls.gender">
                <select id="gender" class="form-select" formControlName="gender">
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </app-form-field>
            </div>
            <div class="col-md-3">
              <app-form-field label="Source" inputId="source" [control]="form.controls.source">
                <select id="source" class="form-select" formControlName="source">
                  <option value="Born">Born on farm</option>
                  <option value="Purchased">Purchased</option>
                </select>
              </app-form-field>
            </div>
            <div class="col-md-3 pe-md-3">
              <app-form-field label="Date of birth" inputId="dateOfBirth" [control]="form.controls.dateOfBirth">
                <input id="dateOfBirth" type="date" class="form-control" formControlName="dateOfBirth" [max]="today" />
              </app-form-field>
            </div>
            <div class="col-md-3 pe-md-3">
              <app-form-field label="Registration date" inputId="registrationDate" [control]="form.controls.registrationDate">
                <input id="registrationDate" type="date" class="form-control" formControlName="registrationDate" [max]="today" />
              </app-form-field>
            </div>
            <div class="col-md-3 pe-md-3">
              <app-form-field label="Color" inputId="color" [control]="form.controls.color">
                <input id="color" class="form-control" formControlName="color" maxlength="50" />
              </app-form-field>
            </div>
            <div class="col-md-3">
              <app-form-field label="Weight (kg)" inputId="weightKg" [control]="form.controls.weightKg">
                <input id="weightKg" type="number" min="0" step="0.1" class="form-control" formControlName="weightKg" />
              </app-form-field>
            </div>
          </div>
        </div>

        @if (isFemale()) {
          <div class="card mb-3">
            <div class="card-header">Milking &amp; reproduction</div>
            <div class="card-body row g-0">
              <div class="col-md-3 pe-md-3">
                <app-form-field label="Milking status" inputId="milkingStatus" [control]="form.controls.milkingStatus">
                  <select id="milkingStatus" class="form-select" formControlName="milkingStatus">
                    <option value="Milking">Milking</option>
                    <option value="Dry">Dry</option>
                    <option value="Heifer">Heifer</option>
                    <option value="Calf">Calf</option>
                    <option value="NotApplicable">Not applicable</option>
                  </select>
                </app-form-field>
              </div>
              <div class="col-md-3 pe-md-3">
                <app-form-field label="Pregnancy status" inputId="pregnancyStatus" [control]="form.controls.pregnancyStatus">
                  <select id="pregnancyStatus" class="form-select" formControlName="pregnancyStatus">
                    <option value="NotPregnant">Not pregnant</option>
                    <option value="Pregnant">Pregnant</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </app-form-field>
              </div>
              @if (isPregnant()) {
                <div class="col-md-3 pe-md-3">
                  <app-form-field label="Expected delivery" inputId="expectedDeliveryDate" [control]="form.controls.expectedDeliveryDate">
                    <input id="expectedDeliveryDate" type="date" class="form-control" formControlName="expectedDeliveryDate" />
                  </app-form-field>
                </div>
              }
              <div class="col-md-3 pe-md-3">
                <app-form-field label="Lactation no." inputId="lactationNo" [control]="form.controls.lactationNo">
                  <input id="lactationNo" type="number" min="0" step="1" class="form-control" formControlName="lactationNo" />
                </app-form-field>
              </div>
              <div class="col-md-3">
                <app-form-field label="Last calving date" inputId="lastCalvingDate" [control]="form.controls.lastCalvingDate">
                  <input id="lastCalvingDate" type="date" class="form-control" formControlName="lastCalvingDate" [max]="today" />
                </app-form-field>
              </div>
            </div>
          </div>
        }

        <div class="card mb-3">
          <div class="card-body">
            <app-form-field label="Remarks" inputId="remarks" [control]="form.controls.remarks">
              <textarea id="remarks" class="form-control" rows="2" formControlName="remarks" maxlength="500"></textarea>
            </app-form-field>
          </div>
        </div>

        <div class="d-flex justify-content-end gap-2 mb-4">
          <a [routerLink]="isEdit() ? ['/animals', id()] : ['/animals']" class="btn btn-light">Cancel</a>
          <button type="submit" class="btn btn-primary" [disabled]="saving() || readOnly()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm me-1"></span>
            }
            {{ isEdit() ? 'Save changes' : 'Register animal' }}
          </button>
        </div>
      </form>
    }
  `,
})
export class AnimalFormComponent implements OnInit {
  private readonly svc = inject(AnimalService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  /** route param (present on /animals/:id/edit) */
  readonly id = input<string>();

  readonly types = ANIMAL_TYPES;
  readonly today = toIsoDate();
  readonly isEdit = signal(false);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly readOnly = signal(false);
  readonly statusText = signal('');
  readonly isFemale = signal(true);
  readonly isPregnant = signal(false);

  private readonly activeFarmers = toSignal(this.lookups.get('farmers', { status: 'Active' }), { initialValue: [] as LookupItem[] });
  private readonly currentFarmer = signal<LookupItem | null>(null);
  readonly farmerOptions = computed(() => {
    const list = this.activeFarmers();
    const cur = this.currentFarmer();
    return cur && !list.some((f) => f.id === cur.id) ? [cur, ...list] : list;
  });
  readonly breeds = signal<LookupItem[]>([]);

  readonly form = this.fb.group({
    tagNumber: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', Validators.maxLength(100)],
    farmerId: ['', Validators.required],
    animalType: ['Cow', Validators.required],
    breedId: [''],
    gender: ['Female', Validators.required],
    source: ['Born', Validators.required],
    dateOfBirth: [''],
    registrationDate: [toIsoDate()],
    color: [''],
    weightKg: [null as number | null, Validators.min(0)],
    milkingStatus: ['Heifer', Validators.required],
    pregnancyStatus: ['NotPregnant', Validators.required],
    expectedDeliveryDate: [''],
    lactationNo: [null as number | null, [Validators.min(0), Validators.pattern(/^\d+$/)]],
    lastCalvingDate: [''],
    remarks: [''],
  });

  constructor() {
    const c = this.form.controls;
    c.animalType.valueChanges.subscribe(() => {
      c.breedId.setValue('');
      this.refreshDerived();
    });
    c.gender.valueChanges.subscribe((g) => {
      if (g === 'Male') {
        c.milkingStatus.setValue('NotApplicable');
        c.pregnancyStatus.setValue('NotPregnant');
        c.expectedDeliveryDate.setValue('');
      }
      this.refreshDerived();
    });
    c.pregnancyStatus.valueChanges.subscribe(() => this.refreshDerived());
    this.refreshDerived();
  }

  ngOnInit(): void {
    const preset = this.id();
    if (preset) {
      this.isEdit.set(true);
      this.loadAnimal();
    }
  }

  loadAnimal(): void {
    const id = this.id();
    if (!id) {
      return;
    }
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.get(id).subscribe({
      next: (a) => {
        this.patch(a);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  private patch(a: AnimalDetail): void {
    this.currentFarmer.set({ id: a.farmerId, code: a.farmerCode, name: a.farmerName });
    this.readOnly.set(!isAnimalEditable(a.status));
    this.statusText.set(a.status.toLowerCase());
    this.form.patchValue(
      {
        tagNumber: a.tagNumber,
        name: a.name ?? '',
        farmerId: String(a.farmerId),
        animalType: a.animalType,
        breedId: a.breedId ? String(a.breedId) : '',
        gender: a.gender,
        source: a.source || 'Born',
        dateOfBirth: dateOnly(a.dateOfBirth),
        registrationDate: dateOnly(a.registrationDate),
        color: a.color ?? '',
        weightKg: a.weightKg,
        milkingStatus: a.milkingStatus,
        pregnancyStatus: a.pregnancyStatus,
        expectedDeliveryDate: dateOnly(a.expectedDeliveryDate),
        lactationNo: a.lactationNo,
        lastCalvingDate: dateOnly(a.lastCalvingDate),
        remarks: a.remarks ?? '',
      },
      { emitEvent: false },
    );
    this.refreshDerived();
  }

  /** female-only sections, conditional validators and the breed list for the selected type */
  private refreshDerived(): void {
    const c = this.form.controls;
    this.isFemale.set(c.gender.value === 'Female');
    const pregnant = c.gender.value === 'Female' && c.pregnancyStatus.value === 'Pregnant';
    this.isPregnant.set(pregnant);
    c.expectedDeliveryDate.setValidators(pregnant ? Validators.required : null);
    c.expectedDeliveryDate.updateValueAndValidity({ emitEvent: false });
    this.lookups.get('breeds', { status: c.animalType.value }).subscribe((list) => this.breeds.set(list));
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please correct the highlighted fields.');
      return;
    }
    const v = this.form.getRawValue();
    const female = v.gender === 'Female';
    const pregnant = female && v.pregnancyStatus === 'Pregnant';
    const body: AnimalRequest = {
      tagNumber: v.tagNumber.trim(),
      farmerId: Number(v.farmerId),
      breedId: numOrNull(v.breedId),
      name: nullIfEmpty(v.name),
      animalType: v.animalType,
      gender: v.gender,
      dateOfBirth: nullIfEmpty(v.dateOfBirth),
      color: nullIfEmpty(v.color),
      weightKg: numOrNull(v.weightKg),
      source: v.source,
      registrationDate: nullIfEmpty(v.registrationDate),
      lactationNo: female ? numOrNull(v.lactationNo) : null,
      lastCalvingDate: female ? nullIfEmpty(v.lastCalvingDate) : null,
      milkingStatus: female ? v.milkingStatus : 'NotApplicable',
      pregnancyStatus: female ? v.pregnancyStatus : 'NotPregnant',
      expectedDeliveryDate: pregnant ? nullIfEmpty(v.expectedDeliveryDate) : null,
      remarks: nullIfEmpty(v.remarks),
    };
    const editing = this.isEdit();
    this.saving.set(true);
    const request$ = editing ? this.svc.update(this.id()!, body) : this.svc.create(body);
    request$.subscribe({
      next: (a) => {
        this.saving.set(false);
        this.toast.success(editing ? 'Animal updated.' : `Animal ${a.tagNumber} registered.`);
        void this.router.navigate(['/animals', a.id]);
      },
      error: () => this.saving.set(false),
    });
  }
}
