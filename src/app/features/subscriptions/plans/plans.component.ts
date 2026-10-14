import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppCurrencyPipe } from '../../../shared/pipes/app-pipes';
import { PagedList, orNull } from '../../../shared/utils/paged-list';
import { BILLING_CYCLES, FREQUENCIES, PlanRequest, SubscriptionPlan, WEEK_DAYS } from '../subscription.model';
import { SubscriptionService } from '../subscription.service';

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    ModalComponent,
    FormFieldComponent,
    HasPermissionDirective,
    AppCurrencyPipe,
    ...DATA_TABLE_IMPORTS,
  ],
  template: `
    <app-page-header title="Subscription Plans" subtitle="Delivery frequency, quantity and pricing templates">
      <a routerLink="/subscriptions" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>Subscriptions</a>
      <button *appHasPermission="'subscription.create'" type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="bi bi-plus-lg me-1"></i>Add Plan
      </button>
    </app-page-header>

    <app-data-table
      [columns]="columns"
      [items]="list.items()"
      [total]="list.total()"
      [loading]="list.loading()"
      [error]="list.error()"
      [page]="list.query.page ?? 1"
      [pageSize]="list.query.pageSize ?? 20"
      searchPlaceholder="Search code or name..."
      emptyTitle="No plans found"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2">
        <select class="form-select form-select-sm w-auto" formControlName="frequency" aria-label="Frequency">
          <option value="">All frequencies</option>
          @for (f of frequencies; track f) {
            <option [value]="f">{{ f }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="isActive" aria-label="Status">
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <ng-template appColumn="frequency" let-row>
        {{ row.frequency }}
        @if (row.daysOfWeek) {
          <div class="small text-muted">{{ row.daysOfWeek }}</div>
        }
      </ng-template>
      <ng-template appColumn="pricePerUnit" let-row>
        @if (row.pricePerUnit !== null && row.pricePerUnit !== undefined) {
          {{ row.pricePerUnit | appCurrency }}
        } @else {
          <span class="text-muted">Price list</span>
        }
      </ng-template>
      <ng-template appRowActions let-row>
        <button *appHasPermission="'subscription.update'" type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="openEdit(row)">
          <i class="bi bi-pencil"></i> Edit
        </button>
        <button *appHasPermission="'subscription.update'" type="button" class="btn btn-sm btn-outline-danger" (click)="remove(row)">
          <i class="bi bi-trash"></i>
        </button>
      </ng-template>
    </app-data-table>

    <app-modal [open]="modalOpen()" [title]="editing() ? 'Edit plan' : 'Add plan'" size="lg" (closed)="closeModal()">
      <form id="planForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row">
          @if (!editing()) {
            <div class="col-md-4">
              <app-form-field label="Plan code" inputId="plCode" [control]="form.controls.planCode" hint="Blank = auto (PLN0001...)">
                <input id="plCode" class="form-control" formControlName="planCode" maxlength="20" autocomplete="off" />
              </app-form-field>
            </div>
          }
          <div [class]="editing() ? 'col-md-12' : 'col-md-8'">
            <app-form-field label="Name" inputId="plName" [control]="form.controls.name">
              <input id="plName" class="form-control" formControlName="name" maxlength="150" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-12">
            <app-form-field label="Description" inputId="plDesc" [control]="form.controls.description">
              <input id="plDesc" class="form-control" formControlName="description" maxlength="255" autocomplete="off" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Frequency" inputId="plFreq" [control]="form.controls.frequency">
              <select id="plFreq" class="form-select" formControlName="frequency">
                @for (f of frequencies; track f) {
                  <option [value]="f">{{ f }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-8">
            @if (form.controls.frequency.value === 'Weekly') {
              <div class="mb-3">
                <label class="form-label">Delivery days <span class="text-danger">*</span></label>
                <div class="d-flex flex-wrap gap-2">
                  @for (d of weekDays; track d) {
                    <button
                      type="button"
                      class="btn btn-sm"
                      [class.btn-primary]="days().includes(d)"
                      [class.btn-outline-secondary]="!days().includes(d)"
                      (click)="toggleDay(d)"
                    >
                      {{ d }}
                    </button>
                  }
                </div>
                @if (daysInvalid()) {
                  <div class="invalid-feedback d-block">Select at least one day.</div>
                }
              </div>
            }
          </div>
          <div class="col-md-6">
            <app-form-field label="Product" inputId="plProduct" [control]="form.controls.productId" hint="Optional - subscribers can choose a product when the plan has none">
              <select id="plProduct" class="form-select" formControlName="productId">
                <option [ngValue]="null">-- any product --</option>
                @for (p of products(); track p.id) {
                  <option [ngValue]="p.id">{{ p.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-3">
            <app-form-field label="Default quantity" inputId="plQty" [control]="form.controls.defaultQuantity">
              <input id="plQty" type="number" min="0" step="0.5" class="form-control" formControlName="defaultQuantity" />
            </app-form-field>
          </div>
          <div class="col-md-3">
            <app-form-field label="Price / unit" inputId="plPrice" [control]="form.controls.pricePerUnit" hint="Blank = price list">
              <input id="plPrice" type="number" min="0" step="0.01" class="form-control" formControlName="pricePerUnit" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Discount %" inputId="plDisc" [control]="form.controls.discountPercent">
              <input id="plDisc" type="number" min="0" max="100" step="0.01" class="form-control" formControlName="discountPercent" />
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Billing cycle" inputId="plCycle" [control]="form.controls.billingCycle">
              <select id="plCycle" class="form-select" formControlName="billingCycle">
                @for (c of billingCycles; track c) {
                  <option [value]="c">{{ c }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-4">
            <app-form-field label="Minimum days" inputId="plMin" [control]="form.controls.minimumDays">
              <input id="plMin" type="number" min="0" step="1" class="form-control" formControlName="minimumDays" />
            </app-form-field>
          </div>
          @if (editing()) {
            <div class="col-12">
              <div class="form-check form-switch">
                <input id="plActive" type="checkbox" class="form-check-input" formControlName="isActive" />
                <label class="form-check-label" for="plActive">Active</label>
              </div>
            </div>
          }
        </div>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeModal()">Cancel</button>
        <button type="submit" form="planForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class PlansComponent {
  private readonly svc = inject(SubscriptionService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly frequencies = FREQUENCIES;
  readonly billingCycles = BILLING_CYCLES;
  readonly weekDays = WEEK_DAYS;
  readonly products = toSignal(this.lookups.products(), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'planCode', label: 'Code', sortable: true, width: '110px' },
    { key: 'name', label: 'Plan', sortable: true },
    { key: 'productName', label: 'Product' },
    { key: 'frequency', label: 'Frequency', sortable: true },
    { key: 'defaultQuantity', label: 'Qty', type: 'number', sortable: true, width: '80px' },
    { key: 'pricePerUnit', label: 'Price / unit' },
    { key: 'discountPercent', label: 'Disc %', type: 'number', width: '80px' },
    { key: 'billingCycle', label: 'Billing' },
    { key: 'activeSubscriptions', label: 'Subscribers', type: 'number', width: '110px' },
    { key: 'isActive', label: 'Status', type: 'badge', sortable: true },
  ];

  readonly filters = this.fb.group({ frequency: [''], isActive: [''] });
  readonly list = new PagedList<SubscriptionPlan>(
    (q) => this.svc.listPlans(q),
    () => ({ ...this.filters.getRawValue() }),
  );

  readonly modalOpen = signal(false);
  readonly editing = signal<SubscriptionPlan | null>(null);
  readonly saving = signal(false);
  readonly days = signal<string[]>([]);
  readonly daysInvalid = signal(false);

  readonly form = this.fb.group({
    planCode: ['', Validators.maxLength(20)],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', Validators.maxLength(255)],
    frequency: ['Daily', Validators.required],
    productId: this.fb.control<number | null>(null),
    defaultQuantity: [1, [Validators.required, Validators.min(0.001)]],
    pricePerUnit: this.fb.control<number | null>(null, Validators.min(0)),
    discountPercent: [0, [Validators.min(0), Validators.max(100)]],
    billingCycle: ['Monthly', Validators.required],
    minimumDays: [0, Validators.min(0)],
    isActive: [true],
  });

  constructor() {
    this.list.load();
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
  }

  toggleDay(day: string): void {
    this.days.update((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day]));
    this.daysInvalid.set(false);
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset();
    this.days.set([]);
    this.daysInvalid.set(false);
    this.modalOpen.set(true);
  }

  openEdit(p: SubscriptionPlan): void {
    this.editing.set(p);
    this.form.reset({
      planCode: p.planCode,
      name: p.name,
      description: p.description ?? '',
      frequency: p.frequency,
      productId: p.productId,
      defaultQuantity: p.defaultQuantity,
      pricePerUnit: p.pricePerUnit,
      discountPercent: p.discountPercent,
      billingCycle: p.billingCycle,
      minimumDays: p.minimumDays,
      isActive: p.isActive,
    });
    this.days.set(p.daysOfWeek ? p.daysOfWeek.split(',').map((d) => d.trim()).filter((d) => !!d) : []);
    this.daysInvalid.set(false);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    if (!this.saving()) {
      this.modalOpen.set(false);
    }
  }

  save(): void {
    const v = this.form.getRawValue();
    const weekly = v.frequency === 'Weekly';
    if (this.form.invalid || (weekly && this.days().length === 0)) {
      this.form.markAllAsTouched();
      this.daysInvalid.set(weekly && this.days().length === 0);
      return;
    }
    const orderedDays = WEEK_DAYS.filter((d) => this.days().includes(d)).join(',');
    const current = this.editing();
    const body: PlanRequest = {
      name: v.name.trim(),
      description: orNull(v.description.trim()),
      frequency: v.frequency,
      daysOfWeek: weekly ? orderedDays : null,
      productId: v.productId,
      defaultQuantity: Number(v.defaultQuantity),
      pricePerUnit: v.pricePerUnit === null || (v.pricePerUnit as unknown) === '' ? null : Number(v.pricePerUnit),
      discountPercent: Number(v.discountPercent) || 0,
      billingCycle: v.billingCycle,
      minimumDays: Number(v.minimumDays) || 0,
    };
    this.saving.set(true);
    const request$ = current
      ? this.svc.updatePlan(current.id, { ...body, isActive: v.isActive })
      : this.svc.createPlan({ ...body, planCode: orNull(v.planCode.trim()) });
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.toast.success(current ? 'Plan updated.' : 'Plan created.');
        this.list.load();
      },
      error: () => this.saving.set(false),
    });
  }

  async remove(p: SubscriptionPlan): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Deactivate plan',
      message: `Deactivate plan "${p.name}"? Plans with active subscriptions cannot be deactivated.`,
      confirmText: 'Deactivate',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc.deletePlan(p.id).subscribe(() => {
      this.toast.success('Plan deactivated.');
      this.list.load();
    });
  }
}
