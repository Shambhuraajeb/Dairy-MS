export interface Supplier {
  id: number;
  supplierCode: string;
  name: string;
  contactPerson: string | null;
  mobile: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstNumber: string | null;
  panNo: string | null;
  paymentTermsDays: number;
  isActive: boolean;
  createdDate: string;
  purchaseCount: number;
  totalPurchased: number;
}

export interface SupplierRequest {
  supplierCode: string;
  name: string;
  contactPerson: string | null;
  mobile: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstNumber: string | null;
  panNo: string | null;
  paymentTermsDays: number;
  isActive?: boolean;
}
