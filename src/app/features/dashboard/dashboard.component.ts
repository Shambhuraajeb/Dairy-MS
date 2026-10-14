import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionService } from '../../core/services/permission.service';
import { OwnerDashboardComponent } from './views/owner-dashboard.component';
import { VariantDashboardComponent } from './views/variant-dashboard.component';
import { WelcomeDashboardComponent } from './views/welcome-dashboard.component';

type DashboardView = 'owner' | 'collection' | 'inventory' | 'customer' | 'welcome';

const OWNER_ROLES = ['Super Admin', 'Dairy Owner', 'Dairy Manager'];
const CUSTOMER_ROLES = ['Customer', 'Distributor / B2B Customer'];

/** Picks the dashboard variant from the signed-in role, falling back to permissions. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [OwnerDashboardComponent, VariantDashboardComponent, WelcomeDashboardComponent],
  template: `
    @switch (view()) {
      @case ('owner') {
        <app-owner-dashboard />
      }
      @case ('collection') {
        <app-variant-dashboard name="collection" />
      }
      @case ('inventory') {
        <app-variant-dashboard name="inventory" />
      }
      @case ('customer') {
        <app-variant-dashboard name="customer" />
      }
      @default {
        <app-welcome-dashboard />
      }
    }
  `,
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly perm = inject(PermissionService);

  protected readonly view = computed<DashboardView>(() => {
    const role = this.auth.user()?.role ?? '';
    if (OWNER_ROLES.includes(role)) {
      return 'owner';
    }
    if (role === 'Collection Supervisor' && this.perm.has('collection.view')) {
      return 'collection';
    }
    if (role === 'Inventory Manager' && this.perm.has('inventory.view')) {
      return 'inventory';
    }
    if (CUSTOMER_ROLES.includes(role)) {
      return 'customer';
    }
    if (this.perm.has('dashboard.view')) {
      return 'owner';
    }
    if (this.perm.has('collection.view') && this.perm.has('collection.approve')) {
      return 'collection';
    }
    if (this.perm.has('inventory.view') && this.perm.has('inventory.adjust')) {
      return 'inventory';
    }
    return 'welcome';
  });
}
