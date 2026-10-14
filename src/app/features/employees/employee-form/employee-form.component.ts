import { Component, OnInit, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { toIsoDate } from '../../../shared/utils/format';
import { dateOnly, orNull } from '../../../shared/utils/paged-list';
import { Employee, EmployeeRequest } from '../employee.model';
import { EmployeeService } from '../employee.service';

@Component({
  selector: 'app-employee-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, FormFieldComponent, LoadingComponent],
  template: `
    <app-page-header [title]="isEdit() ? 'Edit Employee' : 'New Employee'" subtitle="Personal details, designation, salary defaults and bank info">
      <a routerLink="/employees" class="btn btn-light">Cancel</a>
    </app-page-header>

    @if (loading()) {
      <app-loading text="Loading employee..." />
    } @else if (loadError()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center">
        <span>{{ loadError() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="loadEmployee()">Retry</button>
      </div>
    } @else {
      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="card mb-3">
          <div class="card-header">Personal information</div>
          <div class="card-body row g-0">
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Employee code" inputId="empCode" [control]="form.controls.employeeCode" hint="Leave blank to auto-generate">
                <input id="empCode" class="form-control" formControlName="employeeCode" maxlength="30" autocomplete="off" />
              </app-form-field>
            </div>
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Full name" inputId="empName" [control]="form.controls.fullName">
                <input id="empName" class="form-control" formControlName="fullName" maxlength="150" />
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Gender" inputId="empGender" [control]="form.controls.gender">
                <select id="empGender" class="form-select" formControlName="gender">
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </app-form-field>
            </div>
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Date of birth" inputId="empDob" [control]="form.controls.dateOfBirth">
                <input id="empDob" type="date" class="form-control" formControlName="dateOfBirth" [max]="today" />
              </app-form-field>
            </div>
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Mobile" inputId="empMobile" [control]="form.controls.mobile" [messages]="{ pattern: 'Enter 10-13 digits.' }">
                <input id="empMobile" class="form-control" formControlName="mobile" maxlength="13" inputmode="tel" />
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Email" inputId="empEmail" [control]="form.controls.email">
                <input id="empEmail" type="email" class="form-control" formControlName="email" maxlength="150" />
              </app-form-field>
            </div>
            <div class="col-md-8 pe-md-3">
              <app-form-field label="Address" inputId="empAddress" [control]="form.controls.addressLine">
                <input id="empAddress" class="form-control" formControlName="addressLine" maxlength="250" />
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="City" inputId="empCity" [control]="form.controls.city">
                <input id="empCity" class="form-control" formControlName="city" maxlength="100" />
              </app-form-field>
            </div>
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Aadhaar no." inputId="empAadhaar" [control]="form.controls.aadhaarNo" [messages]="{ pattern: 'Aadhaar must be 12 digits.' }">
                <input id="empAadhaar" class="form-control" formControlName="aadhaarNo" maxlength="12" inputmode="numeric" />
              </app-form-field>
            </div>
            <div class="col-md-4 pe-md-3">
              <app-form-field label="PAN" inputId="empPan" [control]="form.controls.panNo" [messages]="{ pattern: 'PAN format: ABCDE1234F.' }">
                <input id="empPan" class="form-control text-uppercase" formControlName="panNo" maxlength="10" />
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Emergency contact" inputId="empEmergency" [control]="form.controls.emergencyContact">
                <input id="empEmergency" class="form-control" formControlName="emergencyContact" maxlength="100" />
              </app-form-field>
            </div>
          </div>
        </div>

        <div class="card mb-3">
          <div class="card-header">Employment &amp; salary</div>
          <div class="card-body row g-0">
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Designation" inputId="empDesignation" [control]="form.controls.designationId">
                <select id="empDesignation" class="form-select" formControlName="designationId">
                  <option [ngValue]="null">Select designation</option>
                  @for (d of designations(); track d.id) {
                    <option [ngValue]="d.id">{{ d.name }}</option>
                  }
                </select>
              </app-form-field>
            </div>
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Branch" inputId="empBranch" [control]="form.controls.branchId">
                <select id="empBranch" class="form-select" formControlName="branchId">
                  <option [ngValue]="null">No branch</option>
                  @for (b of branches(); track b.id) {
                    <option [ngValue]="b.id">{{ b.name }}</option>
                  }
                </select>
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Join date" inputId="empJoin" [control]="form.controls.joinDate">
                <input id="empJoin" type="date" class="form-control" formControlName="joinDate" />
              </app-form-field>
            </div>
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Basic salary (monthly)" inputId="empBasic" [control]="form.controls.basicSalary">
                <input id="empBasic" type="number" min="0" step="0.01" class="form-control" formControlName="basicSalary" />
              </app-form-field>
            </div>
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Default allowances" inputId="empAllow" [control]="form.controls.defaultAllowances">
                <input id="empAllow" type="number" min="0" step="0.01" class="form-control" formControlName="defaultAllowances" />
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Default deductions" inputId="empDeduct" [control]="form.controls.defaultDeductions">
                <input id="empDeduct" type="number" min="0" step="0.01" class="form-control" formControlName="defaultDeductions" />
              </app-form-field>
            </div>
            @if (isEdit()) {
              <div class="col-md-4 pe-md-3">
                <app-form-field label="Exit date" inputId="empExit" [control]="form.controls.exitDate" hint="Leave blank for current employees">
                  <input id="empExit" type="date" class="form-control" formControlName="exitDate" />
                </app-form-field>
              </div>
            }
          </div>
        </div>

        <div class="card mb-3">
          <div class="card-header">Bank details</div>
          <div class="card-body row g-0">
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Bank name" inputId="empBank" [control]="form.controls.bankName">
                <input id="empBank" class="form-control" formControlName="bankName" maxlength="100" />
              </app-form-field>
            </div>
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Account number" inputId="empAcc" [control]="form.controls.bankAccountNo">
                <input id="empAcc" class="form-control" formControlName="bankAccountNo" maxlength="30" inputmode="numeric" />
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="IFSC" inputId="empIfsc" [control]="form.controls.ifscCode" [messages]="{ pattern: 'IFSC format: ABCD0123456.' }">
                <input id="empIfsc" class="form-control text-uppercase" formControlName="ifscCode" maxlength="11" />
              </app-form-field>
            </div>
          </div>
        </div>

        <div class="d-flex justify-content-end gap-2 mb-4">
          <a routerLink="/employees" class="btn btn-light">Cancel</a>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm me-1"></span>
            }
            {{ isEdit() ? 'Save changes' : 'Create employee' }}
          </button>
        </div>
      </form>
    }
  `,
})
export class EmployeeFormComponent implements OnInit {
  private readonly svc = inject(EmployeeService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  /** route param (present on /employees/:id/edit) */
  readonly id = input<string>();

  readonly today = toIsoDate();
  readonly isEdit = signal(false);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);

  readonly designations = toSignal(this.lookups.get('designations'), { initialValue: [] as LookupItem[] });
  readonly branches = toSignal(this.lookups.get('branches'), { initialValue: [] as LookupItem[] });

  readonly form = this.fb.group({
    employeeCode: ['', Validators.maxLength(30)],
    fullName: ['', [Validators.required, Validators.maxLength(150)]],
    gender: [''],
    dateOfBirth: [''],
    mobile: ['', Validators.pattern(/^\d{10,13}$/)],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    addressLine: [''],
    city: [''],
    designationId: [null as number | null, Validators.required],
    branchId: [null as number | null],
    joinDate: [toIsoDate()],
    exitDate: [''],
    basicSalary: [0, [Validators.required, Validators.min(0)]],
    defaultAllowances: [0, Validators.min(0)],
    defaultDeductions: [0, Validators.min(0)],
    bankName: [''],
    bankAccountNo: [''],
    ifscCode: ['', Validators.pattern(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/)],
    aadhaarNo: ['', Validators.pattern(/^\d{12}$/)],
    panNo: ['', Validators.pattern(/^[A-Za-z]{5}\d{4}[A-Za-z]$/)],
    emergencyContact: [''],
  });

  ngOnInit(): void {
    if (this.id()) {
      this.isEdit.set(true);
      this.form.controls.employeeCode.disable();
      this.loadEmployee();
    }
  }

  loadEmployee(): void {
    const id = this.id();
    if (!id) {
      return;
    }
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.get(id).subscribe({
      next: (e) => {
        this.patch(e);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  private patch(e: Employee): void {
    this.form.patchValue({
      employeeCode: e.employeeCode,
      fullName: e.fullName,
      gender: e.gender ?? '',
      dateOfBirth: dateOnly(e.dateOfBirth),
      mobile: e.mobile ?? '',
      email: e.email ?? '',
      addressLine: e.addressLine ?? '',
      city: e.city ?? '',
      designationId: e.designationId,
      branchId: e.branchId,
      joinDate: dateOnly(e.joinDate),
      exitDate: dateOnly(e.exitDate),
      basicSalary: e.basicSalary ?? 0,
      defaultAllowances: e.defaultAllowances ?? 0,
      defaultDeductions: e.defaultDeductions ?? 0,
      bankName: e.bankName ?? '',
      bankAccountNo: e.bankAccountNo ?? '',
      ifscCode: e.ifscCode ?? '',
      aadhaarNo: e.aadhaarNo ?? '',
      panNo: e.panNo ?? '',
      emergencyContact: e.emergencyContact ?? '',
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: EmployeeRequest = {
      fullName: v.fullName.trim(),
      gender: orNull(v.gender),
      dateOfBirth: orNull(v.dateOfBirth),
      mobile: orNull(v.mobile.trim()),
      email: orNull(v.email.trim()),
      addressLine: orNull(v.addressLine.trim()),
      city: orNull(v.city.trim()),
      designationId: v.designationId as number,
      branchId: v.branchId,
      joinDate: orNull(v.joinDate),
      basicSalary: v.basicSalary ?? 0,
      defaultAllowances: v.defaultAllowances ?? 0,
      defaultDeductions: v.defaultDeductions ?? 0,
      bankName: orNull(v.bankName.trim()),
      bankAccountNo: orNull(v.bankAccountNo.trim()),
      ifscCode: orNull(v.ifscCode.trim().toUpperCase()),
      aadhaarNo: orNull(v.aadhaarNo.trim()),
      panNo: orNull(v.panNo.trim().toUpperCase()),
      emergencyContact: orNull(v.emergencyContact.trim()),
    };
    const id = this.id();
    this.saving.set(true);
    const request$ = id
      ? this.svc.update(id, { ...body, exitDate: orNull(v.exitDate) })
      : this.svc.create({ ...body, employeeCode: orNull(v.employeeCode.trim()) });
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(id ? 'Employee updated.' : 'Employee created.');
        this.router.navigate(['/employees']);
      },
      error: () => this.saving.set(false),
    });
  }
}
