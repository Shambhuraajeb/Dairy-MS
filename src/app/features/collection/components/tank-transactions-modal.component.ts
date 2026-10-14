import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { PagedQuery } from '../../../core/models/api.model';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { optText } from '../collection.util';
import { Tank, TankTxn } from '../models/tank.model';
import { MilkTankService } from '../services/milk-tank.service';

function quantityRule(group: AbstractControl): ValidationErrors | null {
  const type = group.get('transactionType')?.value as string | undefined;
  const qty = group.get('quantity')?.value as number | null | undefined;
  if (qty === null || qty === undefined) {
    return null;
  }
  if (type === 'Out' && qty <= 0) {
    return { qty: 'Quantity taken out must be greater than zero.' };
  }
  if (type === 'Adjust' && qty === 0) {
    return { qty: 'An adjustment cannot be zero (use a negative value to reduce).' };
  }
  return null;
}

/** Tank movement history plus recording a dispatch (Out) or a manual correction (Adjust). */
@Component({
  selector: 'app-tank-transactions-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, HasPermissionDirective, AppNumberPipe, ...DATA_TABLE_IMPORTS],
  template: `
    <app-modal [open]="tank() !== null" [title]="'Tank: ' + (tank()?.name ?? '')" size="xl" (closed)="closed.emit()">
      @if (tank(); as t) {
        <div class="d-flex flex-wrap gap-4 mb-3">
          <div><div class="text-muted small">Center</div><div>{{ t.collectionCenterName }}</div></div>
          <div><div class="text-muted small">Capacity</div><div>{{ t.capacityLiters | appNumber: 3 }} L</div></div>
          <div>
            <div class="text-muted small">Current quantity</div>
            <div class="fw-semibold">{{ (balance() ?? t.currentQuantity) | appNumber: 3 }} L</div>
          </div>
        </div>
        <form *appHasPermission="'collection.update'" [formGroup]="form" (ngSubmit)="record()" class="row g-2 align-items-start mb-3" novalidate>
          <div class="col-md-2">
            <select class="form-select" formControlName="transactionType" aria-label="Type">
              <option value="Out">Take out (dispatch)</option>
              <option value="Adjust">Adjust (+/-)</option>
            </select>
          </div>
          <div class="col-md-2">
            <input type="number" step="0.001" class="form-control" placeholder="Liters" formControlName="quantity" aria-label="Quantity"
              [class.is-invalid]="form.controls.quantity.touched && (form.controls.quantity.invalid || form.errors)" />
          </div>
          <div class="col-md-3"><input type="text" class="form-control" placeholder="Destination" maxlength="150" formControlName="destination" aria-label="Destination" /></div>
          <div class="col-md-3"><input type="text" class="form-control" placeholder="Remarks" maxlength="250" formControlName="remarks" aria-label="Remarks" /></div>
          <div class="col-md-2">
            <button type="submit" class="btn btn-primary w-100" [disabled]="saving()">
              @if (saving()) {
                <span class="spinner-border spinner-border-sm me-1"></span>
              }
              Record
            </button>
          </div>
          @if (form.touched && (form.errors?.['qty'] || form.controls.quantity.errors)) {
            <div class="col-12 text-danger small">{{ form.errors?.['qty'] ?? 'Enter a valid quantity.' }}</div>
          }
        </form>
      }
      <app-data-table
        [columns]="columns"
        [items]="items()"
        [total]="total()"
        [loading]="loading()"
        [error]="error()"
        [page]="query.page ?? 1"
        [pageSize]="query.pageSize ?? 10"
        [searchable]="false"
        [pageSizeOptions]="[10, 20, 50]"
        emptyTitle="No tank movements"
        emptyMessage="Movements appear when milk is collected into this tank or recorded here."
        (queryChange)="onQuery($event)"
        (retry)="load()"
      >
        <div tableFilters>
          <select class="form-select form-select-sm w-auto" aria-label="Type filter" (change)="onType($event)">
            <option value="">All types</option>
            <option value="In">In</option>
            <option value="Out">Out</option>
            <option value="Adjust">Adjust</option>
          </select>
        </div>
      </app-data-table>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closed.emit()">Close</button>
      </div>
    </app-modal>
  `,
})
export class TankTransactionsModalComponent {
  private readonly svc = inject(MilkTankService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly tank = input<Tank | null>(null);
  readonly closed = output<void>();
  /** a movement was recorded; parent should refresh its tank list */
  readonly changed = output<void>();

  protected readonly columns: TableColumn[] = [
    { key: 'transactionDate', label: 'Date', type: 'datetime', sortable: true },
    { key: 'transactionType', label: 'Type', sortable: true },
    { key: 'quantity', label: 'Quantity (L)', type: 'number', sortable: true },
    { key: 'balanceAfter', label: 'Balance (L)', type: 'number', sortable: true },
    { key: 'collectionNumber', label: 'Collection' },
    { key: 'destination', label: 'Destination' },
    { key: 'remarks', label: 'Remarks' },
    { key: 'createdByName', label: 'By' },
  ];

  protected readonly items = signal<TankTxn[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly balance = signal<number | null>(null);
  protected query: PagedQuery = { page: 1, pageSize: 10 };

  protected readonly form = this.fb.group(
    {
      transactionType: ['Out'],
      quantity: this.fb.control<number | null>(null, [Validators.required]),
      destination: ['', Validators.maxLength(150)],
      remarks: ['', Validators.maxLength(250)],
    },
    { validators: [quantityRule] },
  );

  constructor() {
    effect(() => {
      const t = this.tank();
      untracked(() => {
        this.balance.set(null);
        this.query = { page: 1, pageSize: 10 };
        this.items.set([]);
        this.total.set(0);
        this.form.reset({ transactionType: 'Out', quantity: null, destination: '', remarks: '' });
        if (t) {
          this.load();
        }
      });
    });
  }

  protected onQuery(q: PagedQuery): void {
    this.query = { ...this.query, ...q };
    this.load();
  }

  protected onType(event: Event): void {
    const type = (event.target as HTMLSelectElement).value;
    this.query = { ...this.query, type: type || undefined, page: 1 };
    this.load();
  }

  protected load(): void {
    const t = this.tank();
    if (!t) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.svc.transactions(t.id, this.query).subscribe({
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

  protected record(): void {
    const t = this.tank();
    if (!t) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.svc
      .addTransaction(t.id, {
        transactionType: v.transactionType === 'Adjust' ? 'Adjust' : 'Out',
        quantity: Number(v.quantity),
        destination: optText(v.destination),
        remarks: optText(v.remarks),
      })
      .subscribe({
        next: (txn) => {
          this.saving.set(false);
          this.balance.set(txn.balanceAfter);
          this.toast.success('Tank movement recorded.');
          this.form.reset({ transactionType: v.transactionType, quantity: null, destination: '', remarks: '' });
          this.query = { ...this.query, page: 1 };
          this.load();
          this.changed.emit();
        },
        error: () => this.saving.set(false),
      });
  }
}
