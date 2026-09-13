import type { LabelDocument } from '../schemas/label.schema';

/**
 * Standard error codes for document storage, parsing, and migration.
 */
export type DocumentErrorCode =
  | 'FILE_NOT_FOUND'
  | 'FILE_READ_FAILED'
  | 'FILE_TOO_LARGE'
  | 'INVALID_JSON'
  | 'INVALID_FORMAT'
  | 'UNSUPPORTED_FORMAT_VERSION'
  | 'NEWER_FORMAT_VERSION'
  | 'DOCUMENT_VALIDATION_FAILED'
  | 'MIGRATION_FAILED'
  | 'FILE_WRITE_FAILED'
  | 'FS_READ_ERROR'
  | 'FS_WRITE_ERROR'
  | 'ATOMIC_REPLACE_FAILED'
  | 'PERMISSION_DENIED';

/**
 * Structured document error.
 */
export interface DocumentError {
  readonly code: DocumentErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

/**
 * Non-blocking warning issued during document load or migration.
 */
export interface DocumentWarning {
  readonly code: string;
  readonly message: string;
}

/**
 * Discriminated result returned when loading or deserializing a label file.
 */
export type LoadLabelResult =
  | {
      readonly success: true;
      readonly document: LabelDocument;
      readonly formatVersion: number;
      readonly migrated: boolean;
      readonly warnings: DocumentWarning[];
    }
  | {
      readonly success: false;
      readonly errors: DocumentError[];
    };

/**
 * Result returned when serializing a label document into its storage container.
 */
export type SaveLabelResult =
  | {
      readonly success: true;
      readonly json: string;
    }
  | {
      readonly success: false;
      readonly errors: DocumentError[];
    };
