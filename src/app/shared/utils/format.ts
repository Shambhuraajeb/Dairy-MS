const LOCALE = 'en-IN';

export type DateInput = Date | string | number | null | undefined;

/** Parses ISO strings; date-only strings (yyyy-MM-dd) are treated as local dates to avoid timezone shifts. */
export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) {
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: DateInput, mode: 'date' | 'datetime' | 'time' = 'date'): string {
  const d = toDate(value);
  if (!d) {
    return '—';
  }
  const opts: Intl.DateTimeFormatOptions =
    mode === 'time'
      ? { hour: '2-digit', minute: '2-digit' }
      : mode === 'datetime'
        ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(LOCALE, opts).format(d);
}

export function formatNumber(value: number | string | null | undefined, maxDigits = 2, minDigits = 0): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const n = Number(value);
  if (isNaN(n)) {
    return '—';
  }
  return new Intl.NumberFormat(LOCALE, { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits }).format(n);
}

export function formatCurrency(value: number | string | null | undefined, currency = 'INR', digits = 2): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const n = Number(value);
  if (isNaN(n)) {
    return '—';
  }
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/** yyyy-MM-dd in local time (for date inputs / query params) */
export function toIsoDate(d: Date = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
