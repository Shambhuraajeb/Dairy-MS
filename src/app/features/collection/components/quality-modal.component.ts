import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { optNumber, optText } from '../collection.util';
import { CollectionListItem, QualityRequest } from '../models/collection.model';
import { MilkCollectionService } from '../services/milk-collection.service';

/** Record a quality test for a Pending collection (a Fail result blocks approval). */
@Component({
  selector: 'app-quality-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent],
  template: `
    <app-modal [open]="collection() !== null" [title]="'Record quality: ' + (collection()?.collectionNumber ?? '')" size="lg" (closed)="close()">
      @if (collection(); as c) {
        <p class="text-muted small">{{ c.farmerCode }} - {{ c.farmerName }}. Quality results do not change the payable FAT/SNF; use Adjust for that.</p>
      }
      <form id="qualityForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row">
          <div class="col-6 col-md-3">
            <app-form-field label="FAT %" inputId="qFat" [control]="form.controls.fat">
              <input id="qFat" type="number" step="0.01" class="form-control" formControlName="fat" />
            </app-form-field>
          </div>
          <div class="col-6 col-md-3">
            <app-form-field label="SNF %" inputId="qSnf" [control]="form.controls.snf">
              <input id="qSnf" type="number" step="0.01" class="form-control" formControlName="snf" />
            </app-form-field>
          </div>
          <div class="col-6 col-md-3">
            <app-form-field label="CLR" inputId="qClr" [control]="form.controls.clr">
              <input id="qClr" type="number" step="0.01" class="form-control" formControlName="clr" />
            </app-form-field>
          </div>
          <div class="col-6 col-md-3">
            <app-form-field label="Temperature (°C)" inputId="qTemp" [control]="form.controls.temperature">
              <input id="qTemp" type="number" step="0.1" class="form-control" formControlName="temperature" />
            </app-form-field>
          </div>
          <div class="col-6 col-md-3">
            <app-form-field label="Protein %" inputId="qProtein" [control]="form.controls.protein">
              <input id="qProtein" type="number" step="0.01" class="form-control" formControlName="protein" />
            </app-form-field>
          </div>
          <div class="col-6 col-md-3">
            <app-form-field label="Lactose %" inputId="qLactose" [control]="form.controls.lactose">
              <input id="qLactose" type="number" step="0.01" class="form-control" formControlName="lactose" />
            </app-form-field>
          </div>
          <div class="col-6 col-md-3">
            <app-form-field label="Acidity" inputId="qAcidity" [control]="form.controls.acidity">
              <input id="qAcidity" type="number" step="0.01" class="form-control" formControlName="acidity" />
            </app-form-field>
          </div>
          <div class="col-6 col-md-3">
            <app-form-field label="Result" inputId="qResult" hint="Auto = Fail if anything is detected">
              <select id="qResult" class="form-select" formControlName="result">
                <option value="">Auto</option>
                <option value="Pass">Pass</option>
                <option value="Fail">Fail</option>
              </select>
            </app-form-field>
          </div>
        </div>
        <div class="section-title">Adulteration checks</div>
        <div class="row mb-3">
          @for (f of flags; track f.key) {
            <div class="col-6 col-md-4">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" [id]="'q_' + f.key" [formControlName]="f.key" />
                <label class="form-check-label" [for]="'q_' + f.key">{{ f.label }}</label>
              </div>
            </div>
          }
        </div>
        <div class="row">
          <div class="col-md-6">
            <app-form-field label="Failure reason" inputId="qFail" [control]="form.controls.failureReason">
              <input id="qFail" type="text" maxlength="250" class="form-control" formControlName="failureReason" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Remarks" inputId="qRemarks" [control]="form.controls.remarks">
              <input id="qRemarks" type="text" maxlength="500" class="form-control" formControlName="remarks" />
            </app-form-field>
          </div>
        </div>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="qualityForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save test
        </button>
      </div>
    </app-modal>
  `,
})
export class QualityModalComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(MilkCollectionService);
  private readonly toast = inject(ToastService);

  readonly collection = input<CollectionListItem | null>(null);
  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly saving = signal(false);

  protected readonly flags: { key: 'waterAdded' | 'starchDetected' | 'ureaDetected' | 'neutralizerDetected' | 'antibioticDetected' | 'otherAdulteration'; label: string }[] = [
    { key: 'waterAdded', label: 'Water added' },
    { key: 'starchDetected', label: 'Starch detected' },
    { key: 'ureaDetected', label: 'Urea detected' },
    { key: 'neutralizerDetected', label: 'Neutralizer detected' },
    { key: 'antibioticDetected', label: 'Antibiotic detected' },
    { key: 'otherAdulteration', label: 'Other adulteration' },
  ];

  protected readonly form = this.fb.group({
    fat: this.fb.control<number | null>(null, [Validators.min(0.1), Validators.max(25)]),
    snf: this.fb.control<number | null>(null, [Validators.min(0.1), Validators.max(25)]),
    clr: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(60)]),
    protein: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(25)]),
    lactose: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(25)]),
    temperature: this.fb.control<number | null>(null, [Validators.min(-5), Validators.max(100)]),
    acidity: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(10)]),
    result: [''],
    waterAdded: [false],
    starchDetected: [false],
    ureaDetected: [false],
    neutralizerDetected: [false],
    antibioticDetected: [false],
    otherAdulteration: [false],
    failureReason: ['', Validators.maxLength(250)],
    remarks: ['', Validators.maxLength(500)],
  });

  constructor() {
    effect(() => {
      const c = this.collection();
      untracked(() => {
        if (c) {
          this.form.reset({
            fat: c.fat,
            snf: c.snf,
            clr: c.clr,
            result: '',
            waterAdded: false,
            starchDetected: false,
            ureaDetected: false,
            neutralizerDetected: false,
            antibioticDetected: false,
            otherAdulteration: false,
            failureReason: '',
            remarks: '',
          });
        }
        this.saving.set(false);
      });
    });
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
    const body: QualityRequest = {
      fat: optNumber(v.fat),
      snf: optNumber(v.snf),
      clr: optNumber(v.clr),
      protein: optNumber(v.protein),
      lactose: optNumber(v.lactose),
      temperature: optNumber(v.temperature),
      acidity: optNumber(v.acidity),
      waterAdded: v.waterAdded,
      starchDetected: v.starchDetected,
      ureaDetected: v.ureaDetected,
      neutralizerDetected: v.neutralizerDetected,
      antibioticDetected: v.antibioticDetected,
      otherAdulteration: v.otherAdulteration,
      result: optText(v.result),
      failureReason: optText(v.failureReason),
      remarks: optText(v.remarks),
    };
    this.saving.set(true);
    this.svc.recordQuality(c.id, body).subscribe({
      next: (test) => {
        this.saving.set(false);
        this.toast.success(`Quality test saved: ${test.result}.`);
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
