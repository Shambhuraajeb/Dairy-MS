import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { MENU, MenuItem, filterMenu, flattenMenu } from '../../core/constants/menu.config';
import { PermissionService } from '../../core/services/permission.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <aside class="app-sidebar" [class.collapsed]="collapsed()">
      <a class="sidebar-brand" routerLink="/dashboard" (click)="navigated.emit()">
        <i class="bi bi-droplet-fill brand-icon"></i>
        <span class="brand-text">Dairy<span class="brand-accent">MS</span></span>
      </a>
      <nav class="sidebar-nav" aria-label="Main navigation">
        <ul class="sidebar-list">
          @for (item of menu(); track item.label) {
            @if (item.children) {
              <li class="nav-group" [class.open]="isOpen(item)">
                <button
                  type="button"
                  class="sidebar-link group-toggle"
                  [class.has-active]="activeGroup() === item.label"
                  [attr.title]="collapsed() ? item.label : null"
                  [attr.aria-expanded]="isOpen(item)"
                  (click)="toggleGroup(item)"
                >
                  <i class="bi {{ item.icon }} link-icon"></i>
                  <span class="link-text">{{ item.label }}</span>
                  <i class="bi bi-chevron-down chevron"></i>
                </button>
                @if (isOpen(item) && !collapsed()) {
                  <ul class="sidebar-children">
                    @for (child of item.children; track child.label) {
                      <li>
                        <a class="sidebar-link child-link" [routerLink]="child.route" [class.active]="activeRoute() === child.route" (click)="navigated.emit()">
                          <i class="bi {{ child.icon }} link-icon"></i>
                          <span class="link-text">{{ child.label }}</span>
                        </a>
                      </li>
                    }
                  </ul>
                }
              </li>
            } @else {
              <li>
                <a class="sidebar-link" [routerLink]="item.route" [class.active]="activeRoute() === item.route" [attr.title]="collapsed() ? item.label : null" (click)="navigated.emit()">
                  <i class="bi {{ item.icon }} link-icon"></i>
                  <span class="link-text">{{ item.label }}</span>
                </a>
              </li>
            }
          }
        </ul>
      </nav>
    </aside>
  `,
})
export class SidebarComponent {
  private readonly router = inject(Router);
  private readonly perm = inject(PermissionService);

  readonly collapsed = input(false);
  readonly navigated = output<void>();
  readonly expandRequest = output<void>();

  protected readonly menu = computed(() => filterMenu(MENU, (p) => this.perm.check(p)));

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** the leaf menu route that best (longest prefix) matches the current url */
  protected readonly activeRoute = computed(() => {
    const path = this.url().split(/[?#]/)[0];
    let best = '';
    for (const leaf of flattenMenu(this.menu())) {
      const r = leaf.route;
      if (r && (path === r || path.startsWith(r + '/')) && r.length > best.length) {
        best = r;
      }
    }
    return best;
  });

  protected readonly activeGroup = computed(() => {
    const active = this.activeRoute();
    return this.menu().find((g) => g.children?.some((c) => c.route === active))?.label ?? null;
  });

  private readonly openGroups = signal<ReadonlySet<string>>(new Set());

  constructor() {
    effect(() => {
      const g = this.activeGroup();
      if (g) {
        untracked(() => this.openGroups.update((s) => new Set(s).add(g)));
      }
    });
  }

  protected isOpen(item: MenuItem): boolean {
    return this.openGroups().has(item.label);
  }

  protected toggleGroup(item: MenuItem): void {
    if (this.collapsed()) {
      this.openGroups.update((s) => new Set(s).add(item.label));
      this.expandRequest.emit();
      return;
    }
    this.openGroups.update((s) => {
      const next = new Set(s);
      if (next.has(item.label)) {
        next.delete(item.label);
      } else {
        next.add(item.label);
      }
      return next;
    });
  }
}
