import { formatDate, formatNumber } from '../../shared/utils/format';

/** First present key wins; objects collapse to their name/status/label. */
export function pickValue(data: Record<string, any> | null | undefined, keys: readonly string[]): number | string | null {
  if (!data) {
    return null;
  }
  for (const k of keys) {
    const v = k.includes('.')
      ? k.split('.').reduce<any>((o, part) => (o === null || o === undefined ? undefined : o[part]), data)
      : data[k];
    if (v === undefined || v === null) {
      continue;
    }
    if (Array.isArray(v)) {
      return v.length;
    }
    if (typeof v === 'object') {
      const s = v.name ?? v.planName ?? v.status ?? v.label;
      if (s !== undefined && s !== null) {
        return String(s);
      }
      continue;
    }
    return v as number | string;
  }
  return null;
}

export function toSeries(points: readonly any[] | null | undefined): { labels: string[]; values: number[] } {
  const list = points ?? [];
  return {
    labels: list.map((p) => String(p?.label ?? p?.name ?? p?.date ?? '')),
    values: list.map((p) => Number(p?.value ?? p?.total ?? p?.amount ?? 0)),
  };
}

export function humanize(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Generic cell formatter for auto-rendered tables. */
export function formatCell(v: unknown): string {
  if (v === null || v === undefined || v === '') {
    return '—';
  }
  if (typeof v === 'number') {
    return formatNumber(v, 2);
  }
  if (typeof v === 'boolean') {
    return v ? 'Yes' : 'No';
  }
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      return formatDate(v, 'datetime');
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return formatDate(v, 'date');
    }
    return v;
  }
  return '';
}
