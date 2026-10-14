import { Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { CollectionListItem, RejectCollectionRequest } from '../models/collection.model';
import { MilkCollectionService } from '../services/milk-collection.service';

const PRESETS = ['Low FAT', 'Low SNF', 'Adulterated milk', 'High temperature', 'Sour milk', 'Foreign matter'];

/** Reject a pending collection fully, or only a part of the quantity (the remainder stays payable). */
@Component({
  selector: 'app-reject-collection-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent, AppNumberPipe],
  template: `
    <app-modal [open]="collection() !== null" [title]="'Reject ' + (collection()?.collectionNumber ?? '')" size="md" (closed)="close()">
      @if (collection(); as c) {
        <p class="text-muted small">
          {{ c.farmerCode }} - {{ c.farmerName }}, {{ c.quantityLiters | appNumber: 3 }} L, FAT {{ c.fat | appNumber }}, SNF {{ c.snf | appNumber }}.
        </p>
      }
      <form id="rejectForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="mb-3">
          <label class="form-label" for="rejPreset">Common reasons</label>
          <select id="rejPreset" class="form-select" (change)="applyPreset($event)">
            <option value="">Select to fill the reason...</option>
            @for (p of presets; track p) {
              <option [value]="p">{{ p }}</option>
            }
          </select>
        </div>
        <app-form-field label="Reason" inputId="rejReason" [control]="form.controls.reason" [messages]="{ pattern: 'Reason cannot be blank.' }">
          <textarea id="rejReason" rows="2" maxlength="500" class="form-control" formControlName="reason"></textarea>
        </app-form-field>
        <div class="form-check form-switch mb-3">
          <input id="rejPartial" type="checkbox" class="form-check-input" formControlName="partial" />
          <label class="form-check-label" for="rejPartial">Partial rejection (only part of the quantity)</label>
        </div>
        @if (form.controls.partial.value) {
          <app-form-field label="Quantity to reject (L)" inputId="rejQty" [control]="form.controls.quantityLiters" hint="The remaining quantity stays payable.">
            <input id="rejQty" type="number" step="0.001" class="form-control" formControlName="quantityLiters" />
          </app-form-field>
        }
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="rejectForm" class="btn btn-danger" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Reject
        </button>
      </div>
    </app-modal>
  `,
})
export class RejectCollectionModalComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(MilkCollectionService);
  private readonly toast = inject(ToastService);

  readonly collection = input<CollectionListItem | null>(null);
  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly presets = PRESETS;
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    reason: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)]],
    partial: [false],
    quantityLiters: this.fb.control<number | null>(null),
  });

  constructor() {
    effect(() => {
      const c = this.collection();
      untracked(() => {
        if (c) {
          this.form.reset({ reason: '', partial: false, quantityLiters: null });
        }
        this.saving.set(false);
      });
    });
    this.form.controls.partial.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((partial) => {
      const qty = this.form.controls.quantityLiters;
      qty.setValidators(partial ? [Validators.required, Validators.min(0.001), (c: AbstractControl) => this.belowCollected(c)] : []);
      qty.setValue(null);
      qty.updateValueAndValidity();
    });
  }

  private belowCollected(c: AbstractControl): ValidationErrors | null {
    const col = this.collection();
    if (!col || c.value === null || c.value === '') {
      return null;
    }
    return Number(c.value) < col.quantityLiters
      ? null
      : { belowCollected: { message: `Must be less than the collected quantity (${col.quantityLiters} L). Leave partial off to reject everything.` } };
  }

  protected applyPreset(event: Event): void {
    const v = (event.target as HTMLSelectElement).value;
    if (v) {
      this.form.controls.reason.setValue(v);
      this.form.controls.reason.markAsDirty();
    }
  }

  protected close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  protected save(): void {
    const c = this.collection();
    if (!c) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: RejectCollectionRequest = { reason: v.reason.trim() };
    if (v.partial && v.quantityLiters !== null) {
      body.quantityLiters = Number(v.quantityLiters);
    }
    this.saving.set(true);
    this.svc.reject(c.id, body).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(`Collection ${c.collectionNumber}: ${res.rejectedQuantity} L rejected.`);
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
