import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { errorMessage } from '../../../core/utils/http-error';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AppCurrencyPipe, AppDatePipe, AppNumberPipe } from '../../../shared/pipes/app-pipes';
import { qualityColor, trimTime } from '../collection.util';
import { CollectionDetail, QualityTest } from '../models/collection.model';
import { MilkCollectionService } from '../services/milk-collection.service';

interface CompareRow {
  label: string;
  original: number | null;
  current: number | null;
  digits: number;
  money: boolean;
}

/** Detail view of one collection: quality tests, rate breakdown, original vs adjusted values, audit trail. */
@Component({
  selector: 'app-collection-detail-modal',
  standalone: true,
  imports: [ModalComponent, StatusBadgeComponent, LoadingComponent, HasPermissionDirective, AppDatePipe, AppNumberPipe, AppCurrencyPipe],
  template: `
    <app-modal [open]="collectionId() !== null" title="Collection details" size="xl" (closed)="closed.emit()">
      @if (loading()) {
        <app-loading text="Loading details..." />
      } @else if (error()) {
        <div class="alert alert-danger mb-0">{{ error() }}</div>
      } @else if (detail(); as d) {
        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
          <h5 class="mb-0">{{ d.collectionNumber }}</h5>
          <app-status-badge [status]="d.status" />
          <app-status-badge [status]="d.settlementStatus" />
          @if (d.qualityResult) {
            <app-status-badge [status]="d.qualityResult" [color]="qualityColor(d.qualityResult)" [label]="'Quality ' + d.qualityResult" />
          }
          @if (d.adjustedFlag) {
            <span class="badge text-bg-info">Adjusted</span>
          }
        </div>

        <div class="row g-3 mb-3">
          <div class="col-md-4"><div class="text-muted small">Farmer</div><div>{{ d.farmerCode }} - {{ d.farmerName }}</div></div>
          <div class="col-md-4"><div class="text-muted small">Date / Shift</div><div>{{ d.collectionDate | appDate }} / {{ d.shiftName }}</div></div>
          <div class="col-md-4"><div class="text-muted small">Collection center</div><div>{{ d.collectionCenterName }}</div></div>
          <div class="col-md-4"><div class="text-muted small">Milk type</div><div>{{ d.milkType }}</div></div>
          <div class="col-md-4"><div class="text-muted small">Temperature</div><div>{{ d.temperature !== null ? (d.temperature | appNumber) + ' °C' : '—' }}</div></div>
          <div class="col-md-4"><div class="text-muted small">Tank</div><div>{{ d.tankName ?? '—' }}</div></div>
        </div>

        <h6 class="section-title">Values{{ hasOriginal(d) ? ': original vs adjusted' : '' }}</h6>
        <div class="table-responsive mb-3">
          <table class="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Field</th>
                @if (hasOriginal(d)) {
                  <th class="text-end">Original</th>
                }
                <th class="text-end">{{ hasOriginal(d) ? 'Adjusted / current' : 'Value' }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of compareRows(d); track r.label) {
                <tr>
                  <td>{{ r.label }}</td>
                  @if (hasOriginal(d)) {
                    <td class="text-end">
                      @if (r.money) {
                        {{ r.original | appCurrency }}
                      } @else {
                        {{ r.original | appNumber: r.digits }}
                      }
                    </td>
                  }
                  <td class="text-end" [class.fw-semibold]="r.original !== null && r.original !== r.current">
                    @if (r.money) {
                      {{ r.current | appCurrency }}
                    } @else {
                      {{ r.current | appNumber: r.digits }}
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (d.adjustedFlag && d.adjustmentReason) {
          <div class="alert alert-info py-2">
            <strong>Adjustment:</strong> {{ d.adjustmentReason }}
            <span class="text-muted">- {{ d.adjustedByName ?? 'unknown' }}, {{ d.adjustedDate | appDate: 'datetime' }}</span>
          </div>
        }

        <h6 class="section-title">Rate breakdown</h6>
        @if (d.rateBreakdown; as rb) {
          <div class="row g-3 mb-3">
            <div class="col-md-4"><div class="text-muted small">Rate chart</div><div>{{ rb.rateChartName }} ({{ rb.calculationMethod }})</div></div>
            <div class="col-md-4">
              <div class="text-muted small">Slab</div>
              <div>
                @if (rb.rateChartDetailId !== null) {
                  FAT {{ rb.slabFatFrom | appNumber }}-{{ rb.slabFatTo | appNumber }}, SNF {{ rb.slabSnfFrom | appNumber }}-{{ rb.slabSnfTo | appNumber }}
                } @else {
                  Formula
                }
              </div>
            </div>
            <div class="col-md-4"><div class="text-muted small">FAT / SNF used</div><div>{{ rb.fatUsed | appNumber }} / {{ rb.snfUsed | appNumber }}</div></div>
            <div class="col-md-3"><div class="text-muted small">Base rate</div><div>{{ rb.baseRate | appCurrency }}</div></div>
            <div class="col-md-3"><div class="text-muted small">Bonus / L</div><div>{{ rb.bonus | appCurrency }}</div></div>
            <div class="col-md-3"><div class="text-muted small">Penalty / L</div><div>{{ rb.penalty | appCurrency }}</div></div>
            <div class="col-md-3"><div class="text-muted small">Final rate / L</div><div class="fw-semibold">{{ rb.finalRate | appCurrency }}</div></div>
            <div class="col-md-3"><div class="text-muted small">Quantity used</div><div>{{ rb.quantityUsed | appNumber: 3 }} L</div></div>
            <div class="col-md-3"><div class="text-muted small">Bonus amount</div><div>{{ rb.bonusAmount | appCurrency }}</div></div>
            <div class="col-md-3"><div class="text-muted small">Penalty amount</div><div>{{ rb.penaltyAmount | appCurrency }}</div></div>
            <div class="col-md-3"><div class="text-muted small">Total amount</div><div class="fw-semibold">{{ d.amount | appCurrency }}</div></div>
          </div>
        } @else {
          <p class="text-muted">No rate breakdown recorded.</p>
        }

        <h6 class="section-title">Quality tests</h6>
        @if (d.qualityTests.length === 0) {
          <p class="text-muted">No quality test recorded.</p>
        } @else {
          <div class="table-responsive mb-3">
            <table class="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Tested</th>
                  <th class="text-end">FAT</th>
                  <th class="text-end">SNF</th>
                  <th class="text-end">CLR</th>
                  <th class="text-end">Protein</th>
                  <th class="text-end">Temp</th>
                  <th class="text-end">Acidity</th>
                  <th>Result</th>
                  <th>Findings</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                @for (t of d.qualityTests; track t.id) {
                  <tr>
                    <td>{{ t.testDate | appDate: 'datetime' }}</td>
                    <td class="text-end">{{ t.fat | appNumber }}</td>
                    <td class="text-end">{{ t.snf | appNumber }}</td>
                    <td class="text-end">{{ t.clr | appNumber }}</td>
                    <td class="text-end">{{ t.protein | appNumber }}</td>
                    <td class="text-end">{{ t.temperature | appNumber }}</td>
                    <td class="text-end">{{ t.acidity | appNumber }}</td>
                    <td><app-status-badge [status]="t.result" [color]="qualityColor(t.result)" /></td>
                    <td>{{ findings(t) }}</td>
                    <td>{{ t.testedByName ?? '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        @if (d.rejections.length > 0 || d.status === 'Rejected') {
          <h6 class="section-title">Rejections</h6>
          <div class="table-responsive mb-3">
            <table class="table table-sm align-middle mb-0">
              <thead><tr><th>Date</th><th>Reason</th><th class="text-end">Quantity (L)</th><th>By</th></tr></thead>
              <tbody>
                @for (r of d.rejections; track r.id) {
                  <tr>
                    <td>{{ r.rejectionDate | appDate }}</td>
                    <td>{{ r.reason }}</td>
                    <td class="text-end">{{ r.quantityLiters | appNumber: 3 }}</td>
                    <td>{{ r.rejectedByName ?? '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <h6 class="section-title">Audit trail</h6>
        <ul class="list-unstyled mb-0 small">
          <li><span class="text-muted">Collected by:</span> {{ d.collectedByName ?? '—' }}, {{ d.createdDate | appDate: 'datetime' }}</li>
          @if (d.approvedDate) {
            <li><span class="text-muted">Approved by:</span> {{ d.approvedByName ?? '—' }}, {{ d.approvedDate | appDate: 'datetime' }}</li>
          }
          @if (d.rejectedDate) {
            <li>
              <span class="text-muted">Rejected by:</span> {{ d.rejectedByName ?? '—' }}, {{ d.rejectedDate | appDate: 'datetime' }}
              @if (d.rejectionReason) {
                - {{ d.rejectionReason }}
              }
            </li>
          }
          @if (d.remarks) {
            <li><span class="text-muted">Remarks:</span> {{ d.remarks }}</li>
          }
        </ul>
      }
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="closed.emit()">Close</button>
        @if (detail(); as d) {
          @if (canAdjust()) {
            <button *appHasPermission="'collection.update'" type="button" class="btn btn-warning" (click)="adjust.emit(d)">
              <i class="bi bi-sliders me-1"></i>Adjust
            </button>
          }
        }
      </div>
    </app-modal>
  `,
})
export class CollectionDetailModalComponent {
  private readonly svc = inject(MilkCollectionService);

