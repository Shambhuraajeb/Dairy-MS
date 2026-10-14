import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { FarmerDetail, nullIfEmpty } from '../farmer.model';
import { FarmerService } from '../farmer.service';
import { FarmerAddressesTabComponent } from './tabs/farmer-addresses-tab.component';
import { FarmerBankTabComponent } from './tabs/farmer-bank-tab.component';
import { FarmerDocumentsTabComponent } from './tabs/farmer-documents-tab.component';
import { FarmerOverviewTabComponent } from './tabs/farmer-overview-tab.component';
import { FarmerRelatedTabComponent } from './tabs/farmer-related-tab.component';

type TabKey = 'overview' | 'addresses' | 'bank' | 'documents' | 'animals' | 'collections' | 'payments' | 'loans';

interface TabDef {
  key: TabKey;
  label: string;
  icon: string;
  permission?: string;
}

const TABS: TabDef[] = [
  { key: 'overview', label: 'Overview', icon: 'bi-speedometer2' },
  { key: 'addresses', label: 'Addresses', icon: 'bi-geo-alt' },
  { key: 'bank', label: 'Bank accounts', icon: 'bi-bank' },
  { key: 'documents', label: 'Documents', icon: 'bi-file-earmark-text' },
  { key: 'animals', label: 'Animals', icon: 'bi-clipboard2-pulse', permission: 'animal.view' },
  { key: 'collections', label: 'Collections', icon: 'bi-droplet-half', permission: 'collection.view' },
  { key: 'payments', label: 'Payments', icon: 'bi-cash-stack', permission: 'payment.view' },
  { key: 'loans', label: 'Loans & Advances', icon: 'bi-wallet2', permission: 'loan.view' },
];

