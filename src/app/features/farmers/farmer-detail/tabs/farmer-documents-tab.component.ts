import { Component, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LookupItem } from '../../../../core/models/api.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { LookupService } from '../../../../core/services/lookup.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { FormFieldComponent } from '../../../../shared/components/form-field/form-field.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { AppDatePipe } from '../../../../shared/pipes/app-pipes';
import { FarmerDetail, FarmerDocument, dateOnly, nullIfEmpty } from '../../farmer.model';
import { FarmerService } from '../../farmer.service';

const MAX_BYTES = 10 * 1024 * 1024;

@Component({
  selector: 'app-farmer-documents-tab',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, FormFieldComponent, ModalComponent, StatusBadgeComponent, HasPermissionDirective, AppDatePipe],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="h6 mb-0">Documents</h2>
      <button *appHasPermission="'farmer.update'" type="button" class="btn btn-sm btn-primary" (click)="openUpload()">
        <i class="bi bi-upload me-1"></i>Upload document
      </button>
    </div>

    <div class="card">
      @if (farmer().documents.length === 0) {
        <app-empty-state icon="bi-file-earmark-text" title="No documents" message="Upload KYC or agreement documents (PDF, JPG, PNG up to 10 MB)." />
      } @else {
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 app-table">
            <thead>
              <tr>
                <th>Type</th><th>Number</th><th>File</th><th>Expiry</th><th>Status</th><th>Uploaded</th><th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (d of farmer().documents; track d.id) {
                <tr>
                  <td>{{ d.documentTypeName || '—' }}</td>
                  <td>{{ d.documentNumber || '—' }}</td>
                  <td>
                    {{ d.fileName || '—' }}
                    @if (d.fileSize) {
                      <div class="small text-muted">{{ sizeText(d.fileSize) }}</div>
                    }
                  </td>
                  <td>{{ d.expiryDate | appDate }}</td>
                  <td><app-status-badge [status]="d.verificationStatus" /></td>
                  <td>{{ d.createdDate | appDate }}</td>
                  <td class="text-end text-nowrap">
                    @if (d.hasFile) {
                      <button type="button" class="btn btn-sm btn-outline-primary me-1" [disabled]="busyId() === d.id" (click)="download(d)">
                        <i class="bi bi-download"></i> Download
                      </button>
                    }
                    <ng-container *appHasPermission="'farmer.update'">
                      @if (d.verificationStatus !== 'Verified') {
                        <button type="button" class="btn btn-sm btn-outline-success me-1" (click)="setStatus(d, 'Verified')">Verify</button>
                      }
                      <button type="button" class="btn btn-sm btn-outline-danger" (click)="remove(d)"><i class="bi bi-trash"></i></button>
                    </ng-container>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <app-modal [open]="open()" title="Upload document" (closed)="close()">
      <form id="docForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-form-field label="Document type" inputId="dType" [control]="form.controls.documentTypeId">
          <select id="dType" class="form-select" formControlName="documentTypeId">
            <option value="">Select type</option>
            @for (t of docTypes(); track t.id) {
              <option [value]="t.id">{{ t.name }}</option>
            }
          </select>
        </app-form-field>
        <app-form-field label="Document number" inputId="dNumber" [control]="form.controls.documentNumber">
          <input id="dNumber" class="form-control" formControlName="documentNumber" maxlength="100" />
        </app-form-field>
        <div class="mb-3">
          <label class="form-label" for="dFile">File</label>
          <input id="dFile" type="file" class="form-control" accept=".pdf,.jpg,.jpeg,.png" (change)="onFile($event)" />
          <div class="form-text">PDF, JPG or PNG, up to 10 MB. Optional if you only record the document details.</div>
          @if (fileError()) {
            <div class="invalid-feedback d-block">{{ fileError() }}</div>
          }
        </div>
        <app-form-field label="File / document name" inputId="dName" [control]="form.controls.fileName" [required]="!file()" hint="Required when no file is attached">
          <input id="dName" class="form-control" formControlName="fileName" maxlength="200" />
        </app-form-field>
        <app-form-field label="Expiry date" inputId="dExpiry" [control]="form.controls.expiryDate">
          <input id="dExpiry" type="date" class="form-control" formControlName="expiryDate" />
        </app-form-field>
        <app-form-field label="Remarks" inputId="dRemarks" [control]="form.controls.remarks">
          <textarea id="dRemarks" class="form-control" rows="2" formControlName="remarks" maxlength="300"></textarea>
        </app-form-field>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn-light" (click)="close()">Cancel</button>
        <button type="submit" form="docForm" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm me-1"></span>
          }
          Upload
        </button>
      </div>
    </app-modal>
  `,
})
export class FarmerDocumentsTabComponent {
  private readonly svc = inject(FarmerService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly farmer = input.required<FarmerDetail>();
  readonly changed = output<void>();

  readonly docTypes = toSignal(this.lookups.get('document-types', { status: 'Farmer' }), { initialValue: [] as LookupItem[] });
  readonly open = signal(false);
  readonly saving = signal(false);
  readonly busyId = signal<number | null>(null);
  readonly file = signal<File | null>(null);
  readonly fileError = signal<string | null>(null);

  readonly form = this.fb.group({
    documentTypeId: ['', Validators.required],
    documentNumber: [''],
    fileName: [''],
    expiryDate: [''],
    remarks: [''],
  });

  sizeText(bytes: number): string {
    return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  openUpload(): void {
    this.form.reset();
    this.file.set(null);
    this.fileError.set(null);
    this.open.set(true);
  }

  close(): void {
    if (!this.saving()) {
      this.open.set(false);
    }
  }

  onFile(event: Event): void {
    const f = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.fileError.set(null);
    if (f && f.size > MAX_BYTES) {
      this.fileError.set('File is larger than 10 MB.');
      (event.target as HTMLInputElement).value = '';
      this.file.set(null);
      return;
    }
    this.file.set(f);
    if (f && !this.form.controls.fileName.value) {
      this.form.controls.fileName.setValue(f.name);
    }
  }

  save(): void {
    const v = this.form.getRawValue();
    const file = this.file();
    if (!file && !v.fileName.trim()) {
      this.form.controls.fileName.setErrors({ required: true });
    }
    if (this.form.invalid || this.fileError()) {
      this.form.markAllAsTouched();
      return;
    }
    const data = new FormData();
    if (file) {
      data.append('file', file, file.name);
    }
    data.append('documentTypeId', v.documentTypeId);
    for (const [key, value] of [
      ['documentNumber', v.documentNumber],
      ['fileName', v.fileName],
      ['expiryDate', v.expiryDate],
      ['remarks', v.remarks],
    ] as const) {
      if (value.trim()) {
        data.append(key, value.trim());
      }
    }
    this.saving.set(true);
    this.svc.uploadDocument(this.farmer().id, data).subscribe({
      next: () => {
        this.saving.set(false);
        this.open.set(false);
        this.toast.success('Document uploaded.');
        this.changed.emit();
      },
      error: () => this.saving.set(false),
    });
  }

  download(d: FarmerDocument): void {
    this.busyId.set(d.id);
    this.svc.downloadDocument(this.farmer().id, d).subscribe({
      next: () => this.busyId.set(null),
      error: () => this.busyId.set(null),
    });
  }

  setStatus(d: FarmerDocument, verificationStatus: string): void {
    this.svc
      .updateDocument(this.farmer().id, d.id, {
        documentTypeId: d.documentTypeId,
        documentNumber: nullIfEmpty(d.documentNumber),
        expiryDate: nullIfEmpty(dateOnly(d.expiryDate)),
        remarks: nullIfEmpty(d.remarks),
        verificationStatus,
      })
      .subscribe(() => {
        this.toast.success(`Document marked ${verificationStatus.toLowerCase()}.`);
        this.changed.emit();
      });
  }

  async remove(d: FarmerDocument): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Delete document',
      message: `Delete "${d.fileName ?? d.documentTypeName ?? 'this document'}"?`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    this.svc.deleteDocument(this.farmer().id, d.id).subscribe(() => {
      this.toast.success('Document deleted.');
      this.changed.emit();
    });
  }
}
