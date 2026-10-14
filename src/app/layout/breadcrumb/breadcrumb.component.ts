import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

interface Crumb {
  label: string;
  path: string;
  link: boolean;
}

/**
 * Built from `data.breadcrumb` (falls back to `data.title`) of every route config in the active chain.
 * Set `breadcrumbLink: false` in a route's data for labels that have no page of their own.
 */
@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (crumbs().length > 1) {
      <nav aria-label="breadcrumb" class="app-breadcrumb">
        <ol class="breadcrumb mb-0">
          @for (c of crumbs(); track $index; let last = $last) {
            @if (last || !c.link) {
              <li class="breadcrumb-item" [class.active]="last" [attr.aria-current]="last ? 'page' : null">{{ c.label }}</li>
            } @else {
              <li class="breadcrumb-item"><a [routerLink]="c.path">{{ c.label }}</a></li>
            }
          }
        </ol>
      </nav>
    }
  `,
})
export class BreadcrumbComponent {
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  readonly crumbs = signal<Crumb[]>([]);

  constructor() {
    this.build();
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.build());
  }

  private build(): void {
    const list: Crumb[] = [];
    const segments: string[] = [];
    let snap: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    while (snap) {
      segments.push(...snap.url.map((s) => s.path));
      const data = snap.routeConfig?.data as Record<string, unknown> | undefined;
      const label = (data?.['breadcrumb'] ?? data?.['title']) as string | undefined;
      if (label) {
        const path = '/' + segments.join('/');
        const crumb: Crumb = { label, path, link: data?.['breadcrumbLink'] !== false };
        if (list.length && list[list.length - 1].path === path) {
          list[list.length - 1] = crumb;
        } else {
          list.push(crumb);
        }
      }
      snap = snap.firstChild;
    }
    if (list.length && list[0].path !== '/dashboard') {
      list.unshift({ label: 'Home', path: '/dashboard', link: true });
    }
    this.crumbs.set(list);
    const last = list.length ? list[list.length - 1].label : '';
    this.titleService.setTitle(last ? `${last} · Dairy Management` : 'Dairy Management System');
  }
}
