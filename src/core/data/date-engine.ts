import { DateField, DateFormat } from './data.schema';

export interface ResolutionContext {
  now: Date;
}

/**
 * Returns the number of days in a given month and year.
 * (month is 0-indexed: 0 = Jan, 1 = Feb, ..., 11 = Dec).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Applies relative offsets (days, months, years) to a reference Date.
 *
 * Arithmetic policy for month/year offsets:
 * If the resulting month has fewer days than the original day (e.g. Jan 31 + 1 month),
 * the day is clamped to the last day of the target month (Feb 28/29),
 * avoiding accidental overflow into the following month.
 */
export function applyDateOffset(
  baseDate: Date,
  offset?: { days?: number; months?: number; years?: number }
): Date {
  if (!offset) {
    return new Date(baseDate.getTime());
  }

  const result = new Date(baseDate.getTime());

  // 1. Apply Year and Month offsets with day clamping
  const years = offset.years ?? 0;
  const months = offset.months ?? 0;

  if (years !== 0 || months !== 0) {
    const originalDay = result.getDate();
    const currentYear = result.getFullYear();
    const currentMonth = result.getMonth();

    // Total months calculation
    const totalMonths = currentMonth + months + years * 12;
    const targetYear = Math.floor(totalMonths / 12) + (totalMonths < 0 && totalMonths % 12 !== 0 ? 0 : 0);
    // Normalized year and month
    const newDate = new Date(result.getTime());
    newDate.setFullYear(currentYear + years);
    newDate.setMonth(currentMonth + months);

    // If day was clamped by JS overflow, adjust to last day of intended month
    const intendedYear = currentYear + years + Math.floor((currentMonth + months) / 12);
    const intendedMonth = ((currentMonth + months) % 12 + 12) % 12;
    const maxDays = getDaysInMonth(intendedYear, intendedMonth);
    const clampedDay = Math.min(originalDay, maxDays);

    result.setFullYear(intendedYear, intendedMonth, clampedDay);
  }

  // 2. Apply Day offset
  const days = offset.days ?? 0;
  if (days !== 0) {
    result.setDate(result.getDate() + days);
  }

  return result;
}

/**
 * Formats a Date object into one of the supported standard label formats.
 * Does not depend on system locale or timezone string conversions.
 */
export function formatDate(date: Date, format: DateFormat): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYYMMDD':
      return `${year}${month}${day}`;
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`;
    default: {
      const _exhaustive: never = format;
      throw new Error(`Unsupported date format: ${_exhaustive}`);
    }
  }
}

/**
 * Resolves a DateField value given a ResolutionContext.
 *
 * Requirements:
 * - Pure and deterministic: relies exclusively on context.now.
 * - Supports 'now' and 'relative' modes.
 */
export function resolveDateValue(
  field: DateField,
  context: ResolutionContext
): string {
  const baseDate = context.now;
  const targetDate =
    field.mode === 'relative'
      ? applyDateOffset(baseDate, field.offset)
      : new Date(baseDate.getTime());

  return formatDate(targetDate, field.format);
}

/**
 * Resolves all date fields in a collection for a given context into a key-value record.
 */
export function resolveDatesForRecord(
  dateFields: DateField[],
  context: ResolutionContext
): Record<string, string> {
  const record: Record<string, string> = {};
  for (const field of dateFields) {
    record[field.name] = resolveDateValue(field, context);
  }
  return record;
}
