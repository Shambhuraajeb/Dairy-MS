import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PagedQuery } from '../../../core/models/api.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { DATA_TABLE_IMPORTS, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { Unit } from './unit.model';
import { UnitService } from './unit.service';

@Component({
  selector: 'app-units',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, ModalComponent, FormFieldComponent, HasPermissionDirective, ...DATA_TABLE_IMPORTS],
  templateUrl: './units.component.html',
})
export class UnitsComponent {
  private readonly svc = inject(UnitService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly columns: TableColumn[] = [
    { key: 'code', label: 'Code', sortable: true, width: '160px' },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'isActive', label: 'Status', type: 'badge', width: '140px' },
  ];

  readonly items = signal<Unit[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  query: PagedQuery = { page: 1, pageSize: 20 };

  readonly modalOpen = signal(false);
  readonly editing = signal<Unit | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(20)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    isActive: [true],
  });

  constructor() {
    this.load();
  }

  onQuery(q: PagedQuery): void {
    this.query = q;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.list(this.query).subscribe({
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
    this.editing.set(null);
    this.form.reset({ code: '', name: '', isActive: true });
    this.modalOpen.set(true);
  }

  openEdit(unit: Unit): void {
    this.editing.set(unit);
    this.form.reset({ code: unit.code, name: unit.name, isActive: unit.isActive });
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
    const body = this.form.getRawValue();
    const current = this.editing();
    const request$ = current ? this.svc.update(current.id, body) : this.svc.create({ ...body, isActive: true });
    this.saving.set(true);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.toast.success(current ? 'Unit updated.' : 'Unit created.');
        this.load();
      },
      error: () => this.saving.set(false), // the error interceptor already toasted the server message
    });
  }

  async toggleActive(unit: Unit): Promise<void> {
    const activate = !unit.isActive;
    const ok = await this.confirmService.confirm({
      title: activate ? 'Activate unit' : 'Deactivate unit',
      message: `${activate ? 'Activate' : 'Deactivate'} unit "${unit.name}"?`,
      confirmText: activate ? 'Activate' : 'Deactivate',
      variant: activate ? 'primary' : 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc.setActive(unit, activate).subscribe(() => {
      this.toast.success(activate ? 'Unit activated.' : 'Unit deactivated.');
      this.load();
    });
  }
}
