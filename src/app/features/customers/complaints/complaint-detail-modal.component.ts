import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppDatePipe } from '../../../shared/pipes/app-pipes';
import { AssignableUser, Complaint } from '../complaint.model';
import { CustomerService } from '../customer.service';

type Mode = 'none' | 'assign' | 'status' | 'resolve' | 'feedback';

@Component({
  selector: 'app-complaint-detail-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent, StatusBadgeComponent, HasPermissionDirective, AppDatePipe],
  template: `
    <app-modal [open]="!!current()" [title]="current() ? 'Complaint ' + current()!.complaintNumber : 'Complaint'" size="lg" (closed)="close()">
      @if (current(); as c) {
        <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
          <app-status-badge [status]="c.status" />
          <app-status-badge [status]="c.priority" [color]="priorityColor(c.priority)" />
          <span class="badge text-bg-light border">{{ c.category }}</span>
          <span class="text-muted small ms-auto">Raised {{ c.createdDate | appDate: 'datetime' }}</span>
        </div>

        <h2 class="h6">{{ c.subject }}</h2>
        <p class="text-muted" style="white-space: pre-line">{{ c.description }}</p>

        <dl class="row small mb-3">
          <dt class="col-sm-3">Customer</dt><dd class="col-sm-9">{{ c.customerName }} ({{ c.customerCode }})</dd>
          @if (c.orderNumber) {
            <dt class="col-sm-3">Order</dt><dd class="col-sm-9">{{ c.orderNumber }}</dd>
          }
          @if (c.deliveryNumber) {
            <dt class="col-sm-3">Delivery</dt><dd class="col-sm-9">{{ c.deliveryNumber }}</dd>
          }
          <dt class="col-sm-3">Assigned to</dt>
          <dd class="col-sm-9">{{ c.assignedToName || '—' }}@if (c.assignedDate) { <span class="text-muted"> ({{ c.assignedDate | appDate }})</span> }</dd>
        </dl>

        @if (c.resolution) {
          <div class="alert alert-success py-2">
            <div class="fw-semibold small">Resolution ({{ c.resolvedDate | appDate }})</div>
            <div style="white-space: pre-line">{{ c.resolution }}</div>
          </div>
        }
        @if (c.closedDate) {
          <div class="small text-muted mb-2">Closed on {{ c.closedDate | appDate }}</div>
        }
        @if (c.feedbackRating) {
          <div class="alert alert-info py-2">
            <div class="fw-semibold small">Customer feedback</div>
            <div class="text-warning" aria-label="Rating">
              @for (n of stars; track n) {
                <i class="bi" [class.bi-star-fill]="n <= c.feedbackRating!" [class.bi-star]="n > c.feedbackRating!"></i>
              }
            </div>
            @if (c.feedbackComments) {
              <div>{{ c.feedbackComments }}</div>
            }
          </div>
        }

        @if (mode() === 'none') {
          <div class="d-flex flex-wrap gap-2">
            <ng-container *appHasPermission="'complaint.update'">
              @if (c.status !== 'Closed') {
                <button type="button" class="btn btn-sm btn-outline-primary" (click)="startAssign()"><i class="bi bi-person-plus me-1"></i>Assign</button>
                <button type="button" class="btn btn-sm btn-outline-secondary" (click)="startStatus()"><i class="bi bi-arrow-repeat me-1"></i>Change status</button>
              }
              @if (canResolve()) {
                <button type="button" class="btn btn-sm btn-success" (click)="startResolve()"><i class="bi bi-check2-circle me-1"></i>Resolve</button>
              }
              @if (c.status === 'Resolved') {
                <button type="button" class="btn btn-sm btn-dark" [disabled]="busy()" (click)="closeComplaint()"><i class="bi bi-lock me-1"></i>Close</button>
              }
            </ng-container>
            @if (canFeedback()) {
              <button type="button" class="btn btn-sm btn-warning" (click)="startFeedback()"><i class="bi bi-star me-1"></i>Give feedback</button>
            }
          </div>
        }

        @switch (mode()) {
          @case ('assign') {
            <form [formGroup]="assignForm" (ngSubmit)="submitAssign()" novalidate class="border rounded p-3 bg-light">
              <div class="fw-semibold mb-2">Assign complaint</div>
              @if (users().length > 0) {
                <app-form-field label="Assign to" inputId="asUser" [control]="assignForm.controls.assignedTo">
                  <select id="asUser" class="form-select" formControlName="assignedTo">
                    <option [ngValue]="null">-- select staff --</option>
                    @for (u of users(); track u.id) {
                      <option [ngValue]="u.id">{{ u.displayName }} ({{ u.roleName }})</option>
                    }
                  </select>
                </app-form-field>
              } @else {
                <app-form-field label="User ID" inputId="asUserId" [control]="assignForm.controls.assignedTo" hint="Enter the user id of the staff member, or assign to yourself.">
                  <input id="asUserId" type="number" min="1" class="form-control" formControlName="assignedTo" />
                </app-form-field>
              }
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-sm btn-outline-secondary" (click)="assignToMe()">Assign to me</button>
                <span class="ms-auto"></span>
                <button type="button" class="btn btn-sm btn-light" (click)="mode.set('none')">Cancel</button>
                <button type="submit" class="btn btn-sm btn-primary" [disabled]="busy()">Assign</button>
              </div>
            </form>
          }
          @case ('status') {
            <form [formGroup]="statusForm" (ngSubmit)="submitStatus()" novalidate class="border rounded p-3 bg-light">
              <div class="fw-semibold mb-2">Change status</div>
              <app-form-field label="Status" inputId="stStatus" [control]="statusForm.controls.status" [hint]="c.status === 'Resolved' ? 'Moving a resolved complaint back reopens it.' : ''">
                <select id="stStatus" class="form-select" formControlName="status">
                  <option value="Open">Open</option>
                  <option value="Assigned">Assigned</option>
                  <option value="InProgress">In progress</option>
                </select>
              </app-form-field>
              <div class="d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-sm btn-light" (click)="mode.set('none')">Cancel</button>
                <button type="submit" class="btn btn-sm btn-primary" [disabled]="busy()">Update</button>
              </div>
            </form>
          }
          @case ('resolve') {
            <form [formGroup]="resolveForm" (ngSubmit)="submitResolve()" novalidate class="border rounded p-3 bg-light">
              <div class="fw-semibold mb-2">Resolve complaint</div>
              <app-form-field label="Resolution" inputId="rsText" [control]="resolveForm.controls.resolution">
                <textarea id="rsText" class="form-control" rows="3" formControlName="resolution" maxlength="2000"></textarea>
              </app-form-field>
              <div class="d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-sm btn-light" (click)="mode.set('none')">Cancel</button>
                <button type="submit" class="btn btn-sm btn-success" [disabled]="busy()">Mark resolved</button>
              </div>
            </form>
          }
          @case ('feedback') {
            <form [formGroup]="feedbackForm" (ngSubmit)="submitFeedback()" novalidate class="border rounded p-3 bg-light">
              <div class="fw-semibold mb-2">How was the resolution?</div>
              <div class="mb-3 fs-4 text-warning">
                @for (n of stars; track n) {
                  <button type="button" class="btn btn-link p-0 me-1 text-warning fs-4" [attr.aria-label]="n + ' star'" (click)="feedbackForm.controls.rating.setValue(n)">
                    <i class="bi" [class.bi-star-fill]="n <= feedbackForm.controls.rating.value" [class.bi-star]="n > feedbackForm.controls.rating.value"></i>
                  </button>
                }
              </div>
              <app-form-field label="Comments" inputId="fbText" [control]="feedbackForm.controls.comments">
                <textarea id="fbText" class="form-control" rows="2" formControlName="comments" maxlength="500"></textarea>
              </app-form-field>
              <div class="d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-sm btn-light" (click)="mode.set('none')">Cancel</button>
                <button type="submit" class="btn btn-sm btn-primary" [disabled]="busy()">Submit feedback</button>
              </div>
            </form>
          }
        }
      }
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Close</button>
      </div>
    </app-modal>
  `,
})
export class ComplaintDetailModalComponent {
  private readonly svc = inject(CustomerService);
  private readonly auth = inject(AuthService);
  private readonly perm = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** null = closed */
  readonly complaint = input<Complaint | null>(null);
  readonly closed = output<void>();
  readonly changed = output<Complaint>();

