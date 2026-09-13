import { CounterField } from './data.schema';

/**
 * Computes the string value of a counter field for a specific record index.
 *
 * Requirements:
 * - Pure and deterministic: does not mutate the CounterField definition or external state.
 * - recordIndex is 0-indexed (0 = first label, 1 = second, etc.).
 * - Applies start + (recordIndex * step).
 * - Applies zero-padding.
 * - Prepends prefix (if configured) and appends suffix (if configured).
 */
export function resolveCounterValue(field: CounterField, recordIndex: number): string {
  if (!Number.isInteger(recordIndex) || recordIndex < 0) {
    throw new Error(`Record index must be a non-negative integer, received ${recordIndex}`);
  }

  const numericValue = field.start + recordIndex * field.step;
  const isNegative = numericValue < 0;
  const absStr = Math.abs(numericValue).toString().padStart(field.padding, '0');
  const formattedNumber = isNegative ? `-${absStr}` : absStr;

  const prefix = field.prefix ?? '';
  const suffix = field.suffix ?? '';

  return `${prefix}${formattedNumber}${suffix}`;
}

/**
 * Resolves multiple counter fields for a given record index into a key-value record.
 */
export function resolveCountersForRecord(
  counterFields: CounterField[],
  recordIndex: number
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of counterFields) {
    result[field.name] = resolveCounterValue(field, recordIndex);
  }
  return result;
}
