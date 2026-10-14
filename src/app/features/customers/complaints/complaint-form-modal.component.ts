import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { COMPLAINT_CATEGORIES, COMPLAINT_PRIORITIES, Complaint } from '../complaint.model';
import { CustomerService } from '../customer.service';

@Component({
  selector: 'app-complaint-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent],
  template: `
    <app-modal [open]="open()" title="Raise complaint" size="lg" (closed)="close()">
      <form id="complaintForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row">
          @if (!isCustomerRole()) {
            <div class="col-md-12">
              <app-form-field label="Customer" inputId="cpCustomer" [control]="form.controls.customerId">
                <select id="cpCustomer" class="form-select" formControlName="customerId">
                  <option [ngValue]="null">-- select customer --</option>
                  @for (c of customers(); track c.id) {
                    <option [ngValue]="c.id">{{ c.code }} - {{ c.name }}</option>
                  }
                </select>
              </app-form-field>
            </div>
          }
          <div class="col-md-6">
            <app-form-field label="Category" inputId="cpCategory" [control]="form.controls.category">
              <select id="cpCategory" class="form-select" formControlName="category">
                @for (c of categories; track c) {
                  <option [value]="c">{{ c }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Priority" inputId="cpPriority" [control]="form.controls.priority">
              <select id="cpPriority" class="form-select" formControlName="priority">
                @for (p of priorities; track p) {
                  <option [value]="p">{{ p }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-12">
            <app-form-field label="Subject" inputId="cpSubject" [control]="form.controls.subject">
              <input id="cpSubject" class="form-control" formControlName="subject" maxlength="150" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-12">
            <app-form-field label="Description" inputId="cpDesc" [control]="form.controls.description">
              <textarea id="cpDesc" class="form-control" rows="4" formControlName="description" maxlength="2000"></textarea>
            </app-form-field>
          </div>
        </div>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="complaintForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Submit complaint
        </button>
      </div>
    </app-modal>
  `,
})
export class ComplaintFormModalComponent {
  private readonly svc = inject(CustomerService);
  private readonly lookups = inject(LookupService);
  private readonly perm = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = input(false);
  /** preselected customer (staff) */
  readonly customerId = input<number | null>(null);
  readonly closed = output<void>();
  readonly saved = output<Complaint>();

  readonly categories = COMPLAINT_CATEGORIES;
  readonly priorities = COMPLAINT_PRIORITIES;
  readonly customers = toSignal(this.lookups.customers(), { initialValue: [] as LookupItem[] });
  readonly saving = signal(false);

  readonly form = this.fb.group({
    customerId: this.fb.control<number | null>(null),
    category: ['Other', Validators.required],
    priority: ['Medium', Validators.required],
    subject: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.reset());
      }
    });
  }

  isCustomerRole(): boolean {
    return this.perm.isInRole('Customer', 'Distributor / B2B Customer');
  }

  private reset(): void {
    this.form.reset({ customerId: this.customerId(), category: 'Other', priority: 'Medium', subject: '', description: '' });
    const ctrl = this.form.controls.customerId;
    if (this.isCustomerRole()) {
      ctrl.clearValidators();
    } else {
      ctrl.setValidators(Validators.required);
    }
    ctrl.updateValueAndValidity();
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
      .createComplaint({
        customerId: this.isCustomerRole() ? null : v.customerId,
        category: v.category,
        priority: v.priority,
        subject: v.subject.trim(),
        description: v.description.trim(),
      })
      .subscribe({
        next: (c) => {
          this.saving.set(false);
          this.toast.success(`Complaint ${c.complaintNumber} raised.`);
          this.saved.emit(c);
        },
        error: () => this.saving.set(false),
      });
  }
}
