export type CustomerType = 'Retail' | 'Distributor';
export const CUSTOMER_TYPES: CustomerType[] = ['Retail', 'Distributor'];

export interface Product {
  id: number;
  productCode: string;
  name: string;
  productCategoryId: number;
  categoryName: string | null;
  unitId: number;
  unitCode: string | null;
  unitName: string | null;
  description: string | null;
  taxPercent: number;
  hsnCode: string | null;
  isMilkBased: boolean;
  milkLitersPerUnit: number | null;
  defaultPrice: number;
  currentPrice: number | null;
  distributorPrice: number | null;
  currentStock: number;
  reorderLevel: number;
  shelfLifeDays: number | null;
  imagePath: string | null;
  isActive: boolean;
}

export interface ProductRequest {
  productCode?: string | null;
  name: string;
  productCategoryId: number;
  unitId: number;
  description?: string | null;
  taxPercent: number;
  hsnCode?: string | null;
  isMilkBased: boolean;
  milkLitersPerUnit?: number | null;
  defaultPrice: number;
  currentStock?: number | null;
  reorderLevel: number;
  shelfLifeDays?: number | null;
  isActive?: boolean | null;
}

export interface ProductCategory {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  productCount: number;
}

export interface ProductCategoryRequest {
  code?: string | null;
  name: string;
  description?: string | null;
  isActive?: boolean | null;
}

export interface ProductPrice {
  id: number;
  productId: number;
  productName: string;
  productCode: string;
  customerType: CustomerType;
  price: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdDate: string;
}

export interface ProductPriceRequest {
  productId: number;
  customerType: CustomerType;
  price: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface ProductPriceInfo {
  productId: number;
  customerType: string;
  date: string;
  price: number;
  source: 'PriceList' | 'Default';
  taxPercent: number;
}
