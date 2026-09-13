import type { PrinterLanguage } from './printer-profile.schema';

/**
 * Lifecycle states of a print job.
 */
export type PrintJobStatus =
  | 'queued'
  | 'validating'
  | 'dispatching'
  | 'completed'
  | 'failed'
  | 'retry_wait'
  | 'cancelled'
  | 'unknown';

/**
 * Standard error codes for printing operations.
 */
export type PrintErrorCode =
  | 'INVALID_REQUEST'
  | 'PRINTER_PROFILE_NOT_FOUND'
  | 'PRINTER_DISABLED'
  | 'UNSUPPORTED_ARTIFACT'
  | 'DPI_MISMATCH'
  | 'COMPILE_FAILED'
  | 'CONNECTION_REFUSED'
  | 'CONNECTION_TIMEOUT'
  | 'CONNECTION_RESET'
  | 'SPOOLER_ERROR'
  | 'SYSTEM_PRINTER_NOT_FOUND'
  | 'CANCELLED'
  | 'UNKNOWN_PRINT_ERROR';

/**
 * Structured print error information.
 */
export interface PrintError {
  readonly code: PrintErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: unknown;
}

/**
 * The core PrintJob entity representing a requested printing operation.
 */
export interface PrintJob {
  readonly id: string; // UUID v4
  readonly printerProfileId: string; // UUID v4
  readonly artifactType: PrinterLanguage;
  readonly copies: number; // 1 to 999
  readonly status: PrintJobStatus;
  readonly attempt: number; // >= 0
  readonly maxAttempts: number; // >= 1 (default 3)
  readonly createdAt: string; // ISO 8601
  readonly startedAt?: string; // ISO 8601
  readonly completedAt?: string; // ISO 8601
  readonly error?: PrintError;
}

/**
 * Parameters to create a new print job.
 */
export interface CreatePrintJobParams {
  id: string;
  printerProfileId: string;
  artifactType: PrinterLanguage;
  copies: number;
  maxAttempts?: number;
}