  readonly collectionId = input<number | null>(null);
  readonly closed = output<void>();
  readonly adjust = output<CollectionDetail>();

  protected readonly detail = signal<CollectionDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly qualityColor = qualityColor;
  protected readonly trimTime = trimTime;

  protected readonly canAdjust = computed(() => {
    const d = this.detail();
    return !!d && (d.status === 'Pending' || d.status === 'Approved') && d.settlementStatus === 'Unsettled';
  });

  private sub: Subscription | null = null;

  constructor() {
    effect(() => {
      const id = this.collectionId();
      untracked(() => this.load(id));
    });
  }

  /** reload from outside (e.g. after an adjustment) */
  reload(): void {
    this.load(this.collectionId());
  }

  private load(id: number | null): void {
    this.sub?.unsubscribe();
    this.detail.set(null);
    this.error.set(null);
    if (id === null) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.sub = this.svc.get(id).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected hasOriginal(d: CollectionDetail): boolean {
    return d.originalQuantity !== null || d.originalFat !== null || d.originalSnf !== null || d.originalAmount !== null;
  }

  protected compareRows(d: CollectionDetail): CompareRow[] {
    return [
      { label: 'Quantity (L)', original: d.originalQuantity, current: d.quantityLiters, digits: 3, money: false },
      { label: 'FAT %', original: d.originalFat, current: d.fat, digits: 2, money: false },
      { label: 'SNF %', original: d.originalSnf, current: d.snf, digits: 2, money: false },
      { label: 'CLR', original: d.originalClr, current: d.clr, digits: 2, money: false },
      { label: 'Final rate / L', original: d.originalRate, current: d.finalRate, digits: 2, money: true },
      { label: 'Amount', original: d.originalAmount, current: d.amount, digits: 2, money: true },
    ];
  }

  protected findings(t: QualityTest): string {
    const flags: [boolean | null, string][] = [
      [t.waterAdded, 'Water'],
      [t.starchDetected, 'Starch'],
      [t.ureaDetected, 'Urea'],
      [t.neutralizerDetected, 'Neutralizer'],
      [t.antibioticDetected, 'Antibiotic'],
      [t.otherAdulteration, 'Other adulteration'],
    ];
    const hits = flags.filter(([v]) => v === true).map(([, name]) => name);
    const parts = [...hits];
    if (t.failureReason) {
      parts.push(t.failureReason);
    }
    return parts.length ? parts.join(', ') : '—';
  }
}
