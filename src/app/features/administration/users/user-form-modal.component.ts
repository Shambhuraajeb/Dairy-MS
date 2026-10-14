import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { orNull } from '../../../shared/utils/paged-list';
import { strongPasswordValidator } from '../../../shared/validators/app-validators';
import { UserAdmin, UserUpdateRequest } from '../administration.model';
import { AdministrationService } from '../administration.service';

type RoleKind = 'farmer' | 'customer' | 'other';

/** Create / edit user modal. `user` = null -> create. */
@Component({
  selector: 'app-user-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent],
  template: `
    <app-modal [open]="open()" [title]="user() ? 'Edit User' : 'New User'" size="lg" (closed)="close()">
      <form id="userForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row">
          @if (!user()) {
            <div class="col-md-6">
              <app-form-field
                label="Username"
                inputId="usrUsername"
                [control]="form.controls.username"
                hint="Letters, digits and . _ - @"
                [messages]="{ pattern: 'Only letters, digits and . _ - @ are allowed.' }"
              >
                <input id="usrUsername" class="form-control" formControlName="username" maxlength="100" autocomplete="off" />
              </app-form-field>
            </div>
            <div class="col-md-6">
              <app-form-field label="Password" inputId="usrPassword" [control]="form.controls.password">
                <input id="usrPassword" type="password" class="form-control" formControlName="password" autocomplete="new-password" />
              </app-form-field>
            </div>
          }
          <div class="col-md-6">
            <app-form-field label="Display name" inputId="usrDisplay" [control]="form.controls.displayName">
              <input id="usrDisplay" class="form-control" formControlName="displayName" maxlength="150" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Role" inputId="usrRole" [control]="form.controls.roleId">
              <select id="usrRole" class="form-select" formControlName="roleId">
                <option [ngValue]="null">Select role</option>
                @for (r of roles(); track r.id) {
                  <option [ngValue]="r.id">{{ r.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Email" inputId="usrEmail" [control]="form.controls.email">
              <input id="usrEmail" type="email" class="form-control" formControlName="email" maxlength="150" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Mobile" inputId="usrMobile" [control]="form.controls.mobile" [messages]="{ pattern: 'Enter 10-13 digits.' }">
              <input id="usrMobile" class="form-control" formControlName="mobile" maxlength="13" inputmode="tel" />
            </app-form-field>
          </div>

          @if (roleKind() === 'farmer') {
            <div class="col-md-6">
              <app-form-field label="Linked farmer" inputId="usrFarmer" [control]="form.controls.farmerId" hint="Farmer users only see their own data">
                <select id="usrFarmer" class="form-select" formControlName="farmerId">
                  <option [ngValue]="null">Select farmer</option>
                  @for (f of farmers(); track f.id) {
                    <option [ngValue]="f.id">{{ f.code }} - {{ f.name }}</option>
                  }
                </select>
              </app-form-field>
            </div>
          }
          @if (roleKind() === 'customer') {
            <div class="col-md-6">
              <app-form-field label="Linked customer" inputId="usrCustomer" [control]="form.controls.customerId" hint="Customer users only see their own data">
                <select id="usrCustomer" class="form-select" formControlName="customerId">
                  <option [ngValue]="null">Select customer</option>
                  @for (c of customers(); track c.id) {
                    <option [ngValue]="c.id">{{ c.code }} - {{ c.name }}</option>
                  }
                </select>
              </app-form-field>
            </div>
          }
          <div class="col-md-6">
            <app-form-field label="Linked employee" inputId="usrEmployee" [control]="form.controls.employeeId" hint="Optional. Needed for attendance, leave and delivery assignment">
              <select id="usrEmployee" class="form-select" formControlName="employeeId">
                <option [ngValue]="null">None</option>
                @for (e of employees(); track e.id) {
                  <option [ngValue]="e.id">{{ e.code }} - {{ e.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Branch" inputId="usrBranch" [control]="form.controls.branchId">
              <select id="usrBranch" class="form-select" formControlName="branchId">
                <option [ngValue]="null">None</option>
                @for (b of branches(); track b.id) {
                  <option [ngValue]="b.id">{{ b.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Collection center" inputId="usrCenter" [control]="form.controls.collectionCenterId">
              <select id="usrCenter" class="form-select" formControlName="collectionCenterId">
                <option [ngValue]="null">None</option>
                @for (c of centers(); track c.id) {
                  <option [ngValue]="c.id">{{ c.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
        </div>

        @if (!user()) {
          <div class="form-check form-switch mb-2">
            <input id="usrMustChange" type="checkbox" class="form-check-input" formControlName="mustChangePassword" />
            <label class="form-check-label" for="usrMustChange">Require password change at first sign-in</label>
          </div>
        } @else {
          <div class="form-check form-switch">
            <input id="usrActive" type="checkbox" class="form-check-input" formControlName="isActive" />
            <label class="form-check-label" for="usrActive">Active</label>
          </div>
        }
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="userForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class UserFormModalComponent {
  private readonly svc = inject(AdministrationService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = input(false);
  readonly user = input<UserAdmin | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly roles = toSignal(this.lookups.get('roles'), { initialValue: [] as LookupItem[] });
  readonly farmers = toSignal(this.lookups.get('farmers'), { initialValue: [] as LookupItem[] });
  readonly customers = toSignal(this.lookups.get('customers'), { initialValue: [] as LookupItem[] });
  readonly employees = toSignal(this.lookups.get('employees'), { initialValue: [] as LookupItem[] });
  readonly branches = toSignal(this.lookups.get('branches'), { initialValue: [] as LookupItem[] });
  readonly centers = signal<LookupItem[]>([]);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100), Validators.pattern(/^[A-Za-z0-9._@-]+$/)]],
    password: ['', [Validators.required, strongPasswordValidator()]],
    displayName: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    mobile: ['', Validators.pattern(/^\d{10,13}$/)],
    roleId: [null as number | null, Validators.required],
    farmerId: [null as number | null],
    customerId: [null as number | null],
    employeeId: [null as number | null],
    branchId: [null as number | null],
    collectionCenterId: [null as number | null],
    mustChangePassword: [true],
    isActive: [true],
  });

  private readonly roleId = toSignal(this.form.controls.roleId.valueChanges, { initialValue: null as number | null });
  readonly roleKind = computed<RoleKind>(() => {
    const name = (this.roles().find((r) => r.id === this.roleId())?.name ?? '').toLowerCase();
    if (name === 'farmer') {
      return 'farmer';
    }
    return name === 'customer' || name.startsWith('distributor') ? 'customer' : 'other';
  });
  private patching = false;

  constructor() {
    effect(() => {
      if (this.open()) {
        const u = this.user();
        untracked(() => this.init(u));
      }
    });
    effect(() => {
      const kind = this.roleKind();
      untracked(() => {
        this.setRequired('farmerId', kind === 'farmer');
        this.setRequired('customerId', kind === 'customer');
      });
    });
    this.form.controls.branchId.valueChanges.pipe(takeUntilDestroyed()).subscribe((b) => {
      if (this.patching) {
        return;
      }
      this.form.controls.collectionCenterId.setValue(null);
      this.loadCenters(b);
    });
  }

  private setRequired(key: 'farmerId' | 'customerId', required: boolean): void {
    const c = this.form.controls[key];
    c.setValidators(required ? Validators.required : null);
    c.updateValueAndValidity({ emitEvent: false });
  }

  private loadCenters(branchId: number | null): void {
    this.lookups.get('collection-centers', branchId ? { parentId: branchId } : undefined).subscribe((list) => this.centers.set(list));
  }

  private init(u: UserAdmin | null): void {
    this.patching = true;
    this.form.reset({
      username: u?.username ?? '',
      password: '',
      displayName: u?.displayName ?? '',
      email: u?.email ?? '',
      mobile: u?.mobile ?? '',
      roleId: u?.roleId ?? null,
      farmerId: u?.farmerId ?? null,
      customerId: u?.customerId ?? null,
      employeeId: u?.employeeId ?? null,
      branchId: u?.branchId ?? null,
      collectionCenterId: u?.collectionCenterId ?? null,
      mustChangePassword: true,
      isActive: u?.isActive ?? true,
    });
    this.patching = false;
    if (u) {
      this.form.controls.username.disable();
      this.form.controls.password.disable();
    } else {
      this.form.controls.username.enable();
      this.form.controls.password.enable();
    }
    this.loadCenters(u?.branchId ?? null);
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
    const kind = this.roleKind();
    const base: UserUpdateRequest = {
      displayName: v.displayName.trim(),
      email: orNull(v.email.trim()),
      mobile: orNull(v.mobile.trim()),
      roleId: v.roleId as number,
      farmerId: kind === 'farmer' ? v.farmerId : null,
      customerId: kind === 'customer' ? v.customerId : null,
      employeeId: v.employeeId,
      branchId: v.branchId,
      collectionCenterId: v.collectionCenterId,
      isActive: v.isActive,
    };
    const current = this.user();
    this.saving.set(true);
    const request$ = current
      ? this.svc.updateUser(current.id, base)
      : this.svc.createUser({ ...base, username: v.username.trim(), password: v.password, mustChangePassword: v.mustChangePassword });
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(current ? 'User updated.' : 'User created.');
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
