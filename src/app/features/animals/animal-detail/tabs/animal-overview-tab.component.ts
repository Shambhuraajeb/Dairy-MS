import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { AppCurrencyPipe, AppDatePipe } from '../../../../shared/pipes/app-pipes';
import { AnimalDetail } from '../../animal.model';

@Component({
  selector: 'app-animal-overview-tab',
  standalone: true,
  imports: [RouterLink, StatusBadgeComponent, AppDatePipe, AppCurrencyPipe],
  template: `
    @let a = animal();
    <div class="row g-3">
      <div class="col-lg-6">
        <div class="card h-100">
          <div class="card-header">Animal details</div>
          <div class="card-body">
            <dl class="row mb-0 small">
              <dt class="col-sm-5 text-muted">Tag number</dt><dd class="col-sm-7 fw-semibold">{{ a.tagNumber }}</dd>
              <dt class="col-sm-5 text-muted">Name</dt><dd class="col-sm-7">{{ a.name || '—' }}</dd>
              <dt class="col-sm-5 text-muted">Owner</dt>
              <dd class="col-sm-7"><a [routerLink]="['/farmers', a.farmerId]" class="text-decoration-none">{{ a.farmerName }}</a> <span class="text-muted">({{ a.farmerCode }})</span></dd>
              <dt class="col-sm-5 text-muted">Type / breed</dt><dd class="col-sm-7">{{ a.animalType }} / {{ a.breedName || '—' }}</dd>
              <dt class="col-sm-5 text-muted">Gender</dt><dd class="col-sm-7">{{ a.gender }}</dd>
              <dt class="col-sm-5 text-muted">Date of birth</dt><dd class="col-sm-7">{{ a.dateOfBirth | appDate }}</dd>
              <dt class="col-sm-5 text-muted">Age</dt><dd class="col-sm-7">{{ ageText(a.ageMonths) }}</dd>
              <dt class="col-sm-5 text-muted">Color</dt><dd class="col-sm-7">{{ a.color || '—' }}</dd>
              <dt class="col-sm-5 text-muted">Weight</dt><dd class="col-sm-7">{{ a.weightKg ? a.weightKg + ' kg' : '—' }}</dd>
              <dt class="col-sm-5 text-muted">Source</dt><dd class="col-sm-7">{{ a.source }}</dd>
              <dt class="col-sm-5 text-muted">Registered</dt><dd class="col-sm-7">{{ a.registrationDate | appDate }}</dd>
              <dt class="col-sm-5 text-muted">Remarks</dt><dd class="col-sm-7 mb-0">{{ a.remarks || '—' }}</dd>
            </dl>
          </div>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="card h-100">
          <div class="card-header">Production &amp; reproduction</div>
          <div class="card-body">
            <dl class="row mb-0 small">
              <dt class="col-sm-5 text-muted">Status</dt><dd class="col-sm-7"><app-status-badge [status]="a.status" /> <span class="text-muted">{{ a.statusDate | appDate }}</span></dd>
              <dt class="col-sm-5 text-muted">Milking status</dt><dd class="col-sm-7">{{ a.milkingStatus }}</dd>
              <dt class="col-sm-5 text-muted">Pregnancy</dt><dd class="col-sm-7"><app-status-badge [status]="a.pregnancyStatus" /></dd>
              @if (a.pregnancyStatus === 'Pregnant') {
                <dt class="col-sm-5 text-muted">Expected delivery</dt><dd class="col-sm-7">{{ a.expectedDeliveryDate | appDate }}</dd>
              }
              <dt class="col-sm-5 text-muted">Lactation no.</dt><dd class="col-sm-7">{{ a.lactationNo ?? '—' }}</dd>
              <dt class="col-sm-5 text-muted">Last calving</dt><dd class="col-sm-7 mb-0">{{ a.lastCalvingDate | appDate }}</dd>
            </dl>
          </div>
        </div>
      </div>
      @if (a.sale; as s) {
        <div class="col-lg-6">
          <div class="card border-secondary">
            <div class="card-header">Sale</div>
            <div class="card-body">
              <dl class="row mb-0 small">
                <dt class="col-sm-5 text-muted">Sold on</dt><dd class="col-sm-7">{{ s.saleDate | appDate }}</dd>
                <dt class="col-sm-5 text-muted">Buyer</dt><dd class="col-sm-7">{{ s.buyerName }} {{ s.buyerMobile }}</dd>
                <dt class="col-sm-5 text-muted">Price</dt><dd class="col-sm-7">{{ s.salePrice | appCurrency }}</dd>
                <dt class="col-sm-5 text-muted">Reference</dt><dd class="col-sm-7">{{ s.referenceNo || '—' }}</dd>
                <dt class="col-sm-5 text-muted">Reason</dt><dd class="col-sm-7 mb-0">{{ s.reason || '—' }}</dd>
              </dl>
            </div>
          </div>
        </div>
      }
      @if (a.death; as d) {
        <div class="col-lg-6">
          <div class="card border-danger">
            <div class="card-header">Death</div>
            <div class="card-body">
              <dl class="row mb-0 small">
                <dt class="col-sm-5 text-muted">Date</dt><dd class="col-sm-7">{{ d.deathDate | appDate }}</dd>
                <dt class="col-sm-5 text-muted">Cause</dt><dd class="col-sm-7">{{ d.causeCategory }}{{ d.cause ? ' - ' + d.cause : '' }}</dd>
                <dt class="col-sm-5 text-muted">Veterinarian</dt><dd class="col-sm-7">{{ d.vetName || '—' }}</dd>
                <dt class="col-sm-5 text-muted">Post-mortem</dt><dd class="col-sm-7">{{ d.postMortemDone ? 'Done' : 'Not done' }}</dd>
                <dt class="col-sm-5 text-muted">Loss</dt><dd class="col-sm-7 mb-0">{{ d.lossAmount | appCurrency }}</dd>
              </dl>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AnimalOverviewTabComponent {
  readonly animal = input.required<AnimalDetail>();

  ageText(months: number | null | undefined): string {
    if (months === null || months === undefined) {
      return '—';
    }
    return months < 12 ? `${months} months` : `${Math.floor(months / 12)} yr ${months % 12} mo`;
  }
}
