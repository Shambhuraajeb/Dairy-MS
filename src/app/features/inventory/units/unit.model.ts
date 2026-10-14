export interface Unit {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

export interface UnitRequest {
  code: string;
  name: string;
  isActive: boolean;
}
