import { NullHandlingPolicy } from './field-mapping.schema';

export interface ExternalNormalizationOptions {
  nullHandling?: NullHandlingPolicy;
  defaultValue?: string;
  columnName?: string;
}

export type ValueNormalizationOptions = ExternalNormalizationOptions;

export class NormalizationError extends Error {
  constructor(message: string, public readonly columnName?: string) {
    super(message);
    this.name = 'NormalizationError';
  }
}

/**
 * Normalizes an untyped external value (from CSV, Excel, SQL, REST) into a string representation.
 *
 * Rules:
 * - Does NOT perform speculative string parsing (e.g. "01/02/03" remains an exact string, never coerced to Date).
 * - Numbers are converted to finite numeric strings.
 * - Booleans are converted to "true" or "false".
 * - Valid Date objects are converted to ISO 8601 strings.
 * - Null/undefined values follow the explicit NullHandlingPolicy:
 *     - 'empty': Returns "".
 *     - 'default': Uses options.defaultValue, or throws if defaultValue is not provided and field is strict.
 *     - 'error': Throws NormalizationError.
 */
export function normalizeExternalValue(
  value: unknown,
  options: ExternalNormalizationOptions = {}
): string {
  const { nullHandling = 'default', defaultValue, columnName } = options;

  // 1. Handle null and undefined
  if (value === null || value === undefined) {
    if (nullHandling === 'error') {
      throw new NormalizationError(
        `Null or undefined value encountered for column '${columnName || 'unknown'}' under 'error' policy`,
        columnName
      );
    }
    if (nullHandling === 'default') {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      return '';
    }
    return '';
  }

  // 2. Exact string preservation (never speculate or mutate strings)
  if (typeof value === 'string') {
    return value;
  }

  // 3. Finite Numbers
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new NormalizationError(
        `Non-finite numeric value '${value}' in column '${columnName || 'unknown'}'`,
        columnName
      );
    }
    return value.toString();
  }

  // 4. Booleans
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  // 5. BigInt
  if (typeof value === 'bigint') {
    return value.toString();
  }

  // 6. Real Date instances
  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      throw new NormalizationError(
        `Invalid Date object in column '${columnName || 'unknown'}'`,
        columnName
      );
    }
    return value.toISOString();
  }

  // 7. Structured objects or arrays (serialize safely to JSON)
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      throw new NormalizationError(
        `Unable to serialize object in column '${columnName || 'unknown'}'`,
        columnName
      );
    }
  }

  // Unsupported symbol or function
  throw new NormalizationError(
    `Unsupported value type '${typeof value}' in column '${columnName || 'unknown'}'`,
    columnName
  );
}

/**
 * Type-safe variant that returns a result object instead of throwing.
 */
export function safeNormalizeExternalValue(
  value: unknown,
  options: ExternalNormalizationOptions = {}
): { success: true; value: string } | { success: false; error: string } {
  try {
    const normalized = normalizeExternalValue(value, options);
    return { success: true, value: normalized };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown normalization error',
    };
  }
}
