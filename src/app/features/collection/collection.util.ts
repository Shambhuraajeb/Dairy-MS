import { ShiftDto } from './models/collection.model';

/** '06:00:00' -> '06:00' */
export function trimTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '';
}

/** first 10 chars of an ISO datetime (yyyy-MM-dd); '' when empty */
export function isoDay(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

export function shiftLabel(s: ShiftDto): string {
  const time = s.startTime ? ` (${trimTime(s.startTime)}-${trimTime(s.endTime)})` : '';
  const center = s.collectionCenterName ? ` - ${s.collectionCenterName}` : '';
  return `${s.shiftName}${time}${center}`;
}

/** shifts that apply to the given center (center-less shifts apply everywhere) */
export function shiftsForCenter(shifts: ShiftDto[], centerId: number | null | undefined): ShiftDto[] {
  if (!centerId) {
    return shifts;
  }
  return shifts.filter((s) => s.collectionCenterId === null || s.collectionCenterId === centerId);
}

/** the shift whose time window contains "now" (handles overnight windows), else null */
export function currentShift(shifts: ShiftDto[]): ShiftDto | null {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMin = (t: string): number => {
    const [h, m] = t.split(':');
    return Number(h) * 60 + Number(m);
  };
  for (const s of shifts) {
    if (!s.startTime || !s.endTime) {
      continue;
    }
    const start = toMin(s.startTime);
    const end = toMin(s.endTime);
    const inside = start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
    if (inside) {
      return s;
    }
  }
  return null;
}

/** A `shift` query param may be a shift id or a shift name (dashboard links use names such as "Morning"). */
export function resolveShiftId(shifts: ShiftDto[], value: string | null | undefined, centerId?: number | null): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (/^\d+$/.test(value)) {
    return Number(value);
  }
  const wanted = value.toLowerCase();
  const matches = shifts.filter((s) => s.shiftName.toLowerCase() === wanted);
  if (matches.length === 0) {
    return null;
  }
  const exact = centerId ? matches.find((s) => s.collectionCenterId === centerId) : undefined;
  return (exact ?? matches[0]).id;
}

/** query-param string -> number or null */
export function toNumberOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = Number(value);
  return isNaN(n) ? null : n;
}

/** form number (maybe null/NaN) -> number | undefined for request bodies */
export function optNumber(value: number | null | undefined): number | undefined {
  return value === null || value === undefined || isNaN(value) ? undefined : value;
}

/** form text -> trimmed string | undefined */
export function optText(value: string | null | undefined): string | undefined {
  const t = (value ?? '').trim();
  return t ? t : undefined;
}

export function qualityColor(result: string | null | undefined): 'success' | 'danger' | 'secondary' {
  return result === 'Pass' ? 'success' : result === 'Fail' ? 'danger' : 'secondary';
}

export function monthStart(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
