import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent],
  template: `
    <app-page-header title="My profile" subtitle="Your account and access">
      <a class="btn btn-outline-primary" routerLink="/change-password"><i class="bi bi-key me-1"></i>Change password</a>
    </app-page-header>
    @if (auth.user(); as user) {
      <div class="row g-3">
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-body text-center">
              <div class="avatar avatar-lg mx-auto mb-3">{{ initials() }}</div>
              <h2 class="h5 mb-1">{{ user.displayName }}</h2>
              <div class="text-muted mb-2">&#64;{{ user.username }}</div>
              <span class="badge text-bg-primary">{{ user.role }}</span>
            </div>
          </div>
        </div>
        <div class="col-lg-8">
          <div class="card h-100">
            <div class="card-header">Permissions ({{ user.role === 'Super Admin' ? 'all' : user.permissions.length }})</div>
            <div class="card-body">
              @if (user.role === 'Super Admin') {
                <p class="text-muted mb-0">Super Admin has unrestricted access to every module.</p>
              } @else {
                @for (g of groups(); track g.module) {
                  <div class="mb-3">
                    <div class="text-uppercase small fw-semibold text-muted mb-1">{{ g.module }}</div>
                    <div class="d-flex flex-wrap gap-1">
                      @for (p of g.codes; track p) {
                        <span class="badge text-bg-light border fw-normal">{{ p }}</span>
                      }
                    </div>
                  </div>
                } @empty {
                  <p class="text-muted mb-0">No permissions assigned.</p>
                }
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ProfileComponent {
  protected readonly auth = inject(AuthService);

  protected readonly initials = computed(() =>
    (this.auth.user()?.displayName ?? '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join(''),
  );

  protected readonly groups = computed(() => {
    const map = new Map<string, string[]>();
    for (const code of this.auth.permissions()) {
      const module = code.split('.')[0];
      map.set(module, [...(map.get(module) ?? []), code]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([module, codes]) => ({ module, codes }));
  });
}
