import { Component, ElementRef, HostListener, computed, inject, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, HasPermissionDirective],
  template: `
    <header class="app-topbar">
      <button type="button" class="topbar-btn" (click)="toggle.emit()" aria-label="Toggle sidebar">
        <i class="bi bi-list"></i>
      </button>
      <div class="topbar-spacer"></div>

      <a *appHasPermission="'notification.view'" class="topbar-btn position-relative" routerLink="/notifications" aria-label="Notifications">
        <i class="bi bi-bell"></i>
        @if (notifications.unreadCount() > 0) {
          <span class="notif-badge">{{ notifications.unreadCount() > 99 ? '99+' : notifications.unreadCount() }}</span>
        }
      </a>

      <div class="user-menu">
        <button type="button" class="user-trigger" (click)="menuOpen.set(!menuOpen())" [attr.aria-expanded]="menuOpen()">
          <span class="avatar">{{ initials() }}</span>
          <span class="user-meta d-none d-md-flex">
            <span class="user-name">{{ auth.user()?.displayName }}</span>
            <span class="user-role">{{ auth.user()?.role }}</span>
          </span>
          <i class="bi bi-chevron-down small d-none d-md-inline"></i>
        </button>
        @if (menuOpen()) {
          <div class="dropdown-menu dropdown-menu-end show" data-bs-popper="static">
            <div class="dropdown-header">
              <div class="fw-semibold text-dark">{{ auth.user()?.displayName }}</div>
              <span class="badge text-bg-light border">{{ auth.user()?.role }}</span>
            </div>
            <div class="dropdown-divider"></div>
            <a class="dropdown-item" routerLink="/profile" (click)="menuOpen.set(false)"><i class="bi bi-person me-2"></i>Profile</a>
            <a class="dropdown-item" routerLink="/change-password" (click)="menuOpen.set(false)"><i class="bi bi-key me-2"></i>Change password</a>
            <div class="dropdown-divider"></div>
            <button type="button" class="dropdown-item text-danger" (click)="logout()"><i class="bi bi-box-arrow-right me-2"></i>Logout</button>
          </div>
        }
      </div>
    </header>
  `,
})
export class TopbarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly notifications = inject(NotificationService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly toggle = output<void>();
  protected readonly menuOpen = signal(false);

  protected readonly initials = computed(() => {
    const name = this.auth.user()?.displayName || this.auth.user()?.username || '?';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.menuOpen() && !this.host.nativeElement.querySelector('.user-menu')?.contains(event.target as Node)) {
      this.menuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen.set(false);
  }

  protected logout(): void {
    this.menuOpen.set(false);
    this.auth.logout();
  }
}
