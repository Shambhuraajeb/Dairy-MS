import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { FarmerLoanListItem, nullIfEmpty } from '../farmer.model';
import { FarmerService } from '../farmer.service';

@Component({
  selector: 'app-loan-list',
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
      searchPlaceholder="Search loan no. or farmer..."
      emptyTitle="No loans found"
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
          <option value="Active">Active</option>
          <option value="Closed">Closed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>
      <div tableActions>
        <button *appHasPermission="'loan.create'" type="button" class="btn btn-sm btn-primary" (click)="openCreate()">
          <i class="bi bi-plus-lg me-1"></i>New Loan
        </button>
      </div>

      <ng-template appColumn="loanNumber" let-row>
        <a [routerLink]="['/farmers/loans', row.id]" class="fw-semibold text-decoration-none">{{ row.loanNumber }}</a>
      </ng-template>
      <ng-template appColumn="farmerName" let-row>
        <a [routerLink]="['/farmers', row.farmerId]" class="text-decoration-none">{{ row.farmerName }}</a>
        <div class="small text-muted">{{ row.farmerCode }}</div>
      </ng-template>
      <ng-template appColumn="installments" let-row>{{ row.paidInstallments }} / {{ row.numberOfInstallments }}</ng-template>
      <ng-template appRowActions let-row>
        <a [routerLink]="['/farmers/loans', row.id]" class="btn btn-sm btn-outline-primary"><i class="bi bi-list-check"></i> Schedule</a>
      </ng-template>
    </app-data-table>

    <app-modal [open]="modalOpen()" title="New farmer loan" size="lg" (closed)="closeModal()">
      <form id="loanForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-form-field label="Farmer" inputId="lnFarmer" [control]="form.controls.farmerId" hint="Only active farmers can receive loans">
          <select id="lnFarmer" class="form-select" formControlName="farmerId">
            <option value="">Select farmer</option>
            @for (f of activeFarmers(); track f.id) {
              <option [value]="f.id">{{ f.code }} - {{ f.name }}</option>
            }
          </select>
        </app-form-field>
        <div class="row">
          <div class="col-md-6">
            <app-form-field label="Principal amount (INR)" inputId="lnPrincipal" [control]="form.controls.principalAmount">
              <input id="lnPrincipal" type="number" min="0" step="0.01" class="form-control" formControlName="principalAmount" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Interest rate (% per year)" inputId="lnRate" [control]="form.controls.interestRate">
              <input id="lnRate" type="number" min="0" max="100" step="0.01" class="form-control" formControlName="interestRate" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Number of installments" inputId="lnInst" [control]="form.controls.numberOfInstallments" hint="1 to 120" [messages]="{ pattern: 'Enter a whole number.' }">
              <input id="lnInst" type="number" min="1" max="120" step="1" class="form-control" formControlName="numberOfInstallments" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="First installment due on" inputId="lnStart" [control]="form.controls.startDate">
              <input id="lnStart" type="date" class="form-control" formControlName="startDate" />
            </app-form-field>
          </div>
        </div>
        <app-form-field label="Remarks" inputId="lnRemarks" [control]="form.controls.remarks">
          <textarea id="lnRemarks" class="form-control" rows="2" formControlName="remarks" maxlength="300"></textarea>
        </app-form-field>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closeModal()">Cancel</button>
        <button type="submit" form="loanForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Create loan
        </button>
      </div>
    </app-modal>
  `,
})
export class LoanListComponent {
  private readonly svc = inject(FarmerService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly allFarmers = toSignal(this.lookups.get('farmers'), { initialValue: [] as LookupItem[] });
  readonly activeFarmers = toSignal(this.lookups.get('farmers', { status: 'Active' }), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'loanNumber', label: 'Loan no.', sortable: true },
    { key: 'farmerName', label: 'Farmer', sortable: true },
    { key: 'loanDate', label: 'Date', type: 'date', sortable: true },
    { key: 'principalAmount', label: 'Principal', type: 'currency', sortable: true },
    { key: 'interestRate', label: 'Rate %', type: 'number' },
    { key: 'installmentAmount', label: 'EMI', type: 'currency' },
    { key: 'installments', label: 'Paid', type: 'template', align: 'center' },
    { key: 'outstandingAmount', label: 'Outstanding', type: 'currency', sortable: true },
    { key: 'nextDueDate', label: 'Next due', type: 'date' },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
  ];

  readonly filters = this.fb.group({ farmerId: [''], status: [''] });
  readonly items = signal<FarmerLoanListItem[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  query: PagedQuery = { page: 1, pageSize: 20 };

  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly form = this.fb.group({
    farmerId: ['', Validators.required],
    principalAmount: [null as number | null, [Validators.required, positiveNumberValidator()]],
    interestRate: [0 as number | null, [Validators.required, Validators.min(0), Validators.max(100)]],
    numberOfInstallments: [null as number | null, [Validators.required, Validators.min(1), Validators.max(120), Validators.pattern(/^\d+$/)]],
    startDate: [toIsoDate(), Validators.required],
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
    this.svc.loans({ ...this.query, ...this.filters.getRawValue() }).subscribe({
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
    const preset = this.filters.controls.farmerId.value;
    this.form.reset({ farmerId: preset, interestRate: 0, startDate: toIsoDate() });
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
      .createLoan({
        farmerId: Number(v.farmerId),
        principalAmount: Number(v.principalAmount),
        interestRate: Number(v.interestRate),
        numberOfInstallments: Number(v.numberOfInstallments),
        startDate: v.startDate,
        remarks: nullIfEmpty(v.remarks),
      })
      .subscribe({
        next: (loan) => {
          this.saving.set(false);
          this.modalOpen.set(false);
          this.toast.success(`Loan ${loan.loanNumber} created.`);
          void this.router.navigate(['/farmers/loans', loan.id]);
        },
        error: () => this.saving.set(false),
      });
  }
}
