export const RATE_CHART_STATUSES = ['Draft', 'Active', 'Expired'] as const;
export type CalculationMethod = 'Slab' | 'Formula';

export interface RateChartListItem {
  id: number;
  name: string;
  milkType: string;
  collectionCenterId: number | null;
  collectionCenterName: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  calculationMethod: string;
  baseRatePerLiter: number;
  baseFat: number;
  baseSnf: number;
  fatRatePerPoint: number;
  snfRatePerPoint: number;
  minRatePerLiter: number;
  maxRatePerLiter: number | null;
  detailCount: number;
  activatedDate: string | null;
  isActive: boolean;
  createdDate: string;
}

export interface RateChartDetail {
  id?: number;
  fatFrom: number;
  fatTo: number;
  snfFrom: number;
  snfTo: number;
  rate: number;
  bonusPerLiter: number;
  penaltyPerLiter: number;
}

export interface RateChart extends RateChartListItem {
  bonusMinFat: number | null;
  bonusMinSnf: number | null;
  qualityBonusPerLiter: number;
  penaltyBelowFat: number | null;
  penaltyBelowSnf: number | null;
  qualityPenaltyPerLiter: number;
  description: string | null;
  activatedBy: number | null;
  details: RateChartDetail[];
}

export interface RateChartRequest {
  name: string;
  milkType: string;
  collectionCenterId?: number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  calculationMethod: string;
  baseRatePerLiter: number;
  baseFat: number;
  baseSnf: number;
  fatRatePerPoint: number;
  snfRatePerPoint: number;
  minRatePerLiter: number;
  maxRatePerLiter?: number | null;
  bonusMinFat?: number | null;
  bonusMinSnf?: number | null;
  qualityBonusPerLiter: number;
  penaltyBelowFat?: number | null;
  penaltyBelowSnf?: number | null;
  qualityPenaltyPerLiter: number;
  description?: string | null;
  details: RateChartDetail[];
}

export interface ActivateRateChartResult {
  chart: RateChart;
  supersededChartIds: number[];
}
