export type MilkType = 'Cow' | 'Buffalo' | 'Mixed';

export interface FarmerListItem {
  id: number;
  farmerCode: string;
  fullName: string;
  fatherName: string | null;
  mobile: string;
  email: string | null;
  milkType: string;
  collectionCenterId: number | null;
  collectionCenterName: string | null;
  branchId: number | null;
  joinDate: string | null;
  verificationStatus: string;
  status: string;
  isActive: boolean;
  animalCount: number;
}

export interface FarmerAddress {
  id: number;
  farmerId: number;
  addressType: string;
  line1: string;
  line2: string | null;
  village: string | null;
  taluka: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
}

export interface FarmerBankAccount {
  id: number;
  farmerId: number;
  accountHolderName: string;
  bankName: string;
  branchName: string | null;
  accountNumber: string;
  ifscCode: string;
  upiId: string | null;
  isPrimary: boolean;
}

export interface FarmerDocument {
  id: number;
  farmerId: number;
  documentTypeId: number | null;
  documentTypeName: string | null;
  documentNumber: string | null;
  fileName: string | null;
  hasFile: boolean;
  contentType: string | null;
  fileSize: number | null;
  expiryDate: string | null;
  verificationStatus: string;
  verifiedDate: string | null;
  remarks: string | null;
  createdDate: string;
}

export interface FarmerDetail extends FarmerListItem {
  branchName: string | null;
  alternateMobile: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  aadhaarNo: string | null;
  panNo: string | null;
  verifiedBy: string | number | null;
  verifiedDate: string | null;
  verificationRemarks: string | null;
  statusReason: string | null;
  activatedDate: string | null;
  deactivatedDate: string | null;
  notes: string | null;
  createdDate: string;
  addresses: FarmerAddress[];
  bankAccounts: FarmerBankAccount[];
  documents: FarmerDocument[];
}

export interface FarmerSummary {
  farmerId: number;
  animalCount: number;
  milkingAnimalCount: number;
  collectionsThisMonth: number;
  quantityThisMonth: number;
  amountThisMonth: number;
  pendingApprovalCount: number;
  payableAmount: number;
  loanBalance: number;
  advanceBalance: number;
  lastCollectionDate: string | null;
}

export interface AddressBody {
  addressType: string;
  line1: string;
  line2: string | null;
  village: string | null;
  taluka: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
}

export interface BankBody {
  accountHolderName: string;
  bankName: string;
  branchName: string | null;
  accountNumber: string;
  ifscCode: string;
  upiId: string | null;
  isPrimary: boolean;
}

export interface FarmerRequest {
  farmerCode?: string | null;
  fullName: string;
  fatherName: string | null;
  mobile: string;
  alternateMobile: string | null;
  email: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  aadhaarNo: string | null;
  panNo: string | null;
  collectionCenterId: number | null;
  branchId: number | null;
  milkType: string;
  joinDate: string | null;
  notes: string | null;
  address?: AddressBody | null;
  bankAccount?: BankBody | null;
}

export interface FarmerCollectionRow {
  id: number;
  collectionNumber: string;
  collectionDate: string;
  shiftName: string | null;
  collectionCenterName: string | null;
  quantityLiters: number;
  fat: number | null;
  snf: number | null;
  rate: number | null;
  amount: number | null;
  status: string;
  settlementStatus: string | null;
}

export interface FarmerPaymentRow {
  id: number;
  paymentNumber: string;
  paymentDate: string;
  periodFrom: string | null;
  periodTo: string | null;
  totalQuantity: number;
  grossAmount: number;
  deductionAmount: number;
  netPayable: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  paidDate: string | null;
}

export interface FarmerAdvance {
  id: number;
  advanceNumber: string;
  farmerId: number;
  farmerCode: string;
  farmerName: string;
  advanceDate: string;
  amount: number;
  recoveredAmount: number;
  balanceAmount: number;
  recoveryPerSettlement: number | null;
  purpose: string | null;
  paymentModeId: number | null;
  paymentModeName: string | null;
  referenceNo: string | null;
  status: string;
  approvedDate: string | null;
  remarks: string | null;
  createdDate: string;
}

export interface AdvanceRequest {
  farmerId: number;
  advanceDate: string | null;
  amount: number;
  recoveryPerSettlement: number | null;
  purpose: string | null;
  paymentModeId: number | null;
  referenceNo: string | null;
  remarks: string | null;
}

export interface LoanInstallment {
  id: number;
  farmerLoanId: number;
  installmentNo: number;
  dueDate: string;
  amount: number;
  principalComponent: number;
  interestComponent: number;
  paidAmount: number;
  balanceAmount: number;
  paidDate: string | null;
  status: string;
  isOverdue: boolean;
  paymentSource: string | null;
  farmerPaymentId: number | null;
  remarks: string | null;
}

export interface FarmerLoanListItem {
  id: number;
  loanNumber: string;
  farmerId: number;
  farmerCode: string;
  farmerName: string;
  loanDate: string;
  principalAmount: number;
  interestRate: number;
  interestAmount: number;
  totalPayable: number;
  numberOfInstallments: number;
  installmentAmount: number;
  firstInstallmentDate: string | null;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
  purpose: string | null;
  paidInstallments: number;
  nextDueDate: string | null;
}

export interface FarmerLoan extends FarmerLoanListItem {
  interestType: string | null;
  paymentModeId: number | null;
  paymentModeName: string | null;
  referenceNo: string | null;
  approvedDate: string | null;
  closedDate: string | null;
  remarks: string | null;
  createdDate: string;
  installments: LoanInstallment[];
}

export interface LoanRequest {
  farmerId: number;
  principalAmount: number;
  interestRate: number;
  numberOfInstallments: number;
  startDate: string;
  remarks: string | null;
}

/** '' / undefined -> null, trimmed string otherwise */
export function nullIfEmpty(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
}

export function numOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') {
    return null;
  }
  const n = Number(v);
  return isNaN(n) ? null : n;
}

/** ISO datetime -> yyyy-MM-dd for <input type="date"> */
export function dateOnly(v: string | null | undefined): string {
  return v ? v.substring(0, 10) : '';
}
