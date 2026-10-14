import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppCurrencyPipe, AppDatePipe } from '../../../shared/pipes/app-pipes';
import { orNull } from '../../../shared/utils/paged-list';
import { SubscriptionDetail } from '../subscription.model';
import { SubscriptionService } from '../subscription.service';
import { SubscriptionEditModalComponent } from './subscription-edit-modal.component';
import { SubscriptionPauseModalComponent } from './subscription-pause-modal.component';

@Component({
  selector: 'app-subscription-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    ModalComponent,
    FormFieldComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    AppCurrencyPipe,
    AppDatePipe,
    SubscriptionEditModalComponent,
    SubscriptionPauseModalComponent,
  ],
  template: `
    @if (loading()) {
      <app-loading text="Loading subscription..." />
    } @else if (error()) {
      <div class="card">
        <app-empty-state icon="bi-exclamation-octagon" title="Could not load subscription" [message]="error()!">
          <button type="button" class="btn btn-outline-primary btn-sm me-2" (click)="load()">Retry</button>
          <a routerLink="/subscriptions" class="btn btn-light btn-sm">Back to subscriptions</a>
        </app-empty-state>
      </div>
    } @else if (sub(); as s) {
      <app-page-header [title]="s.subscriptionNumber" [subtitle]="s.customerName + ' · ' + s.productName + ' · ' + s.frequency">
        <a routerLink="/subscriptions" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>Back</a>
        @if (isActiveOrPaused()) {
          <ng-container *appHasPermission="'subscription.update'">
            <button type="button" class="btn btn-outline-secondary" (click)="editOpen.set(true)"><i class="bi bi-pencil me-1"></i>Edit</button>
            @if (s.status === 'Active') {
              <button type="button" class="btn btn-warning" (click)="pauseOpen.set(true)"><i class="bi bi-pause-circle me-1"></i>Pause</button>
            }
            @if (s.status === 'Paused') {
              <button type="button" class="btn btn-success" [disabled]="busy()" (click)="resume()"><i class="bi bi-play-circle me-1"></i>Resume</button>
            }
            @if (canCancel()) {
              <button type="button" class="btn btn-outline-danger" (click)="openCancel()"><i class="bi bi-x-circle me-1"></i>Cancel subscription</button>
            }
          </ng-container>
        }
      </app-page-header>

      <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
        <app-status-badge [status]="s.status" />
        @if (s.status === 'Paused' && activePause(); as p) {
          <span class="small text-muted">
            Paused from {{ p.pauseFrom | appDate }}{{ p.pauseTo ? ' until ' : ' until resumed' }}@if (p.pauseTo) { {{ p.pauseTo | appDate }} }
          </span>
        }
      </div>

      <div class="row g-3">
        <div class="col-lg-7">
          <div class="card h-100">
            <div class="card-body">
              <h2 class="section-title">Subscription</h2>
              <dl class="row mb-0">
                <dt class="col-sm-4">Customer</dt>
                <dd class="col-sm-8">
                  <a [routerLink]="['/customers', s.customerId]" class="text-decoration-none">{{ s.customerName }}</a>
                  <span class="text-muted small"> ({{ s.customerCode }})</span>
                </dd>
                <dt class="col-sm-4">Plan</dt><dd class="col-sm-8">{{ s.planName }}</dd>
                <dt class="col-sm-4">Product</dt><dd class="col-sm-8">{{ s.productName }}</dd>
                <dt class="col-sm-4">Quantity</dt><dd class="col-sm-8">{{ s.quantity }} @ {{ s.unitPrice | appCurrency }}</dd>
                <dt class="col-sm-4">Frequency</dt>
                <dd class="col-sm-8">{{ s.frequency }}@if (s.daysOfWeek) { <span class="text-muted"> ({{ s.daysOfWeek }})</span> }</dd>
                <dt class="col-sm-4">Delivery slot</dt><dd class="col-sm-8">{{ s.deliverySlot }}</dd>
                <dt class="col-sm-4">Address</dt><dd class="col-sm-8">{{ s.addressText || '—' }}</dd>
                @if (s.remarks) {
                  <dt class="col-sm-4">Remarks</dt><dd class="col-sm-8">{{ s.remarks }}</dd>
                }
              </dl>
            </div>
          </div>
        </div>
        <div class="col-lg-5">
          <div class="card h-100">
            <div class="card-body">
              <h2 class="section-title">Schedule</h2>
              <dl class="row mb-0">
                <dt class="col-sm-5">Start date</dt><dd class="col-sm-7">{{ s.startDate | appDate }}</dd>
                <dt class="col-sm-5">End date</dt><dd class="col-sm-7">{{ s.endDate ? (s.endDate | appDate) : 'Open ended' }}</dd>
                <dt class="col-sm-5">Next order</dt><dd class="col-sm-7">{{ s.nextOrderDate | appDate }}</dd>
                <dt class="col-sm-5">Last order</dt><dd class="col-sm-7">{{ s.lastOrderDate | appDate }}</dd>
                <dt class="col-sm-5">Created</dt><dd class="col-sm-7">{{ s.createdDate | appDate }}</dd>
                @if (s.cancelledDate) {
                  <dt class="col-sm-5">Cancelled</dt><dd class="col-sm-7">{{ s.cancelledDate | appDate }}</dd>
                  <dt class="col-sm-5">Reason</dt><dd class="col-sm-7">{{ s.cancelReason || '—' }}</dd>
                }
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="card mt-3">
        <div class="card-body pb-2">
          <h2 class="section-title">Pause history</h2>
        </div>
        @if (s.pauses.length === 0) {
          <app-empty-state icon="bi-pause-circle" title="No pauses" message="This subscription has never been paused." />
        } @else {
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0 app-table">
              <thead>
                <tr><th>From</th><th>Until</th><th>Reason</th><th>Resumed</th><th>Status</th></tr>
              </thead>
              <tbody>
                @for (p of s.pauses; track p.id) {
                  <tr>
                    <td>{{ p.pauseFrom | appDate }}</td>
                    <td>{{ p.pauseTo ? (p.pauseTo | appDate) : 'Until resumed' }}</td>
                    <td>{{ p.reason || '—' }}</td>
                    <td>{{ p.resumedDate | appDate }}</td>
                    <td><app-status-badge [status]="p.status" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <app-subscription-edit-modal [open]="editOpen()" [subscription]="s" (closed)="editOpen.set(false)" (saved)="onSaved($event, 'edit')" />
      <app-subscription-pause-modal [open]="pauseOpen()" [subscriptionId]="s.id" (closed)="pauseOpen.set(false)" (paused)="onSaved($event, 'pause')" />

      <app-modal [open]="cancelOpen()" title="Cancel subscription" size="md" (closed)="closeCancel()">
        <form id="cancelSubForm" [formGroup]="cancelForm" (ngSubmit)="submitCancel()" novalidate>
          <p class="text-muted small">Cancelling stops all future orders. This cannot be undone.</p>
          <app-form-field label="Reason" inputId="cxReason" [control]="cancelForm.controls.reason">
            <textarea id="cxReason" class="form-control" rows="3" formControlName="reason" maxlength="255"></textarea>
          </app-form-field>
        </form>
        <div modal-footer>
          <button type="button" class="btn btn-light" (click)="closeCancel()">Keep subscription</button>
          <button type="submit" form="cancelSubForm" class="btn btn-danger" [disabled]="busy()">Cancel subscription</button>
        </div>
      </app-modal>
    }
  `,
})
export class SubscriptionDetailComponent implements OnInit {
  private readonly svc = inject(SubscriptionService);
  private readonly perm = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly id = input.required<string>();

