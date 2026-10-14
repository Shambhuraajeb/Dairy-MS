import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { AdjustCollectionRequest, CollectionDetail, CollectionListItem } from '../models/collection.model';
import { MilkCollectionService } from '../services/milk-collection.service';

/** Adjust quantity / FAT / SNF / CLR of a Pending or Approved (unsettled) collection; a reason is mandatory. */
@Component({
  selector: 'app-adjust-collection-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent, AppNumberPipe],
  template: `
    <app-modal [open]="collection() !== null" [title]="'Adjust ' + (collection()?.collectionNumber ?? '')" size="md" (closed)="close()">
      @if (collection(); as c) {
        <p class="text-muted small">
          {{ c.farmerCode }} - {{ c.farmerName }}. Original values are preserved and the rate is recalculated.
          Current: {{ c.quantityLiters | appNumber: 3 }} L, FAT {{ c.fat | appNumber }}, SNF {{ c.snf | appNumber }}.
        </p>
      }
      <form id="adjustForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row">
          <div class="col-6">
            <app-form-field label="Quantity (L)" inputId="adjQty" [control]="form.controls.quantityLiters">
              <input id="adjQty" type="number" step="0.001" class="form-control" formControlName="quantityLiters" />
            </app-form-field>
          </div>
          <div class="col-6">
            <app-form-field label="FAT %" inputId="adjFat" [control]="form.controls.fat">
              <input id="adjFat" type="number" step="0.01" class="form-control" formControlName="fat" />
            </app-form-field>
          </div>
          <div class="col-6">
            <app-form-field label="SNF %" inputId="adjSnf" [control]="form.controls.snf">
              <input id="adjSnf" type="number" step="0.01" class="form-control" formControlName="snf" />
            </app-form-field>
          </div>
          <div class="col-6">
            <app-form-field label="CLR" inputId="adjClr" [control]="form.controls.clr">
              <input id="adjClr" type="number" step="0.01" class="form-control" formControlName="clr" />
            </app-form-field>
          </div>
        </div>
        <app-form-field label="Reason for adjustment" inputId="adjReason" [control]="form.controls.reason" [messages]="{ pattern: 'Reason cannot be blank.' }">
          <textarea id="adjReason" rows="2" maxlength="500" class="form-control" formControlName="reason"></textarea>
        </app-form-field>
        @if (form.errors?.['noChange'] && (form.touched || form.dirty)) {
          <div class="text-danger small">Change at least one value.</div>
        }
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="adjustForm" class="btn btn-warning" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save adjustment
        </button>
      </div>
    </app-modal>
  `,
})
export class AdjustCollectionModalComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(MilkCollectionService);
  private readonly toast = inject(ToastService);

  readonly collection = input<CollectionListItem | null>(null);
  readonly saved = output<CollectionDetail>();
  readonly closed = output<void>();

  protected readonly saving = signal(false);

  protected readonly form = this.fb.group(
    {
      quantityLiters: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.001)]),
      fat: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.1), Validators.max(25)]),
      snf: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.1), Validators.max(25)]),
      clr: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(60)]),
      reason: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)]],
    },
    { validators: [(g: AbstractControl) => this.changeValidator(g)] },
  );

  constructor() {
    effect(() => {
      const c = this.collection();
      untracked(() => {
        if (c) {
          this.form.reset({ quantityLiters: c.quantityLiters, fat: c.fat, snf: c.snf, clr: c.clr, reason: '' });
        }
        this.saving.set(false);
      });
    });
  }

  private changeValidator(g: AbstractControl): ValidationErrors | null {
    const c = this.collection();
    if (!c) {
      return null;
    }
    return this.diff(c, g.value as Record<string, number | null>) ? null : { noChange: true };
  }

  /** only the values that really changed (null = keep on the server); undefined when nothing changed */
  private diff(c: CollectionListItem, v: Record<string, number | null>): Omit<AdjustCollectionRequest, 'reason'> | undefined {
    const out: Omit<AdjustCollectionRequest, 'reason'> = {};
    let changed = false;
    const q = v['quantityLiters'];
    if (q !== null && q !== undefined && Number(q) !== c.quantityLiters) {
      out.quantityLiters = Number(q);
      changed = true;
    }
    const fat = v['fat'];
    if (fat !== null && fat !== undefined && Number(fat) !== c.fat) {
      out.fat = Number(fat);
      changed = true;
    }
    const snf = v['snf'];
    if (snf !== null && snf !== undefined && Number(snf) !== c.snf) {
      out.snf = Number(snf);
      changed = true;
    }
    const clr = v['clr'];
    if (clr !== null && clr !== undefined && Number(clr) !== c.clr) {
      out.clr = Number(clr);
      changed = true;
    }
    return changed ? out : undefined;
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
    const changes = this.diff(c, { quantityLiters: v.quantityLiters, fat: v.fat, snf: v.snf, clr: v.clr });
    if (!changes) {
      return;
    }
    this.saving.set(true);
    this.svc.adjust(c.id, { ...changes, reason: v.reason.trim() }).subscribe({
      next: (detail) => {
        this.saving.set(false);
        this.toast.success(`Collection ${c.collectionNumber} adjusted.`);
        this.saved.emit(detail);
      },
      error: () => this.saving.set(false),
    });
  }
}
