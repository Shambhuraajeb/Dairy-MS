import { Component, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { FormFieldComponent } from '../../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { BankBody, FarmerBankAccount, FarmerDetail, nullIfEmpty } from '../../farmer.model';
import { FarmerService } from '../../farmer.service';

@Component({
  selector: 'app-farmer-bank-tab',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, FormFieldComponent, ModalComponent, HasPermissionDirective],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="h6 mb-0">Bank accounts</h2>
      <button *appHasPermission="'farmer.update'" type="button" class="btn btn-sm btn-primary" (click)="openCreate()">
        <i class="bi bi-plus-lg me-1"></i>Add bank account
      </button>
    </div>

    @if (farmer().bankAccounts.length === 0) {
      <div class="card">
        <app-empty-state icon="bi-bank" title="No bank accounts" message="At least one active bank account is required to activate a farmer." />
      </div>
    } @else {
      <div class="row g-3">
        @for (b of farmer().bankAccounts; track b.id) {
          <div class="col-md-6 col-xl-4">
            <div class="card h-100">
              <div class="card-body">
                <div class="d-flex justify-content-between mb-2">
                  <strong>{{ b.bankName }}</strong>
                  @if (b.isPrimary) {
                    <span class="badge badge-soft badge-soft-success">Primary</span>
                  }
                </div>
                <div class="font-monospace">{{ b.accountNumber }}</div>
                <div class="small text-muted">{{ b.accountHolderName }}</div>
                <div class="small text-muted">IFSC {{ b.ifscCode }}@if (b.branchName) {<span> &middot; {{ b.branchName }}</span>}</div>
                @if (b.upiId) {
                  <div class="small text-muted">UPI {{ b.upiId }}</div>
                }
              </div>
              <div *appHasPermission="'farmer.update'" class="card-footer bg-white border-0 pt-0 text-end">
                <button type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="openEdit(b)"><i class="bi bi-pencil"></i> Edit</button>
                <button type="button" class="btn btn-sm btn-outline-danger" (click)="remove(b)"><i class="bi bi-trash"></i></button>
              </div>
            </div>
          </div>
        }
      </div>
    }

    <app-modal [open]="open()" [title]="editing() ? 'Edit bank account' : 'Add bank account'" (closed)="close()">
      <form id="bankForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-form-field label="Account holder name" inputId="bHolder" [control]="form.controls.accountHolderName">
          <input id="bHolder" class="form-control" formControlName="accountHolderName" maxlength="150" />
        </app-form-field>
        <div class="row">
          <div class="col-md-6">
            <app-form-field label="Bank name" inputId="bBank" [control]="form.controls.bankName">
              <input id="bBank" class="form-control" formControlName="bankName" maxlength="150" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Branch" inputId="bBranch" [control]="form.controls.branchName">
              <input id="bBranch" class="form-control" formControlName="branchName" maxlength="150" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Account number" inputId="bAcc" [control]="form.controls.accountNumber">
              <input id="bAcc" class="form-control" formControlName="accountNumber" maxlength="30" inputmode="numeric" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="IFSC" inputId="bIfsc" [control]="form.controls.ifscCode" [messages]="{ pattern: 'IFSC format: ABCD0123456.' }">
              <input id="bIfsc" class="form-control text-uppercase" formControlName="ifscCode" maxlength="11" />
            </app-form-field>
          </div>
        </div>
        <app-form-field label="UPI id" inputId="bUpi" [control]="form.controls.upiId">
          <input id="bUpi" class="form-control" formControlName="upiId" maxlength="100" />
        </app-form-field>
        <div class="form-check form-switch">
          <input id="bPrimary" type="checkbox" class="form-check-input" formControlName="isPrimary" />
          <label class="form-check-label" for="bPrimary">Primary account</label>
        </div>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="bankForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class FarmerBankTabComponent {
  private readonly svc = inject(FarmerService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly farmer = input.required<FarmerDetail>();
  readonly changed = output<void>();

  readonly open = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<FarmerBankAccount | null>(null);

  readonly form = this.fb.group({
    accountHolderName: ['', [Validators.required, Validators.maxLength(150)]],
    bankName: ['', [Validators.required, Validators.maxLength(150)]],
    branchName: [''],
    accountNumber: ['', [Validators.required, Validators.maxLength(30)]],
    ifscCode: ['', [Validators.required, Validators.pattern(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/)]],
    upiId: [''],
    isPrimary: [false],
  });

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({ accountHolderName: this.farmer().fullName, isPrimary: this.farmer().bankAccounts.length === 0 });
    this.open.set(true);
  }

  openEdit(b: FarmerBankAccount): void {
    this.editing.set(b);
    this.form.reset({
      accountHolderName: b.accountHolderName,
      bankName: b.bankName,
      branchName: b.branchName ?? '',
      accountNumber: b.accountNumber,
      ifscCode: b.ifscCode,
      upiId: b.upiId ?? '',
      isPrimary: b.isPrimary,
    });
    this.open.set(true);
  }

  close(): void {
    if (!this.saving()) {
      this.open.set(false);
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: BankBody = {
      accountHolderName: v.accountHolderName.trim(),
      bankName: v.bankName.trim(),
      branchName: nullIfEmpty(v.branchName),
      accountNumber: v.accountNumber.trim(),
      ifscCode: v.ifscCode.trim().toUpperCase(),
      upiId: nullIfEmpty(v.upiId),
      isPrimary: v.isPrimary,
    };
    const current = this.editing();
    const farmerId = this.farmer().id;
    this.saving.set(true);
    const request$ = current ? this.svc.updateBankAccount(farmerId, current.id, body) : this.svc.addBankAccount(farmerId, body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.open.set(false);
        this.toast.success(current ? 'Bank account updated.' : 'Bank account added.');
        this.changed.emit();
      },
      error: () => this.saving.set(false),
    });
  }

  async remove(b: FarmerBankAccount): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Delete bank account',
      message: `Delete account ${b.accountNumber} (${b.bankName})?`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc.deleteBankAccount(this.farmer().id, b.id).subscribe(() => {
      this.toast.success('Bank account deleted.');
      this.changed.emit();
    });
  }
}