@Component({
  selector: 'app-farmer-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    ModalComponent,
    FormFieldComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    FarmerOverviewTabComponent,
    FarmerAddressesTabComponent,
    FarmerBankTabComponent,
    FarmerDocumentsTabComponent,
    FarmerRelatedTabComponent,
  ],
  template: `
    @if (loading()) {
      <app-loading text="Loading farmer..." />
    } @else if (error()) {
      <div class="card">
        <app-empty-state icon="bi-exclamation-octagon" title="Could not load farmer" [message]="error()!">
          <button type="button" class="btn btn-outline-primary btn-sm me-2" (click)="load()">Retry</button>
          <a routerLink="/farmers" class="btn btn-light btn-sm">Back to farmers</a>
        </app-empty-state>
      </div>
    } @else if (farmer(); as f) {
      <app-page-header [title]="f.fullName" [subtitle]="f.farmerCode + ' · ' + (f.collectionCenterName || 'No collection center') + ' · ' + f.milkType + ' milk'">
        <a routerLink="/farmers" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>Back</a>
        <ng-container *appHasPermission="'farmer.update'">
          <a [routerLink]="['/farmers', f.id, 'edit']" class="btn btn-outline-secondary"><i class="bi bi-pencil me-1"></i>Edit</a>
          @if (f.verificationStatus !== 'Verified') {
            <button type="button" class="btn btn-outline-primary" (click)="openVerify()"><i class="bi bi-patch-check me-1"></i>Verify</button>
          }
          @if (canActivate()) {
            <button type="button" class="btn btn-success" [disabled]="busy()" (click)="activate()"><i class="bi bi-check-circle me-1"></i>Activate</button>
          }
          @if (f.status === 'Active') {
            <button type="button" class="btn btn-outline-danger" (click)="openDeactivate()"><i class="bi bi-slash-circle me-1"></i>Deactivate</button>
          }
        </ng-container>
      </app-page-header>

      <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
        <span class="text-muted small">Status</span><app-status-badge [status]="f.status" />
        <span class="text-muted small ms-2">Verification</span><app-status-badge [status]="f.verificationStatus" />
        <span class="text-muted small ms-2"><i class="bi bi-telephone me-1"></i>{{ f.mobile }}</span>
      </div>

      @if (f.status !== 'Active' && f.status !== 'Inactive') {
        <div class="alert alert-info py-2 small">
          Activation checklist:
          <span [class.text-success]="f.verificationStatus === 'Verified'">
            <i class="bi" [class.bi-check-circle-fill]="f.verificationStatus === 'Verified'" [class.bi-circle]="f.verificationStatus !== 'Verified'"></i> verified
          </span> &middot;
          <span [class.text-success]="!!f.collectionCenterId">
            <i class="bi" [class.bi-check-circle-fill]="!!f.collectionCenterId" [class.bi-circle]="!f.collectionCenterId"></i> collection center
          </span> &middot;
          <span [class.text-success]="f.bankAccounts.length > 0">
            <i class="bi" [class.bi-check-circle-fill]="f.bankAccounts.length > 0" [class.bi-circle]="f.bankAccounts.length === 0"></i> bank account
          </span>
        </div>
      }

      <ul class="nav nav-tabs mb-3 flex-nowrap overflow-auto">
        @for (t of tabs(); track t.key) {
          <li class="nav-item">
            <button type="button" class="nav-link text-nowrap" [class.active]="tab() === t.key" (click)="tab.set(t.key)">
              <i class="bi {{ t.icon }} me-1"></i>{{ t.label }}
            </button>
          </li>
        }
      </ul>

      @switch (tab()) {
        @case ('overview') {
          <app-farmer-overview-tab [farmer]="f" />
        }
        @case ('addresses') {
          <app-farmer-addresses-tab [farmer]="f" (changed)="reload()" />
        }
        @case ('bank') {
          <app-farmer-bank-tab [farmer]="f" (changed)="reload()" />
        }
        @case ('documents') {
          <app-farmer-documents-tab [farmer]="f" (changed)="reload()" />
        }
        @case ('animals') {
          <app-farmer-related-tab [farmerId]="f.id" kind="animals" />
        }
        @case ('collections') {
          <app-farmer-related-tab [farmerId]="f.id" kind="collections" />
        }
        @case ('payments') {
          <app-farmer-related-tab [farmerId]="f.id" kind="payments" />
        }
        @case ('loans') {
          <div class="d-flex justify-content-end mb-2">
            <a routerLink="/farmers/loans" [queryParams]="{ farmerId: f.id }" class="btn btn-sm btn-outline-primary">
              <i class="bi bi-wallet2 me-1"></i>Manage advances &amp; loans
            </a>
          </div>
          <app-farmer-related-tab [farmerId]="f.id" kind="loans" />
        }
      }

      <app-modal [open]="verifyOpen()" title="Verify farmer" (closed)="closeVerify()">
        <form id="verifyForm" [formGroup]="verifyForm" (ngSubmit)="submitVerify()" novalidate>
          <div class="mb-3">
            <div class="form-check">
              <input id="vApprove" type="radio" class="form-check-input" formControlName="approved" value="true" />
              <label class="form-check-label" for="vApprove">Approve - KYC details are correct</label>
            </div>
            <div class="form-check">
              <input id="vReject" type="radio" class="form-check-input" formControlName="approved" value="false" />
              <label class="form-check-label" for="vReject">Reject</label>
            </div>
          </div>
          <app-form-field label="Remarks" inputId="vRemarks" [control]="verifyForm.controls.remarks" [required]="verifyForm.controls.approved.value === 'false'">
            <textarea id="vRemarks" class="form-control" rows="3" formControlName="remarks" maxlength="300"></textarea>
          </app-form-field>
        </form>
        <div modal-footer>
          <button type="button" class="btn btn-light" (click)="closeVerify()">Cancel</button>
          <button type="submit" form="verifyForm" class="btn btn-primary" [disabled]="busy()">Submit</button>
        </div>
      </app-modal>

      <app-modal [open]="deactivateOpen()" title="Deactivate farmer" (closed)="closeDeactivate()">
        <form id="deactivateForm" [formGroup]="deactivateForm" (ngSubmit)="submitDeactivate()" novalidate>
          <p class="text-muted">Deactivated farmers cannot be used for new collections or animals.</p>
          <app-form-field label="Reason" inputId="dReason" [control]="deactivateForm.controls.reason">
            <textarea id="dReason" class="form-control" rows="3" formControlName="reason" maxlength="300"></textarea>
          </app-form-field>
        </form>
        <div modal-footer>
          <button type="button" class="btn btn-light" (click)="closeDeactivate()">Cancel</button>
          <button type="submit" form="deactivateForm" class="btn btn-danger" [disabled]="busy()">Deactivate</button>
        </div>
      </app-modal>
    }
  `,
})
export class FarmerDetailComponent implements OnInit {
  private readonly svc = inject(FarmerService);
  private readonly perm = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly id = input.required<string>();