  readonly stars = [1, 2, 3, 4, 5];
  readonly current = signal<Complaint | null>(null);
  readonly mode = signal<Mode>('none');
  readonly busy = signal(false);
  readonly users = signal<AssignableUser[]>([]);

  readonly canResolve = computed(() => {
    const s = this.current()?.status;
    return !!s && s !== 'Resolved' && s !== 'Closed';
  });
  readonly canFeedback = computed(() => {
    const c = this.current();
    return (
      !!c &&
      this.perm.isInRole('Customer', 'Distributor / B2B Customer') &&
      (c.status === 'Resolved' || c.status === 'Closed') &&
      !c.feedbackRating
    );
  });

  readonly assignForm = this.fb.group({ assignedTo: this.fb.control<number | null>(null, Validators.required) });
  readonly statusForm = this.fb.group({ status: ['InProgress', Validators.required] });
  readonly resolveForm = this.fb.group({ resolution: ['', [Validators.required, Validators.maxLength(2000)]] });
  readonly feedbackForm = this.fb.group({ rating: [5, [Validators.min(1), Validators.max(5)]], comments: [''] });

  constructor() {
    effect(() => {
      const c = this.complaint();
      untracked(() => {
        this.current.set(c);
        this.mode.set('none');
      });
    });
  }

