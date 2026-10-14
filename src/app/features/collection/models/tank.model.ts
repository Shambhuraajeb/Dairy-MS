export const TANK_STATUSES = ['Active', 'Maintenance', 'Inactive'] as const;

export interface Tank {
  id: number;
  code: string;
  name: string;
  collectionCenterId: number;
  collectionCenterName: string;
  capacityLiters: number;
  currentQuantity: number;
  availableCapacity: number;
  fillPercent: number;
  milkType: string | null;
  minTemperature: number | null;
  maxTemperature: number | null;
  currentTemperature: number | null;
  status: string;
  lastCleanedDate: string | null;
  isActive: boolean;
  createdDate: string;
}

export interface CreateTankRequest {
  code: string;
  name: string;
  collectionCenterId: number;
  capacityLiters: number;
  milkType?: string | null;
  minTemperature?: number | null;
  maxTemperature?: number | null;
  currentTemperature?: number | null;
}

export interface UpdateTankRequest {
  name: string;
  collectionCenterId: number;
  capacityLiters: number;
  milkType?: string | null;
  minTemperature?: number | null;
  maxTemperature?: number | null;
  currentTemperature?: number | null;
  status: string;
  lastCleanedDate?: string | null;
  isActive?: boolean;
}

export interface TankTxn {
  id: number;
  tankId: number;
  transactionType: string;
  quantity: number;
  balanceAfter: number;
  milkCollectionId: number | null;
  collectionNumber: string | null;
  transactionDate: string;
  destination: string | null;
  referenceType: string | null;
  referenceId: number | null;
  remarks: string | null;
  createdBy: number | null;
  createdByName: string | null;
}

export interface TankTxnRequest {
  transactionType: 'Out' | 'Adjust';
  quantity: number;
  destination?: string;
  remarks?: string;
}
