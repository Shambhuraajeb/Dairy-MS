import { OrderLine } from '../orders/order.model';

export const DELIVERY_SLOTS = ['Morning', 'Evening'] as const;
export type DeliverySlot = (typeof DELIVERY_SLOTS)[number];
export const DELIVERY_STATUSES = ['Pending', 'Dispatched', 'Delivered', 'Failed', 'Cancelled'] as const;
export const SCHEDULE_STATUSES = ['Planned', 'Dispatched', 'Completed'] as const;
export const VEHICLE_TYPES = ['Van', 'Truck', 'Tanker', 'Bike', 'Auto'] as const;
export const VEHICLE_STATUSES = ['Available', 'OnRoute', 'Maintenance', 'Inactive'] as const;

// routes
export interface DeliveryRoute {
  id: number;
  code: string;
  name: string;
  branchId: number | null;
  branchName: string | null;
  description: string | null;
  startLocation: string | null;
  endLocation: string | null;
  distanceKm: number;
  estimatedMinutes: number;
  defaultVehicleId: number | null;
  defaultVehicleNo: string | null;
  defaultDriverEmployeeId: number | null;
  defaultDriverName: string | null;
  isActive: boolean;
  addressCount: number;
}

export interface RouteRequest {
  code?: string | null;
  name: string;
  branchId?: number | null;
  description?: string | null;
  startLocation?: string | null;
  endLocation?: string | null;
  distanceKm: number;
  estimatedMinutes: number;
  defaultVehicleId?: number | null;
  defaultDriverEmployeeId?: number | null;
  isActive?: boolean | null;
}

// vehicles
export interface Vehicle {
  id: number;
  registrationNo: string;
  vehicleType: string;
  make: string | null;
  model: string | null;
  capacity: number;
  capacityUnit: string | null;
  driverEmployeeId: number | null;
  driverName: string | null;
  branchId: number | null;
  fuelType: string | null;
  insuranceExpiry: string | null;
  fitnessExpiry: string | null;
  status: string;
  isActive: boolean;
}

export interface VehicleRequest {
  registrationNo: string;
  vehicleType: string;
  make?: string | null;
  model?: string | null;
  capacity: number;
  capacityUnit?: string | null;
  driverEmployeeId?: number | null;
  branchId?: number | null;
  fuelType?: string | null;
  insuranceExpiry?: string | null;
  fitnessExpiry?: string | null;
  status: string;
  isActive?: boolean | null;
}

// schedules
export interface DeliverySchedule {
  id: number;
  routeId: number;
  routeCode: string;
  routeName: string;
  vehicleId: number | null;
  vehicleNo: string | null;
  driverEmployeeId: number | null;
  driverName: string | null;
  scheduleDate: string;
  slot: DeliverySlot;
  status: string;
  plannedStartTime: string | null;
  dispatchedDate: string | null;
  completedDate: string | null;
  remarks: string | null;
  deliveryCount: number;
  deliveredCount: number;
  isActive: boolean;
}

export interface ScheduleRequest {
  routeId?: number | null;
  vehicleId?: number | null;
  driverEmployeeId?: number | null;
  scheduleDate: string;
  slot: DeliverySlot;
  plannedStartTime?: string | null;
  remarks?: string | null;
}

// deliveries
export interface DeliveryListItem {
  id: number;
  deliveryNumber: string;
  salesOrderId: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  customerMobile: string | null;
  addressText: string | null;
  deliveryInstructions: string | null;
  deliveryDate: string;
  deliverySlot: DeliverySlot;
  deliveryScheduleId: number | null;
  routeId: number | null;
  routeName: string | null;
  driverEmployeeId: number | null;
  driverName: string | null;
  assignedUserId: number | null;
  assignedUserName: string | null;
  sequenceNo: number | null;
  status: string;
  dispatchedDate: string | null;
  deliveredDate: string | null;
  failureReason: string | null;
  orderTotal: number;
  totalQuantity: number;
  invoiceId: number | null;
  remarks: string | null;
}

export interface DeliveryConfirmation {
  id: number;
  deliveryId: number;
  confirmedBy: number | null;
  confirmedByName: string | null;
  confirmedDate: string;
  outcome: string;
  deliveredQuantity: number;
  receivedBy: string | null;
  collectedAmount: number | null;
  latitude: number | null;
  longitude: number | null;
  failureReason: string | null;
  remarks: string | null;
}

export interface DeliveryDetail extends DeliveryListItem {
  lines: OrderLine[];
  confirmation: DeliveryConfirmation | null;
}

export interface ConfirmDeliveryRequest {
  isDelivered: boolean;
  receivedBy?: string | null;
  remarks?: string | null;
  failureReason?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CreateDeliveryRequest {
  salesOrderId: number;
  deliveryScheduleId?: number | null;
  driverEmployeeId?: number | null;
  assignedUserId?: number | null;
}

export interface BulkDeliveryRequest {
  deliveryScheduleId: number;
  salesOrderIds: number[];
  driverEmployeeId?: number | null;
  assignedUserId?: number | null;
}

export interface BulkDeliveryResult {
  requestedCount: number;
  createdCount: number;
  failedCount: number;
  created: { salesOrderId: number; deliveryId: number; deliveryNumber: string }[];
  failed: { salesOrderId: number; message: string }[];
}

export function scheduleLabel(s: DeliverySchedule): string {
  const parts = [s.routeName, `${s.scheduleDate.slice(0, 10)} ${s.slot}`];
  if (s.driverName) {
    parts.push(s.driverName);
  }
  return parts.join(' | ');
}
