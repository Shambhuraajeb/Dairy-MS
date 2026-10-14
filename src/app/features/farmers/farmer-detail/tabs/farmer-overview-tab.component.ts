import { Component, OnInit, inject, input, signal } from '@angular/core';
import { PermissionService } from '../../../../core/services/permission.service';
import { errorMessage } from '../../../../core/utils/http-error';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { LoadingComponent } from '../../../../shared/components/loading/loading.component';
import { AppDatePipe } from '../../../../shared/pipes/app-pipes';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { FarmerDetail, FarmerSummary } from '../../farmer.model';
import { FarmerService } from '../../farmer.service';

@Component({
  selector: 'app-farmer-overview-tab',
  standalone: true,
  imports: [KpiCardComponent, LoadingComponent, AppDatePipe, StatusBadgeComponent],
  template: `
    @if (loading()) {
      <app-loading text="Loading summary..." />
    } @else if (error()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center">
        <span>{{ error() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="load()">Retry</button>
      </div>
    } @else if (summary(); as s) {
      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Animals" [value]="s.animalCount" icon="bi-clipboard2-pulse" color="primary" [subtitle]="s.milkingAnimalCount + ' milking'"
            [link]="perm.has('animal.view') ? '/animals' : null" [queryParams]="{ farmerId: farmer().id }" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Collections (month)" [value]="s.collectionsThisMonth" icon="bi-droplet-half" color="info"
            [subtitle]="s.pendingApprovalCount + ' pending approval'" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Milk this month" [value]="s.quantityThisMonth" suffix="L" icon="bi-moisture" color="success" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Amount this month" [value]="s.amountThisMonth" format="currency" icon="bi-currency-rupee" color="success" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Payable" [value]="s.payableAmount" format="currency" icon="bi-cash-stack" color="warning" subtitle="approved, unpaid" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Loan balance" [value]="s.loanBalance" format="currency" icon="bi-bank" color="danger"
            [link]="perm.has('loan.view') ? '/farmers/loans' : null" [queryParams]="{ farmerId: farmer().id }" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Advance balance" [value]="s.advanceBalance" format="currency" icon="bi-wallet2" color="danger"
            [link]="perm.has('loan.view') ? '/farmers/loans' : null" [queryParams]="{ farmerId: farmer().id, tab: 'advances' }" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card title="Last collection" [value]="s.lastCollectionDate ? (s.lastCollectionDate | appDate) : 'Never'" format="none" icon="bi-calendar-check" color="secondary" />
        </div>
      </div>
    }

    @let f = farmer();
    <div class="row g-3">
      <div class="col-lg-6">
        <div class="card h-100">
          <div class="card-header">Personal information</div>
          <div class="card-body">
            <dl class="row mb-0 small">
              <dt class="col-sm-5 text-muted">Father / husband</dt><dd class="col-sm-7">{{ f.fatherName || '—' }}</dd>
              <dt class="col-sm-5 text-muted">Mobile</dt><dd class="col-sm-7">{{ f.mobile }}</dd>
              <dt class="col-sm-5 text-muted">Alternate mobile</dt><dd class="col-sm-7">{{ f.alternateMobile || '—' }}</dd>
              <dt class="col-sm-5 text-muted">Email</dt><dd class="col-sm-7">{{ f.email || '—' }}</dd>
              <dt class="col-sm-5 text-muted">Gender</dt><dd class="col-sm-7">{{ f.gender || '—' }}</dd>
              <dt class="col-sm-5 text-muted">Date of birth</dt><dd class="col-sm-7">{{ f.dateOfBirth | appDate }}</dd>
              <dt class="col-sm-5 text-muted">Aadhaar</dt><dd class="col-sm-7">{{ f.aadhaarNo || '—' }}</dd>
              <dt class="col-sm-5 text-muted">PAN</dt><dd class="col-sm-7">{{ f.panNo || '—' }}</dd>
              <dt class="col-sm-5 text-muted">Notes</dt><dd class="col-sm-7 mb-0">{{ f.notes || '—' }}</dd>
            </dl>
          </div>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="card h-100">
          <div class="card-header">Collection &amp; workflow</div>
          <div class="card-body">
            <dl class="row mb-0 small">
              <dt class="col-sm-5 text-muted">Branch</dt><dd class="col-sm-7">{{ f.branchName || '—' }}</dd>
              <dt class="col-sm-5 text-muted">Collection center</dt><dd class="col-sm-7">{{ f.collectionCenterName || '—' }}</dd>
              <dt class="col-sm-5 text-muted">Milk type</dt><dd class="col-sm-7">{{ f.milkType }}</dd>
              <dt class="col-sm-5 text-muted">Join date</dt><dd class="col-sm-7">{{ f.joinDate | appDate }}</dd>
              <dt class="col-sm-5 text-muted">Verification</dt>
              <dd class="col-sm-7"><app-status-badge [status]="f.verificationStatus" />
                @if (f.verifiedDate) { <span class="text-muted ms-1">{{ f.verifiedDate | appDate }}</span> }</dd>
              @if (f.verificationRemarks) {
                <dt class="col-sm-5 text-muted">Verification remarks</dt><dd class="col-sm-7">{{ f.verificationRemarks }}</dd>
              }
              <dt class="col-sm-5 text-muted">Status</dt><dd class="col-sm-7"><app-status-badge [status]="f.status" /></dd>
              @if (f.statusReason) {
                <dt class="col-sm-5 text-muted">Status reason</dt><dd class="col-sm-7">{{ f.statusReason }}</dd>
              }
              <dt class="col-sm-5 text-muted">Activated</dt><dd class="col-sm-7">{{ f.activatedDate | appDate }}</dd>
              <dt class="col-sm-5 text-muted">Deactivated</dt><dd class="col-sm-7">{{ f.deactivatedDate | appDate }}</dd>
              <dt class="col-sm-5 text-muted">Registered</dt><dd class="col-sm-7 mb-0">{{ f.createdDate | appDate: 'datetime' }}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class FarmerOverviewTabComponent implements OnInit {
  private readonly svc = inject(FarmerService);
  protected readonly perm = inject(PermissionService);

  readonly farmer = input.required<FarmerDetail>();
  readonly summary = signal<FarmerSummary | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.summary(this.farmer().id).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
