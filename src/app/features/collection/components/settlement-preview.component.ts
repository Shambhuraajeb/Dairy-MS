import { Component, input } from '@angular/core';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { AppCurrencyPipe, AppDatePipe, AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { SettlementPreview } from '../models/settlement.model';

/** Read-only view of GET farmer-settlements/preview: totals, payable collections, advances and loan installments. */
@Component({
  selector: 'app-settlement-preview',
  standalone: true,
  imports: [KpiCardComponent, StatusBadgeComponent, AppCurrencyPipe, AppDatePipe, AppNumberPipe],
  template: `
    @let s = preview().summary;
    <div class="d-flex flex-wrap align-items-baseline gap-2 mb-2">
      <h5 class="mb-0">{{ s.farmerCode }} - {{ s.farmerName }}</h5>
      <span class="text-muted">{{ s.periodFrom | appDate }} - {{ s.periodTo | appDate }}</span>
    </div>
    <div class="row g-3 mb-3">
      <div class="col-6 col-lg-3"><app-kpi-card title="Collections" [value]="s.totalCollections" icon="bi-droplet" color="info" [subtitle]="(s.totalQuantity | appNumber: 3) + ' L'" /></div>
      <div class="col-6 col-lg-3"><app-kpi-card title="Gross amount" [value]="s.grossAmount" icon="bi-cash" color="primary" format="currency" /></div>
      <div class="col-6 col-lg-3"><app-kpi-card title="Bonus" [value]="s.bonusAmount" icon="bi-plus-circle" color="success" format="currency" /></div>
      <div class="col-6 col-lg-3"><app-kpi-card title="Penalty" [value]="s.penaltyAmount" icon="bi-dash-circle" color="danger" format="currency" /></div>
      <div class="col-6 col-lg-3"><app-kpi-card title="Net before deduction" [value]="s.netBeforeDeduction" icon="bi-calculator" color="secondary" format="currency" /></div>
      <div class="col-6 col-lg-3">
        <app-kpi-card title="Advance balance" [value]="s.pendingAdvanceBalance" icon="bi-wallet2" color="warning" format="currency"
          [subtitle]="'suggested ' + (s.suggestedAdvanceDeduction | appNumber)" />
      </div>
      <div class="col-6 col-lg-3">
        <app-kpi-card title="Loan installments due" [value]="s.loanInstallmentsDue" icon="bi-bank" color="warning" format="currency"
          [subtitle]="'suggested ' + (s.suggestedLoanDeduction | appNumber)" />
      </div>
      <div class="col-6 col-lg-3"><app-kpi-card title="Net payable (suggested)" [value]="s.netPayable" icon="bi-check-circle" color="success" format="currency" /></div>
    </div>

    <h6 class="section-title">Payable collections ({{ preview().collections.length }})</h6>
    <div class="card mb-3">
      <div class="table-responsive" style="max-height: 320px">
        <table class="table table-sm table-hover align-middle mb-0 app-table">
          <thead>
            <tr>
              <th>Collection</th><th>Date</th><th>Shift</th><th>Center</th><th>Milk</th>
              <th class="text-end">Qty (L)</th><th class="text-end">FAT</th><th class="text-end">SNF</th>
              <th class="text-end">Rate</th><th class="text-end">Bonus</th><th class="text-end">Penalty</th><th class="text-end">Amount</th>
            </tr>
          </thead>
          <tbody>
            @for (c of preview().collections; track c.id) {
              <tr>
                <td>{{ c.collectionNumber }}</td>
                <td>{{ c.collectionDate | appDate }}</td>
                <td>{{ c.shiftName }}</td>
                <td>{{ c.collectionCenterName }}</td>
                <td>{{ c.milkType }}</td>
                <td class="text-end">{{ c.quantityLiters | appNumber: 3 }}</td>
                <td class="text-end">{{ c.fat | appNumber }}</td>
                <td class="text-end">{{ c.snf | appNumber }}</td>
                <td class="text-end">{{ c.finalRate | appCurrency }}</td>
                <td class="text-end">{{ c.bonusAmount | appCurrency }}</td>
                <td class="text-end">{{ c.penaltyAmount | appCurrency }}</td>
                <td class="text-end">{{ c.amount | appCurrency }}</td>
              </tr>
            } @empty {
              <tr><td colspan="12" class="text-center text-muted py-4">No approved, unsettled collections in this period.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-lg-6">
        <h6 class="section-title">Open advances</h6>
        <div class="card">
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0 app-table">
              <thead><tr><th>Advance</th><th>Date</th><th class="text-end">Balance</th><th class="text-end">Suggested</th></tr></thead>
              <tbody>
                @for (a of preview().advances; track a.id) {
                  <tr>
                    <td>{{ a.advanceNumber }}<div class="text-muted small">{{ a.purpose ?? '' }}</div></td>
                    <td>{{ a.advanceDate | appDate }}</td>
                    <td class="text-end">{{ a.balanceAmount | appCurrency }}</td>
                    <td class="text-end">{{ a.suggestedRecovery | appCurrency }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="text-center text-muted py-3">No open advances</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="col-lg-6">
        <h6 class="section-title">Loan installments due</h6>
        <div class="card">
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0 app-table">
              <thead><tr><th>Loan</th><th>Due</th><th>Status</th><th class="text-end">Due amount</th></tr></thead>
              <tbody>
                @for (i of preview().loanInstallments; track i.id) {
                  <tr>
                    <td>{{ i.loanNumber }} #{{ i.installmentNo }}</td>
                    <td>{{ i.dueDate | appDate }}</td>
                    <td><app-status-badge [status]="i.status" /></td>
                    <td class="text-end">{{ i.dueAmount | appCurrency }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="text-center text-muted py-3">No installments due</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class SettlementPreviewComponent {
  readonly preview = input.required<SettlementPreview>();
}
