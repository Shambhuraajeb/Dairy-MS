import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { PagedList, qp } from '../../../shared/utils/paged-list';
import { Consumption } from '../inventory.model';
import { InventoryService } from '../inventory.service';
import { ConsumptionModalComponent } from './consumption-modal.component';

@Component({
  selector: 'app-consumption-list',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, HasPermissionDirective, AppNumberPipe, ConsumptionModalComponent, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Consumption" subtitle="Stock used in the dairy (feed, medicines, packaging...)">
      <button *appHasPermission="'inventory.create'" type="button" class="btn btn-primary" (click)="modalOpen.set(true)">
        <i class="bi bi-plus-lg me-1"></i>Record Consumption
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
      searchPlaceholder="Search item, batch or purpose..."
      emptyTitle="No consumption recorded"
      (queryChange)="list.onQuery($event)"
      (retry)="list.load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2 align-items-center">
        <select class="form-select form-select-sm w-auto" formControlName="itemId" aria-label="Item">
          <option value="">All items</option>
          @for (i of items(); track i.id) {
            <option [value]="i.id">{{ i.name }}</option>
          }
        </select>
        <input type="date" class="form-control form-control-sm w-auto" formControlName="from" aria-label="From date" />
        <input type="date" class="form-control form-control-sm w-auto" formControlName="to" aria-label="To date" />
        <div class="form-check form-check-inline mb-0">
          <input id="overrideOnly" type="checkbox" class="form-check-input" formControlName="expiredOverride" />
          <label class="form-check-label small" for="overrideOnly">Expired overrides only</label>
        </div>
      </div>

      <ng-template appColumn="itemName" let-row>
        <div class="fw-semibold">{{ row.itemName }}</div>
        <div class="small text-muted">{{ row.itemCode }}</div>
      </ng-template>
      <ng-template appColumn="quantity" let-row>
        {{ row.quantity | appNumber: 3 }} <span class="text-muted small">{{ row.unitName }}</span>
      </ng-template>
      <ng-template appColumn="purpose" let-row>
        {{ row.purpose ?? '—' }}
        @if (row.expiredOverride) {
          <span class="badge badge-soft badge-soft-danger ms-1" [attr.title]="row.overrideReason">Expired override</span>
        }
      </ng-template>
    </app-data-table>

    <app-consumption-modal [open]="modalOpen()" (closed)="modalOpen.set(false)" (saved)="onSaved()" />
  `,
})
export class ConsumptionListComponent {
  private readonly svc = inject(InventoryService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly items = toSignal(this.lookups.items(), { initialValue: [] as LookupItem[] });
  readonly modalOpen = signal(false);

  readonly columns: TableColumn[] = [
    { key: 'consumptionDate', label: 'Date', type: 'date', sortable: true },
    { key: 'itemName', label: 'Item', sortable: true },
    { key: 'batchNumber', label: 'Batch' },
    { key: 'quantity', label: 'Quantity', type: 'template', sortable: true, align: 'end' },
    { key: 'costValue', label: 'Cost', type: 'currency' },
    { key: 'purpose', label: 'Purpose', type: 'template' },
    { key: 'consumedByName', label: 'By' },
  ];

  readonly filters = this.fb.group({ itemId: [''], from: [''], to: [''], expiredOverride: [false] });
  readonly list = new PagedList<Consumption>(
    (q) => this.svc.consumption(q),
    () => {
      const f = this.filters.getRawValue();
      return {
        itemId: f.itemId || undefined,
        from: f.from || undefined,
        to: f.to || undefined,
        expiredOverride: f.expiredOverride ? true : undefined,
      };
    },
  );

  constructor() {
    const p = this.route.snapshot.queryParamMap;
    this.filters.patchValue({
      itemId: qp(p, 'itemId'),
      from: qp(p, 'from'),
      to: qp(p, 'to'),
      expiredOverride: p.get('expiredOverride') === 'true',
    });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.refilter());
    this.list.load();
  }

  onSaved(): void {
    this.modalOpen.set(false);
    this.list.load();
  }
}
