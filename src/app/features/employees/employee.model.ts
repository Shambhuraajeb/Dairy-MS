export type EmployeeStatus = 'Active' | 'Inactive' | 'Terminated';
export type AttendanceStatus = 'Present' | 'Absent' | 'HalfDay' | 'Leave';
export type LeaveType = 'Casual' | 'Sick' | 'Earned' | 'Unpaid' | 'Other';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export const EMPLOYEE_STATUSES: EmployeeStatus[] = ['Active', 'Inactive', 'Terminated'];
export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['Present', 'Absent', 'HalfDay', 'Leave'];
export const LEAVE_TYPES: LeaveType[] = ['Casual', 'Sick', 'Earned', 'Unpaid', 'Other'];
export const LEAVE_STATUSES: LeaveStatus[] = ['Pending', 'Approved', 'Rejected'];
export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "HH:mm" from "HH:mm:ss" / ISO datetime; '' when empty */
export function toHHmm(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const time = value.includes('T') ? value.split('T')[1] : value;
  return time.slice(0, 5);
}

export interface Employee {
  id: number;
  employeeCode: string;
  fullName: string;
  gender: string | null;
  dateOfBirth: string | null;
  mobile: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  designationId: number;
  designationName: string | null;
  branchId: number | null;
  branchName: string | null;
  joinDate: string | null;
  exitDate: string | null;
  basicSalary: number;
  defaultAllowances: number;
  defaultDeductions: number;
  bankName: string | null;
  bankAccountNo: string | null;
  ifscCode: string | null;
  aadhaarNo: string | null;
  panNo: string | null;
  emergencyContact: string | null;
  status: EmployeeStatus;
  isActive: boolean;
  createdDate: string;
}

export interface EmployeeRequest {
  employeeCode?: string | null;
  fullName: string;
  gender: string | null;
  dateOfBirth: string | null;
  mobile: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  designationId: number;
  branchId: number | null;
  joinDate: string | null;
  exitDate?: string | null;
  basicSalary: number;
  defaultAllowances: number;
  defaultDeductions: number;
  bankName: string | null;
  bankAccountNo: string | null;
  ifscCode: string | null;
  aadhaarNo: string | null;
  panNo: string | null;
  emergencyContact: string | null;
}

export interface Designation {
  id: number;
  name: string;
  department: string | null;
  description: string | null;
  isActive: boolean;
  employeeCount: number;
}

export interface DesignationRequest {
  name: string;
  department: string | null;
  description: string | null;
  isActive?: boolean;
}

export interface Attendance {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  attendanceDate: string;
  checkIn: string | null;
  checkOut: string | null;
  workedHours: number | null;
  status: AttendanceStatus;
  remarks: string | null;
}

export interface AttendanceSheetRow {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  designationName: string | null;
  attendanceId: number | null;
  status: AttendanceStatus | null;
  checkIn: string | null;
  checkOut: string | null;
  workedHours: number | null;
  remarks: string | null;
}

/** editable client-side row of the daily sheet (times as HH:mm) */
export interface AttendanceSheetEntry {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  designationName: string | null;
  status: AttendanceStatus | null;
  checkIn: string;
  checkOut: string;
  remarks: string;
  /** status/time/remarks differ from what the server has */
  dirty: boolean;
}

export interface AttendanceBulkRequest {
  date: string;
  entries: { employeeId: number; status: AttendanceStatus; checkIn: string | null; checkOut: string | null; remarks: string | null }[];
}

export interface LeaveRequest {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  approvedBy: number | null;
  approvedByName: string | null;
  approvedDate: string | null;
  rejectionReason: string | null;
  createdDate: string;
}

export interface LeaveCreateRequest {
  employeeId: number | null;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  days: number | null;
  reason: string | null;
}

export interface Salary {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  designationName: string | null;
  salaryMonth: number;
  salaryYear: number;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  basicAmount: number;
  allowances: number;
  deductions: number;
  netAmount: number;
  status: 'Generated' | 'Paid';
  paymentModeId: number | null;
  paymentModeName: string | null;
  referenceNo: string | null;
  paidDate: string | null;
  remarks: string | null;
}

export interface SalaryGenerateResult {
  generated: number;
  alreadyExisting: number;
  salaryMonth: number;
  salaryYear: number;
}
