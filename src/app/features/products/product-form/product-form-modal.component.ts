import { Component, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { Product, ProductRequest } from '../product.model';
import { ProductService } from '../product.service';

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const txt = (v: string | null | undefined): string | null => (v && v.trim() ? v.trim() : null);

@Component({
  selector: 'app-product-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent],
  template: `
    <app-modal [open]="open()" [title]="product() ? 'Edit Product' : 'Add Product'" size="lg" (closed)="close()">
      <form id="productForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row">
          <div class="col-md-4">
            <app-form-field label="Product code" inputId="prCode" [control]="form.controls.productCode" [hint]="product() ? '' : 'Leave blank to auto-generate'">
              <input id="prCode" type="text" class="form-control" formControlName="productCode" maxlength="30" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-8">
            <app-form-field label="Name" inputId="prName" [control]="form.controls.name">
              <input id="prName" type="text" class="form-control" formControlName="name" maxlength="150" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Category" inputId="prCat" [control]="form.controls.productCategoryId">
              <select id="prCat" class="form-select" formControlName="productCategoryId">
                <option [ngValue]="null">Select category</option>
                @for (c of categories(); track c.id) {
                  <option [ngValue]="c.id">{{ c.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Unit" inputId="prUnit" [control]="form.controls.unitId">
              <select id="prUnit" class="form-select" formControlName="unitId">
                <option [ngValue]="null">Select unit</option>
                @for (u of units(); track u.id) {
                  <option [ngValue]="u.id">{{ u.code ? u.code + ' - ' : '' }}{{ u.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Default price" inputId="prPrice" [control]="form.controls.defaultPrice" hint="Used when no price list entry applies">
              <input id="prPrice" type="number" class="form-control" formControlName="defaultPrice" min="0" step="0.01" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Tax %" inputId="prTax" [control]="form.controls.taxPercent">
              <input id="prTax" type="number" class="form-control" formControlName="taxPercent" min="0" max="100" step="0.01" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="HSN code" inputId="prHsn" [control]="form.controls.hsnCode">
              <input id="prHsn" type="text" class="form-control" formControlName="hsnCode" maxlength="20" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Current stock" inputId="prStock" [control]="form.controls.currentStock">
              <input id="prStock" type="number" class="form-control" formControlName="currentStock" min="0" step="0.001" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Reorder level" inputId="prReorder" [control]="form.controls.reorderLevel">
              <input id="prReorder" type="number" class="form-control" formControlName="reorderLevel" min="0" step="0.001" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Shelf life (days)" inputId="prShelf" [control]="form.controls.shelfLifeDays">
              <input id="prShelf" type="number" class="form-control" formControlName="shelfLifeDays" min="1" step="1" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <div class="form-check form-switch mb-3 pt-md-4">
              <input id="prMilk" type="checkbox" class="form-check-input" formControlName="isMilkBased" />
              <label class="form-check-label" for="prMilk">Milk based product</label>
            </div>
          </div>
          @if (form.controls.isMilkBased.value) {
            <div class="col-md-4">
              <app-form-field label="Milk liters per unit" inputId="prLpu" [control]="form.controls.milkLitersPerUnit">
                <input id="prLpu" type="number" class="form-control" formControlName="milkLitersPerUnit" min="0.001" step="0.001" />
              </app-form-field>
            </div>
          }
          @if (product()) {
            <div class="col-md-4">
              <div class="form-check form-switch mb-3 pt-md-4">
                <input id="prActive" type="checkbox" class="form-check-input" formControlName="isActive" />
                <label class="form-check-label" for="prActive">Active</label>
              </div>
            </div>
          }
          <div class="col-12">
            <app-form-field label="Description" inputId="prDesc" [control]="form.controls.description">
              <textarea id="prDesc" class="form-control" rows="2" formControlName="description" maxlength="255"></textarea>
            </app-form-field>
          </div>
        </div>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="productForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class ProductFormModalComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(ProductService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);

  readonly open = input(false);
  readonly product = input<Product | null>(null);
  readonly saved = output<void>();
  readonly closed = output<void>();

  readonly categories = toSignal(this.lookups.get('product-categories'), { initialValue: [] as LookupItem[] });
  readonly units = toSignal(this.lookups.units(), { initialValue: [] as LookupItem[] });
  readonly saving = signal(false);

  readonly form = this.fb.group({
    productCode: ['', [Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    productCategoryId: this.fb.control<number | null>(null, Validators.required),
    unitId: this.fb.control<number | null>(null, Validators.required),
    description: [''],
    taxPercent: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    hsnCode: [''],
    isMilkBased: [false],
    milkLitersPerUnit: this.fb.control<number | null>(null, Validators.min(0.001)),
    defaultPrice: [0, [Validators.required, Validators.min(0)]],
    currentStock: this.fb.control<number | null>(0, Validators.min(0)),
    reorderLevel: [0, [Validators.required, Validators.min(0)]],
    shelfLifeDays: this.fb.control<number | null>(null, Validators.min(1)),
    isActive: [true],
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      const p = this.product();
      this.form.controls.productCode.setValidators(
        p ? [Validators.required, Validators.maxLength(30)] : [Validators.maxLength(30)],
      );
      this.form.reset({
        productCode: p?.productCode ?? '',
        name: p?.name ?? '',
        productCategoryId: p?.productCategoryId ?? null,
        unitId: p?.unitId ?? null,
        description: p?.description ?? '',
        taxPercent: p?.taxPercent ?? 0,
        hsnCode: p?.hsnCode ?? '',
        isMilkBased: p?.isMilkBased ?? false,
        milkLitersPerUnit: p?.milkLitersPerUnit ?? null,
        defaultPrice: p?.defaultPrice ?? 0,
        currentStock: p?.currentStock ?? 0,
        reorderLevel: p?.reorderLevel ?? 0,
        shelfLifeDays: p?.shelfLifeDays ?? null,
        isActive: p?.isActive ?? true,
      });
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
    const current = this.product();
    const body: ProductRequest = {
      productCode: txt(v.productCode),
      name: v.name.trim(),
      productCategoryId: Number(v.productCategoryId),
      unitId: Number(v.unitId),
      description: txt(v.description),
      taxPercent: Number(v.taxPercent),
      hsnCode: txt(v.hsnCode),
      isMilkBased: v.isMilkBased,
      milkLitersPerUnit: v.isMilkBased ? num(v.milkLitersPerUnit) : null,
      defaultPrice: Number(v.defaultPrice),
      currentStock: num(v.currentStock) ?? (current ? null : 0),
      reorderLevel: Number(v.reorderLevel),
      shelfLifeDays: num(v.shelfLifeDays),
      isActive: current ? v.isActive : null,
    };
    this.saving.set(true);
    const request$: Observable<unknown> = current ? this.svc.update(current.id, body) : this.svc.create(body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.lookups.clear('products');
        this.toast.success(current ? 'Product updated.' : 'Product created.');
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
