export type OrderStatus = 'Pending' | 'Confirmed' | 'Scheduled' | 'Dispatched' | 'Delivered' | 'Cancelled' | 'Failed';
export const ORDER_STATUSES: OrderStatus[] = ['Pending', 'Confirmed', 'Scheduled', 'Dispatched', 'Delivered', 'Cancelled', 'Failed'];
export const ORDER_SLOTS = ['Morning', 'Evening'] as const;
export type OrderSlot = (typeof ORDER_SLOTS)[number];
export const ORDER_SOURCES = ['Manual', 'Subscription'] as const;

export interface OrderListItem {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  customerCode: string;
  customerAddressId: number | null;
  addressText: string | null;
  customerSubscriptionId: number | null;
  routeId: number | null;
  routeName: string | null;
  orderDate: string;
  deliveryDate: string;
  deliverySlot: OrderSlot;
  source: string;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  deliveryCharge: number;
  totalAmount: number;
  paidAmount: number;
  status: OrderStatus;
  paymentStatus: string;
  invoiceId: number | null;
  invoiceNumber: string | null;
  totalQuantity: number;
  remarks: string | null;
  createdDate: string;
}

export interface OrderLine {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  unitCode: string | null;
  quantity: number;
  deliveredQuantity: number;
  unitPrice: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  lineTotal: number;
  remarks: string | null;
}

export interface OrderDeliveryInfo {
  id: number;
  deliveryNumber: string;
  status: string;
  deliveryScheduleId: number | null;
  routeId: number | null;
  routeName: string | null;
  driverEmployeeId: number | null;
  driverName: string | null;
  assignedUserId: number | null;
  dispatchedDate: string | null;
  deliveredDate: string | null;
  failureReason: string | null;
}

export interface OrderDetail extends OrderListItem {
  confirmedDate: string | null;
  cancelledDate: string | null;
  cancelReason: string | null;
  lines: OrderLine[];
  delivery: OrderDeliveryInfo | null;
}

export interface CreateOrderItem {
  productId: number;
  quantity: number;
  unitPrice?: number | null;
}

export interface CreateOrderRequest {
  customerId?: number | null;
  customerAddressId?: number | null;
  deliveryDate: string;
  deliverySlot: OrderSlot;
  remarks?: string | null;
  items: CreateOrderItem[];
}

export interface UpdateOrderRequest {
  customerAddressId?: number | null;
  deliveryDate?: string | null;
  deliverySlot?: OrderSlot | null;
  remarks?: string | null;
}

export interface CustomerAddressLite {
  id: number;
  addressType: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string | null;
  pincode: string | null;
  routeName: string | null;
  deliveryInstructions: string | null;
  isDefault: boolean;
}

export interface CustomerLite {
  id: number;
  customerCode: string;
  name: string;
  customerType: string;
  mobile: string | null;
  creditLimit: number;
  outstandingBalance: number;
  discountPercent: number;
}

export function addressLabel(a: CustomerAddressLite): string {
  const parts = [a.line1, a.line2, a.landmark, a.city, a.pincode].filter((p) => !!p);
  return `${a.addressType}${a.isDefault ? ' (default)' : ''}: ${parts.join(', ')}`;
}
