export interface Expense {
  id: number;
  expenseNumber: string;
  expenseCategoryId: number;
  categoryName: string;
  expenseDate: string;
  amount: number;
  paymentModeId: number | null;
  paymentModeName: string | null;
  description: string | null;
  payee: string | null;
  receiptNo: string | null;
  branchId: number | null;
  branchName: string | null;
  collectionCenterId: number | null;
  status: string;
  approvedBy: number | null;
  approvedByName: string | null;
  approvedDate: string | null;
  rejectionReason: string | null;
  referenceType: string | null;
  referenceId: number | null;
  createdBy: number | null;
  createdByName: string | null;
  createdDate: string;
}

export interface ExpenseRequest {
  expenseCategoryId: number;
  expenseDate: string | null;
  amount: number;
  paymentModeId: number | null;
  description: string | null;
  branchId: number | null;
  payee: string | null;
  receiptNo: string | null;
}

export interface ExpenseCreated {
  id: number;
  number: string;
  status: string;
}

export interface ExpenseCategory {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  expenseCount: number;
}

export interface ExpenseCategoryRequest {
  code: string;
  name: string;
  description: string | null;
  isActive?: boolean;
}

export interface CashTransaction {
  id: number;
  transactionDate: string;
  transactionType: 'In' | 'Out' | string;
  category: string;
  amount: number;
  balanceAfter: number;
  paymentModeId: number | null;
  paymentModeName: string | null;
  branchId: number | null;
  branchName: string | null;
  referenceType: string | null;
  referenceId: number | null;
  remarks: string | null;
  createdBy: number | null;
  createdByName: string | null;
}

export interface CashCategoryTotal {
  category: string;
  totalIn: number;
  totalOut: number;
}

export interface CashSummary {
  from: string | null;
  to: string | null;
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  netChange: number;
  closingBalance: number;
  transactionCount: number;
  byCategory: CashCategoryTotal[];
}

export const EXPENSE_STATUSES = ['Pending', 'Approved', 'Rejected'];
