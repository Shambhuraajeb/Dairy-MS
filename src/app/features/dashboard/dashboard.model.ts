/**
 * Dashboard API contract (tolerant): backend returns ApiResponse<T>; every field is optional on the client.
 *
 * GET /api/dashboard/summary  -> DashboardSummary (flat object of numbers, camelCase, exactly these names)
 * GET /api/dashboard/charts   -> DashboardCharts (each series = [{ label: string, value: number }])
 *
 * GET /api/dashboard/collection | inventory | customer -> flat object; the frontend picks KPIs by these
 * keys (first present alias wins) and auto-renders any array property: arrays of {label,value} become a
 * chart, arrays of objects become a table (first 6 non-id columns).
 *   collection: currentShift (string | {name}), farmersServed, totalLiters, avgFat, avgSnf, acceptedCount,
 *               rejectedCount, pendingApprovals, [recentCollections[]], [shiftTrend [{label,value}]]
 *   inventory:  stockValue, lowStockCount, expiringBatches, [recentPurchases[]], [consumptionTrend [{label,value}]]
 *   customer:   activeSubscriptions | subscription ({planName}|string), todayDeliveryStatus | todayDelivery (string),
 *               currentBill, outstanding, openComplaints, [recentDeliveries[]]
 */
export interface DashboardSummary {
  milkCollectedToday?: number;
  morningCollection?: number;
  eveningCollection?: number;
  avgFat?: number;
  avgSnf?: number;
  todayMilkValue?: number;
  salesToday?: number;
  salesThisMonth?: number;
  farmerOutstanding?: number;
  customerOutstanding?: number;
  activeSubscriptions?: number;
  lowStockCount?: number;
  expiringInventoryCount?: number;
  sickAnimals?: number;
  vaccinationsDue?: number;
  maintenanceDue?: number;
  deliverySuccessRate?: number;
  revenue?: number;
  expenses?: number;
  profit?: number;
  [key: string]: number | undefined;
}

export interface ChartPoint {
  label: string;
  value: number;
  [key: string]: unknown;
}

export interface DashboardCharts {
  milkCollectionTrend?: ChartPoint[];
  salesTrend?: ChartPoint[];
  collectionByCenter?: ChartPoint[];
  topFarmers?: ChartPoint[];
  productSales?: ChartPoint[];
  expenseCategories?: ChartPoint[];
}

export type DashboardVariantName = 'collection' | 'inventory' | 'customer';
export type DashboardVariantData = Record<string, any>;
