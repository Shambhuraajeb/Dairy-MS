import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { toIsoDate } from '../../../shared/utils/format';
import { orNull } from '../../../shared/utils/paged-list';
import { AttendanceSheetEntry, AttendanceStatus, toHHmm } from '../employee.model';
import { EmployeeService } from '../employee.service';

interface QuickStatus {
  status: AttendanceStatus;
  short: string;
  label: string;
  color: 'success' | 'danger' | 'warning' | 'info';
}

@Component({
  selector: 'app-attendance-sheet',
  standalone: true,
  imports: [LoadingComponent, EmptyStateComponent],
  template: `
    <div class="card mb-3">
      <div class="card-body d-flex flex-wrap align-items-end gap-3">
        <div>
          <label class="form-label mb-1" for="sheetDate">Date</label>
          <input id="sheetDate" type="date" class="form-control form-control-sm" [value]="date()" [max]="today" (change)="onDate($event)" />
        </div>
        <div>
          <label class="form-label mb-1" for="sheetDesignation">Designation</label>
          <select id="sheetDesignation" class="form-select form-select-sm" (change)="onDesignation($event)">
            <option value="">All designations</option>
            @for (d of designations(); track d.id) {
              <option [value]="d.id">{{ d.name }}</option>
            }
          </select>
        </div>
        <div>
          <label class="form-label mb-1" for="sheetSearch">Find employee</label>
          <input id="sheetSearch" type="search" class="form-control form-control-sm" placeholder="Name or code" (input)="onSearch($event)" />
        </div>
        <div class="ms-auto d-flex flex-wrap gap-2 small">
          <span class="badge badge-soft badge-soft-success">Present {{ counts().Present }}</span>
          <span class="badge badge-soft badge-soft-warning">Half day {{ counts().HalfDay }}</span>
          <span class="badge badge-soft badge-soft-info">Leave {{ counts().Leave }}</span>
          <span class="badge badge-soft badge-soft-danger">Absent {{ counts().Absent }}</span>
          <span class="badge badge-soft badge-soft-secondary">Unmarked {{ counts().unmarked }}</span>
        </div>
      </div>
    </div>

    <div class="card position-relative">
      @if (loading()) {
        <app-loading text="Loading sheet..." />
      } @else if (error()) {
        <div class="text-center py-5">
          <i class="bi bi-exclamation-octagon text-danger fs-3 d-block mb-2"></i>
          <div class="text-danger mb-2">{{ error() }}</div>
          <button type="button" class="btn btn-sm btn-outline-primary" (click)="load()"><i class="bi bi-arrow-clockwise"></i> Retry</button>
        </div>
      } @else if (rows().length === 0) {
        <app-empty-state icon="bi-people" title="No employees" message="There are no active employees for this selection." />
      } @else {
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 app-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Designation</th>
                <th style="width: 260px">Status</th>
                <th style="width: 120px">Check in</th>
                <th style="width: 120px">Check out</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              @for (e of visible(); track e.employeeId) {
                <tr [class.table-warning]="e.dirty">
                  <td>
                    <div class="fw-semibold">{{ e.employeeName }}</div>
                    <div class="small text-muted">{{ e.employeeCode }}</div>
                  </td>
                  <td>{{ e.designationName ?? '—' }}</td>
                  <td>
                    <div class="btn-group btn-group-sm" role="group" aria-label="Attendance status">
                      @for (q of quick; track q.status) {
                        <button
                          type="button"
                          [class]="'btn ' + btnClass(e, q)"
                          [title]="q.label"
                          [disabled]="!canManage()"
                          (click)="setStatus(e, q.status)"
                        >
                          {{ q.short }}
                        </button>
                      }
                    </div>
                    <span class="small text-muted ms-2">{{ e.status ?? 'Not marked' }}</span>
                  </td>
                  <td>
                    <input
                      type="time"
                      class="form-control form-control-sm"
                      [value]="e.checkIn"
                      [disabled]="!canManage() || !timesAllowed(e)"
                      (input)="setField(e, 'checkIn', $event)"
                      aria-label="Check in"
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      class="form-control form-control-sm"
                      [value]="e.checkOut"
                      [disabled]="!canManage() || !timesAllowed(e)"
                      (input)="setField(e, 'checkOut', $event)"
                      aria-label="Check out"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      class="form-control form-control-sm"
                      maxlength="200"
                      [value]="e.remarks"
                      [disabled]="!canManage()"
                      (input)="setField(e, 'remarks', $event)"
                      aria-label="Remarks"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (canManage()) {
          <div class="card-footer d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-outline-success" (click)="markAllPresent()">
                <i class="bi bi-check2-all me-1"></i>Mark unmarked as present
              </button>
              <button type="button" class="btn btn-sm btn-light" [disabled]="dirtyCount() === 0" (click)="load()">Discard changes</button>
            </div>
            <button type="button" class="btn btn-primary" [disabled]="saving() || dirtyCount() === 0" (click)="save()">
              @if (saving()) {
                <span class="spinner-border spinner-border-sm me-1"></span>
              }
              <i class="bi bi-save me-1"></i>Save attendance ({{ dirtyCount() }})
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class AttendanceSheetComponent {
  private readonly svc = inject(EmployeeService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly perm = inject(PermissionService);

  readonly today = toIsoDate();
  readonly quick: QuickStatus[] = [
    { status: 'Present', short: 'P', label: 'Present', color: 'success' },
    { status: 'HalfDay', short: 'HD', label: 'Half day', color: 'warning' },
    { status: 'Leave', short: 'L', label: 'Leave', color: 'info' },
    { status: 'Absent', short: 'A', label: 'Absent', color: 'danger' },
  ];

  readonly designations = toSignal(this.lookups.get('designations'), { initialValue: [] as LookupItem[] });
  readonly date = signal(toIsoDate());
  readonly designationId = signal<number | null>(null);
  readonly searchText = signal('');
  readonly rows = signal<AttendanceSheetEntry[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly canManage = computed(() => this.perm.has('attendance.manage'));
  readonly dirtyCount = computed(() => this.rows().filter((r) => r.dirty).length);
  readonly visible = computed(() => {
    const q = this.searchText().trim().toLowerCase();
    return q ? this.rows().filter((r) => r.employeeName.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q)) : this.rows();
  });
  readonly counts = computed(() => {
    const c = { Present: 0, HalfDay: 0, Leave: 0, Absent: 0, unmarked: 0 };
    for (const r of this.rows()) {
      if (r.status) {
        c[r.status]++;
      } else {
        c.unmarked++;
      }
    }
    return c;
  });

  constructor() {
    this.load();
  }

  load(): void {
    if (!this.date()) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.svc.attendanceSheet(this.date(), this.designationId()).subscribe({
      next: (rows) => {
        this.rows.set(
          rows.map((r) => ({
            employeeId: r.employeeId,
            employeeCode: r.employeeCode,
            employeeName: r.employeeName,
            designationName: r.designationName,
            status: r.status,
            checkIn: toHHmm(r.checkIn),
            checkOut: toHHmm(r.checkOut),
            remarks: r.remarks ?? '',
            dirty: false,
          })),
        );
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  onDate(ev: Event): void {
    this.date.set((ev.target as HTMLInputElement).value);
    this.load();
  }

  onDesignation(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.designationId.set(v ? Number(v) : null);
    this.load();
  }

  onSearch(ev: Event): void {
    this.searchText.set((ev.target as HTMLInputElement).value);
  }

  btnClass(e: AttendanceSheetEntry, q: QuickStatus): string {
    return (e.status === q.status ? 'btn-' : 'btn-outline-') + q.color;
  }

  timesAllowed(e: AttendanceSheetEntry): boolean {
    return e.status === 'Present' || e.status === 'HalfDay';
  }

  private patchRow(target: AttendanceSheetEntry, changes: Partial<AttendanceSheetEntry>): void {
    this.rows.update((list) => list.map((r) => (r === target ? { ...r, ...changes, dirty: true } : r)));
  }

  setStatus(e: AttendanceSheetEntry, status: AttendanceStatus): void {
    if (!this.canManage() || e.status === status) {
      return;
    }
    const clearTimes = status === 'Absent' || status === 'Leave';
    this.patchRow(e, clearTimes ? { status, checkIn: '', checkOut: '' } : { status });
  }

  setField(e: AttendanceSheetEntry, field: 'checkIn' | 'checkOut' | 'remarks', ev: Event): void {
    const value = (ev.target as HTMLInputElement).value;
    this.patchRow(e, field === 'checkIn' ? { checkIn: value } : field === 'checkOut' ? { checkOut: value } : { remarks: value });
  }

  markAllPresent(): void {
    this.rows.update((list) => list.map((r) => (r.status ? r : { ...r, status: 'Present' as const, dirty: true })));
  }

  save(): void {
    const entries = this.rows()
      .filter((r) => r.dirty && r.status)
      .map((r) => ({
        employeeId: r.employeeId,
        status: r.status as AttendanceStatus,
        checkIn: orNull(r.checkIn),
        checkOut: orNull(r.checkOut),
        remarks: orNull(r.remarks.trim()),
      }));
    if (entries.length === 0) {
      this.toast.info('Mark at least one employee before saving.');
      return;
    }
    this.saving.set(true);
    this.svc.saveAttendanceBulk({ date: this.date(), entries }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(`Attendance saved for ${res.saved} employee(s).`);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
