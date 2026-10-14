import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { LookupItem } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { AppCurrencyPipe } from '../../../shared/pipes/app-pipes';
import { isoDay, optText } from '../collection.util';
import { CreateSettlementRequest, CreateSettlementResult, SettlementPreview } from '../models/settlement.model';
import { FarmerSettlementService } from '../services/farmer-settlement.service';

/** Deduction / bonus inputs and the "Create settlement" action for a previewed farmer + period. */
@Component({
  selector: 'app-settlement-create-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormFieldComponent, AppCurrencyPipe],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="row">
        <div class="col-6 col-md-3">
          <app-form-field label="Extra bonus" inputId="stBonus" [control]="form.controls.bonusAmount" hint="Added to per-collection bonus">
            <input id="stBonus" type="number" step="0.01" class="form-control" formControlName="bonusAmount" />
          </app-form-field>
        </div>
        <div class="col-6 col-md-3">
          <app-form-field label="Extra penalty" inputId="stPenalty" [control]="form.controls.penaltyAmount">
            <input id="stPenalty" type="number" step="0.01" class="form-control" formControlName="penaltyAmount" />
          </app-form-field>
        </div>
        <div class="col-6 col-md-3">
          <app-form-field label="Advance deduction" inputId="stAdvance" [control]="form.controls.advanceDeduction"
            [hint]="'Balance ' + (preview().summary.pendingAdvanceBalance | appCurrency)">
            <input id="stAdvance" type="number" step="0.01" class="form-control" formControlName="advanceDeduction" />
          </app-form-field>
        </div>
        <div class="col-6 col-md-3">
          <app-form-field label="Other deduction" inputId="stOther" [control]="form.controls.otherDeduction">
            <input id="stOther" type="number" step="0.01" class="form-control" formControlName="otherDeduction" />
          </app-form-field>
        </div>
        <div class="col-md-6">
          <app-form-field label="Other deduction remarks" inputId="stOtherRemarks" [control]="form.controls.otherDeductionRemarks">
            <input id="stOtherRemarks" type="text" maxlength="250" class="form-control" formControlName="otherDeductionRemarks" />
          </app-form-field>
        </div>
        <div class="col-md-3">
          <app-form-field label="Payment mode" inputId="stMode">
            <select id="stMode" class="form-select" formControlName="paymentModeId">
              <option [ngValue]="null">Default (farmer's)</option>
              @for (m of modes(); track m.id) {
                <option [ngValue]="m.id">{{ m.name }}</option>
              }
            </select>
          </app-form-field>
        </div>
        <div class="col-md-3">
          <app-form-field label="Reference no." inputId="stRef" [control]="form.controls.referenceNo">
            <input id="stRef" type="text" maxlength="100" class="form-control" formControlName="referenceNo" />
          </app-form-field>
        </div>
        <div class="col-md-9">
          <app-form-field label="Remarks" inputId="stRemarks" [control]="form.controls.remarks">
            <input id="stRemarks" type="text" maxlength="500" class="form-control" formControlName="remarks" />
          </app-form-field>
        </div>
        <div class="col-md-3 d-flex align-items-center">
          <div class="form-check form-switch">
            <input id="stLoans" type="checkbox" class="form-check-input" formControlName="includeLoanInstallments" />
            <label class="form-check-label" for="stLoans">Deduct due loan installments</label>
          </div>
        </div>
      </div>
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 border-top pt-3">
        <div>
          <span class="text-muted">Estimated net payable</span>
          <span class="fs-5 fw-semibold ms-2" [class.text-danger]="estimate() < 0">{{ estimate() | appCurrency }}</span>
        </div>
        <button type="submit" class="btn btn-primary" [disabled]="saving() || preview().collections.length === 0">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          <i class="bi bi-journal-plus me-1"></i>Create settlement
        </button>
      </div>
    </form>
  `,
})
export class SettlementCreateFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(FarmerSettlementService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly lookup = inject(LookupService);

  readonly preview = input.required<SettlementPreview>();
  readonly created = output<CreateSettlementResult>();

  protected readonly saving = signal(false);
  protected readonly modes = toSignal(this.lookup.paymentModes(), { initialValue: [] as LookupItem[] });

  protected readonly form = this.fb.group({
    bonusAmount: this.fb.control<number | null>(0, [Validators.min(0)]),
    penaltyAmount: this.fb.control<number | null>(0, [Validators.min(0)]),
    advanceDeduction: this.fb.control<number | null>(0, [Validators.min(0)]),
    otherDeduction: this.fb.control<number | null>(0, [Validators.min(0)]),
    otherDeductionRemarks: ['', [Validators.maxLength(250), (c: AbstractControl) => this.remarksRule(c)]],
    includeLoanInstallments: [true],
    paymentModeId: this.fb.control<number | null>(null),
    referenceNo: ['', Validators.maxLength(100)],
    remarks: ['', Validators.maxLength(500)],
  });

  private readonly tick = toSignal(this.form.valueChanges.pipe(startWith(null)), { initialValue: null });

  protected readonly estimate = computed(() => {
    this.tick();
    const v = this.form.getRawValue();
    const s = this.preview().summary;
    const num = (x: number | null): number => (x === null || isNaN(Number(x)) ? 0 : Number(x));
    return (
      s.netBeforeDeduction +
      num(v.bonusAmount) -
      num(v.penaltyAmount) -
      num(v.advanceDeduction) -
      (v.includeLoanInstallments ? s.suggestedLoanDeduction : 0) -
      num(v.otherDeduction)
    );
  });

  constructor() {
    effect(() => {
      const p = this.preview();
      untracked(() => {
        this.form.reset({
          bonusAmount: 0,
          penaltyAmount: 0,
          advanceDeduction: p.summary.suggestedAdvanceDeduction,
          otherDeduction: 0,
          otherDeductionRemarks: '',
          includeLoanInstallments: true,
          paymentModeId: null,
          referenceNo: '',
          remarks: '',
        });
        this.saving.set(false);
      });
    });
    this.form.controls.otherDeduction.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.form.controls.otherDeductionRemarks.updateValueAndValidity());
  }

  private remarksRule(c: AbstractControl): ValidationErrors | null {
    const other = Number(c.parent?.get('otherDeduction')?.value ?? 0);
    const text = String(c.value ?? '').trim();
    return other > 0 && !text ? { required: true } : null;
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const s = this.preview().summary;
    const ok = await this.confirmService.confirm({
      title: 'Create settlement',
      message: `Create a settlement for ${s.farmerName} (${s.totalCollections} collections)? The collections are locked to it until it is cancelled.`,
      confirmText: 'Create',
    });
    if (!ok) {
      return;
    }
    const v = this.form.getRawValue();
    const body: CreateSettlementRequest = {
      farmerId: s.farmerId,
      from: isoDay(s.periodFrom),
      to: isoDay(s.periodTo),
      bonusAmount: Number(v.bonusAmount ?? 0),
      penaltyAmount: Number(v.penaltyAmount ?? 0),
      advanceDeduction: Number(v.advanceDeduction ?? 0),
      includeLoanInstallments: v.includeLoanInstallments,
      otherDeduction: Number(v.otherDeduction ?? 0),
      otherDeductionRemarks: optText(v.otherDeductionRemarks),
      paymentModeId: v.paymentModeId ?? undefined,
      referenceNo: optText(v.referenceNo),
      remarks: optText(v.remarks),
    };
    this.saving.set(true);
    this.svc.create(body).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(`Settlement ${res.number} created (net payable ${res.netPayable}). Approve it below to pay.`);
        this.created.emit(res);
      },
      error: () => this.saving.set(false),
    });
  }
}
