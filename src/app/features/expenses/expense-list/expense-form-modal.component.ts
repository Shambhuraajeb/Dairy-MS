import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { toIsoDate } from '../../../shared/utils/format';
import { orNull } from '../../../shared/utils/paged-list';
import { positiveNumberValidator } from '../../../shared/validators/app-validators';
import { ExpenseService } from '../expense.service';

function notFuture(control: AbstractControl): ValidationErrors | null {
  const v = control.value as string;
  return v && v > toIsoDate() ? { custom: { message: 'Expense date cannot be in the future.' } } : null;
}

@Component({
  selector: 'app-expense-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent],
  template: `
    <app-modal [open]="open()" title="New Expense" (closed)="close()">
      <form id="expenseForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-form-field label="Category" inputId="exCat" [control]="form.controls.expenseCategoryId">
          <select id="exCat" class="form-select" formControlName="expenseCategoryId">
            <option [ngValue]="null">Select category</option>
            @for (c of categories(); track c.id) {
              <option [ngValue]="c.id">{{ c.name }}</option>
            }
          </select>
        </app-form-field>
        <div class="row">
          <div class="col-md-6">
            <app-form-field label="Amount" inputId="exAmount" [control]="form.controls.amount">
              <input id="exAmount" type="number" min="0" step="any" class="form-control" formControlName="amount" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Expense date" inputId="exDate" [control]="form.controls.expenseDate">
              <input id="exDate" type="date" class="form-control" formControlName="expenseDate" [max]="today" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Payment mode" inputId="exMode">
              <select id="exMode" class="form-select" formControlName="paymentModeId">
                <option [ngValue]="null">Not specified</option>
                @for (m of paymentModes(); track m.id) {
                  <option [ngValue]="m.id">{{ m.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Branch" inputId="exBranch">
              <select id="exBranch" class="form-select" formControlName="branchId">
                <option [ngValue]="null">Default</option>
                @for (b of branches(); track b.id) {
                  <option [ngValue]="b.id">{{ b.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Payee" inputId="exPayee" [control]="form.controls.payee">
              <input id="exPayee" type="text" class="form-control" formControlName="payee" maxlength="150" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Receipt no." inputId="exReceipt" [control]="form.controls.receiptNo">
              <input id="exReceipt" type="text" class="form-control" formControlName="receiptNo" maxlength="50" />
            </app-form-field>
          </div>
        </div>
        <app-form-field label="Description" inputId="exDesc" [control]="form.controls.description">
          <textarea id="exDesc" rows="2" class="form-control" formControlName="description" maxlength="500"></textarea>
        </app-form-field>
        <div class="form-text">Small expenses may be approved automatically; others wait for approval.</div>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="expenseForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save expense
        </button>
      </div>
    </app-modal>
  `,
})
export class ExpenseFormModalComponent {
  private readonly svc = inject(ExpenseService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = input(false);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly categories = toSignal(this.lookups.get('expense-categories'), { initialValue: [] as LookupItem[] });
  readonly paymentModes = toSignal(this.lookups.paymentModes(), { initialValue: [] as LookupItem[] });
  readonly branches = toSignal(this.lookups.branches(), { initialValue: [] as LookupItem[] });
  readonly saving = signal(false);
  readonly today = toIsoDate();

  readonly form = this.fb.group({
    expenseCategoryId: this.fb.control<number | null>(null, Validators.required),
    amount: this.fb.control<number | null>(null, [Validators.required, positiveNumberValidator()]),
    expenseDate: [toIsoDate(), notFuture],
    paymentModeId: this.fb.control<number | null>(null),
    branchId: this.fb.control<number | null>(null),
    payee: ['', Validators.maxLength(150)],
    receiptNo: ['', Validators.maxLength(50)],
    description: ['', Validators.maxLength(500)],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => {
          this.saving.set(false);
          this.form.reset({
            expenseCategoryId: null,
            amount: null,
            expenseDate: toIsoDate(),
            paymentModeId: null,
            branchId: null,
            payee: '',
            receiptNo: '',
            description: '',
          });
        });
      }
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
      .create({
        expenseCategoryId: Number(v.expenseCategoryId),
        expenseDate: orNull(v.expenseDate),
        amount: Number(v.amount),
        paymentModeId: v.paymentModeId,
        description: orNull(v.description.trim()),
        branchId: v.branchId,
        payee: orNull(v.payee.trim()),
        receiptNo: orNull(v.receiptNo.trim()),
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.toast.success(`Expense ${res.number} recorded (${res.status}).`);
          this.saved.emit();
        },
        error: () => this.saving.set(false),
      });
  }
}
