export const COMPLAINT_CATEGORIES = ['Quality', 'Delivery', 'Billing', 'Service', 'Other'] as const;
export const COMPLAINT_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export const COMPLAINT_STATUSES = ['Open', 'Assigned', 'InProgress', 'Resolved', 'Closed'] as const;

export interface Complaint {
  id: number;
  complaintNumber: string;
  customerId: number;
  customerName: string;
  customerCode: string;
  salesOrderId: number | null;
  orderNumber: string | null;
  deliveryId: number | null;
  deliveryNumber: string | null;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  assignedTo: number | null;
  assignedToName: string | null;
  assignedDate: string | null;
  resolution: string | null;
  resolvedBy: number | null;
  resolvedDate: string | null;
  closedBy: number | null;
  closedDate: string | null;
  feedbackRating: number | null;
  feedbackComments: string | null;
  feedbackDate: string | null;
  createdDate: string;
}

export interface ComplaintRequest {
  customerId: number | null;
  category: string;
  subject: string;
  description: string;
  priority: string;
}

export interface AssignableUser {
  id: number;
  username: string;
  displayName: string;
  roleName: string;
}
