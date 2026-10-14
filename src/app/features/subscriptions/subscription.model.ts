export const FREQUENCIES = ['Daily', 'Alternate', 'Weekly'] as const;
export const BILLING_CYCLES = ['Daily', 'Weekly', 'Monthly'] as const;
export const SLOTS = ['Morning', 'Evening'] as const;
export const SUBSCRIPTION_STATUSES = ['Active', 'Paused', 'Cancelled', 'Expired'] as const;
export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export interface SubscriptionPlan {
  id: number;
  planCode: string;
  name: string;
  description: string | null;
  frequency: string;
  daysOfWeek: string | null;
  productId: number | null;
  productName: string | null;
  defaultQuantity: number;
  pricePerUnit: number | null;
  discountPercent: number;
  billingCycle: string;
  minimumDays: number;
  isActive: boolean;
  activeSubscriptions: number;
}

export interface PlanRequest {
  planCode?: string | null;
  name: string;
  description: string | null;
  frequency: string;
  daysOfWeek: string | null;
  productId: number | null;
  defaultQuantity: number;
  pricePerUnit: number | null;
  discountPercent: number;
  billingCycle: string;
  minimumDays: number;
  isActive?: boolean;
}

export interface Subscription {
  id: number;
  subscriptionNumber: string;
  customerId: number;
  customerName: string;
  customerCode: string;
  subscriptionPlanId: number;
  planName: string;
  customerAddressId: number;
  addressText: string | null;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  frequency: string;
  daysOfWeek: string | null;
  startDate: string;
  endDate: string | null;
  deliverySlot: string;
  status: string;
  nextOrderDate: string | null;
  lastOrderDate: string | null;
  cancelledDate: string | null;
  cancelReason: string | null;
  remarks: string | null;
  createdDate: string;
}

export interface SubscriptionPause {
  id: number;
  customerSubscriptionId: number;
  pauseFrom: string;
  pauseTo: string | null;
  reason: string | null;
  resumedDate: string | null;
  resumedBy: number | null;
  status: string;
}

export interface SubscriptionDetail extends Subscription {
  pauses: SubscriptionPause[];
}

export interface SubscriptionCreateRequest {
  customerId: number;
  subscriptionPlanId: number;
  customerAddressId: number;
  productId: number | null;
  quantity: number | null;
  startDate: string | null;
  endDate: string | null;
  deliverySlot: string;
}

export interface SubscriptionUpdateRequest {
  quantity: number | null;
  endDate: string | null;
  deliverySlot: string | null;
  customerAddressId: number | null;
  remarks: string | null;
}

export interface PauseRequest {
  pauseFrom: string | null;
  pauseTo: string | null;
  reason: string | null;
}

export interface GenerateOrdersResult {
  ordersCreated: number;
  forDate: string;
}
