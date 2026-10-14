import { Component, OnInit, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { toIsoDate } from '../../../shared/utils/format';
import { FarmerDetail, FarmerRequest, dateOnly, nullIfEmpty, numOrNull } from '../farmer.model';
import { FarmerService } from '../farmer.service';

const MOBILE_RE = /^\+?\d{10,13}$/;
const blank = (g: AbstractControl, key: string): boolean => String(g.get(key)?.value ?? '').trim() === '';

/** optional sub-form: once any field is filled, all `required` fields must be filled */
function completeIfStarted(fields: string[], required: string[]): ValidatorFn {
  return (g: AbstractControl): ValidationErrors | null => {
    const started = fields.some((k) => !blank(g, k));
    return started && required.some((k) => blank(g, k)) ? { incomplete: true } : null;
  };
}

@Component({
  selector: 'app-farmer-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, FormFieldComponent, LoadingComponent],
  template: `
    <app-page-header [title]="isEdit() ? 'Edit Farmer' : 'New Farmer'" subtitle="Personal details, collection center and milk type">
      <a [routerLink]="isEdit() ? ['/farmers', id()] : ['/farmers']" class="btn btn-light">Cancel</a>
    </app-page-header>

    @if (loading()) {
      <app-loading text="Loading farmer..." />
    } @else if (loadError()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center">
        <span>{{ loadError() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="loadFarmer()">Retry</button>
      </div>
    } @else {
      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="card mb-3">
          <div class="card-header">Personal information</div>
          <div class="card-body row g-0 column-gap-0">
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Farmer code" inputId="farmerCode" [control]="form.controls.farmerCode" hint="Leave blank to auto-generate">
                <input id="farmerCode" class="form-control" formControlName="farmerCode" maxlength="30" autocomplete="off" />
              </app-form-field>
            </div>
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Full name" inputId="fullName" [control]="form.controls.fullName">
                <input id="fullName" class="form-control" formControlName="fullName" maxlength="150" />
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Father / husband name" inputId="fatherName" [control]="form.controls.fatherName">
                <input id="fatherName" class="form-control" formControlName="fatherName" maxlength="150" />
              </app-form-field>
            </div>
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Mobile" inputId="mobile" [control]="form.controls.mobile" [messages]="{ pattern: 'Enter 10-13 digits (optional leading +).' }">
                <input id="mobile" class="form-control" formControlName="mobile" maxlength="14" inputmode="tel" />
              </app-form-field>
            </div>
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Alternate mobile" inputId="alternateMobile" [control]="form.controls.alternateMobile" [messages]="{ pattern: 'Enter 10-13 digits (optional leading +).' }">
                <input id="alternateMobile" class="form-control" formControlName="alternateMobile" maxlength="14" inputmode="tel" />
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Email" inputId="email" [control]="form.controls.email">
                <input id="email" type="email" class="form-control" formControlName="email" maxlength="150" />
              </app-form-field>
            </div>
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Gender" inputId="gender" [control]="form.controls.gender">
                <select id="gender" class="form-select" formControlName="gender">
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </app-form-field>
            </div>
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Date of birth" inputId="dateOfBirth" [control]="form.controls.dateOfBirth">
                <input id="dateOfBirth" type="date" class="form-control" formControlName="dateOfBirth" [max]="today" />
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Join date" inputId="joinDate" [control]="form.controls.joinDate">
                <input id="joinDate" type="date" class="form-control" formControlName="joinDate" />
              </app-form-field>
            </div>
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Aadhaar no." inputId="aadhaarNo" [control]="form.controls.aadhaarNo" [messages]="{ pattern: 'Aadhaar must be 12 digits.' }">
                <input id="aadhaarNo" class="form-control" formControlName="aadhaarNo" maxlength="12" inputmode="numeric" />
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="PAN" inputId="panNo" [control]="form.controls.panNo" [messages]="{ pattern: 'PAN format: ABCDE1234F.' }">
                <input id="panNo" class="form-control text-uppercase" formControlName="panNo" maxlength="10" />
              </app-form-field>
            </div>
          </div>
        </div>

        <div class="card mb-3">
          <div class="card-header">Collection &amp; milk</div>
          <div class="card-body row g-0">
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Branch" inputId="branchId" [control]="form.controls.branchId">
                <select id="branchId" class="form-select" formControlName="branchId">
                  <option value="">Select branch</option>
                  @for (b of branches(); track b.id) {
                    <option [value]="b.id">{{ b.name }}</option>
                  }
                </select>
              </app-form-field>
            </div>
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Collection center" inputId="collectionCenterId" [control]="form.controls.collectionCenterId" hint="Required to activate the farmer">
                <select id="collectionCenterId" class="form-select" formControlName="collectionCenterId">
                  <option value="">Select center</option>
                  @for (c of centers(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Milk type" inputId="milkType" [control]="form.controls.milkType">
                <select id="milkType" class="form-select" formControlName="milkType">
                  <option value="Cow">Cow</option>
                  <option value="Buffalo">Buffalo</option>
                  <option value="Mixed">Mixed</option>
                </select>
              </app-form-field>
            </div>
            <div class="col-12">
              <app-form-field label="Notes" inputId="notes" [control]="form.controls.notes">
                <textarea id="notes" class="form-control" rows="2" formControlName="notes" maxlength="500"></textarea>
              </app-form-field>
            </div>
          </div>
        </div>

        @if (!isEdit()) {
          <div class="card mb-3" formGroupName="address">
            <div class="card-header">Address <span class="text-muted fw-normal small">(optional, more can be added later)</span></div>
            <div class="card-body row g-0">
              @if (form.controls.address.errors?.['incomplete'] && submitted()) {
                <div class="col-12"><div class="alert alert-warning py-2">Address line 1 is required when any address field is filled.</div></div>
              }
              <div class="col-md-3 pe-md-3">
                <app-form-field label="Type" inputId="addrType" [control]="form.controls.address.controls.addressType">
                  <select id="addrType" class="form-select" formControlName="addressType">
                    <option value="Home">Home</option>
                    <option value="Farm">Farm</option>
                    <option value="Billing">Billing</option>
                  </select>
                </app-form-field>
              </div>
              <div class="col-md-5 pe-md-3">
                <app-form-field label="Line 1" inputId="addrLine1" [control]="form.controls.address.controls.line1" [required]="false">
                  <input id="addrLine1" class="form-control" formControlName="line1" maxlength="200" />
                </app-form-field>
              </div>
              <div class="col-md-4">
                <app-form-field label="Line 2" inputId="addrLine2" [control]="form.controls.address.controls.line2">
                  <input id="addrLine2" class="form-control" formControlName="line2" maxlength="200" />
                </app-form-field>
              </div>
              <div class="col-md-3 pe-md-3">
                <app-form-field label="Village" inputId="addrVillage" [control]="form.controls.address.controls.village">
                  <input id="addrVillage" class="form-control" formControlName="village" maxlength="100" />
                </app-form-field>
              </div>
              <div class="col-md-3 pe-md-3">
                <app-form-field label="Taluka" inputId="addrTaluka" [control]="form.controls.address.controls.taluka">
                  <input id="addrTaluka" class="form-control" formControlName="taluka" maxlength="100" />
                </app-form-field>
              </div>
              <div class="col-md-3 pe-md-3">
                <app-form-field label="District" inputId="addrDistrict" [control]="form.controls.address.controls.district">
                  <input id="addrDistrict" class="form-control" formControlName="district" maxlength="100" />
                </app-form-field>
              </div>
              <div class="col-md-3">
                <app-form-field label="City" inputId="addrCity" [control]="form.controls.address.controls.city">
                  <input id="addrCity" class="form-control" formControlName="city" maxlength="100" />
                </app-form-field>
              </div>
              <div class="col-md-4 pe-md-3">
                <app-form-field label="State" inputId="addrState" [control]="form.controls.address.controls.state">
                  <input id="addrState" class="form-control" formControlName="state" maxlength="100" />
                </app-form-field>
              </div>
              <div class="col-md-4">
                <app-form-field label="Pincode" inputId="addrPincode" [control]="form.controls.address.controls.pincode" [messages]="{ pattern: 'Pincode must be 6 digits.' }">
                  <input id="addrPincode" class="form-control" formControlName="pincode" maxlength="6" inputmode="numeric" />
                </app-form-field>
              </div>
            </div>
          </div>

          <div class="card mb-3" formGroupName="bankAccount">
            <div class="card-header">Bank account <span class="text-muted fw-normal small">(needed before activation; can be added later)</span></div>
            <div class="card-body row g-0">
              @if (form.controls.bankAccount.errors?.['incomplete'] && submitted()) {
                <div class="col-12">
                  <div class="alert alert-warning py-2">Account holder, bank, account number and IFSC are all required when adding a bank account.</div>
                </div>
              }
              <div class="col-md-4 pe-md-3">
                <app-form-field label="Account holder" inputId="bankHolder" [control]="form.controls.bankAccount.controls.accountHolderName" [required]="false">
                  <input id="bankHolder" class="form-control" formControlName="accountHolderName" maxlength="150" />
                </app-form-field>
              </div>
              <div class="col-md-4 pe-md-3">
                <app-form-field label="Bank name" inputId="bankName" [control]="form.controls.bankAccount.controls.bankName" [required]="false">
                  <input id="bankName" class="form-control" formControlName="bankName" maxlength="150" />
                </app-form-field>
              </div>
              <div class="col-md-4">
                <app-form-field label="Branch" inputId="bankBranch" [control]="form.controls.bankAccount.controls.branchName">
                  <input id="bankBranch" class="form-control" formControlName="branchName" maxlength="150" />
                </app-form-field>
              </div>
              <div class="col-md-4 pe-md-3">
                <app-form-field label="Account number" inputId="bankAcc" [control]="form.controls.bankAccount.controls.accountNumber" [required]="false">
                  <input id="bankAcc" class="form-control" formControlName="accountNumber" maxlength="30" inputmode="numeric" />
                </app-form-field>
              </div>
              <div class="col-md-4 pe-md-3">
                <app-form-field label="IFSC" inputId="bankIfsc" [control]="form.controls.bankAccount.controls.ifscCode" [required]="false" [messages]="{ pattern: 'IFSC format: ABCD0123456.' }">
                  <input id="bankIfsc" class="form-control text-uppercase" formControlName="ifscCode" maxlength="11" />
                </app-form-field>
              </div>
              <div class="col-md-4">
                <app-form-field label="UPI id" inputId="bankUpi" [control]="form.controls.bankAccount.controls.upiId">
                  <input id="bankUpi" class="form-control" formControlName="upiId" maxlength="100" />
                </app-form-field>
              </div>
            </div>
          </div>
        }

        <div class="d-flex justify-content-end gap-2 mb-4">
          <a [routerLink]="isEdit() ? ['/farmers', id()] : ['/farmers']" class="btn btn-light">Cancel</a>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm me-1"></span>
            }
            {{ isEdit() ? 'Save changes' : 'Register farmer' }}
          </button>
        </div>
      </form>
    }
  `,
})
export class FarmerFormComponent implements OnInit {
  private readonly svc = inject(FarmerService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  /** route param (present on /farmers/:id/edit) */
  readonly id = input<string>();

  readonly today = toIsoDate();
  readonly isEdit = signal(false);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly submitted = signal(false);

  readonly branches = toSignal(this.lookups.get('branches'), { initialValue: [] as LookupItem[] });
  readonly centers = signal<LookupItem[]>([]);

  readonly form = this.fb.group({
    farmerCode: ['', Validators.maxLength(30)],
    fullName: ['', [Validators.required, Validators.maxLength(150)]],
    fatherName: [''],
    mobile: ['', [Validators.required, Validators.pattern(MOBILE_RE)]],
    alternateMobile: ['', Validators.pattern(MOBILE_RE)],
    email: ['', Validators.email],
    gender: [''],
    dateOfBirth: [''],
    aadhaarNo: ['', Validators.pattern(/^\d{12}$/)],
    panNo: ['', Validators.pattern(/^[A-Za-z]{5}\d{4}[A-Za-z]$/)],
    branchId: [''],
    collectionCenterId: [''],
    milkType: ['Cow', Validators.required],
    joinDate: [toIsoDate()],
    notes: [''],
    address: this.fb.group(
      {
        addressType: ['Home'],
        line1: [''],
        line2: [''],
        village: [''],
        taluka: [''],
        district: [''],
        city: [''],
        state: [''],
        pincode: ['', Validators.pattern(/^\d{6}$/)],
      },
      { validators: [completeIfStarted(['line1', 'line2', 'village', 'taluka', 'district', 'city', 'state', 'pincode'], ['line1'])] },
    ),
    bankAccount: this.fb.group(
      {
        accountHolderName: [''],
        bankName: [''],
        branchName: [''],
        accountNumber: [''],
        ifscCode: ['', Validators.pattern(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/)],
        upiId: [''],
      },
      {
        validators: [
          completeIfStarted(
            ['accountHolderName', 'bankName', 'branchName', 'accountNumber', 'ifscCode', 'upiId'],
            ['accountHolderName', 'bankName', 'accountNumber', 'ifscCode'],
          ),
        ],
      },
    ),
  });

  constructor() {
    this.form.controls.branchId.valueChanges.subscribe((b) => {
      this.form.controls.collectionCenterId.setValue('');
      this.loadCenters(b);
    });
    this.loadCenters('');
  }

  ngOnInit(): void {
    if (this.id()) {
      this.isEdit.set(true);
      this.form.controls.farmerCode.disable();
      this.form.controls.address.disable();
      this.form.controls.bankAccount.disable();
      this.loadFarmer();
    }
  }

  loadFarmer(): void {
    const id = this.id();
    if (!id) {
      return;
    }
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.get(id).subscribe({
      next: (f) => {
        this.patch(f);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  private patch(f: FarmerDetail): void {
    this.form.patchValue(
      {
        farmerCode: f.farmerCode,
        fullName: f.fullName,
        fatherName: f.fatherName ?? '',
        mobile: f.mobile,
        alternateMobile: f.alternateMobile ?? '',
        email: f.email ?? '',
        gender: f.gender ?? '',
        dateOfBirth: dateOnly(f.dateOfBirth),
        aadhaarNo: f.aadhaarNo ?? '',
        panNo: f.panNo ?? '',
        branchId: f.branchId ? String(f.branchId) : '',
        collectionCenterId: f.collectionCenterId ? String(f.collectionCenterId) : '',
        milkType: f.milkType || 'Cow',
        joinDate: dateOnly(f.joinDate),
        notes: f.notes ?? '',
      },
      { emitEvent: false },
    );
    this.loadCenters(f.branchId ? String(f.branchId) : '');
  }

  private loadCenters(branchId: string): void {
    this.lookups
      .get('collection-centers', branchId ? { parentId: Number(branchId) } : undefined)
      .subscribe((list) => this.centers.set(list));
  }

  save(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please correct the highlighted fields.');
      return;
    }
    const v = this.form.getRawValue();
    const body: FarmerRequest = {
      fullName: v.fullName.trim(),
      fatherName: nullIfEmpty(v.fatherName),
      mobile: v.mobile.trim(),
      alternateMobile: nullIfEmpty(v.alternateMobile),
      email: nullIfEmpty(v.email),
      gender: nullIfEmpty(v.gender),
      dateOfBirth: nullIfEmpty(v.dateOfBirth),
      aadhaarNo: nullIfEmpty(v.aadhaarNo),
      panNo: nullIfEmpty(v.panNo)?.toUpperCase() ?? null,
      collectionCenterId: numOrNull(v.collectionCenterId),
      branchId: numOrNull(v.branchId),
      milkType: v.milkType,
      joinDate: nullIfEmpty(v.joinDate),
      notes: nullIfEmpty(v.notes),
    };
    const editing = this.isEdit();
    if (!editing) {
      body.farmerCode = nullIfEmpty(v.farmerCode);
      const a = v.address;
      if (a.line1.trim()) {
        body.address = {
          addressType: a.addressType,
          line1: a.line1.trim(),
          line2: nullIfEmpty(a.line2),
          village: nullIfEmpty(a.village),
          taluka: nullIfEmpty(a.taluka),
          district: nullIfEmpty(a.district),
          city: nullIfEmpty(a.city),
          state: nullIfEmpty(a.state),
          pincode: nullIfEmpty(a.pincode),
          isDefault: true,
        };
      }
      const b = v.bankAccount;
      if (b.accountNumber.trim()) {
        body.bankAccount = {
          accountHolderName: b.accountHolderName.trim(),
          bankName: b.bankName.trim(),
          branchName: nullIfEmpty(b.branchName),
          accountNumber: b.accountNumber.trim(),
          ifscCode: b.ifscCode.trim().toUpperCase(),
          upiId: nullIfEmpty(b.upiId),
          isPrimary: true,
        };
      }
    }
    this.saving.set(true);
    const request$ = editing ? this.svc.update(this.id()!, body) : this.svc.create(body);
    request$.subscribe({
      next: (f) => {
        this.saving.set(false);
        this.toast.success(editing ? 'Farmer updated.' : `Farmer ${f.farmerCode} registered.`);
        void this.router.navigate(['/farmers', f.id]);
      },
      error: () => this.saving.set(false),
    });
  }
}
