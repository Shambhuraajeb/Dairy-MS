import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { errorMessage } from '../../../core/utils/http-error';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly form = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });
  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly demoUsers = [
    { username: 'admin', role: 'Super Admin' },
    { username: 'owner', role: 'Dairy Owner' },
    { username: 'manager', role: 'Dairy Manager' },
    { username: 'supervisor', role: 'Collection Supervisor' },
    { username: 'accountant', role: 'Accountant' },
    { username: 'inventory', role: 'Inventory Manager' },
    { username: 'deliverymgr', role: 'Delivery Manager' },
    { username: 'driver', role: 'Driver' },
    { username: 'vet', role: 'Veterinarian' },
    { username: 'staff', role: 'Staff' },
    { username: 'farmer1', role: 'Farmer' },
    { username: 'customer1', role: 'Customer' },
    { username: 'distributor1', role: 'Distributor' },
  ];

  fillDemo(username: string): void {
    this.form.patchValue({ username, password: 'Admin@123' });
    this.error.set(null);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: (user) => {
        this.loading.set(false);
        if (user.mustChangePassword) {
          void this.router.navigateByUrl('/change-password');
          return;
        }
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const safe = !!returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') && !returnUrl.startsWith('/login');
        void this.router.navigateByUrl(safe && returnUrl ? returnUrl : '/dashboard');
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const body = err instanceof HttpErrorResponse ? (err.error as { message?: string } | null) : null;
        this.error.set(
          body?.message || (err instanceof HttpErrorResponse && err.status === 401 ? 'Invalid username or password.' : errorMessage(err)),
        );
      },
    });
  }
}
