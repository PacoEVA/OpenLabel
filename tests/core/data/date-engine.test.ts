import { describe, it, expect } from 'vitest';
import {
  formatDate,
  applyDateOffset,
  resolveDateValue,
  resolveDatesForRecord,
  ResolutionContext,
} from '../../../src/core/data/date-engine';
import { DateField } from '../../../src/core/data/data.schema';

describe('formatDate', () => {
  const sampleDate = new Date(2026, 2, 5); // 2026-03-05 (month index 2 = March)

  it('formats YYYY-MM-DD', () => {
    expect(formatDate(sampleDate, 'YYYY-MM-DD')).toBe('2026-03-05');
  });

  it('formats DD/MM/YYYY', () => {
    expect(formatDate(sampleDate, 'DD/MM/YYYY')).toBe('05/03/2026');
  });

  it('formats MM/DD/YYYY', () => {
    expect(formatDate(sampleDate, 'MM/DD/YYYY')).toBe('03/05/2026');
  });

  it('formats YYYYMMDD', () => {
    expect(formatDate(sampleDate, 'YYYYMMDD')).toBe('20260305');
  });

  it('formats DD-MM-YYYY', () => {
    expect(formatDate(sampleDate, 'DD-MM-YYYY')).toBe('05-03-2026');
  });
});

describe('applyDateOffset', () => {
  it('adds and subtracts days correctly', () => {
    const base = new Date(2026, 2, 15); // 2026-03-15
    const plus30 = applyDateOffset(base, { days: 30 });
    expect(formatDate(plus30, 'YYYY-MM-DD')).toBe('2026-04-14');

    const minus7 = applyDateOffset(base, { days: -7 });
    expect(formatDate(minus7, 'YYYY-MM-DD')).toBe('2026-03-08');
  });

  it('adds months and years correctly for regular dates', () => {
    const base = new Date(2026, 2, 15); // 2026-03-15
    const plus1Month = applyDateOffset(base, { months: 1 });
    expect(formatDate(plus1Month, 'YYYY-MM-DD')).toBe('2026-04-15');

    const plus1Year = applyDateOffset(base, { years: 1 });
    expect(formatDate(plus1Year, 'YYYY-MM-DD')).toBe('2027-03-15');
  });

  it('clamps day to last day of month when target month has fewer days (Jan 31 + 1 month -> Feb 28)', () => {
    const jan31 = new Date(2026, 0, 31); // 2026-01-31 (not a leap year)
    const febResult = applyDateOffset(jan31, { months: 1 });
    expect(formatDate(febResult, 'YYYY-MM-DD')).toBe('2026-02-28');
  });

  it('clamps leap year Feb 29 + 1 year -> Feb 28', () => {
    const leapDay = new Date(2024, 1, 29); // 2024-02-29
    const nextYear = applyDateOffset(leapDay, { years: 1 });
    expect(formatDate(nextYear, 'YYYY-MM-DD')).toBe('2025-02-28');
  });
});

describe('resolveDateValue and resolveDatesForRecord', () => {
  const fixedNow = new Date(2026, 5, 20); // 2026-06-20
  const context: ResolutionContext = { now: fixedNow };

  const nowField: DateField = {
    id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf1',
    name: 'print_date',
    type: 'date',
    mode: 'now',
    format: 'YYYY-MM-DD',
  };

  const expField: DateField = {
    id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf2',
    name: 'expiration_date',
    type: 'date',
    mode: 'relative',
    offset: { days: 90 },
    format: 'DD/MM/YYYY',
  };

  it('resolves mode: now using context.now', () => {
    const val = resolveDateValue(nowField, context);
    expect(val).toBe('2026-06-20');
  });

  it('resolves mode: relative with offset', () => {
    const val = resolveDateValue(expField, context);
    // 2026-06-20 + 90 days: June has 10 days left -> July 31 -> August 31 -> September 18
    const expected = formatDate(applyDateOffset(fixedNow, { days: 90 }), 'DD/MM/YYYY');
    expect(val).toBe(expected);
  });

  it('resolves multiple date fields consistently sharing the same context', () => {
    const record = resolveDatesForRecord([nowField, expField], context);
    expect(record.print_date).toBe('2026-06-20');
    expect(record.expiration_date).toBe(formatDate(applyDateOffset(fixedNow, { days: 90 }), 'DD/MM/YYYY'));
  });
});
