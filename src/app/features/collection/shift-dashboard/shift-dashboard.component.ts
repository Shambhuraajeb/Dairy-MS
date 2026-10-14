import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { PermissionService } from '../../../core/services/permission.service';
import { errorMessage } from '../../../core/utils/http-error';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppCurrencyPipe, AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { toIsoDate } from '../../../shared/utils/format';
import { isoDay, resolveShiftId, shiftLabel, shiftsForCenter, toNumberOrNull, trimTime } from '../collection.util';
import { ShiftDashboard, ShiftDto } from '../models/collection.model';
import { CollectionShiftService } from '../services/collection-shift.service';

@Component({
  selector: 'app-shift-dashboard',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, KpiCardComponent, LoadingComponent, HasPermissionDirective, AppNumberPipe, AppCurrencyPipe],
  templateUrl: './shift-dashboard.component.html',
})
export class ShiftDashboardComponent implements OnInit {
  private readonly shiftSvc = inject(CollectionShiftService);
  private readonly lookup = inject(LookupService);
  private readonly perm = inject(PermissionService);

  // initial filters from the query string
  readonly date = input<string>();
  readonly from = input<string>();
  readonly center = input<string>();
  readonly centerId = input<string>();
  readonly shift = input<string>();

  protected readonly centers = toSignal(this.lookup.collectionCenters(), { initialValue: [] as LookupItem[] });
  protected readonly shifts = signal<ShiftDto[]>([]);
  protected readonly selDate = signal(toIsoDate());
  protected readonly selCenter = signal<number | null>(null);
  protected readonly selShift = signal<number | null>(null);

  protected readonly data = signal<ShiftDashboard | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly shiftOptions = computed(() => shiftsForCenter(this.shifts(), this.selCenter()));
  protected readonly summary = computed(() => this.data()?.summary ?? null);

  protected readonly shiftLabel = shiftLabel;
  protected readonly trimTime = trimTime;

  /** query params for drill-down links (stable object so the KPI cards do not re-render) */
  protected readonly dayParams = computed(() => {
    const d = this.data();
    const params: Record<string, string | number> = { from: this.selDate(), to: this.selDate() };
    if (this.selCenter()) {
      params['center'] = this.selCenter() as number;
    }
    const sid = d?.shiftId ?? this.selShift();
    if (sid) {
      params['shift'] = sid;
    }
    return params;
  });
  protected readonly entryParams = computed(() => {
    const params: Record<string, string | number> = {};
    if (this.selCenter()) {
      params['center'] = this.selCenter() as number;
    }
    const sid = this.data()?.shiftId ?? this.selShift();
    if (sid) {
      params['shift'] = sid;
    }
    return params;
  });
  protected readonly approvalLink = computed(() => (this.perm.hasAny('collection.approve', 'collection.reject') ? '/collection/approval' : null));
  protected readonly acceptedLabel = computed(() => {
    const s = this.summary();
    return s ? `${s.acceptedLiters} L accepted` : '';
  });

  ngOnInit(): void {
    const d = this.date() ?? this.from();
    if (d) {
      this.selDate.set(isoDay(d));
    }
    const c = toNumberOrNull(this.center() ?? this.centerId());
    if (c) {
      this.selCenter.set(c);
    }
    this.shiftSvc
      .list()
      .pipe(catchError(() => of([] as ShiftDto[])))
      .subscribe((list) => {
        this.shifts.set(list);
        const sid = resolveShiftId(list, this.shift(), this.selCenter());
        if (sid) {
          this.selShift.set(sid);
        }
        this.load();
      });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.shiftSvc.dashboard({ date: this.selDate(), centerId: this.selCenter(), shiftId: this.selShift() }).subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected onDate(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.selDate.set(v || toIsoDate());
    this.load();
  }

  protected onCenter(event: Event): void {
    this.selCenter.set(toNumberOrNull((event.target as HTMLSelectElement).value));
    const sel = this.selShift();
    if (sel !== null && !this.shiftOptions().some((s) => s.id === sel)) {
      this.selShift.set(null);
    }
    this.load();
  }

  protected onShift(event: Event): void {
    this.selShift.set(toNumberOrNull((event.target as HTMLSelectElement).value));
    this.load();
  }

  protected pickRow(shiftId: number, centerId: number | null): void {
    if (centerId) {
      this.selCenter.set(centerId);
    }
    this.selShift.set(shiftId);
    this.load();
  }

  protected today(): void {
    this.selDate.set(toIsoDate());
    this.load();
  }
}
