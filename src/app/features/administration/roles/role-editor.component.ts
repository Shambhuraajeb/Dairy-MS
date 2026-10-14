import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { orNull } from '../../../shared/utils/paged-list';
import { PermissionGroup, RoleDetail } from '../administration.model';
import { AdministrationService } from '../administration.service';

const SUPER_ADMIN = 'Super Admin';

/** /administration/roles/:id - role details + permission matrix grouped by module */
@Component({
  selector: 'app-role-editor',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, FormFieldComponent, LoadingComponent, StatusBadgeComponent],
  template: `
    <app-page-header [title]="role()?.name ?? 'Role'" subtitle="Role details and permissions">
      <a routerLink="/administration/roles" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>Roles</a>
    </app-page-header>

    @if (loading()) {
      <app-loading text="Loading role..." />
    } @else if (loadError()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center">
        <span>{{ loadError() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="load()">Retry</button>
      </div>
    } @else if (role(); as r) {
      <div class="card mb-3">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span>Details</span>
          @if (r.isSystem) {
            <app-status-badge status="info" label="System role" />
          }
        </div>
        <div class="card-body">
          @if (r.isSystem) {
            <div class="alert alert-info py-2">System roles cannot be renamed, deactivated or deleted. Their permissions can still be adjusted.</div>
          }
          <form [formGroup]="detailsForm" (ngSubmit)="saveDetails()" novalidate class="row g-0">
            <div class="col-md-4 pe-md-3">
              <app-form-field label="Name" inputId="redName" [control]="detailsForm.controls.name">
                <input id="redName" class="form-control" formControlName="name" maxlength="100" />
              </app-form-field>
            </div>
            <div class="col-md-6 pe-md-3">
              <app-form-field label="Description" inputId="redDesc" [control]="detailsForm.controls.description">
                <input id="redDesc" class="form-control" formControlName="description" maxlength="250" />
              </app-form-field>
            </div>
            <div class="col-md-2 d-flex align-items-center">
              <div class="form-check form-switch">
                <input id="redActive" type="checkbox" class="form-check-input" formControlName="isActive" />
                <label class="form-check-label" for="redActive">Active</label>
              </div>
            </div>
            <div class="col-12 text-end">
              <button type="submit" class="btn btn-outline-primary" [disabled]="savingDetails() || detailsForm.pristine">
                @if (savingDetails()) {
                  <span class="spinner-border spinner-border-sm me-1"></span>
                }
                Save details
              </button>
            </div>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span>
            Permissions
            <span class="text-muted small ms-1">{{ selected().size }} of {{ totalCount() }} selected</span>
            @if (dirty()) {
              <span class="badge badge-soft badge-soft-warning ms-2">Unsaved changes</span>
            }
          </span>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <input type="search" class="form-control form-control-sm" style="width: 200px" placeholder="Filter permissions..." (input)="onSearch($event)" aria-label="Filter permissions" />
            <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="readOnly()" (click)="selectAll()">Select all</button>
            <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="readOnly()" (click)="clearAll()">Clear all</button>
            <button type="button" class="btn btn-sm btn-light" [disabled]="!dirty()" (click)="discard()">Discard</button>
            <button type="button" class="btn btn-sm btn-primary" [disabled]="readOnly() || !dirty() || savingPerms()" (click)="savePermissions()">
              @if (savingPerms()) {
                <span class="spinner-border spinner-border-sm me-1"></span>
              }
              <i class="bi bi-save me-1"></i>Save permissions
            </button>
          </div>
        </div>
        <div class="card-body">
          @if (readOnly()) {
            <div class="alert alert-secondary py-2">Super Admin always has every permission; its matrix is read-only.</div>
          }
          @for (g of filteredGroups(); track g.module) {
            <div class="border rounded mb-3">
              <div class="d-flex align-items-center justify-content-between px-3 py-2 bg-body-tertiary border-bottom">
                <div class="form-check mb-0">
                  <input
                    type="checkbox"
                    class="form-check-input"
                    [id]="'mod-' + g.module"
                    [checked]="moduleAll(g)"
                    [indeterminate]="moduleSome(g)"
                    [disabled]="readOnly()"
                    (change)="toggleModule(g, $event)"
                  />
                  <label class="form-check-label fw-semibold text-capitalize" [for]="'mod-' + g.module">{{ g.module }}</label>
                </div>
                <span class="small text-muted">{{ moduleCount(g) }} / {{ g.permissions.length }}</span>
              </div>
              <div class="row g-0 p-2">
                @for (p of g.permissions; track p.id) {
                  <div class="col-12 col-md-6 col-xl-4 px-2 py-1">
                    <div class="form-check">
                      <input
                        type="checkbox"
                        class="form-check-input"
                        [id]="'perm-' + p.id"
                        [checked]="selected().has(p.code)"
                        [disabled]="readOnly()"
                        (change)="toggle(p.code, $event)"
                      />
                      <label class="form-check-label" [for]="'perm-' + p.id">
                        {{ p.name }}
                        <code class="small text-muted ms-1">{{ p.code }}</code>
                      </label>
                    </div>
                  </div>
                }
              </div>
            </div>
          } @empty {
            <div class="text-center text-muted py-4">No permissions match the filter.</div>
          }
        </div>
      </div>
    }
  `,
})
export class RoleEditorComponent implements OnInit {
  private readonly svc = inject(AdministrationService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** route param */
  readonly id = input.required<string>();

  readonly role = signal<RoleDetail | null>(null);
  readonly groups = signal<PermissionGroup[]>([]);
  readonly selected = signal<ReadonlySet<string>>(new Set<string>());
  readonly original = signal<ReadonlySet<string>>(new Set<string>());
  readonly search = signal('');
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly savingDetails = signal(false);
  readonly savingPerms = signal(false);

  readonly detailsForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(250)],
    isActive: [true],
  });

  readonly readOnly = computed(() => this.role()?.name === SUPER_ADMIN);
  readonly totalCount = computed(() => this.groups().reduce((n, g) => n + g.permissions.length, 0));
  readonly dirty = computed(() => {
    const a = this.selected();
    const b = this.original();
    if (a.size !== b.size) {
      return true;
    }
    for (const c of a) {
      if (!b.has(c)) {
        return true;
      }
    }
    return false;
  });
  readonly filteredGroups = computed<PermissionGroup[]>(() => {
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

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin([this.svc.getRole(this.id()), this.svc.listPermissions()]).subscribe({
      next: ([role, groups]) => {
        this.groups.set(groups);
        this.applyRole(role);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  private applyRole(role: RoleDetail): void {
    this.role.set(role);
    const codes = new Set(role.permissionCodes);
    this.selected.set(codes);
    this.original.set(new Set(codes));
    this.detailsForm.reset({ name: role.name, description: role.description ?? '', isActive: role.isActive });
    if (role.isSystem) {
      this.detailsForm.controls.name.disable();
      this.detailsForm.controls.isActive.disable();
    } else {
      this.detailsForm.controls.name.enable();
      this.detailsForm.controls.isActive.enable();
    }
  }

  onSearch(ev: Event): void {
    this.search.set((ev.target as HTMLInputElement).value);
  }

  // ---- matrix
  moduleCount(g: PermissionGroup): number {
    const sel = this.selected();
    return g.permissions.filter((p) => sel.has(p.code)).length;
  }
  moduleAll(g: PermissionGroup): boolean {
    return g.permissions.length > 0 && this.moduleCount(g) === g.permissions.length;
  }
  moduleSome(g: PermissionGroup): boolean {
    const n = this.moduleCount(g);
    return n > 0 && n < g.permissions.length;
  }

  toggle(code: string, ev: Event): void {
    const on = (ev.target as HTMLInputElement).checked;
    this.selected.update((s) => {
      const next = new Set(s);
      if (on) {
        next.add(code);
      } else {
        next.delete(code);
      }
      return next;
    });
  }

  toggleModule(g: PermissionGroup, ev: Event): void {
    const on = (ev.target as HTMLInputElement).checked;
    this.selected.update((s) => {
      const next = new Set(s);
      for (const p of g.permissions) {
        if (on) {
          next.add(p.code);
        } else {
          next.delete(p.code);
        }
      }
      return next;
    });
  }

  selectAll(): void {
    this.selected.set(new Set(this.groups().flatMap((g) => g.permissions.map((p) => p.code))));
  }

  clearAll(): void {
    this.selected.set(new Set<string>());
  }

  discard(): void {
    this.selected.set(new Set(this.original()));
  }

  // ---- saving
  saveDetails(): void {
    const r = this.role();
    if (!r) {
      return;
    }
    if (this.detailsForm.invalid) {
      this.detailsForm.markAllAsTouched();
      return;
    }
    const v = this.detailsForm.getRawValue();
    this.savingDetails.set(true);
    this.svc.updateRole(r.id, { name: v.name.trim(), description: orNull(v.description.trim()), isActive: v.isActive }).subscribe({
      next: (updated) => {
        this.savingDetails.set(false);
        this.role.set(updated);
        this.detailsForm.markAsPristine();
        this.lookups.clear('roles');
        this.toast.success('Role details saved.');
      },
      error: () => this.savingDetails.set(false),
    });
  }

  savePermissions(): void {
    const r = this.role();
    if (!r) {
      return;
    }
    this.savingPerms.set(true);
    this.svc.setRolePermissions(r.id, [...this.selected()]).subscribe({
      next: (updated) => {
        this.savingPerms.set(false);
        const codes = new Set(updated.permissionCodes);
        this.role.set(updated);
        this.selected.set(codes);
        this.original.set(new Set(codes));
        this.toast.success('Permissions saved. Users get the change at their next sign-in.');
      },
      error: () => this.savingPerms.set(false),
    });
  }
}
