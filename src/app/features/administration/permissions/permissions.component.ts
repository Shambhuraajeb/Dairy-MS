import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../../../core/utils/http-error';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PermissionGroup } from '../administration.model';
import { AdministrationService } from '../administration.service';

/** /administration/permissions - read-only permission catalog grouped by module */
@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, LoadingComponent, EmptyStateComponent],
  template: `
    <app-page-header title="Permissions" subtitle="Read-only catalog of every permission code. Assign them to roles on the Roles page.">
      <a routerLink="/administration/roles" class="btn btn-outline-primary"><i class="bi bi-person-gear me-1"></i>Manage roles</a>
    </app-page-header>

    <div class="mb-3 d-flex flex-wrap align-items-center gap-3">
      <input type="search" class="form-control form-control-sm" style="max-width: 280px" placeholder="Search code, name or module..." (input)="onSearch($event)" aria-label="Search permissions" />
      <span class="text-muted small">{{ totalFiltered() }} permission(s) in {{ filtered().length }} module(s)</span>
    </div>

    @if (loading()) {
      <app-loading text="Loading permissions..." />
    } @else if (error()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center">
        <span>{{ error() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="load()">Retry</button>
      </div>
    } @else if (filtered().length === 0) {
      <app-empty-state icon="bi-key" title="No permissions found" message="Try a different search term." />
    } @else {
      <div class="row g-3">
        @for (g of filtered(); track g.module) {
          <div class="col-12 col-lg-6">
            <div class="card h-100">
              <div class="card-header d-flex justify-content-between align-items-center">
                <span class="text-capitalize fw-semibold">{{ g.module }}</span>
                <span class="badge badge-soft badge-soft-secondary">{{ g.permissions.length }}</span>
              </div>
              <div class="table-responsive">
                <table class="table table-sm align-middle mb-0 app-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of g.permissions; track p.id) {
                      <tr>
                        <td><code>{{ p.code }}</code></td>
                        <td>{{ p.name }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class PermissionsComponent implements OnInit {
  private readonly svc = inject(AdministrationService);

  readonly groups = signal<PermissionGroup[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly search = signal('');

  readonly filtered = computed<PermissionGroup[]>(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) {
      return this.groups();
    }
    return this.groups()
      .map((g) => ({
        module: g.module,
        permissions: g.permissions.filter(
          (p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || g.module.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.permissions.length > 0);
  });
  readonly totalFiltered = computed(() => this.filtered().reduce((n, g) => n + g.permissions.length, 0));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.listPermissions().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  onSearch(ev: Event): void {
    this.search.set((ev.target as HTMLInputElement).value);
  }
}
