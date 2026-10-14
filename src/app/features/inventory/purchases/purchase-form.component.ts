import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AppCurrencyPipe } from '../../../shared/pipes/app-pipes';
import { toIsoDate } from '../../../shared/utils/format';
import { orNull } from '../../../shared/utils/paged-list';
import { dateRangeValidator, positiveNumberValidator } from '../../../shared/validators/app-validators';
import { InventoryItem, PurchaseRequest } from '../inventory.model';
import { InventoryService } from '../inventory.service';

function buildLine(fb: NonNullableFormBuilder) {
  return fb.group(
    {
      inventoryItemId: fb.control<number | null>(null, Validators.required),
      quantity: fb.control<number | null>(null, [Validators.required, positiveNumberValidator()]),
      unitCost: fb.control<number | null>(null, Validators.min(0)),
      batchNumber: [''],
      manufactureDate: [''],
      expiryDate: [''],
    },
    { validators: dateRangeValidator('manufactureDate', 'expiryDate') },
  );
}
type LineGroup = ReturnType<typeof buildLine>;

@Component({
  selector: 'app-purchase-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, FormFieldComponent, AppCurrencyPipe],
  template: `
    <app-page-header title="New Purchase" subtitle="Create a draft purchase order; approve and receive it from the purchases list">
      <a routerLink="/inventory/purchases" class="btn btn-outline-secondary"><i class="bi bi-arrow-left me-1"></i>Back</a>
    </app-page-header>

    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="card mb-3">
        <div class="card-body">
          <div class="row">
            <div class="col-md-5">
              <app-form-field label="Supplier" inputId="pSupplier" [control]="form.controls.supplierId">
                <select id="pSupplier" class="form-select" formControlName="supplierId">
                  <option [ngValue]="null">Select supplier</option>
                  @for (s of suppliers(); track s.id) {
                    <option [ngValue]="s.id">{{ s.name }}</option>
                  }
                </select>
              </app-form-field>
            </div>
            <div class="col-md-3">
              <app-form-field label="Purchase date" inputId="pDate" [control]="form.controls.purchaseDate">
                <input id="pDate" type="date" class="form-control" formControlName="purchaseDate" />
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Remarks" inputId="pRemarks" [control]="form.controls.remarks">
                <input id="pRemarks" type="text" class="form-control" formControlName="remarks" maxlength="250" />
              </app-form-field>
            </div>
          </div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="section-title mb-0">Line items</div>
            <button type="button" class="btn btn-sm btn-outline-primary" (click)="addLine()"><i class="bi bi-plus-lg me-1"></i>Add line</button>
          </div>
          @if (itemsLoading()) {
            <div class="text-muted small mb-2">Loading items...</div>
          }
          <div formArrayName="lines">
            @for (line of lines.controls; track line; let i = $index) {
              <div class="border rounded p-3 mb-3" [formGroupName]="i">
                <div class="row">
                  <div class="col-md-5">
                    <app-form-field label="Item" [control]="line.controls.inventoryItemId">
                      <select class="form-select" formControlName="inventoryItemId" [attr.aria-label]="'Item ' + (i + 1)">
                        <option [ngValue]="null">Select item</option>
                        @for (it of items(); track it.id) {
                          <option [ngValue]="it.id">{{ it.itemCode }} - {{ it.name }}</option>
                        }
                      </select>
                    </app-form-field>
                  </div>
                  <div class="col-md-2">
                    <app-form-field [label]="'Quantity' + (itemFor(line) ? ' (' + itemFor(line)!.unitName + ')' : '')" [control]="line.controls.quantity">
                      <input type="number" min="0" step="any" class="form-control" formControlName="quantity" />
                    </app-form-field>
                  </div>
                  <div class="col-md-2">
                    <app-form-field label="Unit cost" [control]="line.controls.unitCost" hint="Blank = item cost">
                      <input type="number" min="0" step="any" class="form-control" formControlName="unitCost" />
                    </app-form-field>
                  </div>
                  <div class="col-md-2">
                    <div class="form-label">Line total</div>
                    <div class="fw-semibold pt-1">{{ lineAmount(line) | appCurrency }}</div>
                    @if (itemFor(line); as it) {
                      @if (it.taxPercent > 0) {
                        <div class="form-text">+ {{ it.taxPercent }}% tax</div>
                      }
                    }
                  </div>
                  <div class="col-md-1 text-end">
                    <button type="button" class="btn btn-sm btn-outline-danger mt-4" [disabled]="lines.length <= 1" (click)="removeLine(i)" aria-label="Remove line">
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
                <div class="row">
                  <div class="col-md-4">
                    <app-form-field label="Batch no." [control]="line.controls.batchNumber">
                      <input type="text" class="form-control" formControlName="batchNumber" maxlength="50" autocomplete="off" />
                    </app-form-field>
                  </div>
                  <div class="col-md-4">
                    <app-form-field label="Manufacture date" [control]="line.controls.manufactureDate">
                      <input type="date" class="form-control" formControlName="manufactureDate" />
                    </app-form-field>
                  </div>
                  <div class="col-md-4">
                    <app-form-field label="Expiry date" [control]="line.controls.expiryDate" [hint]="itemFor(line)?.hasExpiry ? 'This item tracks expiry' : ''">
                      <input type="date" class="form-control" formControlName="expiryDate" />
                    </app-form-field>
                    @if (line.hasError('dateRange')) {
                      <div class="invalid-feedback d-block mb-2">Expiry date cannot be before the manufacture date.</div>
                    }
                  </div>
                </div>
              </div>
            }
          </div>

          <div class="d-flex justify-content-end">
            <table class="table table-sm w-auto mb-0">
              <tbody>
                <tr><td class="text-muted pe-4">Sub total</td><td class="text-end">{{ totals().sub | appCurrency }}</td></tr>
                <tr><td class="text-muted pe-4">Tax</td><td class="text-end">{{ totals().tax | appCurrency }}</td></tr>
                <tr><td class="fw-semibold pe-4">Total</td><td class="text-end fw-semibold">{{ totals().total | appCurrency }}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="d-flex gap-2 justify-content-end">
        <a routerLink="/inventory/purchases" class="btn btn-light">Cancel</a>
        <button type="submit" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Create purchase
        </button>
      </div>
    </form>
  `,
})
export class PurchaseFormComponent {
  private readonly svc = inject(InventoryService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly suppliers = toSignal(this.lookups.get('suppliers'), { initialValue: [] as LookupItem[] });
  readonly itemsLoading = signal(true);
  readonly items = signal<InventoryItem[]>([]);
  private readonly itemMap = computed(() => new Map(this.items().map((i) => [i.id, i])));

  readonly lines = this.fb.array<LineGroup>([]);
  readonly form = this.fb.group({
    supplierId: this.fb.control<number | null>(null, Validators.required),
    purchaseDate: [toIsoDate()],
    remarks: [''],
    lines: this.lines,
  });
  readonly totals = signal({ sub: 0, tax: 0, total: 0 });
  readonly saving = signal(false);

  constructor() {
    this.svc.itemOptions().subscribe({
      next: (list) => {
        this.items.set(list);
        this.itemsLoading.set(false);
      },
      error: () => this.itemsLoading.set(false),
    });
    this.addLine();
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.recalc());
    effect(() => {
      this.itemMap();
      untracked(() => this.recalc());
    });
  }

