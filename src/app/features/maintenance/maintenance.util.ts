import { toDate } from '../../shared/utils/format';

/** whole days from today to the given date (negative = past); null when no date */
export function daysUntil(value: string | null | undefined): number | null {
  const d = toDate(value);
  if (!d) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
