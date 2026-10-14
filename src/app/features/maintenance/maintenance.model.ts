export type EquipmentStatus = 'Operational' | 'UnderMaintenance' | 'Retired';

export interface Equipment {
  id: number;
  equipmentCode: string;
  name: string;
  category: string | null;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchaseCost: number;
  location: string | null;
  branchId: number | null;
  branchName: string | null;
  collectionCenterId: number | null;
  collectionCenterName: string | null;
  warrantyExpiry: string | null;
  vendorName: string | null;
  status: EquipmentStatus | string;
  remarks: string | null;
  isActive: boolean;
  createdDate: string;
  nextDueDate: string | null;
  lastMaintenanceDate: string | null;
}

export interface EquipmentRequest {
  equipmentCode: string;
  name: string;
  category: string | null;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchaseCost: number;
  location: string | null;
  branchId: number | null;
  collectionCenterId: number | null;
  warrantyExpiry: string | null;
  vendorName: string | null;
  remarks: string | null;
  status?: string;
  isActive?: boolean;
}

export interface MaintenanceSchedule {
  id: number;
  equipmentId: number;
  equipmentCode: string;
  equipmentName: string;
  taskName: string;
  description: string | null;
  frequencyDays: number;
  lastServiceDate: string | null;
  nextDueDate: string | null;
  alertBeforeDays: number;
  assignedEmployeeId: number | null;
  assignedEmployeeName: string | null;
  status: string;
  isActive: boolean;
  daysToDue: number | null;
  isOverdue: boolean;
  isDue: boolean;
}

export interface ScheduleCreateRequest {
  equipmentId: number;
  taskName: string;
  description: string | null;
  frequencyDays: number;
  lastServiceDate: string | null;
  nextDueDate: string | null;
  alertBeforeDays: number;
  assignedEmployeeId: number | null;
}

export interface ScheduleUpdateRequest {
  taskName: string;
  description: string | null;
  frequencyDays: number;
  lastServiceDate: string | null;
  nextDueDate: string | null;
  alertBeforeDays: number;
  assignedEmployeeId: number | null;
  status?: string;
  isActive?: boolean;
}

export interface MaintenanceRecord {
  id: number;
  equipmentId: number;
  equipmentCode: string;
  equipmentName: string;
  maintenanceScheduleId: number | null;
  taskName: string | null;
  maintenanceType: string;
  maintenanceDate: string;
  description: string;
  vendorName: string | null;
  cost: number;
  nextDueDate: string | null;
  performedBy: string | null;
  downtimeHours: number | null;
  invoiceNo: string | null;
  status: string;
  remarks: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdDate: string;
}

export interface RecordRequest {
  equipmentId: number;
  maintenanceScheduleId: number | null;
  maintenanceDate: string | null;
  description: string;
  vendorName: string | null;
  cost: number;
  maintenanceType: string | null;
  performedBy: string | null;
  downtimeHours: number | null;
  invoiceNo: string | null;
  remarks: string | null;
}

export interface RecordResult {
  id: number;
  nextDueDate: string | null;
  expenseId: number | null;
}

export const EQUIPMENT_STATUSES = ['Operational', 'UnderMaintenance', 'Retired'];
export const SCHEDULE_STATUSES = ['Active', 'Paused'];
export const MAINTENANCE_TYPES = ['Preventive', 'Corrective', 'Breakdown'];
