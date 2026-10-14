import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AppDatePipe } from '../../../shared/pipes/app-pipes';
import { toIsoDate } from '../../../shared/utils/format';
import { orNull } from '../../../shared/utils/paged-list';
import { Equipment, MAINTENANCE_TYPES, MaintenanceSchedule, RecordResult } from '../maintenance.model';
import { MaintenanceService } from '../maintenance.service';

function notFuture(control: AbstractControl): ValidationErrors | null {
  const v = control.value as string;
  return v && v > toIsoDate() ? { custom: { message: 'Maintenance date cannot be in the future.' } } : null;
}

/**
 * Record maintenance. Optional presets: [equipmentId] (preselects the equipment) and [scheduleId].
 * Shows the resulting next due date inside the modal after saving; `saved` fires right after the POST succeeds.
 */
@Component({
  selector: 'app-record-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent, AppDatePipe],
  template: `
    <app-modal [open]="open()" title="Record maintenance" size="lg" (closed)="close()">
      @if (result(); as r) {
        <div class="text-center py-3">
          <i class="bi bi-check-circle-fill text-success fs-1"></i>
          <h5 class="mt-2">Maintenance recorded</h5>
          <p class="mb-1">
            @if (r.nextDueDate) {
              Next due date: <strong>{{ r.nextDueDate | appDate }}</strong>
            } @else {
              No further service is scheduled for this task.
            }
          </p>
          @if (r.expenseId) {
            <p class="text-muted small mb-0">A pending expense (#{{ r.expenseId }}) was raised for the cost.</p>
          }
        </div>
      } @else {
        <form id="recordForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <div class="row">
            <div class="col-md-6">
              <app-form-field label="Equipment" inputId="rcEquip" [control]="form.controls.equipmentId">
                <select id="rcEquip" class="form-select" formControlName="equipmentId">
                  <option [ngValue]="null">Select equipment</option>
                  @for (e of equipment(); track e.id) {
                    <option [ngValue]="e.id">{{ e.equipmentCode }} - {{ e.name }}</option>
                  }
                </select>
              </app-form-field>
            </div>
            <div class="col-md-6">
              <app-form-field label="Schedule (optional)" inputId="rcSched" hint="Linking a schedule advances its next due date">
                <select id="rcSched" class="form-select" formControlName="maintenanceScheduleId">
                  <option [ngValue]="null">None (corrective / ad hoc)</option>
                  @for (s of schedules(); track s.id) {
                    <option [ngValue]="s.id">{{ s.taskName }} (every {{ s.frequencyDays }}d)</option>
                  }
                </select>
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Maintenance date" inputId="rcDate" [control]="form.controls.maintenanceDate">
                <input id="rcDate" type="date" class="form-control" formControlName="maintenanceDate" [max]="today" />
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Type" inputId="rcType" hint="Auto: Preventive with a schedule, else Corrective">
                <select id="rcType" class="form-select" formControlName="maintenanceType">
                  <option value="">Auto</option>
                  @for (t of types; track t) {
                    <option [value]="t">{{ t }}</option>
                  }
                </select>
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Cost" inputId="rcCost" [control]="form.controls.cost">
                <input id="rcCost" type="number" min="0" step="any" class="form-control" formControlName="cost" />
              </app-form-field>
            </div>
          </div>
          <app-form-field label="Description" inputId="rcDesc" [control]="form.controls.description">
            <textarea id="rcDesc" rows="2" class="form-control" formControlName="description" maxlength="500"></textarea>
          </app-form-field>
          <div class="row">
            <div class="col-md-4">
              <app-form-field label="Vendor" inputId="rcVendor" [control]="form.controls.vendorName">
                <input id="rcVendor" type="text" class="form-control" formControlName="vendorName" maxlength="150" />
              </app-form-field>
            </div>
            <div class="col-md-4">
              <app-form-field label="Performed by" inputId="rcBy" [control]="form.controls.performedBy">
                <input id="rcBy" type="text" class="form-control" formControlName="performedBy" maxlength="100" />
              </app-form-field>
            </div>
            <div class="col-md-2">
              <app-form-field label="Downtime (h)" inputId="rcDown" [control]="form.controls.downtimeHours">
                <input id="rcDown" type="number" min="0" step="any" class="form-control" formControlName="downtimeHours" />
              </app-form-field>
            </div>
            <div class="col-md-2">
              <app-form-field label="Invoice no." inputId="rcInv" [control]="form.controls.invoiceNo">
                <input id="rcInv" type="text" class="form-control" formControlName="invoiceNo" maxlength="50" />
              </app-form-field>
            </div>
          </div>
          <app-form-field label="Remarks" inputId="rcRemarks" [control]="form.controls.remarks">
            <input id="rcRemarks" type="text" class="form-control" formControlName="remarks" maxlength="250" />
          </app-form-field>
        </form>
      }
      <div modal-footer>
        @if (result()) {
          <button type="button" class="btn btn-primary" (click)="closed.emit()">Done</button>
        } @else {
          <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
          <button type="submit" form="recordForm" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm me-1"></span>
            }
            Record maintenance
          </button>
        }
      </div>
    </app-modal>
  `,
})
export class RecordModalComponent {
  private readonly svc = inject(MaintenanceService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = input(false);
  readonly equipmentId = input<number | null>(null);
  readonly scheduleId = input<number | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly types = MAINTENANCE_TYPES;
  readonly today = toIsoDate();
  readonly equipment = signal<Equipment[]>([]);
  readonly schedules = signal<MaintenanceSchedule[]>([]);
  readonly saving = signal(false);
  readonly result = signal<RecordResult | null>(null);
  private seq = 0;
  private pendingSchedule: number | null = null;

  readonly form = this.fb.group({
    equipmentId: this.fb.control<number | null>(null, Validators.required),
    maintenanceScheduleId: this.fb.control<number | null>(null),
    maintenanceDate: [toIsoDate(), notFuture],
    maintenanceType: [''],
    cost: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    description: ['', [Validators.required, Validators.maxLength(500)]],
    vendorName: [''],
    performedBy: [''],
    downtimeHours: this.fb.control<number | null>(null, Validators.min(0)),
    invoiceNo: [''],
    remarks: [''],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.onOpen());
      }
    });
    this.form.controls.equipmentId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      const keep = this.pendingSchedule;
      this.pendingSchedule = null;
      this.form.controls.maintenanceScheduleId.setValue(null);
      this.loadSchedules(id, keep);
    });
    this.form.controls.maintenanceScheduleId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      const s = this.schedules().find((x) => x.id === id);
      if (s && !this.form.controls.description.value) {
        this.form.controls.description.setValue(s.taskName);
      }
    });
  }

  private onOpen(): void {
    this.saving.set(false);
    this.result.set(null);
    this.schedules.set([]);
    this.form.reset({
      equipmentId: null,
      maintenanceScheduleId: null,
      maintenanceDate: toIsoDate(),
      maintenanceType: '',
      cost: 0,
      description: '',
      vendorName: '',
      performedBy: '',
      downtimeHours: null,
      invoiceNo: '',
      remarks: '',
    });
    this.pendingSchedule = this.scheduleId();
    this.svc.equipmentOptions().subscribe((list) => {
      this.equipment.set(list);
      const preset = this.equipmentId();
      if (preset !== null) {
        this.form.controls.equipmentId.setValue(preset);
      }
    });
  }

  private loadSchedules(equipmentId: number | null, select: number | null): void {
    const n = ++this.seq;
    this.schedules.set([]);
    if (equipmentId === null) {
      return;
    }
    this.svc.schedulesForEquipment(equipmentId).subscribe({
      next: (list) => {
        if (n !== this.seq) {
          return;
        }
        const active = list.filter((s) => s.status === 'Active');
        this.schedules.set(active);
        if (select !== null && active.some((s) => s.id === select)) {
          this.form.controls.maintenanceScheduleId.setValue(select);
        }
      },
      error: () => undefined,
    });
  }

  close(): void {
    if (!this.saving()) {
      this.closed.emit();
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
      .recordMaintenance({
        equipmentId: Number(v.equipmentId),
        maintenanceScheduleId: v.maintenanceScheduleId,
        maintenanceDate: orNull(v.maintenanceDate),
        description: v.description.trim(),
        vendorName: orNull(v.vendorName.trim()),
        cost: Number(v.cost ?? 0),
        maintenanceType: orNull(v.maintenanceType),
        performedBy: orNull(v.performedBy.trim()),
        downtimeHours: v.downtimeHours === null ? null : Number(v.downtimeHours),
        invoiceNo: orNull(v.invoiceNo.trim()),
        remarks: orNull(v.remarks.trim()),
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.result.set(res);
          this.toast.success('Maintenance recorded.');
          this.saved.emit();
        },
        error: () => this.saving.set(false),
      });
  }
}
