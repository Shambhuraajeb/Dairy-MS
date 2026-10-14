export const CUSTOMER_TYPES = ['Retail', 'Distributor'] as const;
export const CUSTOMER_STATUSES = ['Active', 'Inactive', 'Blocked'] as const;
export const ADDRESS_TYPES = ['Home', 'Office', 'Shop', 'Billing', 'Delivery'] as const;
export const DELIVERY_SLOTS = ['Morning', 'Evening'] as const;

export interface Customer {
  id: number;
  customerCode: string;
  customerType: string;
  name: string;
  contactPerson: string | null;
  mobile: string;
  alternateMobile: string | null;
  email: string | null;
  gstNumber: string | null;
  branchId: number | null;
  branchName: string | null;
  creditLimit: number;
  creditDays: number;
  discountPercent: number;
  outstandingBalance: number;
  joinDate: string | null;
  status: string;
  notes: string | null;
  isActive: boolean;
  createdDate: string;
  activeSubscriptions: number;
}

export interface CustomerRequest {
  customerCode?: string | null;
  customerType: string;
  name: string;
  contactPerson: string | null;
  mobile: string;
  alternateMobile: string | null;
  email: string | null;
  gstNumber: string | null;
  branchId: number | null;
  creditLimit: number;
  creditDays: number;
  discountPercent: number;
  joinDate: string | null;
  notes: string | null;
}

export interface CustomerSummary {
  id: number;
  customer: Customer;
  activeSubscriptions: number;
  pausedSubscriptions: number;
  totalOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  lastOrderDate: string | null;
  totalInvoiced: number;
  openInvoices: number;
  outstandingAmount: number;
  overdueAmount: number;
  unallocatedCredit: number;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  openComplaints: number;
}

export interface CustomerAddress {
  id: number;
  customerId: number;
  addressType: string;
  contactName: string | null;
  contactMobile: string | null;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  routeId: number | null;
  routeName: string | null;
  deliveryInstructions: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface AddressRequest {
  addressType: string;
  contactName: string | null;
  contactMobile: string | null;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  routeId: number | null;
  deliveryInstructions: string | null;
  isDefault: boolean;
}

export type RelatedKind = 'subscriptions' | 'orders' | 'invoices' | 'payments' | 'complaints';

/** one-line address for dropdowns / summaries */
export function addressLine(a: Pick<CustomerAddress, 'line1' | 'line2' | 'landmark' | 'city' | 'pincode'>): string {
  return [a.line1, a.line2, a.landmark, a.city, a.pincode].filter((p) => !!p).join(', ');
}
