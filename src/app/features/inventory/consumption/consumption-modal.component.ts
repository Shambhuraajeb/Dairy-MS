import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppDatePipe, AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { toIsoDate } from '../../../shared/utils/format';
import { orNull } from '../../../shared/utils/paged-list';
import { positiveNumberValidator } from '../../../shared/validators/app-validators';
import { InventoryBatch, InventoryItem } from '../inventory.model';
import { InventoryService } from '../inventory.service';

@Component({
  selector: 'app-consumption-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent, HasPermissionDirective, AppNumberPipe, AppDatePipe],
  template: `
    <app-modal [open]="open()" title="Record consumption" (closed)="close()">
      <form id="consumptionForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-form-field label="Item" inputId="coItem" [control]="form.controls.inventoryItemId">
          <select id="coItem" class="form-select" formControlName="inventoryItemId">
            <option [ngValue]="null">Select item</option>
            @for (i of items(); track i.id) {
              <option [ngValue]="i.id">{{ i.itemCode }} - {{ i.name }}</option>
            }
          </select>
        </app-form-field>
        @if (selectedItem(); as it) {
          <div class="form-text mb-3">In stock: <strong>{{ it.currentStock | appNumber: 3 }} {{ it.unitName }}</strong></div>
        }
        <app-form-field label="Batch (optional)" inputId="coBatch" hint="Leave blank to consume first-expiry-first-out across batches">
          <select id="coBatch" class="form-select" formControlName="inventoryBatchId">
            <option [ngValue]="null">Auto (FEFO)</option>
            @for (b of visibleBatches(); track b.id) {
              <option [ngValue]="b.id">
                {{ b.batchNumber }} - {{ b.quantityAvailable | appNumber: 3 }} {{ b.unitName }}{{ b.expiryDate ? ' - exp ' + (b.expiryDate | appDate) : '' }}{{ b.isExpired ? ' (EXPIRED)' : '' }}
              </option>
            }
          </select>
        </app-form-field>
        <div class="row">
          <div class="col-md-6">
            <app-form-field label="Quantity" inputId="coQty" [control]="form.controls.quantity">
              <input id="coQty" type="number" min="0" step="any" class="form-control" formControlName="quantity" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Consumption date" inputId="coDate" [control]="form.controls.consumptionDate">
              <input id="coDate" type="date" class="form-control" formControlName="consumptionDate" />
            </app-form-field>
          </div>
        </div>
        <app-form-field label="Purpose" inputId="coPurpose" [control]="form.controls.purpose" hint="e.g. Feeding - Shed A, Cleaning, Packaging">
          <input id="coPurpose" type="text" class="form-control" formControlName="purpose" maxlength="150" autocomplete="off" />
        </app-form-field>
        <div *appHasPermission="'inventory.adjust'" class="form-check">
          <input id="coOverride" type="checkbox" class="form-check-input" formControlName="expiredOverride" />
          <label class="form-check-label" for="coOverride">Expired stock override</label>
          <div class="form-text">Allows consuming expired batches. The purpose is stored as the override reason and is mandatory.</div>
        </div>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="consumptionForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Record
        </button>
      </div>
    </app-modal>
  `,
})
export class ConsumptionModalComponent {
  private readonly svc = inject(InventoryService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = input(false);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly items = signal<InventoryItem[]>([]);
  readonly batches = signal<InventoryBatch[]>([]);
  readonly saving = signal(false);
  private readonly itemId = signal<number | null>(null);
  private readonly overrideOn = signal(false);
  private batchSeq = 0;

  readonly selectedItem = computed(() => this.items().find((i) => i.id === this.itemId()));
  readonly visibleBatches = computed(() =>
    this.batches().filter((b) => b.quantityAvailable > 0 && (this.overrideOn() || !b.isExpired)),
  );

  readonly form = this.fb.group({
    inventoryItemId: this.fb.control<number | null>(null, Validators.required),
    inventoryBatchId: this.fb.control<number | null>(null),
    quantity: this.fb.control<number | null>(null, [Validators.required, positiveNumberValidator()]),
    consumptionDate: [toIsoDate()],
    purpose: ['', Validators.maxLength(150)],
    expiredOverride: [false],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.onOpen());
      }
    });
    this.form.controls.inventoryItemId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.itemId.set(id);
      this.form.controls.inventoryBatchId.setValue(null);
      this.loadBatches(id);
    });
    this.form.controls.expiredOverride.valueChanges.pipe(takeUntilDestroyed()).subscribe((on) => {
      this.overrideOn.set(on);
      const purpose = this.form.controls.purpose;
      purpose.setValidators(on ? [Validators.required, Validators.maxLength(150)] : [Validators.maxLength(150)]);
      purpose.updateValueAndValidity();
      const batchId = this.form.controls.inventoryBatchId.value;
      if (!on && batchId !== null && !this.visibleBatches().some((b) => b.id === batchId)) {
        this.form.controls.inventoryBatchId.setValue(null);
      }
    });
  }

  private onOpen(): void {
    this.saving.set(false);
    this.batches.set([]);
    this.itemId.set(null);
    this.overrideOn.set(false);
    this.form.controls.purpose.setValidators([Validators.maxLength(150)]);
    this.form.reset({
      inventoryItemId: null,
      inventoryBatchId: null,
      quantity: null,
      consumptionDate: toIsoDate(),
      purpose: '',
      expiredOverride: false,
    });
    this.svc.itemOptions().subscribe((list) => this.items.set(list));
  }

  private loadBatches(itemId: number | null): void {
    const n = ++this.batchSeq;
    this.batches.set([]);
    if (itemId === null) {
      return;
    }
    this.svc.batchesForItem(itemId).subscribe({
      next: (list) => {
        if (n === this.batchSeq) {
          this.batches.set(list);
        }
      },
      error: () => undefined,
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
    this.saving.set(true);
    this.svc
      .recordConsumption({
        inventoryItemId: Number(v.inventoryItemId),
        inventoryBatchId: v.inventoryBatchId,
        quantity: Number(v.quantity),
        consumptionDate: orNull(v.consumptionDate),
        purpose: orNull(v.purpose.trim()),
        expiredOverride: v.expiredOverride,
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.toast.success(`Consumption recorded. Stock left: ${res.currentStock}.`);
          this.saved.emit();
        },
        error: () => this.saving.set(false),
      });
  }
}
