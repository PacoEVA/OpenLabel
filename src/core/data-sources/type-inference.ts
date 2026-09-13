import { DatasetColumnType } from './dataset.schema';

/**
 * Infers the DatasetColumnType from an array of sample values for a given column.
 *
 * Rules:
 * - Empty array or all null/undefined -> 'null'.
 * - Consistent non-null types -> inferred type ('string' | 'number' | 'boolean' | 'date').
 * - Conflicting non-null types (e.g. string and number) -> 'mixed'.
 * - Date is only inferred from actual Date objects or valid ISO-8601 strings (YYYY-MM-DD...),
 *   never from ambiguous date formats like "01/02/03".
 */
export function inferColumnType(values: unknown[]): DatasetColumnType {
  const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== '');

  if (nonNullValues.length === 0) {
    return 'null';
  }

  let detectedType: DatasetColumnType | null = null;

  for (const val of nonNullValues) {
    let currentType: DatasetColumnType;

    if (typeof val === 'number') {
      currentType = 'number';
    } else if (typeof val === 'boolean') {
      currentType = 'boolean';
    } else if (val instanceof Date) {
      currentType = isNaN(val.getTime()) ? 'mixed' : 'date';
    } else if (typeof val === 'string') {
      currentType = 'string';
    } else {
      currentType = 'mixed';
    }

    if (detectedType === null) {
      detectedType = currentType;
    } else if (detectedType !== currentType) {
      return 'mixed';
    }
  }

  return detectedType ?? 'null';
}
