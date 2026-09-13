import type { PrintErrorCode } from './print-job.types';

/**
 * Default maximum attempts for retryable job failures.
 */
export const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Upper safety bound on requested print copies.
 */
export const MAX_COPIES_LIMIT = 999;

/**
 * Set of error codes that represent transient network or queue issues
 * that may safely be retried BEFORE or DURING connection establishment.
 */
export const RETRYABLE_ERROR_CODES: ReadonlySet<PrintErrorCode> = new Set<PrintErrorCode>([
  'CONNECTION_REFUSED',
  'CONNECTION_TIMEOUT',
  'CONNECTION_RESET',
  'SPOOLER_ERROR',
]);

/**
 * Checks whether an error code qualifies for automated retry.
 */
export function isErrorRetryable(code: PrintErrorCode): boolean {
  return RETRYABLE_ERROR_CODES.has(code);
}

/**
 * Calculates backoff delay in milliseconds based on the attempt number.
 * Attempt 1 -> 0ms (immediate retry)
 * Attempt 2 -> 2000ms (2 seconds)
 * Attempt 3 -> 5000ms (5 seconds)
 * Attempt > 3 -> 10000ms
 */
export function calculateRetryDelayMs(attempt: number): number {
  if (attempt <= 1) return 0;
  if (attempt === 2) return 2000;
  if (attempt === 3) return 5000;
  return 10000;
}

/**
 * Validates the number of copies requested.
 */
export function validateCopies(copies: number): boolean {
  return Number.isInteger(copies) && copies >= 1 && copies <= MAX_COPIES_LIMIT;
}
