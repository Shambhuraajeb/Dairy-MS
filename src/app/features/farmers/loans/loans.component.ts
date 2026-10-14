import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AdvanceListComponent } from './advance-list.component';
import { LoanListComponent } from './loan-list.component';

/** /farmers/loans — tabs: Loans | Advances (?tab=advances, ?farmerId=, ?status= are honoured by the lists) */
@Component({
  selector: 'app-loans',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, LoanListComponent, AdvanceListComponent],
  template: `
    <app-page-header title="Advances & Loans" subtitle="Cash advances and installment loans given to farmers, recovered through settlements">
      <a routerLink="/farmers" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>Farmers</a>
    </app-page-header>

    <ul class="nav nav-tabs mb-3">
      <li class="nav-item">
        <button type="button" class="nav-link" [class.active]="tab() === 'loans'" (click)="tab.set('loans')">
          <i class="bi bi-bank me-1"></i>Loans
        </button>
      </li>
      <li class="nav-item">
        <button type="button" class="nav-link" [class.active]="tab() === 'advances'" (click)="tab.set('advances')">
          <i class="bi bi-wallet2 me-1"></i>Advances
        </button>
      </li>
    </ul>

    @if (tab() === 'loans') {
      <app-loan-list />
    } @else {
      <app-advance-list />
    }
  `,
})
export class LoansComponent {
  readonly tab = signal<'loans' | 'advances'>('loans');

  constructor() {
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((p) => this.tab.set(p.get('tab') === 'advances' ? 'advances' : 'loans'));
  }
}
