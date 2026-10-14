import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { toIsoDate } from '../../../shared/utils/format';
import { positiveNumberValidator } from '../../../shared/validators/app-validators';
import { FarmerAdvance, nullIfEmpty, numOrNull } from '../farmer.model';
import { FarmerService } from '../farmer.service';

@Component({
  selector: 'app-advance-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, FormFieldComponent, ModalComponent, HasPermissionDirective, ...DATA_TABLE_IMPORTS],
  template: `
    <app-data-table
      [columns]="columns"
      [items]="items()"
      [total]="total()"
      [loading]="loading()"
      [error]="error()"
      [page]="query.page ?? 1"
      [pageSize]="query.pageSize ?? 20"
      searchPlaceholder="Search advance no. or farmer..."
      emptyTitle="No advances found"
      (queryChange)="onQuery($event)"
      (retry)="load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2">
        <select class="form-select form-select-sm w-auto" formControlName="farmerId" aria-label="Farmer">
          <option value="">All farmers</option>
          @for (f of allFarmers(); track f.id) {
            <option [value]="f.id">{{ f.code }} - {{ f.name }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">All statuses</option>
          <option value="Open">Open</option>
          <option value="Recovered">Recovered</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>
      <div tableActions>
        <button *appHasPermission="'loan.create'" type="button" class="btn btn-sm btn-primary" (click)="openCreate()">
          <i class="bi bi-plus-lg me-1"></i>New Advance
        </button>
      </div>
      <ng-template appColumn="farmerName" let-row>
        <a [routerLink]="['/farmers', row.farmerId]" class="text-decoration-none">{{ row.farmerName }}</a>
        <div class="small text-muted">{{ row.farmerCode }}</div>
      </ng-template>
    </app-data-table>

    <app-modal [open]="modalOpen()" title="New farmer advance" size="lg" (closed)="closeModal()">
      <form id="advanceForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-form-field label="Farmer" inputId="adFarmer" [control]="form.controls.farmerId" hint="Only active farmers can receive advances">
          <select id="adFarmer" class="form-select" formControlName="farmerId">
            <option value="">Select farmer</option>
            @for (f of activeFarmers(); track f.id) {
              <option [value]="f.id">{{ f.code }} - {{ f.name }}</option>
            }
          </select>
        </app-form-field>
        <div class="row">
          <div class="col-md-6">
            <app-form-field label="Amount (INR)" inputId="adAmount" [control]="form.controls.amount">
              <input id="adAmount" type="number" min="0" step="0.01" class="form-control" formControlName="amount" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Advance date" inputId="adDate" [control]="form.controls.advanceDate">
              <input id="adDate" type="date" class="form-control" formControlName="advanceDate" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Recovery per settlement (INR)" inputId="adRecovery" [control]="form.controls.recoveryPerSettlement" hint="Deducted from each settlement until recovered">
              <input id="adRecovery" type="number" min="0" step="0.01" class="form-control" formControlName="recoveryPerSettlement" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Payment mode" inputId="adMode" [control]="form.controls.paymentModeId">
              <select id="adMode" class="form-select" formControlName="paymentModeId">
                <option value="">Select</option>
                @for (m of paymentModes(); track m.id) {
                  <option [value]="m.id">{{ m.name }}</option>
                }
              </select>
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Reference no." inputId="adRef" [control]="form.controls.referenceNo">
              <input id="adRef" class="form-control" formControlName="referenceNo" maxlength="100" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Purpose" inputId="adPurpose" [control]="form.controls.purpose">
              <input id="adPurpose" class="form-control" formControlName="purpose" maxlength="200" />
            </app-form-field>
          </div>
        </div>
        <app-form-field label="Remarks" inputId="adRemarks" [control]="form.controls.remarks">
          <textarea id="adRemarks" class="form-control" rows="2" formControlName="remarks" maxlength="300"></textarea>
        </app-form-field>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeModal()">Cancel</button>
        <button type="submit" form="advanceForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Create advance
        </button>
      </div>
    </app-modal>
  `,
})
export class AdvanceListComponent {
  private readonly svc = inject(FarmerService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly allFarmers = toSignal(this.lookups.get('farmers'), { initialValue: [] as LookupItem[] });
  readonly activeFarmers = toSignal(this.lookups.get('farmers', { status: 'Active' }), { initialValue: [] as LookupItem[] });
  readonly paymentModes = toSignal(this.lookups.get('payment-modes'), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'advanceNumber', label: 'Advance no.', sortable: true },
    { key: 'farmerName', label: 'Farmer', sortable: true },
    { key: 'advanceDate', label: 'Date', type: 'date', sortable: true },
    { key: 'amount', label: 'Amount', type: 'currency', sortable: true },
    { key: 'recoveredAmount', label: 'Recovered', type: 'currency' },
    { key: 'balanceAmount', label: 'Balance', type: 'currency', sortable: true },
    { key: 'recoveryPerSettlement', label: 'Recovery / settlement', type: 'currency' },
    { key: 'purpose', label: 'Purpose' },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
  ];

  readonly filters = this.fb.group({ farmerId: [''], status: [''] });
  readonly items = signal<FarmerAdvance[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  query: PagedQuery = { page: 1, pageSize: 20 };

  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly form = this.fb.group({
    farmerId: ['', Validators.required],
    amount: [null as number | null, [Validators.required, positiveNumberValidator()]],
    advanceDate: [toIsoDate(), Validators.required],
    recoveryPerSettlement: [null as number | null, Validators.min(0)],
    paymentModeId: [''],
    referenceNo: [''],
    purpose: [''],
    remarks: [''],
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.filters.patchValue({ farmerId: p.get('farmerId') ?? '', status: p.get('status') ?? '' }, { emitEvent: false });
      this.query = { ...this.query, page: 1 };
      this.load();
    });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.query = { ...this.query, page: 1 };
      this.load();
    });
  }

  onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.advances({ ...this.query, ...this.filters.getRawValue() }).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.form.reset({ farmerId: this.filters.controls.farmerId.value, advanceDate: toIsoDate() });
    this.modalOpen.set(true);
  }

  closeModal(): void {
    if (!this.saving()) {
      this.modalOpen.set(false);
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.svc
      .createAdvance({
        farmerId: Number(v.farmerId),
        advanceDate: nullIfEmpty(v.advanceDate),
        amount: Number(v.amount),
        recoveryPerSettlement: numOrNull(v.recoveryPerSettlement),
        purpose: nullIfEmpty(v.purpose),
        paymentModeId: numOrNull(v.paymentModeId),
        referenceNo: nullIfEmpty(v.referenceNo),
        remarks: nullIfEmpty(v.remarks),
      })
      .subscribe({
        next: (a) => {
          this.saving.set(false);
          this.modalOpen.set(false);
          this.toast.success(`Advance ${a.advanceNumber} created.`);
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }
}
