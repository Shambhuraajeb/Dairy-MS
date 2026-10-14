import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PermissionService } from '../../../core/services/permission.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AttendanceHistoryComponent } from './attendance-history.component';
import { AttendanceSheetComponent } from './attendance-sheet.component';

/** /employees/attendance — tabs: Daily sheet (HR) | History */
@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, AttendanceSheetComponent, AttendanceHistoryComponent],
  template: `
    <app-page-header title="Attendance" subtitle="Mark daily attendance and review history">
      <a routerLink="/employees" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>Employees</a>
    </app-page-header>

    <ul class="nav nav-tabs mb-3">
      @if (canSheet) {
        <li class="nav-item">
          <button type="button" class="nav-link" [class.active]="tab() === 'sheet'" (click)="tab.set('sheet')">
            <i class="bi bi-ui-checks-grid me-1"></i>Daily Sheet
          </button>
        </li>
      }
      <li class="nav-item">
        <button type="button" class="nav-link" [class.active]="tab() === 'history'" (click)="tab.set('history')">
          <i class="bi bi-clock-history me-1"></i>History
        </button>
      </li>
    </ul>

    @if (tab() === 'sheet') {
      <app-attendance-sheet />
    } @else {
      <app-attendance-history />
    }
  `,
})
export class AttendanceComponent {
  private readonly perm = inject(PermissionService);
  readonly canSheet = this.perm.hasAny('attendance.manage', 'employee.view');
  readonly tab = signal<'sheet' | 'history'>(this.canSheet ? 'sheet' : 'history');
}
