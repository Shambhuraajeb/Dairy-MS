import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { InventoryBatch, InventoryItem } from '../inventory.model';
import { InventoryService } from '../inventory.service';

function nonZero(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  if (v === null || v === undefined || v === '') {
    return null;
  }
  return Number(v) === 0 || isNaN(Number(v)) ? { custom: { message: 'Enter a non-zero quantity (negative to reduce stock).' } } : null;
}

@Component({
  selector: 'app-adjustment-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent, AppNumberPipe],
  template: `
    <app-modal [open]="open()" title="Adjust stock" (closed)="close()">
      <form id="adjustForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-form-field label="Item" inputId="adItem" [control]="form.controls.inventoryItemId">
          <select id="adItem" class="form-select" formControlName="inventoryItemId">
            <option [ngValue]="null">Select item</option>
            @for (i of items(); track i.id) {
              <option [ngValue]="i.id">{{ i.itemCode }} - {{ i.name }}</option>
            }
          </select>
        </app-form-field>
        <app-form-field label="Batch (optional)" inputId="adBatch" hint="Pick a batch to correct that batch's quantity">
          <select id="adBatch" class="form-select" formControlName="inventoryBatchId">
            <option [ngValue]="null">No specific batch</option>
            @for (b of batches(); track b.id) {
              <option [ngValue]="b.id">{{ b.batchNumber }} - {{ b.quantityAvailable | appNumber: 3 }} {{ b.unitName }} ({{ b.status }})</option>
            }
          </select>
        </app-form-field>
        <app-form-field
          label="Quantity change"
          inputId="adDelta"
          [control]="form.controls.quantityDelta"
          hint="Positive adds stock, negative removes stock (e.g. -2.5)"
        >
          <input id="adDelta" type="number" step="any" class="form-control" formControlName="quantityDelta" />
        </app-form-field>
        @if (selectedItem(); as it) {
          <div class="alert py-2" [class.alert-info]="!wouldBeNegative()" [class.alert-danger]="wouldBeNegative()">
            Current stock <strong>{{ it.currentStock | appNumber: 3 }} {{ it.unitName }}</strong>
            @if (delta() !== null) {
              &rarr; after adjustment <strong>{{ (it.currentStock + (delta() ?? 0)) | appNumber: 3 }} {{ it.unitName }}</strong>
              @if (wouldBeNegative()) {
                (stock cannot go negative)
              }
            }
          </div>
        }
        <app-form-field label="Reason" inputId="adReason" [control]="form.controls.reason" hint="Required. Recorded in the audit log.">
          <textarea id="adReason" rows="2" class="form-control" formControlName="reason" maxlength="250"></textarea>
        </app-form-field>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="adjustForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Apply adjustment
        </button>
      </div>
    </app-modal>
  `,
})
export class AdjustmentModalComponent {
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
  readonly delta = signal<number | null>(null);
  private batchSeq = 0;

  readonly selectedItem = computed(() => this.items().find((i) => i.id === this.itemId()));
  readonly wouldBeNegative = computed(() => {
    const it = this.selectedItem();
    const d = this.delta();
    return !!it && d !== null && it.currentStock + d < 0;
  });

  readonly form = this.fb.group({
    inventoryItemId: this.fb.control<number | null>(null, Validators.required),
    inventoryBatchId: this.fb.control<number | null>(null),
    quantityDelta: this.fb.control<number | null>(null, [Validators.required, nonZero]),
    reason: ['', [Validators.required, Validators.maxLength(250)]],
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
    this.form.controls.quantityDelta.valueChanges.pipe(takeUntilDestroyed()).subscribe((d) => {
      this.delta.set(d === null || isNaN(Number(d)) ? null : Number(d));
    });
  }

  private onOpen(): void {
    this.saving.set(false);
    this.batches.set([]);
    this.itemId.set(null);
    this.delta.set(null);
    this.form.reset({ inventoryItemId: null, inventoryBatchId: null, quantityDelta: null, reason: '' });
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
      .adjustStock({
        inventoryItemId: Number(v.inventoryItemId),
        inventoryBatchId: v.inventoryBatchId,
        quantityDelta: Number(v.quantityDelta),
        reason: v.reason.trim(),
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.toast.success(`Stock adjusted: ${res.previousStock} to ${res.currentStock}.`);
          this.saved.emit();
        },
        error: () => this.saving.set(false),
      });
  }
}
