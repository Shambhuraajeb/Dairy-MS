import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LookupItem, PagedQuery } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { FarmerListItem } from '../farmer.model';
import { FarmerService } from '../farmer.service';

@Component({
  selector: 'app-farmer-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, HasPermissionDirective, ...DATA_TABLE_IMPORTS],
  template: `
    <app-page-header title="Farmers" subtitle="Register, verify and manage milk suppliers">
      <a *appHasPermission="'loan.view'" routerLink="/farmers/loans" class="btn btn-outline-secondary">
        <i class="bi bi-wallet2 me-1"></i>Advances &amp; Loans
      </a>
      <a *appHasPermission="'farmer.create'" routerLink="/farmers/new" class="btn btn-primary">
        <i class="bi bi-plus-lg me-1"></i>New Farmer
      </a>
    </app-page-header>

    <app-data-table
      [columns]="columns"
      [items]="items()"
      [total]="total()"
      [loading]="loading()"
      [error]="error()"
      [page]="query.page ?? 1"
      [pageSize]="query.pageSize ?? 20"
      searchPlaceholder="Search code, name or mobile..."
      emptyTitle="No farmers found"
      (queryChange)="onQuery($event)"
      (retry)="load()"
    >
      <div tableFilters [formGroup]="filters" class="d-flex flex-wrap gap-2">
        <select class="form-select form-select-sm w-auto" formControlName="status" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="verificationStatus" aria-label="Verification">
          <option value="">All verification</option>
          @for (s of verifications; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="collectionCenterId" aria-label="Collection center">
          <option value="">All centers</option>
          @for (c of centers(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select>
        <select class="form-select form-select-sm w-auto" formControlName="milkType" aria-label="Milk type">
          <option value="">All milk types</option>
          @for (m of milkTypes; track m) {
            <option [value]="m">{{ m }}</option>
          }
        </select>
      </div>

      <ng-template appColumn="fullName" let-row>
        <a [routerLink]="['/farmers', row.id]" class="fw-semibold text-decoration-none">{{ row.fullName }}</a>
        @if (row.fatherName) {
          <div class="small text-muted">S/o {{ row.fatherName }}</div>
        }
      </ng-template>
      <ng-template appRowActions let-row>
        <a [routerLink]="['/farmers', row.id]" class="btn btn-sm btn-outline-primary me-1"><i class="bi bi-eye"></i> View</a>
        <a *appHasPermission="'farmer.update'" [routerLink]="['/farmers', row.id, 'edit']" class="btn btn-sm btn-outline-secondary">
          <i class="bi bi-pencil"></i> Edit
        </a>
      </ng-template>
    </app-data-table>
  `,
})
export class FarmerListComponent {
  private readonly svc = inject(FarmerService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly statuses = ['Pending', 'Active', 'Inactive', 'Blocked'];
  readonly verifications = ['Pending', 'Verified', 'Rejected'];
  readonly milkTypes = ['Cow', 'Buffalo', 'Mixed'];
  readonly centers = toSignal(this.lookups.get('collection-centers'), { initialValue: [] as LookupItem[] });

  readonly columns: TableColumn[] = [
    { key: 'farmerCode', label: 'Code', sortable: true, width: '120px' },
    { key: 'fullName', label: 'Farmer', sortable: true },
    { key: 'mobile', label: 'Mobile', sortable: true },
    { key: 'milkType', label: 'Milk', sortable: true, width: '100px' },
    { key: 'collectionCenterName', label: 'Center', sortable: true },
    { key: 'animalCount', label: 'Animals', type: 'number', width: '90px' },
    { key: 'verificationStatus', label: 'Verification', type: 'badge', sortable: true },
    { key: 'status', label: 'Status', type: 'badge', sortable: true },
  ];

  readonly filters = this.fb.group({ status: [''], verificationStatus: [''], collectionCenterId: [''], milkType: [''] });

  readonly items = signal<FarmerListItem[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  query: PagedQuery = { page: 1, pageSize: 20 };

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.filters.patchValue(
        {
          status: p.get('status') ?? '',
          verificationStatus: p.get('verificationStatus') ?? '',
          collectionCenterId: p.get('collectionCenterId') ?? '',
          milkType: p.get('milkType') ?? '',
        },
        { emitEvent: false },
      );
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
    this.svc.list({ ...this.query, ...this.filters.getRawValue() }).subscribe({
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
}
