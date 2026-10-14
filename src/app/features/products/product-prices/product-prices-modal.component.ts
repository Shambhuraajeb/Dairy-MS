import { Component, effect, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppCurrencyPipe, AppDatePipe } from '../../../shared/pipes/app-pipes';
import { dateRangeValidator, positiveNumberValidator } from '../../../shared/validators/app-validators';
import { toIsoDate } from '../../../shared/utils/format';
import { CUSTOMER_TYPES, CustomerType, Product, ProductPrice } from '../product.model';
import { ProductService } from '../product.service';

@Component({
  selector: 'app-product-prices-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent, HasPermissionDirective, AppDatePipe, AppCurrencyPipe],
  template: `
    <app-modal [open]="open()" [title]="'Price list - ' + (product()?.name ?? '')" size="lg" (closed)="close()">
      <ng-container *appHasPermission="'product.update'">
        <form [formGroup]="form" (ngSubmit)="add()" novalidate class="border rounded p-3 mb-3 bg-body-tertiary">
          <div class="section-title mb-2">Add price</div>
          <div class="row g-2 align-items-start">
            <div class="col-md-3">
              <app-form-field label="Customer type" inputId="ppType" [control]="form.controls.customerType">
                <select id="ppType" class="form-select" formControlName="customerType">
                  @for (t of customerTypes; track t) {
                    <option [value]="t">{{ t }}</option>
                  }
                </select>
              </app-form-field>
            </div>
            <div class="col-md-3">
              <app-form-field label="Price" inputId="ppPrice" [control]="form.controls.price">
                <input id="ppPrice" type="number" class="form-control" formControlName="price" min="0" step="0.01" />
              </app-form-field>
            </div>
            <div class="col-md-3">
              <app-form-field label="Effective from" inputId="ppFrom" [control]="form.controls.effectiveFrom">
                <input id="ppFrom" type="date" class="form-control" formControlName="effectiveFrom" />
              </app-form-field>
            </div>
            <div class="col-md-3">
              <app-form-field label="Effective to" inputId="ppTo" [control]="form" hint="Optional (open ended)">
                <input id="ppTo" type="date" class="form-control" formControlName="effectiveTo" />
              </app-form-field>
            </div>
          </div>
          <div class="d-flex justify-content-between align-items-center">
            <span class="small text-muted">The open price of the same customer type is closed the day before the new start date.</span>
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="saving()">
              @if (saving()) {
                <span class="spinner-border spinner-border-sm me-1"></span>
              }
              <i class="bi bi-plus-lg me-1"></i>Add price
            </button>
          </div>
        </form>
      </ng-container>

      @if (loading()) {
        <div class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm me-2"></span>Loading prices...</div>
      } @else if (error()) {
        <div class="text-center py-4">
          <div class="text-danger mb-2">{{ error() }}</div>
          <button type="button" class="btn btn-sm btn-outline-primary" (click)="load()">Retry</button>
        </div>
      } @else if (prices().length === 0) {
        <div class="text-center text-muted py-4">No price list entries. The default price ({{ product()?.defaultPrice | appCurrency }}) applies.</div>
      } @else {
        <div class="table-responsive">
          <table class="table table-sm align-middle app-table mb-0">
            <thead>
              <tr>
                <th>Customer type</th>
                <th class="text-end">Price</th>
                <th>Effective from</th>
                <th>Effective to</th>
                <th>Status</th>
                <th class="text-end"></th>
              </tr>
            </thead>
            <tbody>
              @for (p of prices(); track p.id) {
                <tr>
                  <td>{{ p.customerType }}</td>
                  <td class="text-end">{{ p.price | appCurrency }}</td>
                  <td>{{ p.effectiveFrom.slice(0, 10) | appDate }}</td>
                  <td>{{ p.effectiveTo ? (p.effectiveTo.slice(0, 10) | appDate) : 'Open ended' }}</td>
                  <td>
                    @if (isCurrent(p)) {
                      <span class="badge rounded-pill badge-soft badge-soft-success">Current</span>
                    } @else if (p.effectiveFrom.slice(0, 10) > today) {
                      <span class="badge rounded-pill badge-soft badge-soft-info">Upcoming</span>
                    } @else {
                      <span class="badge rounded-pill badge-soft badge-soft-secondary">Expired</span>
                    }
                  </td>
                  <td class="text-end">
                    <button *appHasPermission="'product.update'" type="button" class="btn btn-sm btn-outline-danger" (click)="remove(p)">
                      <i class="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Close</button>
      </div>
    </app-modal>
  `,
})
export class ProductPricesModalComponent {
  private readonly svc = inject(ProductService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly open = input(false);
  readonly product = input<Product | null>(null);
  readonly changed = output<void>();
  readonly closed = output<void>();

  readonly customerTypes = CUSTOMER_TYPES;
  readonly today = toIsoDate();
  readonly prices = signal<ProductPrice[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  private dirty = false;

  readonly form = this.fb.group(
    {
      customerType: ['Retail' as CustomerType, Validators.required],
      price: [0, [Validators.required, positiveNumberValidator()]],
      effectiveFrom: [toIsoDate(), Validators.required],
      effectiveTo: [''],
    },
    { validators: dateRangeValidator('effectiveFrom', 'effectiveTo') },
  );

  constructor() {
    effect(() => {
      if (this.open() && this.product()) {
        this.dirty = false;
        this.form.reset({ customerType: 'Retail', price: 0, effectiveFrom: toIsoDate(), effectiveTo: '' });
        this.load();
      }
    });
  }

  isCurrent(p: ProductPrice): boolean {
    const from = p.effectiveFrom.slice(0, 10);
    const to = p.effectiveTo ? p.effectiveTo.slice(0, 10) : null;
    return p.isActive && from <= this.today && (to === null || to >= this.today);
  }

  load(): void {
    const product = this.product();
    if (!product) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.svc.prices(product.id).subscribe({
      next: (res) => {
        this.prices.set(res.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  add(): void {
    const product = this.product();
    if (!product) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.svc
      .addPrice({
        productId: product.id,
        customerType: v.customerType,
        price: Number(v.price),
        effectiveFrom: v.effectiveFrom,
        effectiveTo: v.effectiveTo || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.dirty = true;
          this.toast.success('Price added.');
          this.form.patchValue({ price: 0, effectiveTo: '' });
          this.form.markAsUntouched();
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  async remove(p: ProductPrice): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Delete price',
      message: `Delete the ${p.customerType} price of ${p.price} effective from ${p.effectiveFrom.slice(0, 10)}?`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc.removePrice(p.id).subscribe(() => {
      this.dirty = true;
      this.toast.success('Price deleted.');
      this.load();
    });
  }

  close(): void {
    if (this.dirty) {
      this.changed.emit();
    }
    this.closed.emit();
  }
}
