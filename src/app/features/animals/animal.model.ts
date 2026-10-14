export interface AnimalListItem {
  id: number;
  tagNumber: string;
  name: string | null;
  farmerId: number;
  farmerCode: string;
  farmerName: string;
  breedId: number | null;
  breedName: string | null;
  animalType: string;
  gender: string;
  dateOfBirth: string | null;
  ageMonths: number | null;
  milkingStatus: string;
  pregnancyStatus: string;
  expectedDeliveryDate: string | null;
  status: string;
  registrationDate: string | null;
  isActive: boolean;
}

export interface AnimalSale {
  id: number;
  animalId: number;
  saleDate: string;
  buyerName: string;
  buyerMobile: string | null;
  buyerAddress: string | null;
  salePrice: number;
  paymentModeId: number | null;
  referenceNo: string | null;
  reason: string | null;
  remarks: string | null;
}

export interface AnimalDeath {
  id: number;
  animalId: number;
  deathDate: string;
  cause: string | null;
  causeCategory: string;
  vetName: string | null;
  postMortemDone: boolean;
  lossAmount: number | null;
  remarks: string | null;
}

export interface AnimalDetail extends AnimalListItem {
  color: string | null;
  weightKg: number | null;
  source: string;
  lactationNo: number | null;
  lastCalvingDate: string | null;
  statusDate: string | null;
  remarks: string | null;
  createdDate: string;
  sale: AnimalSale | null;
  death: AnimalDeath | null;
}

export interface AnimalRequest {
  tagNumber: string;
  farmerId: number;
  breedId: number | null;
  name: string | null;
  animalType: string;
  gender: string;
  dateOfBirth: string | null;
  color: string | null;
  weightKg: number | null;
  source: string;
  registrationDate: string | null;
  lactationNo: number | null;
  lastCalvingDate: string | null;
  milkingStatus: string;
  pregnancyStatus: string;
  expectedDeliveryDate: string | null;
  remarks: string | null;
}

export interface AnimalDueItem {
  /** synthetic row key built client side */
  id: string;
  animalId: number;
  tagNumber: string;
  animalName: string | null;
  farmerId: number;
  farmerName: string;
  dueType: string;
  title: string;
  dueDate: string;
  daysRemaining: number;
  status: string;
  refId: number | null;
}

export interface LifecycleEvent {
  eventDate: string;
  eventType: string;
  title: string;
  details: string | null;
  refId: number | null;
}

export interface Breed {
  id: number;
  code: string;
  name: string;
  animalType: string;
  averageDailyYield: number | null;
  description: string | null;
  isActive: boolean;
}

export interface BreedRequest {
  code: string;
  name: string;
  animalType: string;
  averageDailyYield: number | null;
  description: string | null;
  isActive?: boolean;
}

export interface SaleRequest {
  saleDate: string | null;
  buyerName: string;
  buyerMobile: string | null;
  buyerAddress: string | null;
  salePrice: number;
  paymentModeId: number | null;
  referenceNo: string | null;
  reason: string | null;
  remarks: string | null;
}

export interface DeathRequest {
  deathDate: string | null;
  cause: string | null;
  causeCategory: string;
  vetName: string | null;
  postMortemDone: boolean;
  lossAmount: number | null;
  remarks: string | null;
}

export const ANIMAL_TYPES = ['Cow', 'Buffalo', 'Goat'] as const;
export const ANIMAL_STATUSES = ['Active', 'Sick', 'Sold', 'Dead', 'Archived'] as const;

/** Only Active/Sick animals can be edited, sold, killed or archived and receive new records */
export function isAnimalEditable(status: string | null | undefined): boolean {
  return status === 'Active' || status === 'Sick';
}