  readonly sub = signal<SubscriptionDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly editOpen = signal(false);
  readonly pauseOpen = signal(false);
  readonly cancelOpen = signal(false);

  readonly cancelForm = this.fb.group({ reason: ['', Validators.maxLength(255)] });

  readonly isActiveOrPaused = computed(() => {
    const st = this.sub()?.status;
    return st === 'Active' || st === 'Paused';
  });
  /** cancel is not allowed for customer roles */
  readonly canCancel = computed(() => !this.perm.isInRole('Customer', 'Distributor / B2B Customer'));
  readonly activePause = computed(() => this.sub()?.pauses.find((p) => p.status === 'Active') ?? null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.get(this.id()).subscribe({
      next: (s) => {
        this.sub.set(s);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  onSaved(updated: SubscriptionDetail, kind: 'edit' | 'pause'): void {
    this.sub.set(updated);
    if (kind === 'edit') {
      this.editOpen.set(false);
    } else {
      this.pauseOpen.set(false);
    }
  }

  async resume(): Promise<void> {
    const s = this.sub()!;
    const ok = await this.confirmService.confirm({
      title: 'Resume subscription',
      message: `Resume ${s.subscriptionNumber}? Orders will be generated again from the next due date.`,
      confirmText: 'Resume',
      variant: 'primary',
    });
    if (!ok) {
      return;
    }
    this.busy.set(true);
    this.svc.resume(s.id).subscribe({
      next: (updated) => {
        this.sub.set(updated);
        this.busy.set(false);
        this.toast.success('Subscription resumed.');
      },
      error: () => this.busy.set(false),
    });
  }

  openCancel(): void {
    this.cancelForm.reset({ reason: '' });
    this.cancelOpen.set(true);
  }

  closeCancel(): void {
    if (!this.busy()) {
      this.cancelOpen.set(false);
    }
  }

  submitCancel(): void {
    if (this.cancelForm.invalid) {
      this.cancelForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.svc.cancel(this.sub()!.id, orNull(this.cancelForm.getRawValue().reason.trim())).subscribe({
      next: (updated) => {
        this.sub.set(updated);
        this.busy.set(false);
        this.cancelOpen.set(false);
        this.toast.success('Subscription cancelled.');
      },
      error: () => this.busy.set(false),
    });
  }
}
