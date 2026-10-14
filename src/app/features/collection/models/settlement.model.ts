export const PAYMENT_STATUSES = ['Draft', 'Approved', 'Paid', 'Cancelled'] as const;

export interface SettlementSummary {
  farmerId: number;
  farmerCode: string;
  farmerName: string;
  periodFrom: string;
  periodTo: string;
  totalCollections: number;
  totalQuantity: number;
  grossAmount: number;
  bonusAmount: number;
  penaltyAmount: number;
  pendingAdvanceBalance: number;
  loanInstallmentsDue: number;
  suggestedAdvanceDeduction: number;
  suggestedLoanDeduction: number;
  suggestedDeduction: number;
  netBeforeDeduction: number;
  netPayable: number;
}

export interface SettlementCollection {
  id: number;
  collectionNumber: string;
  collectionDate: string;
  shiftName: string;
  collectionCenterName: string;
  milkType: string;
  quantityLiters: number;
  fat: number;
  snf: number;
  baseRate: number;
  finalRate: number;
  bonusAmount: number;
  penaltyAmount: number;
  amount: number;
}

export interface SettlementAdvance {
  id: number;
  advanceNumber: string;
  advanceDate: string;
  amount: number;
  recoveredAmount: number;
  balanceAmount: number;
  recoveryPerSettlement: number | null;
  purpose: string | null;
  availableAmount: number;
  suggestedRecovery: number;
}

export interface SettlementInstallment {
  id: number;
  farmerLoanId: number;
  loanNumber: string;
  installmentNo: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: string;
  dueAmount: number;
}

export interface SettlementPreview {
  summary: SettlementSummary;
  collections: SettlementCollection[];
  advances: SettlementAdvance[];
  loanInstallments: SettlementInstallment[];
}

export interface PendingFarmer {
  farmerId: number;
  farmerCode: string;
  farmerName: string;
  mobile: string | null;
  collectionCenterId: number | null;
  collectionCenterName: string | null;
  collectionsCount: number;
  totalQuantity: number;
  grossAmount: number;
  bonusAmount: number;
  penaltyAmount: number;
  totalAmount: number;
  firstCollectionDate: string;
  lastCollectionDate: string;
  pendingAdvanceBalance: number;
  loanInstallmentsDue: number;
}

export interface CreateSettlementRequest {
  farmerId: number;
  from: string;
  to: string;
  bonusAmount?: number;
  penaltyAmount?: number;
  advanceDeduction?: number;
  includeLoanInstallments?: boolean;
  otherDeduction?: number;
  otherDeductionRemarks?: string;
  paymentModeId?: number;
  referenceNo?: string;
  remarks?: string;
}

export interface CreateSettlementResult {
  id: number;
  number: string;
  netPayable: number;
  grossAmount: number;
  bonusAmount: number;
  penaltyAmount: number;
  deductionAmount: number;
  status: string;
}

export interface PayRequest {
  paymentModeId?: number;
  referenceNo?: string;
  paidAmount?: number;
}

export interface PayResult {
  id: number;
  number: string;
  status: string;
  paidAmount: number;
  balanceAmount: number;
  netPayable: number;
}

export interface FarmerPayment {
  id: number;
  paymentNumber: string;
  farmerId: number;
  farmerCode: string;
  farmerName: string;
  collectionCenterId: number | null;
  collectionCenterName: string | null;
  paymentDate: string;
  periodFrom: string;
  periodTo: string;
  totalCollections: number;
  totalQuantity: number;
  grossAmount: number;
  bonusAmount: number;
  penaltyAmount: number;
  deductionAmount: number;
  netPayable: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  paymentModeId: number | null;
  paymentModeName: string | null;
  referenceNo: string | null;
  paidDate: string | null;
  approvedDate: string | null;
  createdDate: string;
}

export interface PaymentDetailLine {
  id: number;
  milkCollectionId: number;
  collectionNumber: string;
  collectionDate: string;
  shiftName: string;
  quantity: number;
  rate: number;
  bonusAmount: number;
  penaltyAmount: number;
  amount: number;
}

export interface PaymentDeduction {
  id: number;
  deductionType: string;
  farmerAdvanceId: number | null;
  advanceNumber: string | null;
  farmerLoanId: number | null;
  loanNumber: string | null;
  farmerLoanInstallmentId: number | null;
  installmentNo: number | null;
  amount: number;
  remarks: string | null;
}

export interface FarmerPaymentDetail extends FarmerPayment {
  bankName: string | null;
  bankAccountMasked: string | null;
  ifscCode: string | null;
  upiId: string | null;
  approvedBy: number | null;
  approvedByName: string | null;
  paidBy: number | null;
  paidByName: string | null;
  cancelledDate: string | null;
  cancelReason: string | null;
  remarks: string | null;
  details: PaymentDetailLine[];
  deductions: PaymentDeduction[];
}
