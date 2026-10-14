import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PagedList, orNull } from '../../../shared/utils/paged-list';
import { CollectionCenter, CollectionCenterRequest } from '../administration.model';
import { AdministrationService } from '../administration.service';

@Component({
  selector: 'app-centers-tab',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent, ...DATA_TABLE_IMPORTS],
  template: `
    <app-data-table
      [columns]="columns"
      [items]="list.items()"
      [total]="list.total()"
      [loading]="list.loading()"
      [error]="list.error()"
      [page]="list.query.page ?? 1"
      [pageSize]="list.query.pageSize ?? 20"
      searchPlaceholder="Search collection centers..."
      emptyTitle="No collection centers found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters">
        <select class="form-select form-select-sm w-auto" formControlName="branchId" aria-label="Branch">
          <option value="">All branches</option>
          @for (b of branches(); track b.id) {
            <option [value]="b.id">{{ b.name }}</option>
          }
        </select>
      </div>
      <div tableActions>
        <button type="button" class="btn btn-sm btn-primary" (click)="openCreate()"><i class="bi bi-plus-lg me-1"></i>Add Center</button>
      </div>
      <ng-template appRowActions let-row>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="openEdit(row)"><i class="bi bi-pencil"></i> Edit</button>
      </ng-template>
    </app-data-table>

    <app-modal [open]="modalOpen()" [title]="editing() ? 'Edit Collection Center' : 'Add Collection Center'" size="lg" (closed)="closeModal()">
      <form id="centerForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row">
          <div class="col-md-4">
            <app-form-field label="Branch" inputId="ccBranch" [control]="form.controls.branchId">
              <select id="ccBranch" class="form-select" formControlName="branchId">
                <option [ngValue]="null">Select branch</option>
                @for (b of branches(); track b.id) {
                  <option [ngValue]="b.id">{{ b.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-3">
            <app-form-field label="Code" inputId="ccCode" [control]="form.controls.code">
              <input id="ccCode" class="form-control text-uppercase" formControlName="code" maxlength="30" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-5">
            <app-form-field label="Name" inputId="ccName" [control]="form.controls.name">
              <input id="ccName" class="form-control" formControlName="name" maxlength="150" />
            </app-form-field>
          </div>
          <div class="col-md-12">
            <app-form-field label="Address" inputId="ccAddress" [control]="form.controls.addressLine">
              <input id="ccAddress" class="form-control" formControlName="addressLine" maxlength="250" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="City" inputId="ccCity" [control]="form.controls.city">
              <input id="ccCity" class="form-control" formControlName="city" maxlength="100" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Pincode" inputId="ccPin" [control]="form.controls.pincode" [messages]="{ pattern: 'Pincode must be 6 digits.' }">
              <input id="ccPin" class="form-control" formControlName="pincode" maxlength="6" inputmode="numeric" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Capacity (liters)" inputId="ccCap" [control]="form.controls.capacityLiters">
              <input id="ccCap" type="number" min="0" step="1" class="form-control" formControlName="capacityLiters" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Contact person" inputId="ccContact" [control]="form.controls.contactPerson">
              <input id="ccContact" class="form-control" formControlName="contactPerson" maxlength="150" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Mobile" inputId="ccMobile" [control]="form.controls.mobile" [messages]="{ pattern: 'Enter 10-13 digits.' }">
              <input id="ccMobile" class="form-control" formControlName="mobile" maxlength="13" inputmode="tel" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Supervisor" inputId="ccSupervisor" [control]="form.controls.supervisorEmployeeId">
              <select id="ccSupervisor" class="form-select" formControlName="supervisorEmployeeId">
                <option [ngValue]="null">None</option>
                @for (e of employees(); track e.id) {
                  <option [ngValue]="e.id">{{ e.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Latitude" inputId="ccLat" [control]="form.controls.latitude">
              <input id="ccLat" type="number" min="-90" max="90" step="any" class="form-control" formControlName="latitude" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Longitude" inputId="ccLng" [control]="form.controls.longitude">
              <input id="ccLng" type="number" min="-180" max="180" step="any" class="form-control" formControlName="longitude" />
            </app-form-field>
          </div>
        </div>
        @if (editing()) {
          <div class="form-check form-switch">
            <input id="ccActive" type="checkbox" class="form-check-input" formControlName="isActive" />
            <label class="form-check-label" for="ccActive">Active</label>
          </div>
        }
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeModal()">Cancel</button>
        <button type="submit" form="centerForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class CentersTabComponent {
  private readonly svc = inject(AdministrationService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly branches = toSignal(this.lookups.get('branches'), { initialValue: [] as LookupItem[] });
  readonly employees = toSignal(this.lookups.get('employees'), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'code', label: 'Code', sortable: true, width: '120px' },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'branchName', label: 'Branch' },
    { key: 'city', label: 'City', sortable: true },
    { key: 'supervisorName', label: 'Supervisor' },
    { key: 'capacityLiters', label: 'Capacity (L)', type: 'number' },
    { key: 'isActive', label: 'Status', type: 'badge', sortable: true, width: '110px' },
  ];

  readonly filters = this.fb.group({ branchId: [''] });
  readonly list = new PagedList<CollectionCenter>(
    (q) => this.svc.listOrg<CollectionCenter>('collection-centers', q),
    () => this.filters.getRawValue() as PagedQuery,
  );
  readonly modalOpen = signal(false);
  readonly editing = signal<CollectionCenter | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    branchId: [null as number | null, Validators.required],
    code: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    addressLine: [''],
    city: [''],
    pincode: ['', Validators.pattern(/^\d{6}$/)],
    mobile: ['', Validators.pattern(/^\d{10,13}$/)],
    contactPerson: [''],
    latitude: [null as number | null, [Validators.min(-90), Validators.max(90)]],
    longitude: [null as number | null, [Validators.min(-180), Validators.max(180)]],
    supervisorEmployeeId: [null as number | null],
    capacityLiters: [null as number | null, Validators.min(0)],
    isActive: [true],
  });

  constructor() {
    this.list.load();
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset();
    this.modalOpen.set(true);
  }

  openEdit(c: CollectionCenter): void {
    this.editing.set(c);
    this.form.reset({
      branchId: c.branchId,
      code: c.code,
      name: c.name,
      addressLine: c.addressLine ?? '',
      city: c.city ?? '',
      pincode: c.pincode ?? '',
      mobile: c.mobile ?? '',
      contactPerson: c.contactPerson ?? '',
      latitude: c.latitude,
      longitude: c.longitude,
      supervisorEmployeeId: c.supervisorEmployeeId,
      capacityLiters: c.capacityLiters,
      isActive: c.isActive,
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
    const body: CollectionCenterRequest = {
      branchId: v.branchId as number,
      code: v.code.trim(),
      name: v.name.trim(),
      addressLine: orNull(v.addressLine.trim()),
      city: orNull(v.city.trim()),
      pincode: orNull(v.pincode.trim()),
      mobile: orNull(v.mobile.trim()),
      contactPerson: orNull(v.contactPerson.trim()),
      latitude: v.latitude,
      longitude: v.longitude,
      supervisorEmployeeId: v.supervisorEmployeeId,
      capacityLiters: v.capacityLiters,
      isActive: v.isActive,
    };
    const current = this.editing();
    this.saving.set(true);
    const request$ = current
      ? this.svc.updateOrg<CollectionCenter>('collection-centers', current.id, body)
      : this.svc.createOrg<CollectionCenter>('collection-centers', body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.toast.success(current ? 'Collection center updated.' : 'Collection center created.');
        this.lookups.clear('collection-centers');
        this.list.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
