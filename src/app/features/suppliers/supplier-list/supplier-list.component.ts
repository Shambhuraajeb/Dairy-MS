import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PagedList, orNull, qp } from '../../../shared/utils/paged-list';
import { Supplier, SupplierRequest } from '../supplier.model';
import { SupplierService } from '../supplier.service';

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, ModalComponent, FormFieldComponent, HasPermissionDirective, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Suppliers" subtitle="Vendors for feed, medicines, packaging and other purchases">
      <button *appHasPermission="'supplier.manage'" type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="bi bi-plus-lg me-1"></i>Add Supplier
      </button>
    </app-page-header>

    <app-data-table
      [columns]="columns"
      [items]="list.items()"
      [total]="list.total()"
      [loading]="list.loading()"
      [error]="list.error()"
      [page]="list.query.page ?? 1"
      [pageSize]="list.query.pageSize ?? 20"
      searchPlaceholder="Search code, name, city or mobile..."
      emptyTitle="No suppliers found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters">
        <select class="form-select form-select-sm w-auto" formControlName="isActive" aria-label="Status">
          <option value="">Active and inactive</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <ng-template appColumn="name" let-row>
        <div class="fw-semibold">{{ row.name }}</div>
        @if (row.contactPerson) {
          <div class="small text-muted">{{ row.contactPerson }}</div>
        }
      </ng-template>
      <ng-template appRowActions let-row>
        <ng-container *appHasPermission="'supplier.manage'">
          <button type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="openEdit(row)"><i class="bi bi-pencil"></i> Edit</button>
          <button
            type="button"
            class="btn btn-sm"
            [class.btn-outline-danger]="row.isActive"
            [class.btn-outline-success]="!row.isActive"
            (click)="toggleActive(row)"
          >
            {{ row.isActive ? 'Deactivate' : 'Activate' }}
          </button>
        </ng-container>
      </ng-template>
    </app-data-table>

    <app-modal [open]="modalOpen()" [title]="editing() ? 'Edit Supplier' : 'Add Supplier'" size="lg" (closed)="closeModal()">
      <form id="supplierForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row">
          <div class="col-md-4">
            <app-form-field label="Supplier code" inputId="supCode" [control]="form.controls.supplierCode">
              <input id="supCode" type="text" class="form-control" formControlName="supplierCode" maxlength="30" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-8">
            <app-form-field label="Name" inputId="supName" [control]="form.controls.name">
              <input id="supName" type="text" class="form-control" formControlName="name" maxlength="150" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Contact person" inputId="supContact" [control]="form.controls.contactPerson">
              <input id="supContact" type="text" class="form-control" formControlName="contactPerson" maxlength="100" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Mobile" inputId="supMobile" [control]="form.controls.mobile" [messages]="{ pattern: 'Enter 10 to 13 digits.' }">
              <input id="supMobile" type="tel" class="form-control" formControlName="mobile" maxlength="14" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Email" inputId="supEmail" [control]="form.controls.email">
              <input id="supEmail" type="email" class="form-control" formControlName="email" maxlength="150" />
            </app-form-field>
          </div>
          <div class="col-12">
            <app-form-field label="Address" inputId="supAddr" [control]="form.controls.addressLine">
              <input id="supAddr" type="text" class="form-control" formControlName="addressLine" maxlength="250" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="City" inputId="supCity" [control]="form.controls.city">
              <input id="supCity" type="text" class="form-control" formControlName="city" maxlength="100" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="State" inputId="supState" [control]="form.controls.state">
              <input id="supState" type="text" class="form-control" formControlName="state" maxlength="100" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Pincode" inputId="supPin" [control]="form.controls.pincode">
              <input id="supPin" type="text" class="form-control" formControlName="pincode" maxlength="10" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="GST number" inputId="supGst" [control]="form.controls.gstNumber">
              <input id="supGst" type="text" class="form-control" formControlName="gstNumber" maxlength="20" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="PAN" inputId="supPan" [control]="form.controls.panNo">
              <input id="supPan" type="text" class="form-control" formControlName="panNo" maxlength="15" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Payment terms (days)" inputId="supTerms" [control]="form.controls.paymentTermsDays">
              <input id="supTerms" type="number" min="0" max="365" step="1" class="form-control" formControlName="paymentTermsDays" />
            </app-form-field>
          </div>
        </div>
        @if (editing()) {
          <div class="form-check form-switch">
            <input id="supActive" type="checkbox" class="form-check-input" formControlName="isActive" />
            <label class="form-check-label" for="supActive">Active</label>
          </div>
        }
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeModal()">Cancel</button>
        <button type="submit" form="supplierForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class SupplierListComponent {
  private readonly svc = inject(SupplierService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly columns: TableColumn[] = [
    { key: 'supplierCode', label: 'Code', sortable: true, width: '120px' },
    { key: 'name', label: 'Supplier', sortable: true },
    { key: 'mobile', label: 'Mobile' },
    { key: 'city', label: 'City', sortable: true },
    { key: 'paymentTermsDays', label: 'Terms (days)', type: 'number' },
    { key: 'purchaseCount', label: 'Purchases', type: 'number' },
    { key: 'totalPurchased', label: 'Total purchased', type: 'currency' },
    { key: 'isActive', label: 'Status', type: 'badge', sortable: true, width: '100px' },
  ];

  readonly filters = this.fb.group({ isActive: [''] });
  readonly list = new PagedList<Supplier>(
    (q) => this.svc.list(q),
    () => ({ isActive: this.filters.controls.isActive.value || undefined }),
  );

  readonly modalOpen = signal(false);
  readonly editing = signal<Supplier | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    supplierCode: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    contactPerson: ['', Validators.maxLength(100)],
    mobile: ['', Validators.pattern(/^\+?\d{10,13}$/)],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    addressLine: ['', Validators.maxLength(250)],
    city: ['', Validators.maxLength(100)],
    state: ['', Validators.maxLength(100)],
    pincode: ['', Validators.maxLength(10)],
    gstNumber: ['', Validators.maxLength(20)],
    panNo: ['', Validators.maxLength(15)],
    paymentTermsDays: this.fb.control<number | null>(30, [Validators.required, Validators.min(0), Validators.max(365)]),
    isActive: [true],
  });

  constructor() {
    this.filters.patchValue({ isActive: qp(this.route.snapshot.queryParamMap, 'isActive') });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
    this.list.load();
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({
      supplierCode: '', name: '', contactPerson: '', mobile: '', email: '', addressLine: '', city: '', state: '',
      pincode: '', gstNumber: '', panNo: '', paymentTermsDays: 30, isActive: true,
    });
    this.modalOpen.set(true);
  }

  openEdit(s: Supplier): void {
    this.editing.set(s);
    this.form.reset({
      supplierCode: s.supplierCode,
      name: s.name,
      contactPerson: s.contactPerson ?? '',
      mobile: s.mobile ?? '',
      email: s.email ?? '',
      addressLine: s.addressLine ?? '',
      city: s.city ?? '',
      state: s.state ?? '',
      pincode: s.pincode ?? '',
      gstNumber: s.gstNumber ?? '',
      panNo: s.panNo ?? '',
      paymentTermsDays: s.paymentTermsDays,
      isActive: s.isActive,
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
    const body: SupplierRequest = {
      supplierCode: v.supplierCode.trim(),
      name: v.name.trim(),
      contactPerson: orNull(v.contactPerson.trim()),
      mobile: orNull(v.mobile.trim()),
      email: orNull(v.email.trim()),
      addressLine: orNull(v.addressLine.trim()),
      city: orNull(v.city.trim()),
      state: orNull(v.state.trim()),
      pincode: orNull(v.pincode.trim()),
      gstNumber: orNull(v.gstNumber.trim()),
      panNo: orNull(v.panNo.trim()),
      paymentTermsDays: Number(v.paymentTermsDays ?? 0),
    };
    const current = this.editing();
    this.saving.set(true);
    const request$ = current ? this.svc.update(current.id, { ...body, isActive: v.isActive }) : this.svc.create(body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.lookups.clear('suppliers');
        this.toast.success(current ? 'Supplier updated.' : 'Supplier created.');
        this.list.load();
      },
      error: () => this.saving.set(false),
    });
  }

  async toggleActive(s: Supplier): Promise<void> {
    const activate = !s.isActive;
    const ok = await this.confirmService.confirm({
      title: activate ? 'Activate supplier' : 'Deactivate supplier',
      message: `${activate ? 'Activate' : 'Deactivate'} supplier "${s.name}"?`,
      confirmText: activate ? 'Activate' : 'Deactivate',
      variant: activate ? 'primary' : 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc.setActive(s, activate).subscribe(() => {
      this.lookups.clear('suppliers');
      this.toast.success(activate ? 'Supplier activated.' : 'Supplier deactivated.');
      this.list.load();
    });
  }
}
