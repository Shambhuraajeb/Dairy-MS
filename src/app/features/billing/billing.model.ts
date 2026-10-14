export const INVOICE_STATUSES = ['Draft', 'Issued', 'PartiallyPaid', 'Paid', 'Cancelled', 'Overdue'] as const;
export const PAYMENT_STATUSES = ['Received', 'Cancelled'] as const;

export interface Invoice {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  customerCode: string;
  customerMobile: string | null;
  customerGstNumber: string | null;
  invoiceType: string;
  invoiceDate: string;
  dueDate: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  isOverdue: boolean;
  orderCount: number;
  issuedDate: string | null;
  cancelledDate: string | null;
  cancelReason: string | null;
  remarks: string | null;
  createdDate: string;
}

export interface InvoiceLine {
  id: number;
  salesOrderId: number | null;
  orderNumber: string | null;
  deliveryId: number | null;
  productId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  lineTotal: number;
}

export interface InvoicePaymentAllocation {
  id: number;
  customerPaymentId: number;
  paymentNumber: string;
  paymentDate: string;
  paymentModeName: string | null;
  referenceNo: string | null;
  amount: number;
  allocationDate: string;
}

export interface InvoiceDetail extends Invoice {
  lines: InvoiceLine[];
  payments: InvoicePaymentAllocation[];
}

export interface GenerateInvoiceRequest {
  customerId: number;
  periodFrom: string | null;
  periodTo: string | null;
  salesOrderIds: number[] | null;
}

/** subset of OrderListDto used when picking delivered orders for an invoice */
export interface BillableOrder {
  id: number;
  orderNumber: string;
  deliveryDate: string;
  deliverySlot: string;
  totalAmount: number;
  status: string;
  invoiceId: number | null;
}

export interface CustomerPayment {
  id: number;
  paymentNumber: string;
  customerId: number;
  customerName: string;
  customerCode: string;
  invoiceId: number | null;
  invoiceNumber: string | null;
  paymentDate: string;
  amount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  paymentModeId: number;
  paymentModeName: string;
  referenceNo: string | null;
  status: string;
  receivedBy: number | null;
  receivedByName: string | null;
  remarks: string | null;
  createdDate: string;
}

export interface PaymentAllocation {
  id: number;
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceTotal: number;
  amount: number;
  allocationDate: string;
}

export interface CustomerPaymentDetail extends CustomerPayment {
  allocations: PaymentAllocation[];
}

export interface RecordPaymentRequest {
  customerId: number;
  paymentDate: string | null;
  amount: number;
  paymentModeId: number;
  referenceNo: string | null;
  invoiceId: number | null;
  remarks: string | null;
}

export interface OutstandingRow {
  id: number;
  customerCode: string;
  customerName: string;
  customerType: string;
  mobile: string | null;
  creditLimit: number;
  openInvoices: number;
  oldestDueDate: string | null;
  currentAmount: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  over90Days: number;
  totalOutstanding: number;
  unallocatedCredit: number;
}

export interface BillingSummary {
  invoicedThisMonth: number;
  collectedThisMonth: number;
  collectedToday: number;
  totalOutstanding: number;
  overdueAmount: number;
  openInvoices: number;
  overdueInvoices: number;
  unallocatedCredit: number;
  uninvoicedOrders: number;
  uninvoicedAmount: number;
  currentAmount: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  over90Days: number;
}
