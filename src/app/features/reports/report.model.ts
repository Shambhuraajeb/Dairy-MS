export interface ReportColumn {
  key: string;
  label: string;
  /** text | number | money | date | datetime | boolean (percent/currency tolerated) */
  type: string;
}

export interface ReportCatalogItem {
  code: string;
  name: string;
  group: string;
  description: string;
  /** query-string filter keys supported by the report */
  filters: string[];
  columns: ReportColumn[];
}

export type ReportRow = Record<string, unknown>;

export interface ReportResult {
  code: string;
  name: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  totals: Record<string, unknown> | null;
  extra: Record<string, unknown> | null;
}

export const REPORT_FILTER_KEYS = [
  'from',
  'to',
  'branchId',
  'collectionCenterId',
  'farmerId',
  'customerId',
  'productId',
  'shiftId',
  'itemId',
  'categoryId',
  'status',
] as const;

export type ReportFilterKey = (typeof REPORT_FILTER_KEYS)[number];