  priorityColor(priority: string): 'secondary' | 'info' | 'warning' | 'danger' {
    switch (priority) {
      case 'Urgent':
        return 'danger';
      case 'High':
        return 'warning';
      case 'Medium':
        return 'info';
      default:
        return 'secondary';
    }
  }

  close(): void {
    this.closed.emit();
  }

  private done(updated: Complaint, message: string): void {
    this.busy.set(false);
    this.current.set(updated);
    this.mode.set('none');
    this.toast.success(message);
    this.changed.emit(updated);
  }

  startAssign(): void {
    const c = this.current()!;
    this.assignForm.reset({ assignedTo: c.assignedTo });
    this.mode.set('assign');
    if (this.users().length === 0 && this.perm.has('user.manage')) {
      this.svc.assignableUsers().subscribe((list) => this.users.set(list));
    }
  }

  assignToMe(): void {
    const me = this.auth.user();
    if (me) {
      this.assignForm.controls.assignedTo.setValue(me.id);
    }
  }

  submitAssign(): void {
    if (this.assignForm.invalid) {
      this.assignForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.svc.assignComplaint(this.current()!.id, Number(this.assignForm.getRawValue().assignedTo)).subscribe({
      next: (u) => this.done(u, 'Complaint assigned.'),
      error: () => this.busy.set(false),
    });
  }

  startStatus(): void {
    const c = this.current()!;
    this.statusForm.reset({ status: c.status === 'Resolved' || c.status === 'Closed' ? 'InProgress' : c.status });
    this.mode.set('status');
  }

  submitStatus(): void {
    this.busy.set(true);
    this.svc.setComplaintStatus(this.current()!.id, this.statusForm.getRawValue().status).subscribe({
      next: (u) => this.done(u, 'Status updated.'),
      error: () => this.busy.set(false),
    });
  }

  startResolve(): void {
    this.resolveForm.reset({ resolution: '' });
    this.mode.set('resolve');
  }

  submitResolve(): void {
    if (this.resolveForm.invalid) {
      this.resolveForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.svc.resolveComplaint(this.current()!.id, this.resolveForm.getRawValue().resolution.trim()).subscribe({
      next: (u) => this.done(u, 'Complaint resolved.'),
      error: () => this.busy.set(false),
    });
  }

  async closeComplaint(): Promise<void> {
    const c = this.current()!;
    const ok = await this.confirmService.confirm({
      title: 'Close complaint',
      message: `Close complaint ${c.complaintNumber}? A closed complaint cannot be reopened.`,
      confirmText: 'Close complaint',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    this.busy.set(true);
    this.svc.closeComplaint(c.id).subscribe({
      next: (u) => this.done(u, 'Complaint closed.'),
      error: () => this.busy.set(false),
    });
  }

  startFeedback(): void {
    this.feedbackForm.reset({ rating: 5, comments: '' });
    this.mode.set('feedback');
  }

  submitFeedback(): void {
    const v = this.feedbackForm.getRawValue();
    this.busy.set(true);
    this.svc.complaintFeedback(this.current()!.id, v.rating, v.comments.trim() || null).subscribe({
      next: (u) => this.done(u, 'Thank you for your feedback.'),
      error: () => this.busy.set(false),
    });
  }
}
