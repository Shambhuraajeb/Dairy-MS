export type MilkType = 'Cow' | 'Buffalo' | 'Mixed';
export const MILK_TYPES: MilkType[] = ['Cow', 'Buffalo', 'Mixed'];
export const COLLECTION_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;
export const SETTLEMENT_STATUSES = ['Unsettled', 'Settled'] as const;

export const REJECTION_REASONS: { code: string; label: string }[] = [
  { code: 'LowFat', label: 'Low FAT' },
  { code: 'LowSnf', label: 'Low SNF' },
  { code: 'Adulterated', label: 'Adulterated' },
  { code: 'HighTemperature', label: 'High temperature' },
  { code: 'Sour', label: 'Sour' },
  { code: 'Other', label: 'Other' },
];

export interface ShiftDto {
  id: number;
  collectionCenterId: number | null;
  collectionCenterName: string | null;
  shiftName: string;
  startTime: string;
  endTime: string;
  description: string | null;
  isActive: boolean;
}

export interface ShiftSummary {
  shiftId: number;
  shiftName: string;
  startTime: string;
  endTime: string;
  collectionCenterId: number | null;
  collectionCenterName: string | null;
  farmersServed: number;
  totalCollections: number;
  totalLiters: number;
  acceptedLiters: number;
  rejectedLiters: number;
  avgFat: number | null;
  avgSnf: number | null;
  acceptedCount: number;
  rejectedCount: number;
  approvedCount: number;
  pendingApprovals: number;
  totalAmount: number;
}

export interface ShiftDashboard {
  date: string;
  collectionCenterId: number | null;
  shiftId: number | null;
  shiftName: string | null;
  startTime: string | null;
  endTime: string | null;
  isCurrentShift: boolean;
  totalPendingApprovals: number;
  summary: ShiftSummary | null;
  shifts: ShiftSummary[];
}

export interface CollectionListItem {
  id: number;
  collectionNumber: string;
  collectionDate: string;
  shiftId: number;
  shiftName: string;
  collectionCenterId: number;
  collectionCenterName: string;
  farmerId: number;
  farmerCode: string;
  farmerName: string;
  milkType: string;
  quantityLiters: number;
  fat: number;
  snf: number;
  clr: number | null;
  rate: number;
  finalRate: number;
  bonusAmount: number;
  penaltyAmount: number;
  amount: number;
  qualityResult: string | null;
  status: string;
  settlementStatus: string;
  adjustedFlag: boolean;
  farmerPaymentId: number | null;
  createdDate: string;
}

export interface QualityTest {
  id: number;
  milkCollectionId: number;
  fat: number | null;
  snf: number | null;
  clr: number | null;
  protein: number | null;
  lactose: number | null;
  temperature: number | null;
  acidity: number | null;
  waterAdded: boolean | null;
  starchDetected: boolean | null;
  ureaDetected: boolean | null;
  neutralizerDetected: boolean | null;
  antibioticDetected: boolean | null;
  otherAdulteration: boolean | null;
  result: string;
  failureReason: string | null;
  testedBy: number | null;
  testedByName: string | null;
  testDate: string | null;
  remarks: string | null;
}

export interface RateBreakdown {
  rateChartId: number;
  rateChartName: string;
  calculationMethod: string;
  rateChartDetailId: number | null;
  slabFatFrom: number | null;
  slabFatTo: number | null;
  slabSnfFrom: number | null;
  slabSnfTo: number | null;
  fatUsed: number;
  snfUsed: number;
  quantityUsed: number;
  baseRate: number;
  bonus: number;
  penalty: number;
  finalRate: number;
  bonusAmount: number;
  penaltyAmount: number;
  calculatedDate: string | null;
}

export interface MilkRejection {
  id: number;
  milkCollectionId: number;
  collectionNumber: string;
  collectionDate: string;
  farmerId: number;
  farmerCode: string;
  farmerName: string;
  collectionCenterId: number;
  collectionCenterName: string;
  rejectionDate: string;
  reasonCode: string;
  reason: string;
  quantityLiters: number;
  disposalMethod: string | null;
  rejectedBy: number | null;
  rejectedByName: string | null;
  rejectedDate: string | null;
  remarks: string | null;
}

export interface CollectionDetail extends CollectionListItem {
  temperature: number | null;
  canCount: number | null;
  rateChartId: number | null;
  rateChartName: string | null;
  tankId: number | null;
  tankName: string | null;
  originalQuantity: number | null;
  originalFat: number | null;
  originalSnf: number | null;
  originalClr: number | null;
  originalRate: number | null;
  originalAmount: number | null;
  adjustmentReason: string | null;
  adjustedBy: number | null;
  adjustedByName: string | null;
  adjustedDate: string | null;
  approvedBy: number | null;
  approvedByName: string | null;
  approvedDate: string | null;
  rejectedBy: number | null;
  rejectedByName: string | null;
  rejectedDate: string | null;
  rejectionReason: string | null;
  collectedBy: number | null;
  collectedByName: string | null;
  remarks: string | null;
  qualityTests: QualityTest[];
  rateBreakdown: RateBreakdown | null;
  rejections: MilkRejection[];
}

export interface RatePreview {
  rateChartId: number;
  rateChartName: string;
  rateChartDetailId: number | null;
  baseRate: number;
  bonus: number;
  penalty: number;
  finalRate: number;
  amount: number;
}

export interface RatePreviewParams {
  centerId: number;
  date?: string;
  milkType?: string;
  fat: number;
  snf: number;
  clr?: number;
  quantity?: number;
}

export interface CreateCollectionRequest {
  collectionDate: string;
  shiftId: number;
  collectionCenterId: number;
  farmerId: number;
  milkType?: string;
  quantityLiters: number;
  fat: number;
  snf: number;
  clr?: number;
  temperature?: number;
  canCount?: number;
  milkTankId?: number;
  waterAdded?: boolean;
  remarks?: string;
}

export interface CreateCollectionResult {
  id: number;
  number: string;
  rate: number;
  baseRate: number;
  bonusAmount: number;
  penaltyAmount: number;
  amount: number;
  status: string;
}

export interface AdjustCollectionRequest {
  quantityLiters?: number;
  fat?: number;
  snf?: number;
  clr?: number;
  reason: string;
}

export interface RejectCollectionRequest {
  reason: string;
  quantityLiters?: number;
}

export interface BulkApproveResult {
  total: number;
  approved: number;
  failed: number;
  results: { id: number; success: boolean; number: string | null; message: string }[];
}

export interface QualityRequest {
  fat?: number;
  snf?: number;
  clr?: number;
  protein?: number;
  lactose?: number;
  temperature?: number;
  acidity?: number;
  waterAdded?: boolean;
  starchDetected?: boolean;
  ureaDetected?: boolean;
  neutralizerDetected?: boolean;
  antibioticDetected?: boolean;
  otherAdulteration?: boolean;
  result?: string;
  failureReason?: string;
  remarks?: string;
}
