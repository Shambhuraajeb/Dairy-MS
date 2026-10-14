import { Component, OnInit, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppCurrencyPipe, AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { toIsoDate } from '../../../shared/utils/format';
import { isoDay, monthStart, toNumberOrNull } from '../collection.util';
import { PaymentsListComponent } from '../components/payments-list.component';
import { SearchSelectComponent } from '../components/search-select.component';
import { SettlementCreateFormComponent } from '../components/settlement-create-form.component';
import { SettlementPreviewComponent } from '../components/settlement-preview.component';
import { CreateSettlementResult, PendingFarmer, SettlementPreview } from '../models/settlement.model';
import { FarmerSettlementService } from '../services/farmer-settlement.service';

@Component({
  selector: 'app-settlement',
  standalone: true,
  imports: [
    RouterLink,
    PageHeaderComponent,
    LoadingComponent,
    HasPermissionDirective,
    SearchSelectComponent,
    SettlementPreviewComponent,
    SettlementCreateFormComponent,
    PaymentsListComponent,
    AppCurrencyPipe,
    AppNumberPipe,
  ],
  templateUrl: './settlement.component.html',
})
export class SettlementComponent implements OnInit {
  private readonly svc = inject(FarmerSettlementService);
  private readonly lookup = inject(LookupService);
  private readonly toast = inject(ToastService);

  // initial values from the query string
  readonly farmerId = input<string>();
  readonly farmer = input<string>();
  readonly from = input<string>();
  readonly to = input<string>();
  readonly center = input<string>();
  readonly centerId = input<string>();

  protected readonly centers = toSignal(this.lookup.collectionCenters(), { initialValue: [] as LookupItem[] });
  protected readonly farmers = toSignal(this.lookup.farmers(), { initialValue: [] as LookupItem[] });

  protected readonly periodFrom = signal(toIsoDate(monthStart()));
  protected readonly periodTo = signal(toIsoDate());
  protected readonly centerFilter = signal<number | null>(null);
  protected readonly search = signal('');

  protected readonly pending = signal<PendingFarmer[]>([]);
  protected readonly pendingLoading = signal(false);
  protected readonly pendingError = signal<string | null>(null);

  protected readonly pickerFarmer = signal<number | null>(null);
  protected readonly selectedFarmerId = signal<number | null>(null);
  protected readonly preview = signal<SettlementPreview | null>(null);
  protected readonly previewLoading = signal(false);
  protected readonly previewError = signal<string | null>(null);

  private readonly paymentsList = viewChild(PaymentsListComponent);
  private readonly search$ = new Subject<string>();

  constructor() {
    this.search$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed()).subscribe((v) => {
      this.search.set(v);
      this.loadPending();
    });
  }

  ngOnInit(): void {
    if (this.from()) {
      this.periodFrom.set(isoDay(this.from()));
    }
    if (this.to()) {
      this.periodTo.set(isoDay(this.to()));
    }
    this.centerFilter.set(toNumberOrNull(this.center() ?? this.centerId()));
    this.loadPending();
    const f = toNumberOrNull(this.farmerId() ?? this.farmer());
    if (f) {
      this.pickerFarmer.set(f);
      this.selectFarmer(f);
    }
  }

  private periodValid(): boolean {
    if (!this.periodFrom() || !this.periodTo()) {
      this.toast.warning('Select both period dates.');
      return false;
    }
    if (this.periodTo() < this.periodFrom()) {
      this.toast.warning('The period end cannot be before its start.');
      return false;
    }
    return true;
  }

  protected onFrom(event: Event): void {
    this.periodFrom.set((event.target as HTMLInputElement).value);
    this.periodChanged();
  }

  protected onTo(event: Event): void {
    this.periodTo.set((event.target as HTMLInputElement).value);
    this.periodChanged();
  }

  protected onCenter(event: Event): void {
    this.centerFilter.set(toNumberOrNull((event.target as HTMLSelectElement).value));
    this.loadPending();
  }

  protected onSearch(event: Event): void {
    this.search$.next((event.target as HTMLInputElement).value.trim());
  }

  private periodChanged(): void {
    if (!this.periodValid()) {
      return;
    }
    this.loadPending();
    if (this.selectedFarmerId() !== null) {
      this.loadPreview();
    }
  }

  protected loadPending(): void {
    if (!this.periodFrom() || !this.periodTo() || this.periodTo() < this.periodFrom()) {
      this.pending.set([]);
      return;
    }
    this.pendingLoading.set(true);
    this.pendingError.set(null);
    this.svc
      .pendingFarmers({ from: this.periodFrom(), to: this.periodTo(), centerId: this.centerFilter(), search: this.search() })
      .subscribe({
        next: (rows) => {
          this.pending.set(rows);
          this.pendingLoading.set(false);
        },
        error: (err) => {
          this.pendingError.set(errorMessage(err));
          this.pendingLoading.set(false);
        },
      });
  }

  protected selectFarmer(id: number | null): void {
    if (id === null) {
      this.toast.warning('Select a farmer first.');
      return;
    }
    if (!this.periodValid()) {
      return;
    }
    this.pickerFarmer.set(id);
    this.selectedFarmerId.set(id);
    this.loadPreview();
  }

  protected loadPreview(): void {
    const id = this.selectedFarmerId();
    if (id === null) {
      return;
    }
    this.previewLoading.set(true);
    this.previewError.set(null);
    this.svc.preview(id, this.periodFrom(), this.periodTo()).subscribe({
      next: (p) => {
        this.preview.set(p);
        this.previewLoading.set(false);
      },
      error: (err) => {
        this.preview.set(null);
        this.previewError.set(errorMessage(err));
        this.previewLoading.set(false);
      },
    });
  }

  protected onCreated(_res: CreateSettlementResult): void {
    this.preview.set(null);
    this.selectedFarmerId.set(null);
    this.pickerFarmer.set(null);
    this.loadPending();
    const list = this.paymentsList();
    list?.setStatus('Draft');
  }

  protected closePreview(): void {
    this.preview.set(null);
    this.selectedFarmerId.set(null);
    this.previewError.set(null);
  }
}
