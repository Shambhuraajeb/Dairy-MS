import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="error-page">
      <div class="error-code">404</div>
      <h1 class="h4">Page not found</h1>
      <p class="text-muted">The page you are looking for does not exist or has been moved.</p>
      <a class="btn btn-primary" routerLink="/dashboard"><i class="bi bi-house me-1"></i>Back to dashboard</a>
    </div>
  `,
})
export class NotFoundComponent {}
