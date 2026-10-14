import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LookupItem } from '../../../core/models/api.model';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { dateOnly, orNull } from '../../../shared/utils/paged-list';
import { Equipment, MaintenanceSchedule, SCHEDULE_STATUSES } from '../maintenance.model';
import { MaintenanceService } from '../maintenance.service';

@Component({
  selector: 'app-schedule-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, FormFieldComponent],
  template: `
    <app-modal [open]="open()" [title]="schedule() ? 'Edit Schedule' : 'Add Schedule'" (closed)="close()">
      <form id="scheduleForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        @if (schedule(); as s) {
          <div class="mb-3">
            <div class="form-label">Equipment</div>
            <div class="fw-semibold">{{ s.equipmentName }} <span class="text-muted small">{{ s.equipmentCode }}</span></div>
          </div>
        } @else {
          <app-form-field label="Equipment" inputId="scEquip" [control]="form.controls.equipmentId">
            <select id="scEquip" class="form-select" formControlName="equipmentId">
              <option [ngValue]="null">Select equipment</option>
              @for (e of equipment(); track e.id) {
                <option [ngValue]="e.id">{{ e.equipmentCode }} - {{ e.name }}</option>
              }
            </select>
          </app-form-field>
        }
        <app-form-field label="Task" inputId="scTask" [control]="form.controls.taskName" hint="e.g. Oil change, Cleaning, Calibration">
          <input id="scTask" type="text" class="form-control" formControlName="taskName" maxlength="150" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Description" inputId="scDesc" [control]="form.controls.description">
          <textarea id="scDesc" rows="2" class="form-control" formControlName="description" maxlength="500"></textarea>
        </app-form-field>
        <div class="row">
          <div class="col-md-6">
            <app-form-field label="Frequency (days)" inputId="scFreq" [control]="form.controls.frequencyDays">
              <input id="scFreq" type="number" min="1" max="3650" step="1" class="form-control" formControlName="frequencyDays" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Alert before (days)" inputId="scAlert" [control]="form.controls.alertBeforeDays">
              <input id="scAlert" type="number" min="0" max="365" step="1" class="form-control" formControlName="alertBeforeDays" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field label="Last service date" inputId="scLast" [control]="form.controls.lastServiceDate">
              <input id="scLast" type="date" class="form-control" formControlName="lastServiceDate" />
            </app-form-field>
          </div>
          <div class="col-md-6">
            <app-form-field
              label="Next due date"
              inputId="scNext"
              [control]="form.controls.nextDueDate"
              hint="Blank = last service (or today) + frequency"
            >
              <input id="scNext" type="date" class="form-control" formControlName="nextDueDate" />
            </app-form-field>
          </div>
        </div>
        <app-form-field label="Assigned to" inputId="scEmp">
          <select id="scEmp" class="form-select" formControlName="assignedEmployeeId">
            <option [ngValue]="null">Unassigned</option>
            @for (e of employees(); track e.id) {
              <option [ngValue]="e.id">{{ e.name }}</option>
            }
          </select>
        </app-form-field>
        @if (schedule()) {
          <app-form-field label="Status" inputId="scStatus">
            <select id="scStatus" class="form-select" formControlName="status">
              @for (s of statuses; track s) {
                <option [value]="s">{{ s }}</option>
              }
            </select>
          </app-form-field>
        }
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="scheduleForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Save
        </button>
      </div>
    </app-modal>
  `,
})
export class ScheduleFormModalComponent {
  private readonly svc = inject(MaintenanceService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = input(false);
  readonly schedule = input<MaintenanceSchedule | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly statuses = SCHEDULE_STATUSES;
  readonly employees = toSignal(this.lookups.employees(), { initialValue: [] as LookupItem[] });
  readonly equipment = signal<Equipment[]>([]);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    equipmentId: this.fb.control<number | null>(null, Validators.required),
    taskName: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', Validators.maxLength(500)],
    frequencyDays: this.fb.control<number | null>(30, [Validators.required, Validators.min(1), Validators.max(3650)]),
    alertBeforeDays: this.fb.control<number | null>(7, [Validators.required, Validators.min(0), Validators.max(365)]),
    lastServiceDate: [''],
    nextDueDate: [''],
    assignedEmployeeId: this.fb.control<number | null>(null),
    status: ['Active'],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.onOpen());
      }
    });
  }

  private onOpen(): void {
    const s = this.schedule();
    this.saving.set(false);
    this.form.reset({
      equipmentId: s?.equipmentId ?? null,
      taskName: s?.taskName ?? '',
      description: s?.description ?? '',
      frequencyDays: s?.frequencyDays ?? 30,
      alertBeforeDays: s?.alertBeforeDays ?? 7,
      lastServiceDate: dateOnly(s?.lastServiceDate),
      nextDueDate: dateOnly(s?.nextDueDate),
      assignedEmployeeId: s?.assignedEmployeeId ?? null,
      status: s?.status ?? 'Active',
    });
    if (s) {
      this.form.controls.equipmentId.disable();
    } else {
      this.form.controls.equipmentId.enable();
      this.svc.equipmentOptions().subscribe((list) => this.equipment.set(list));
    }
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
    const common = {
      taskName: v.taskName.trim(),
      description: orNull(v.description.trim()),
      frequencyDays: Number(v.frequencyDays),
      lastServiceDate: orNull(v.lastServiceDate),
      nextDueDate: orNull(v.nextDueDate),
      alertBeforeDays: Number(v.alertBeforeDays ?? 0),
      assignedEmployeeId: v.assignedEmployeeId,
    };
    const current = this.schedule();
    this.saving.set(true);
    const request$ = current
      ? this.svc.updateSchedule(current.id, { ...common, status: v.status })
      : this.svc.createSchedule({ ...common, equipmentId: Number(v.equipmentId) });
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(current ? 'Schedule updated.' : 'Schedule created.');
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