  itemFor(line: LineGroup): InventoryItem | undefined {
    const id = line.controls.inventoryItemId.value;
    return id === null ? undefined : this.itemMap().get(id);
  }

  lineAmount(line: LineGroup): number {
    const item = this.itemFor(line);
    const qty = Number(line.controls.quantity.value ?? 0);
    const cost = line.controls.unitCost.value ?? item?.unitCost ?? 0;
    return qty * Number(cost);
  }

  addLine(): void {
    const line = buildLine(this.fb);
    this.lines.push(line);
  }

  removeLine(index: number): void {
    if (this.lines.length > 1) {
      this.lines.removeAt(index);
    }
  }

  private recalc(): void {
    let sub = 0;
    let tax = 0;
    for (const line of this.lines.controls) {
      const amount = this.lineAmount(line);
      sub += amount;
      tax += (amount * (this.itemFor(line)?.taxPercent ?? 0)) / 100;
    }
    this.totals.set({ sub, tax, total: sub + tax });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please fix the highlighted fields.');
      return;
    }
    const v = this.form.getRawValue();
    const body: PurchaseRequest = {
      supplierId: Number(v.supplierId),
      purchaseDate: orNull(v.purchaseDate),
      remarks: orNull(v.remarks.trim()),
      items: v.lines.map((l) => ({
        inventoryItemId: Number(l.inventoryItemId),
        quantity: Number(l.quantity),
        unitCost: l.unitCost === null ? null : Number(l.unitCost),
        batchNumber: orNull(l.batchNumber.trim()),
        manufactureDate: orNull(l.manufactureDate),
        expiryDate: orNull(l.expiryDate),
      })),
    };
    this.saving.set(true);
    this.svc.createPurchase(body).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(`Purchase ${res.number} created as draft.`);
        void this.router.navigate(['/inventory/purchases']);
      },
      error: () => this.saving.set(false),
    });
  }
}
