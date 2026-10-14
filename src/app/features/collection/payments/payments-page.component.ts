import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PaymentsListComponent } from '../components/payments-list.component';
import { isoDay, toNumberOrNull } from '../collection.util';

/** /collection/payments: farmer payment history with a details modal (and approve / pay / cancel for authorised users). */
@Component({
  selector: 'app-payments-page',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, HasPermissionDirective, PaymentsListComponent],
  template: `
    <app-page-header title="Farmer Payments" subtitle="Settlement and payment history for farmers">
      <a *appHasPermission="'payment.view'" class="btn btn-outline-primary" routerLink="/collection/settlement">
        <i class="bi bi-calculator me-1"></i>New settlement
      </a>
    </app-page-header>
    <app-payments-list [initialStatus]="status()" [initialFrom]="fromDate()" [initialTo]="toDate()" [initialFarmerId]="farmerNumber()" />
  `,
})
export class PaymentsPageComponent {
  // initial filters from the query string
  readonly status = input<string>();
  readonly from = input<string>();
  readonly to = input<string>();
  readonly farmerId = input<string>();
  readonly farmer = input<string>();

  protected readonly fromDate = computed(() => (this.from() ? isoDay(this.from()) : null));
  protected readonly toDate = computed(() => (this.to() ? isoDay(this.to()) : null));
  protected readonly farmerNumber = computed(() => toNumberOrNull(this.farmerId() ?? this.farmer()));
}
