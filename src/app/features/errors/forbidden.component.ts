import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="error-page">
      <div class="error-code">403</div>
      <h1 class="h4">Access denied</h1>
      <p class="text-muted">You do not have permission to view this page. Contact your administrator if you think this is a mistake.</p>
      <a class="btn btn-primary" routerLink="/dashboard"><i class="bi bi-house me-1"></i>Back to dashboard</a>
    </div>
  `,
})
export class ForbiddenComponent {}
