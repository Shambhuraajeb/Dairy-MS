import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PagedList, orNull } from '../../../shared/utils/paged-list';
import { Dairy, DairyRequest } from '../administration.model';
import { AdministrationService } from '../administration.service';

@Component({
  selector: 'app-dairy-tab',
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
      searchPlaceholder="Search dairies..."
      emptyTitle="No dairies found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableActions>
        <button type="button" class="btn btn-sm btn-primary" (click)="openCreate()"><i class="bi bi-plus-lg me-1"></i>Add Dairy</button>
      </div>
      <ng-template appRowActions let-row>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="openEdit(row)"><i class="bi bi-pencil"></i> Edit</button>
      </ng-template>
    </app-data-table>

    <app-modal [open]="modalOpen()" [title]="editing() ? 'Edit Dairy' : 'Add Dairy'" size="lg" (closed)="closeModal()">
      <form id="dairyForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row">
          <div class="col-md-4">
            <app-form-field label="Code" inputId="dyCode" [control]="form.controls.code">
              <input id="dyCode" class="form-control text-uppercase" formControlName="code" maxlength="30" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-8">
            <app-form-field label="Name" inputId="dyName" [control]="form.controls.name">
              <input id="dyName" class="form-control" formControlName="name" maxlength="150" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Owner" inputId="dyOwner" [control]="form.controls.ownerName">
              <input id="dyOwner" class="form-control" formControlName="ownerName" maxlength="150" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Mobile" inputId="dyMobile" [control]="form.controls.mobile" [messages]="{ pattern: 'Enter 10-13 digits.' }">
              <input id="dyMobile" class="form-control" formControlName="mobile" maxlength="13" inputmode="tel" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Email" inputId="dyEmail" [control]="form.controls.email">
              <input id="dyEmail" type="email" class="form-control" formControlName="email" maxlength="150" />
            </app-form-field>
          </div>
          <div class="col-md-12">
            <app-form-field label="Address" inputId="dyAddress" [control]="form.controls.addressLine">
              <input id="dyAddress" class="form-control" formControlName="addressLine" maxlength="250" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="City" inputId="dyCity" [control]="form.controls.city">
              <input id="dyCity" class="form-control" formControlName="city" maxlength="100" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="State" inputId="dyState" [control]="form.controls.state">
              <input id="dyState" class="form-control" formControlName="state" maxlength="100" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Pincode" inputId="dyPin" [control]="form.controls.pincode" [messages]="{ pattern: 'Pincode must be 6 digits.' }">
              <input id="dyPin" class="form-control" formControlName="pincode" maxlength="6" inputmode="numeric" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="GST number" inputId="dyGst" [control]="form.controls.gstNumber">
              <input id="dyGst" class="form-control text-uppercase" formControlName="gstNumber" maxlength="20" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="License no." inputId="dyLic" [control]="form.controls.licenseNo">
              <input id="dyLic" class="form-control" formControlName="licenseNo" maxlength="50" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Registration no." inputId="dyReg" [control]="form.controls.registrationNo">
              <input id="dyReg" class="form-control" formControlName="registrationNo" maxlength="50" />
            </app-form-field>
          </div>
        </div>
        @if (editing()) {
          <div class="form-check form-switch">
            <input id="dyActive" type="checkbox" class="form-check-input" formControlName="isActive" />
            <label class="form-check-label" for="dyActive">Active</label>
          </div>
        }
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeModal()">Cancel</button>
        <button type="submit" form="dairyForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class DairyTabComponent {
  private readonly svc = inject(AdministrationService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly columns: TableColumn[] = [
    { key: 'code', label: 'Code', sortable: true, width: '120px' },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'ownerName', label: 'Owner' },
    { key: 'city', label: 'City', sortable: true },
    { key: 'mobile', label: 'Mobile' },
    { key: 'isActive', label: 'Status', type: 'badge', sortable: true, width: '110px' },
  ];

  readonly list = new PagedList<Dairy>((q) => this.svc.listOrg<Dairy>('dairy', q));
  readonly modalOpen = signal(false);
  readonly editing = signal<Dairy | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    ownerName: [''],
    mobile: ['', Validators.pattern(/^\d{10,13}$/)],
    email: ['', Validators.email],
    addressLine: [''],
    city: [''],
    state: [''],
    pincode: ['', Validators.pattern(/^\d{6}$/)],
    gstNumber: [''],
    licenseNo: [''],
    registrationNo: [''],
    isActive: [true],
  });

  constructor() {
    this.list.load();
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset();
    this.modalOpen.set(true);
  }

  openEdit(d: Dairy): void {
    this.editing.set(d);
    this.form.reset({
      code: d.code,
      name: d.name,
      ownerName: d.ownerName ?? '',
      mobile: d.mobile ?? '',
      email: d.email ?? '',
      addressLine: d.addressLine ?? '',
      city: d.city ?? '',
      state: d.state ?? '',
      pincode: d.pincode ?? '',
      gstNumber: d.gstNumber ?? '',
      licenseNo: d.licenseNo ?? '',
      registrationNo: d.registrationNo ?? '',
      isActive: d.isActive,
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
    const body: DairyRequest = {
      code: v.code.trim(),
      name: v.name.trim(),
      ownerName: orNull(v.ownerName.trim()),
      mobile: orNull(v.mobile.trim()),
      email: orNull(v.email.trim()),
      addressLine: orNull(v.addressLine.trim()),
      city: orNull(v.city.trim()),
      state: orNull(v.state.trim()),
      pincode: orNull(v.pincode.trim()),
      gstNumber: orNull(v.gstNumber.trim().toUpperCase()),
      licenseNo: orNull(v.licenseNo.trim()),
      registrationNo: orNull(v.registrationNo.trim()),
      isActive: v.isActive,
    };
    const current = this.editing();
    this.saving.set(true);
    const request$ = current ? this.svc.updateOrg<Dairy>('dairy', current.id, body) : this.svc.createOrg<Dairy>('dairy', body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.toast.success(current ? 'Dairy updated.' : 'Dairy created.');
        this.lookups.clear('dairies');
        this.list.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
