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
import { Branch, BranchRequest } from '../administration.model';
import { AdministrationService } from '../administration.service';

@Component({
  selector: 'app-branches-tab',
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
      searchPlaceholder="Search branches..."
      emptyTitle="No branches found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters">
        <select class="form-select form-select-sm w-auto" formControlName="dairyId" aria-label="Dairy">
          <option value="">All dairies</option>
          @for (d of dairies(); track d.id) {
            <option [value]="d.id">{{ d.name }}</option>
          }
        </select>
      </div>
      <div tableActions>
        <button type="button" class="btn btn-sm btn-primary" (click)="openCreate()"><i class="bi bi-plus-lg me-1"></i>Add Branch</button>
      </div>
      <ng-template appRowActions let-row>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="openEdit(row)"><i class="bi bi-pencil"></i> Edit</button>
      </ng-template>
    </app-data-table>

    <app-modal [open]="modalOpen()" [title]="editing() ? 'Edit Branch' : 'Add Branch'" size="lg" (closed)="closeModal()">
      <form id="branchForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row">
          <div class="col-md-4">
            <app-form-field label="Dairy" inputId="brDairy" [control]="form.controls.dairyId">
              <select id="brDairy" class="form-select" formControlName="dairyId">
                <option [ngValue]="null">Select dairy</option>
                @for (d of dairies(); track d.id) {
                  <option [ngValue]="d.id">{{ d.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-3">
            <app-form-field label="Code" inputId="brCode" [control]="form.controls.code">
              <input id="brCode" class="form-control text-uppercase" formControlName="code" maxlength="30" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-5">
            <app-form-field label="Name" inputId="brName" [control]="form.controls.name">
              <input id="brName" class="form-control" formControlName="name" maxlength="150" />
            </app-form-field>
          </div>
          <div class="col-md-12">
            <app-form-field label="Address" inputId="brAddress" [control]="form.controls.addressLine">
              <input id="brAddress" class="form-control" formControlName="addressLine" maxlength="250" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="City" inputId="brCity" [control]="form.controls.city">
              <input id="brCity" class="form-control" formControlName="city" maxlength="100" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="State" inputId="brState" [control]="form.controls.state">
              <input id="brState" class="form-control" formControlName="state" maxlength="100" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Pincode" inputId="brPin" [control]="form.controls.pincode" [messages]="{ pattern: 'Pincode must be 6 digits.' }">
              <input id="brPin" class="form-control" formControlName="pincode" maxlength="6" inputmode="numeric" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Manager" inputId="brManager" [control]="form.controls.managerName">
              <input id="brManager" class="form-control" formControlName="managerName" maxlength="150" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Mobile" inputId="brMobile" [control]="form.controls.mobile" [messages]="{ pattern: 'Enter 10-13 digits.' }">
              <input id="brMobile" class="form-control" formControlName="mobile" maxlength="13" inputmode="tel" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Email" inputId="brEmail" [control]="form.controls.email">
              <input id="brEmail" type="email" class="form-control" formControlName="email" maxlength="150" />
            </app-form-field>
          </div>
        </div>
        @if (editing()) {
          <div class="form-check form-switch">
            <input id="brActive" type="checkbox" class="form-check-input" formControlName="isActive" />
            <label class="form-check-label" for="brActive">Active</label>
          </div>
        }
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeModal()">Cancel</button>
        <button type="submit" form="branchForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class BranchesTabComponent {
  private readonly svc = inject(AdministrationService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly dairies = toSignal(this.lookups.get('dairies'), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'code', label: 'Code', sortable: true, width: '120px' },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'dairyName', label: 'Dairy' },
    { key: 'city', label: 'City', sortable: true },
    { key: 'managerName', label: 'Manager' },
    { key: 'isActive', label: 'Status', type: 'badge', sortable: true, width: '110px' },
  ];

  readonly filters = this.fb.group({ dairyId: [''] });
  readonly list = new PagedList<Branch>(
    (q) => this.svc.listOrg<Branch>('branches', q),
    () => this.filters.getRawValue() as PagedQuery,
  );
  readonly modalOpen = signal(false);
  readonly editing = signal<Branch | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    dairyId: [null as number | null, Validators.required],
    code: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    addressLine: [''],
    city: [''],
    state: [''],
    pincode: ['', Validators.pattern(/^\d{6}$/)],
    mobile: ['', Validators.pattern(/^\d{10,13}$/)],
    email: ['', Validators.email],
    managerName: [''],
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

  openEdit(b: Branch): void {
    this.editing.set(b);
    this.form.reset({
      dairyId: b.dairyId,
      code: b.code,
      name: b.name,
      addressLine: b.addressLine ?? '',
      city: b.city ?? '',
      state: b.state ?? '',
      pincode: b.pincode ?? '',
      mobile: b.mobile ?? '',
      email: b.email ?? '',
      managerName: b.managerName ?? '',
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
    const body: BranchRequest = {
      dairyId: v.dairyId as number,
      code: v.code.trim(),
      name: v.name.trim(),
      addressLine: orNull(v.addressLine.trim()),
      city: orNull(v.city.trim()),
      state: orNull(v.state.trim()),
      pincode: orNull(v.pincode.trim()),
      mobile: orNull(v.mobile.trim()),
      email: orNull(v.email.trim()),
      managerName: orNull(v.managerName.trim()),
      isActive: v.isActive,
    };
    const current = this.editing();
    this.saving.set(true);
    const request$ = current ? this.svc.updateOrg<Branch>('branches', current.id, body) : this.svc.createOrg<Branch>('branches', body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.toast.success(current ? 'Branch updated.' : 'Branch created.');
        this.lookups.clear('branches');
        this.list.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
