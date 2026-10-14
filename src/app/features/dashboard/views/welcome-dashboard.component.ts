import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { MENU, filterMenu, flattenMenu } from '../../../core/constants/menu.config';
import { PermissionService } from '../../../core/services/permission.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

/** Fallback for roles without a data dashboard (farmer, driver, vet, staff): shortcut tiles for everything they can open. */
@Component({
  selector: 'app-welcome-dashboard',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent],
  template: `
    <app-page-header [title]="'Welcome, ' + (auth.user()?.displayName ?? '')" [subtitle]="auth.user()?.role ?? ''" />
    <div class="row g-3">
      @for (s of shortcuts(); track s.route) {
        <div class="col-6 col-md-4 col-xl-3">
          <a class="kpi-card kpi-link" [routerLink]="s.route">
            <div class="kpi-icon kpi-primary"><i class="bi {{ s.icon }}"></i></div>
            <div class="kpi-body"><div class="kpi-title mb-0 fw-semibold text-dark">{{ s.label }}</div></div>
          </a>
        </div>
      } @empty {
        <div class="col-12"><div class="alert alert-info mb-0">No modules are assigned to your role yet. Contact your administrator.</div></div>
      }
    </div>
  `,
})
export class WelcomeDashboardComponent {
  protected readonly auth = inject(AuthService);
  private readonly perm = inject(PermissionService);

  protected readonly shortcuts = computed(() =>
    flattenMenu(filterMenu(MENU, (p) => this.perm.check(p))).filter((i) => i.route && i.route !== '/dashboard'),
  );
}
