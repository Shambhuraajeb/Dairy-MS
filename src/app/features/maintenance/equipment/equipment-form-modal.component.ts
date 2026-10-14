import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { dateOnly, orNull } from '../../../shared/utils/paged-list';
import { EQUIPMENT_STATUSES, Equipment, EquipmentRequest } from '../maintenance.model';
import { MaintenanceService } from '../maintenance.service';

@Component({
  selector: 'app-equipment-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent],
  template: `
    <app-modal [open]="open()" [title]="equipment() ? 'Edit Equipment' : 'Add Equipment'" size="lg" (closed)="close()">
      <form id="equipmentForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row">
          <div class="col-md-4">
            <app-form-field label="Equipment code" inputId="eqCode" [control]="form.controls.equipmentCode">
              <input id="eqCode" type="text" class="form-control" formControlName="equipmentCode" maxlength="30" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-8">
            <app-form-field label="Name" inputId="eqName" [control]="form.controls.name">
              <input id="eqName" type="text" class="form-control" formControlName="name" maxlength="150" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Category" inputId="eqCat" [control]="form.controls.category" hint="e.g. Chiller, Tank, Pump">
              <input id="eqCat" type="text" class="form-control" formControlName="category" maxlength="50" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Make" inputId="eqMake" [control]="form.controls.make">
              <input id="eqMake" type="text" class="form-control" formControlName="make" maxlength="100" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Model" inputId="eqModel" [control]="form.controls.model">
              <input id="eqModel" type="text" class="form-control" formControlName="model" maxlength="100" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Serial number" inputId="eqSerial" [control]="form.controls.serialNumber">
              <input id="eqSerial" type="text" class="form-control" formControlName="serialNumber" maxlength="100" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Purchase date" inputId="eqPDate" [control]="form.controls.purchaseDate">
              <input id="eqPDate" type="date" class="form-control" formControlName="purchaseDate" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Purchase cost" inputId="eqCost" [control]="form.controls.purchaseCost">
              <input id="eqCost" type="number" min="0" step="any" class="form-control" formControlName="purchaseCost" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Location" inputId="eqLoc" [control]="form.controls.location">
              <input id="eqLoc" type="text" class="form-control" formControlName="location" maxlength="100" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Branch" inputId="eqBranch">
              <select id="eqBranch" class="form-select" formControlName="branchId">
                <option [ngValue]="null">None</option>
                @for (b of branches(); track b.id) {
                  <option [ngValue]="b.id">{{ b.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Collection center" inputId="eqCenter">
              <select id="eqCenter" class="form-select" formControlName="collectionCenterId">
                <option [ngValue]="null">None</option>
                @for (c of centers(); track c.id) {
                  <option [ngValue]="c.id">{{ c.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Warranty expiry" inputId="eqWarranty" [control]="form.controls.warrantyExpiry">
              <input id="eqWarranty" type="date" class="form-control" formControlName="warrantyExpiry" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Vendor" inputId="eqVendor" [control]="form.controls.vendorName">
              <input id="eqVendor" type="text" class="form-control" formControlName="vendorName" maxlength="150" />
            </app-form-field>
          </div>
          @if (equipment()) {
            <div class="col-md-4">
              <app-form-field label="Status" inputId="eqStatus">
                <select id="eqStatus" class="form-select" formControlName="status">
                  @for (s of statuses; track s) {
                    <option [value]="s">{{ s }}</option>
                  }
                </select>
              </app-form-field>
            </div>
          }
          <div class="col-12">
            <app-form-field label="Remarks" inputId="eqRemarks" [control]="form.controls.remarks">
              <input id="eqRemarks" type="text" class="form-control" formControlName="remarks" maxlength="250" />
            </app-form-field>
          </div>
        </div>
        @if (equipment()) {
          <div class="form-check form-switch">
            <input id="eqActive" type="checkbox" class="form-check-input" formControlName="isActive" />
            <label class="form-check-label" for="eqActive">Active</label>
          </div>
        }
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="equipmentForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class EquipmentFormModalComponent {
  private readonly svc = inject(MaintenanceService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = input(false);
  readonly equipment = input<Equipment | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly statuses = EQUIPMENT_STATUSES;
  readonly branches = toSignal(this.lookups.branches(), { initialValue: [] as LookupItem[] });
  readonly centers = toSignal(this.lookups.collectionCenters(), { initialValue: [] as LookupItem[] });
  readonly saving = signal(false);

  readonly form = this.fb.group({
    equipmentCode: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    category: ['', Validators.maxLength(50)],
    make: ['', Validators.maxLength(100)],
    model: ['', Validators.maxLength(100)],
    serialNumber: ['', Validators.maxLength(100)],
    purchaseDate: [''],
    purchaseCost: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    location: ['', Validators.maxLength(100)],
    branchId: this.fb.control<number | null>(null),
    collectionCenterId: this.fb.control<number | null>(null),
    warrantyExpiry: [''],
    vendorName: ['', Validators.maxLength(150)],
    remarks: ['', Validators.maxLength(250)],
    status: ['Operational'],
    isActive: [true],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.resetForm());
      }
    });
  }

  private resetForm(): void {
    const e = this.equipment();
    this.saving.set(false);
    this.form.reset({
      equipmentCode: e?.equipmentCode ?? '',
      name: e?.name ?? '',
      category: e?.category ?? '',
      make: e?.make ?? '',
      model: e?.model ?? '',
      serialNumber: e?.serialNumber ?? '',
      purchaseDate: dateOnly(e?.purchaseDate),
      purchaseCost: e?.purchaseCost ?? 0,
      location: e?.location ?? '',
      branchId: e?.branchId ?? null,
      collectionCenterId: e?.collectionCenterId ?? null,
      warrantyExpiry: dateOnly(e?.warrantyExpiry),
      vendorName: e?.vendorName ?? '',
      remarks: e?.remarks ?? '',
      status: e?.status ?? 'Operational',
      isActive: e?.isActive ?? true,
    });
  }

  close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: EquipmentRequest = {
      equipmentCode: v.equipmentCode.trim(),
      name: v.name.trim(),
      category: orNull(v.category.trim()),
      make: orNull(v.make.trim()),
      model: orNull(v.model.trim()),
      serialNumber: orNull(v.serialNumber.trim()),
      purchaseDate: orNull(v.purchaseDate),
      purchaseCost: Number(v.purchaseCost ?? 0),
      location: orNull(v.location.trim()),
      branchId: v.branchId,
      collectionCenterId: v.collectionCenterId,
      warrantyExpiry: orNull(v.warrantyExpiry),
      vendorName: orNull(v.vendorName.trim()),
      remarks: orNull(v.remarks.trim()),
    };
    const current = this.equipment();
    this.saving.set(true);
    const request$ = current
      ? this.svc.updateEquipment(current.id, { ...body, status: v.status, isActive: v.isActive })
      : this.svc.createEquipment(body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(current ? 'Equipment updated.' : 'Equipment added.');
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
