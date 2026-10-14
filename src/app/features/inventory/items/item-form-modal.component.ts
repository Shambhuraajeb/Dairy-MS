import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { orNull } from '../../../shared/utils/paged-list';
import { positiveNumberValidator } from '../../../shared/validators/app-validators';
import { InventoryItem, ItemRequest } from '../inventory.model';
import { InventoryService } from '../inventory.service';

@Component({
  selector: 'app-item-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent],
  template: `
    <app-modal [open]="open()" [title]="item() ? 'Edit Item' : 'Add Item'" size="lg" (closed)="close()">
      <form id="itemForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row">
          <div class="col-md-4">
            <app-form-field label="Item code" inputId="itCode" [control]="form.controls.itemCode">
              <input id="itCode" type="text" class="form-control" formControlName="itemCode" maxlength="30" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-8">
            <app-form-field label="Name" inputId="itName" [control]="form.controls.name">
              <input id="itName" type="text" class="form-control" formControlName="name" maxlength="150" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Category" inputId="itCat" [control]="form.controls.itemCategoryId">
              <select id="itCat" class="form-select" formControlName="itemCategoryId">
                <option [ngValue]="null">Select category</option>
                @for (c of categories(); track c.id) {
                  <option [ngValue]="c.id">{{ c.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Unit" inputId="itUnit" [control]="form.controls.unitId">
              <select id="itUnit" class="form-select" formControlName="unitId">
                <option [ngValue]="null">Select unit</option>
                @for (u of units(); track u.id) {
                  <option [ngValue]="u.id">{{ u.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-3">
            <app-form-field label="Reorder level" inputId="itReorder" [control]="form.controls.reorderLevel">
              <input id="itReorder" type="number" min="0" step="any" class="form-control" formControlName="reorderLevel" />
            </app-form-field>
          </div>
          <div class="col-md-3">
            <app-form-field label="Max stock level" inputId="itMax" [control]="form.controls.maxStockLevel">
              <input id="itMax" type="number" min="0" step="any" class="form-control" formControlName="maxStockLevel" />
            </app-form-field>
          </div>
          <div class="col-md-3">
            <app-form-field label="Unit cost" inputId="itCost" [control]="form.controls.unitCost">
              <input id="itCost" type="number" min="0" step="any" class="form-control" formControlName="unitCost" />
            </app-form-field>
          </div>
          <div class="col-md-3">
            <app-form-field label="Tax %" inputId="itTax" [control]="form.controls.taxPercent">
              <input id="itTax" type="number" min="0" max="100" step="any" class="form-control" formControlName="taxPercent" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Preferred supplier" inputId="itSup">
              <select id="itSup" class="form-select" formControlName="preferredSupplierId">
                <option [ngValue]="null">None</option>
                @for (s of suppliers(); track s.id) {
                  <option [ngValue]="s.id">{{ s.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Storage location" inputId="itLoc" [control]="form.controls.storageLocation">
              <input id="itLoc" type="text" class="form-control" formControlName="storageLocation" maxlength="100" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Barcode" inputId="itBar" [control]="form.controls.barcode">
              <input id="itBar" type="text" class="form-control" formControlName="barcode" maxlength="50" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Shelf life (days)" inputId="itShelf" [control]="form.controls.shelfLifeDays">
              <input id="itShelf" type="number" min="1" step="1" class="form-control" formControlName="shelfLifeDays" />
            </app-form-field>
          </div>
          <div class="col-12">
            <app-form-field label="Description" inputId="itDesc" [control]="form.controls.description">
              <textarea id="itDesc" rows="2" class="form-control" formControlName="description" maxlength="255"></textarea>
            </app-form-field>
          </div>
          <div class="col-12 d-flex flex-wrap gap-4">
            <div class="form-check form-switch">
              <input id="itPerishable" type="checkbox" class="form-check-input" formControlName="isPerishable" />
              <label class="form-check-label" for="itPerishable">Perishable</label>
            </div>
            <div class="form-check form-switch">
              <input id="itExpiry" type="checkbox" class="form-check-input" formControlName="hasExpiry" />
              <label class="form-check-label" for="itExpiry">Tracks expiry</label>
            </div>
            @if (item()) {
              <div class="form-check form-switch">
                <input id="itActive" type="checkbox" class="form-check-input" formControlName="isActive" />
                <label class="form-check-label" for="itActive">Active</label>
              </div>
            }
          </div>
        </div>
        @if (!item()) {
          <div class="form-text mt-2">Current stock starts at 0 and changes only through purchases, consumption and adjustments.</div>
        }
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="itemForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class ItemFormModalComponent {
  private readonly svc = inject(InventoryService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = input(false);
  readonly item = input<InventoryItem | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly categories = toSignal(this.lookups.get('item-categories'), { initialValue: [] as LookupItem[] });
  readonly units = toSignal(this.lookups.units(), { initialValue: [] as LookupItem[] });
  readonly suppliers = toSignal(this.lookups.get('suppliers'), { initialValue: [] as LookupItem[] });
  readonly saving = signal(false);

  readonly form = this.fb.group({
    itemCode: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    itemCategoryId: this.fb.control<number | null>(null, Validators.required),
    unitId: this.fb.control<number | null>(null, Validators.required),
    description: [''],
    reorderLevel: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    maxStockLevel: this.fb.control<number | null>(null, Validators.min(0)),
    unitCost: this.fb.control<number | null>(0, [Validators.required, positiveNumberValidator(true)]),
    taxPercent: this.fb.control<number | null>(0, [Validators.required, Validators.min(0), Validators.max(100)]),
    isPerishable: [false],
    hasExpiry: [false],
    shelfLifeDays: this.fb.control<number | null>(null, Validators.min(1)),
    preferredSupplierId: this.fb.control<number | null>(null),
    storageLocation: [''],
    barcode: [''],
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
    const it = this.item();
    this.saving.set(false);
    this.form.reset({
      itemCode: it?.itemCode ?? '',
      name: it?.name ?? '',
      itemCategoryId: it?.itemCategoryId ?? null,
      unitId: it?.unitId ?? null,
      description: it?.description ?? '',
      reorderLevel: it?.reorderLevel ?? 0,
      maxStockLevel: it?.maxStockLevel ?? null,
      unitCost: it?.unitCost ?? 0,
      taxPercent: it?.taxPercent ?? 0,
      isPerishable: it?.isPerishable ?? false,
      hasExpiry: it?.hasExpiry ?? false,
      shelfLifeDays: it?.shelfLifeDays ?? null,
      preferredSupplierId: it?.preferredSupplierId ?? null,
      storageLocation: it?.storageLocation ?? '',
      barcode: it?.barcode ?? '',
      isActive: it?.isActive ?? true,
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
    const body: ItemRequest = {
      itemCode: v.itemCode.trim(),
      name: v.name.trim(),
      itemCategoryId: Number(v.itemCategoryId),
      unitId: Number(v.unitId),
      description: orNull(v.description.trim()),
      reorderLevel: Number(v.reorderLevel ?? 0),
      maxStockLevel: v.maxStockLevel === null ? null : Number(v.maxStockLevel),
      unitCost: Number(v.unitCost ?? 0),
      taxPercent: Number(v.taxPercent ?? 0),
      isPerishable: v.isPerishable,
      hasExpiry: v.hasExpiry,
      shelfLifeDays: v.shelfLifeDays === null ? null : Number(v.shelfLifeDays),
      preferredSupplierId: v.preferredSupplierId,
      storageLocation: orNull(v.storageLocation.trim()),
      barcode: orNull(v.barcode.trim()),
    };
    const current = this.item();
    this.saving.set(true);
    const request$ = current ? this.svc.updateItem(current.id, { ...body, isActive: v.isActive }) : this.svc.createItem(body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.lookups.clear('items');
        this.toast.success(current ? 'Item updated.' : 'Item created.');
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
