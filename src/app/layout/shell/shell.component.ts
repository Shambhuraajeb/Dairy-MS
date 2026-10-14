import { Component, HostListener, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { BreadcrumbComponent } from '../breadcrumb/breadcrumb.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

const KEY = 'dms.sidebarCollapsed';
const MOBILE_BREAKPOINT = 992;

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, BreadcrumbComponent],
  template: `
    <div class="app-shell" [class.sidebar-collapsed]="collapsed()" [class.sidebar-open]="mobileOpen()">
      <app-sidebar [collapsed]="collapsed() && !isMobile()" (navigated)="mobileOpen.set(false)" (expandRequest)="collapsed.set(false)" />
      <div class="sidebar-backdrop" (click)="mobileOpen.set(false)"></div>
      <div class="app-main">
        <app-topbar (toggle)="toggleSidebar()" />
        <main class="app-content">
          <app-breadcrumb />
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  private readonly router = inject(Router);

  readonly collapsed = signal(localStorage.getItem(KEY) === '1');
  readonly mobileOpen = signal(false);
  readonly isMobile = signal(window.innerWidth < MOBILE_BREAKPOINT);

  constructor() {
    effect(() => localStorage.setItem(KEY, this.collapsed() ? '1' : '0'));
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.mobileOpen.set(false));
  }

  @HostListener('window:resize')
  onResize(): void {
    const mobile = window.innerWidth < MOBILE_BREAKPOINT;
    this.isMobile.set(mobile);
    if (!mobile) {
      this.mobileOpen.set(false);
    }
  }

  toggleSidebar(): void {
    if (this.isMobile()) {
      this.mobileOpen.update((v) => !v);
    } else {
      this.collapsed.update((v) => !v);
    }
  }
}
