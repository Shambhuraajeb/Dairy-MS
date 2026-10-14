export interface ItemCategory {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  itemCount: number;
}

export interface ItemCategoryRequest {
  code: string;
  name: string;
  description: string | null;
  isActive?: boolean;
}

export type StockStatus = 'OutOfStock' | 'Low' | 'OK';

export interface InventoryItem {
  id: number;
  itemCode: string;
  name: string;
  itemCategoryId: number;
  categoryName: string;
  unitId: number;
  unitName: string;
  description: string | null;
  reorderLevel: number;
  maxStockLevel: number | null;
  currentStock: number;
  unitCost: number;
  stockValue: number;
  taxPercent: number;
  isPerishable: boolean;
  hasExpiry: boolean;
  shelfLifeDays: number | null;
  preferredSupplierId: number | null;
  preferredSupplierName: string | null;
  storageLocation: string | null;
  barcode: string | null;
  isActive: boolean;
  stockStatus: StockStatus;
}

export interface InventoryBatch {
  id: number;
  inventoryItemId: number;
  itemCode: string;
  itemName: string;
  unitName: string;
  batchNumber: string;
  supplierId: number | null;
  supplierName: string | null;
  purchaseDetailId: number | null;
  purchaseNumber: string | null;
  manufactureDate: string | null;
  expiryDate: string | null;
  receivedDate: string | null;
  quantityReceived: number;
  quantityAvailable: number;
  unitCost: number;
  stockValue: number;
  storageLocation: string | null;
  status: string;
  daysToExpiry: number | null;
  isExpired: boolean;
}

export interface InventoryItemDetail extends InventoryItem {
  totalBatches: number;
  availableBatches: number;
  expiredBatches: number;
  nearestExpiryDate: string | null;
  batches: InventoryBatch[];
}

export interface ItemRequest {
  itemCode: string;
  name: string;
  itemCategoryId: number;
  unitId: number;
  description: string | null;
  reorderLevel: number;
  maxStockLevel: number | null;
  unitCost: number;
  taxPercent: number;
  isPerishable: boolean;
  hasExpiry: boolean;
  shelfLifeDays: number | null;
  preferredSupplierId: number | null;
  storageLocation: string | null;
  barcode: string | null;
  isActive?: boolean;
}

export interface Purchase {
  id: number;
  purchaseNumber: string;
  supplierId: number;
  supplierName: string;
  branchId: number | null;
  purchaseDate: string;
  expectedDate: string | null;
  supplierInvoiceNo: string | null;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  status: string;
  approvedBy: number | null;
  approvedByName: string | null;
  approvedDate: string | null;
  receivedBy: number | null;
  receivedByName: string | null;
  receivedDate: string | null;
  cancelledDate: string | null;
  cancelReason: string | null;
  remarks: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdDate: string;
  lineCount: number;
}

export interface PurchaseLine {
  id: number;
  purchaseId: number;
  inventoryItemId: number;
  itemCode: string;
  itemName: string;
  unitName: string;
  quantity: number;
  receivedQuantity: number;
  unitCost: number;
  taxPercent: number;
  taxAmount: number;
  lineTotal: number;
  batchNumber: string | null;
  manufactureDate: string | null;
  expiryDate: string | null;
  remarks: string | null;
}

export interface PurchaseDetail extends Purchase {
  lines: PurchaseLine[];
}

export interface PurchaseLineRequest {
  inventoryItemId: number;
  quantity: number;
  unitCost: number | null;
  batchNumber: string | null;
  manufactureDate: string | null;
  expiryDate: string | null;
}

export interface PurchaseRequest {
  supplierId: number;
  purchaseDate: string | null;
  remarks: string | null;
  items: PurchaseLineRequest[];
}

export interface PurchaseCreated {
  id: number;
  number: string;
  totalAmount: number;
}

export interface StockTransaction {
  id: number;
  inventoryItemId: number;
  itemCode: string;
  itemName: string;
  unitName: string;
  inventoryBatchId: number | null;
  batchNumber: string | null;
  transactionType: string;
  quantity: number;
  unitCost: number | null;
  balanceAfter: number | null;
  referenceType: string | null;
  referenceId: number | null;
  remarks: string | null;
  transactionDate: string;
  createdBy: number | null;
  createdByName: string | null;
}

export interface Consumption {
  id: number;
  inventoryItemId: number;
  itemCode: string;
  itemName: string;
  unitName: string;
  inventoryBatchId: number | null;
  batchNumber: string | null;
  stockTransactionId: number | null;
  quantity: number;
  unitCost: number;
  costValue: number;
  consumptionDate: string;
  purpose: string | null;
  branchId: number | null;
  consumedBy: number | null;
  consumedByName: string | null;
  expiredOverride: boolean;
  overrideReason: string | null;
  createdDate: string;
}

export interface ConsumptionRequest {
  inventoryItemId: number;
  inventoryBatchId: number | null;
  quantity: number;
  consumptionDate: string | null;
  purpose: string | null;
  expiredOverride: boolean;
}

export interface ConsumptionResult {
  id: number;
  quantity: number;
  batchesUsed: number;
  currentStock: number;
}

export interface AdjustmentRequest {
  inventoryItemId: number;
  inventoryBatchId: number | null;
  quantityDelta: number;
  reason: string;
}

export interface AdjustmentResult {
  id: number;
  previousStock: number;
  currentStock: number;
}

export interface LowStockAlert {
  id: number;
  itemCode: string;
  itemName: string;
  categoryName: string;
  unitName: string;
  currentStock: number;
  reorderLevel: number;
  maxStockLevel: number | null;
  shortfall: number;
  unitCost: number;
  stockStatus: string;
}

export interface ExpiringAlert {
  id: number;
  inventoryItemId: number;
  itemCode: string;
  itemName: string;
  batchNumber: string;
  expiryDate: string;
  quantityAvailable: number;
  unitName: string;
  unitCost: number;
  stockValue: number;
  daysToExpiry: number;
  isExpired: boolean;
  status: string;
}

export const PURCHASE_STATUSES = ['Draft', 'Approved', 'Received', 'Cancelled'];
export const PAYMENT_STATUSES = ['Unpaid', 'Partial', 'Paid'];
export const BATCH_STATUSES = ['Available', 'Depleted', 'Expired', 'Quarantined'];
export const TRANSACTION_TYPES = ['Purchase', 'Consumption', 'Adjustment', 'Return', 'Sale', 'Opening'];
