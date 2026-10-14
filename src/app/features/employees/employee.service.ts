import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../core/models/api.model';
import { ApiService } from '../../core/services/api.service';
import {
  Attendance,
  AttendanceBulkRequest,
  AttendanceSheetRow,
  Designation,
  DesignationRequest,
  Employee,
  EmployeeRequest,
  LeaveCreateRequest,
  LeaveRequest,
  Salary,
  SalaryGenerateResult,
} from './employee.model';

/** One service for the whole HR area: employees, designations, attendance, leave, salaries. */
@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly api = inject(ApiService);
  // lists render their own errors inline (Retry button)
  private readonly quiet = { skipErrorToast: true };

  // ---- employees
  list(q: PagedQuery): Observable<PagedResult<Employee>> {
    return this.api.getPaged<Employee>('employees', q, this.quiet);
  }
  get(id: number | string): Observable<Employee> {
    return this.api.get<Employee>(`employees/${id}`, undefined, this.quiet);
  }
  create(body: EmployeeRequest): Observable<Employee> {
    return this.api.post<Employee>('employees', body);
  }
  update(id: number | string, body: EmployeeRequest): Observable<Employee> {
    return this.api.put<Employee>(`employees/${id}`, body);
  }
  deactivate(id: number, body?: { status: 'Inactive' | 'Terminated'; exitDate: string | null }): Observable<Employee> {
    return this.api.post<Employee>(`employees/${id}/deactivate`, body);
  }
  activate(id: number): Observable<Employee> {
    return this.api.post<Employee>(`employees/${id}/activate`);
  }

  // ---- designations
  listDesignations(q: PagedQuery): Observable<PagedResult<Designation>> {
    return this.api.getPaged<Designation>('designations', q, this.quiet);
  }
  createDesignation(body: DesignationRequest): Observable<Designation> {
    return this.api.post<Designation>('designations', body);
  }
  updateDesignation(id: number, body: DesignationRequest): Observable<Designation> {
    return this.api.put<Designation>(`designations/${id}`, body);
  }
  deactivateDesignation(id: number): Observable<unknown> {
    return this.api.delete(`designations/${id}`);
  }

  // ---- attendance
  listAttendance(q: PagedQuery): Observable<PagedResult<Attendance>> {
    return this.api.getPaged<Attendance>('attendance', q, this.quiet);
  }
  attendanceSheet(date: string, designationId?: number | null): Observable<AttendanceSheetRow[]> {
    return this.api.get<AttendanceSheetRow[]>('attendance/sheet', { date, designationId }, this.quiet);
  }
  saveAttendanceBulk(body: AttendanceBulkRequest): Observable<{ date: string; saved: number }> {
    return this.api.post<{ date: string; saved: number }>('attendance/bulk', body);
  }

  // ---- leave
  listLeave(q: PagedQuery): Observable<PagedResult<LeaveRequest>> {
    return this.api.getPaged<LeaveRequest>('leave-requests', q, this.quiet);
  }
  createLeave(body: LeaveCreateRequest): Observable<LeaveRequest> {
    return this.api.post<LeaveRequest>('leave-requests', body);
  }
  approveLeave(id: number): Observable<LeaveRequest> {
    return this.api.post<LeaveRequest>(`leave-requests/${id}/approve`);
  }
  rejectLeave(id: number, reason: string | null): Observable<LeaveRequest> {
    return this.api.post<LeaveRequest>(`leave-requests/${id}/reject`, { reason });
  }

  // ---- salaries
  listSalaries(q: PagedQuery): Observable<PagedResult<Salary>> {
    return this.api.getPaged<Salary>('salaries', q, this.quiet);
  }
  generateSalaries(month: number, year: number): Observable<SalaryGenerateResult> {
    return this.api.post<SalaryGenerateResult>('salaries/generate', { month, year });
  }
  paySalary(id: number, paymentModeId: number): Observable<Salary> {
    return this.api.post<Salary>(`salaries/${id}/pay`, { paymentModeId });
  }
}
