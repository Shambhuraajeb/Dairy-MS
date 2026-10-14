import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { toIsoDate } from '../../../shared/utils/format';
import { nullIfEmpty, numOrNull } from '../../farmers/farmer.model';
import { AnimalDetail } from '../animal.model';
import { AnimalService } from '../animal.service';

export type AnimalAction = 'sale' | 'death' | 'archive';

/** One modal that hosts the three lifecycle-ending actions: sale, death, archive. */
@Component({
  selector: 'app-animal-action-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent],
  template: `
    <app-modal [open]="action() !== null" [title]="title()" [size]="action() === 'archive' ? 'md' : 'lg'" (closed)="close()">
      @switch (action()) {
        @case ('sale') {
          <form id="actionForm" [formGroup]="saleForm" (ngSubmit)="submit()" novalidate class="row g-0">
            <div class="col-12"><div class="alert alert-warning py-2 small">Selling marks the animal as Sold. This cannot be undone.</div></div>
            <div class="col-md-6 pe-md-3">
              <app-form-field label="Sale date" inputId="saleDate" [control]="saleForm.controls.saleDate">
                <input id="saleDate" type="date" class="form-control" formControlName="saleDate" [max]="today" />
              </app-form-field>
            </div>
            <div class="col-md-6">
              <app-form-field label="Sale price (INR)" inputId="salePrice" [control]="saleForm.controls.salePrice">
                <input id="salePrice" type="number" min="0" step="0.01" class="form-control" formControlName="salePrice" />
              </app-form-field>
            </div>
            <div class="col-md-6 pe-md-3">
              <app-form-field label="Buyer name" inputId="buyerName" [control]="saleForm.controls.buyerName">
                <input id="buyerName" class="form-control" formControlName="buyerName" maxlength="150" />
              </app-form-field>
            </div>
            <div class="col-md-6">
              <app-form-field label="Buyer mobile" inputId="buyerMobile" [control]="saleForm.controls.buyerMobile" [messages]="{ pattern: 'Enter 10-13 digits.' }">
                <input id="buyerMobile" class="form-control" formControlName="buyerMobile" maxlength="14" inputmode="tel" />
              </app-form-field>
            </div>
            <div class="col-12">
              <app-form-field label="Buyer address" inputId="buyerAddress" [control]="saleForm.controls.buyerAddress">
                <input id="buyerAddress" class="form-control" formControlName="buyerAddress" maxlength="250" />
              </app-form-field>
            </div>
            <div class="col-md-6 pe-md-3">
              <app-form-field label="Payment mode" inputId="saleMode" [control]="saleForm.controls.paymentModeId">
                <select id="saleMode" class="form-select" formControlName="paymentModeId">
                  <option value="">Select</option>
                  @for (m of paymentModes(); track m.id) {
                    <option [value]="m.id">{{ m.name }}</option>
                  }
                </select>
              </app-form-field>
            </div>
            <div class="col-md-6">
              <app-form-field label="Reference no." inputId="saleRef" [control]="saleForm.controls.referenceNo">
                <input id="saleRef" class="form-control" formControlName="referenceNo" maxlength="100" />
              </app-form-field>
            </div>
            <div class="col-md-6 pe-md-3">
              <app-form-field label="Reason for sale" inputId="saleReason" [control]="saleForm.controls.reason">
                <input id="saleReason" class="form-control" formControlName="reason" maxlength="200" />
              </app-form-field>
            </div>
            <div class="col-md-6">
              <app-form-field label="Remarks" inputId="saleRemarks" [control]="saleForm.controls.remarks">
                <input id="saleRemarks" class="form-control" formControlName="remarks" maxlength="300" />
              </app-form-field>
            </div>
          </form>
        }
        @case ('death') {
          <form id="actionForm" [formGroup]="deathForm" (ngSubmit)="submit()" novalidate class="row g-0">
            <div class="col-12"><div class="alert alert-warning py-2 small">This marks the animal as Dead. This cannot be undone.</div></div>
            <div class="col-md-6 pe-md-3">
              <app-form-field label="Date of death" inputId="deathDate" [control]="deathForm.controls.deathDate">
                <input id="deathDate" type="date" class="form-control" formControlName="deathDate" [max]="today" />
              </app-form-field>
            </div>
            <div class="col-md-6">
              <app-form-field label="Cause category" inputId="deathCategory" [control]="deathForm.controls.causeCategory">
                <select id="deathCategory" class="form-select" formControlName="causeCategory">
                  <option value="">Select</option>
                  @for (c of causeCategories; track c) {
                    <option [value]="c">{{ c }}</option>
                  }
                </select>
              </app-form-field>
            </div>
            <div class="col-12">
              <app-form-field label="Cause details" inputId="deathCause" [control]="deathForm.controls.cause">
                <input id="deathCause" class="form-control" formControlName="cause" maxlength="250" />
              </app-form-field>
            </div>
            <div class="col-md-6 pe-md-3">
              <app-form-field label="Veterinarian" inputId="deathVet" [control]="deathForm.controls.vetName">
                <input id="deathVet" class="form-control" formControlName="vetName" maxlength="150" />
              </app-form-field>
            </div>
            <div class="col-md-6">
              <app-form-field label="Loss amount (INR)" inputId="deathLoss" [control]="deathForm.controls.lossAmount">
                <input id="deathLoss" type="number" min="0" step="0.01" class="form-control" formControlName="lossAmount" />
              </app-form-field>
            </div>
            <div class="col-12 mb-3">
              <div class="form-check">
                <input id="deathPm" type="checkbox" class="form-check-input" formControlName="postMortemDone" />
                <label class="form-check-label" for="deathPm">Post-mortem done</label>
              </div>
            </div>
            <div class="col-12">
              <app-form-field label="Remarks" inputId="deathRemarks" [control]="deathForm.controls.remarks">
                <textarea id="deathRemarks" class="form-control" rows="2" formControlName="remarks" maxlength="300"></textarea>
              </app-form-field>
            </div>
          </form>
        }
        @case ('archive') {
          <form id="actionForm" [formGroup]="archiveForm" (ngSubmit)="submit()" novalidate>
            <div class="alert alert-warning py-2 small">Archived animals are hidden from active lists and can no longer be edited.</div>
            <app-form-field label="Reason (optional)" inputId="archiveReason" [control]="archiveForm.controls.reason">
              <textarea id="archiveReason" class="form-control" rows="3" formControlName="reason" maxlength="300"></textarea>
            </app-form-field>
          </form>
        }
      }
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="actionForm" class="btn btn-danger" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          {{ confirmText() }}
        </button>
      </div>
    </app-modal>
  `,
})
export class AnimalActionDialogComponent {
  private readonly svc = inject(AnimalService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly animal = input.required<AnimalDetail>();
  /** null = closed */
  readonly action = input<AnimalAction | null>(null);
  readonly closed = output<void>();
  readonly done = output<AnimalDetail>();

  readonly today = toIsoDate();
  readonly causeCategories = ['Disease', 'Accident', 'Age', 'Calving', 'Unknown'];
  readonly paymentModes = toSignal(this.lookups.get('payment-modes'), { initialValue: [] as LookupItem[] });
  readonly saving = signal(false);

  readonly title = computed(() => {
    const tag = this.animal().tagNumber;
    switch (this.action()) {
      case 'sale':
        return `Sell animal ${tag}`;
      case 'death':
        return `Record death of ${tag}`;
      case 'archive':
        return `Archive animal ${tag}`;
      default:
        return '';
    }
  });
  readonly confirmText = computed(() => (this.action() === 'sale' ? 'Confirm sale' : this.action() === 'death' ? 'Record death' : 'Archive'));

  readonly saleForm = this.fb.group({
    saleDate: [toIsoDate(), Validators.required],
    buyerName: ['', [Validators.required, Validators.maxLength(150)]],
    buyerMobile: ['', Validators.pattern(/^\+?\d{10,13}$/)],
    buyerAddress: [''],
    salePrice: [null as number | null, [Validators.required, Validators.min(0)]],
    paymentModeId: [''],
    referenceNo: [''],
    reason: [''],
    remarks: [''],
  });

  readonly deathForm = this.fb.group({
    deathDate: [toIsoDate(), Validators.required],
    causeCategory: ['', Validators.required],
    cause: [''],
    vetName: [''],
    lossAmount: [null as number | null, Validators.min(0)],
    postMortemDone: [false],
    remarks: [''],
  });

  readonly archiveForm = this.fb.group({ reason: [''] });

  close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  submit(): void {
    const id = this.animal().id;
    const action = this.action();
    let request$: Observable<AnimalDetail>;
    if (action === 'sale') {
      if (this.saleForm.invalid) {
        this.saleForm.markAllAsTouched();
        return;
      }
      const v = this.saleForm.getRawValue();
      request$ = this.svc.sell(id, {
        saleDate: nullIfEmpty(v.saleDate),
        buyerName: v.buyerName.trim(),
        buyerMobile: nullIfEmpty(v.buyerMobile),
        buyerAddress: nullIfEmpty(v.buyerAddress),
        salePrice: Number(v.salePrice),
        paymentModeId: numOrNull(v.paymentModeId),
        referenceNo: nullIfEmpty(v.referenceNo),
        reason: nullIfEmpty(v.reason),
        remarks: nullIfEmpty(v.remarks),
      });
    } else if (action === 'death') {
      if (this.deathForm.invalid) {
        this.deathForm.markAllAsTouched();
        return;
      }
      const v = this.deathForm.getRawValue();
      request$ = this.svc.markDead(id, {
        deathDate: nullIfEmpty(v.deathDate),
        cause: nullIfEmpty(v.cause),
        causeCategory: v.causeCategory,
        vetName: nullIfEmpty(v.vetName),
        postMortemDone: v.postMortemDone,
        lossAmount: numOrNull(v.lossAmount),
        remarks: nullIfEmpty(v.remarks),
      });
    } else if (action === 'archive') {
      request$ = this.svc.archive(id, nullIfEmpty(this.archiveForm.getRawValue().reason));
    } else {
      return;
    }
    this.saving.set(true);
    request$.subscribe({
      next: (animal) => {
        this.saving.set(false);
        this.toast.success(action === 'sale' ? 'Animal sold.' : action === 'death' ? 'Death recorded.' : 'Animal archived.');
        this.done.emit(animal);
      },
      error: () => this.saving.set(false),
    });
  }
}