  readonly farmer = signal<FarmerDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly tab = signal<TabKey>('overview');
  readonly tabs = computed(() => TABS.filter((t) => this.perm.check(t.permission)));

  readonly verifyOpen = signal(false);
  readonly deactivateOpen = signal(false);
  readonly verifyForm = this.fb.group({ approved: ['true'], remarks: [''] });
  readonly deactivateForm = this.fb.group({ reason: ['', [Validators.required, Validators.maxLength(300)]] });

  readonly canActivate = computed(() => {
    const f = this.farmer();
    return !!f && f.verificationStatus === 'Verified' && f.status !== 'Active';
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.get(this.id()).subscribe({
      next: (f) => {
        this.farmer.set(f);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  /** silent refresh (keeps the current tab and page) */
  reload(): void {
    this.svc.get(this.id()).subscribe((f) => this.farmer.set(f));
  }

  private apply(f: FarmerDetail, message: string): void {
    this.farmer.set(f);
    this.busy.set(false);
    this.toast.success(message);
  }

  openVerify(): void {
    this.verifyForm.reset({ approved: 'true', remarks: '' });
    this.verifyOpen.set(true);
  }

  closeVerify(): void {
    if (!this.busy()) {
      this.verifyOpen.set(false);
    }
  }

  submitVerify(): void {
    const v = this.verifyForm.getRawValue();
    const approved = v.approved === 'true';
    if (!approved && !v.remarks.trim()) {
      this.verifyForm.controls.remarks.setErrors({ required: true });
      this.verifyForm.controls.remarks.markAsTouched();
      return;
    }
    this.busy.set(true);
    this.svc.verify(this.farmer()!.id, approved, nullIfEmpty(v.remarks)).subscribe({
      next: (f) => {
        this.verifyOpen.set(false);
        this.apply(f, approved ? 'Farmer verified.' : 'Farmer verification rejected.');
      },
      error: () => this.busy.set(false),
    });
  }

  async activate(): Promise<void> {
    const f = this.farmer()!;
    const ok = await this.confirmService.confirm({
      title: 'Activate farmer',
      message: `Activate ${f.fullName}? Active farmers can deliver milk and own animals.`,
      confirmText: 'Activate',
      variant: 'primary',
    });
    if (!ok) {
      return;
    }
    this.busy.set(true);
    this.svc.activate(f.id).subscribe({
      next: (updated) => this.apply(updated, 'Farmer activated.'),
      error: () => this.busy.set(false),
    });
  }

  openDeactivate(): void {
    this.deactivateForm.reset();
    this.deactivateOpen.set(true);
  }

  closeDeactivate(): void {
    if (!this.busy()) {
      this.deactivateOpen.set(false);
    }
  }

  submitDeactivate(): void {
    if (this.deactivateForm.invalid) {
      this.deactivateForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.svc.deactivate(this.farmer()!.id, this.deactivateForm.getRawValue().reason.trim()).subscribe({
      next: (f) => {
        this.deactivateOpen.set(false);
        this.apply(f, 'Farmer deactivated.');
      },
      error: () => this.busy.set(false),
    });
  }
}
