import { LabelDocumentSchema } from '../schemas/label.schema';
import { CURRENT_FORMAT_VERSION, OPEN_LABEL_FORMAT_ID } from './label-file.schema';
import { runDocumentMigrations } from './migrations/migrate';
import type { LoadLabelResult } from './document.types';

/**
 * Deserializes raw text from a `.label` file container.
 * Safely parses JSON, inspects envelope format and version, and validates the domain document.
 */
export function deserializeLabelFile(rawText: string): LoadLabelResult {
  if (!rawText || rawText.trim().length === 0) {
    return {
      success: false,
      errors: [
        {
          code: 'INVALID_JSON',
          message: 'The file is empty or contains only whitespace',
        },
      ],
    };
  }

  // 1. Safe JSON parsing
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err: unknown) {
    return {
      success: false,
      errors: [
        {
          code: 'INVALID_JSON',
          message: err instanceof Error ? err.message : 'Malformed JSON syntax',
        },
      ],
    };
  }

  // 2. Validate outer container basics
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      success: false,
      errors: [
        {
          code: 'INVALID_FORMAT',
          message: 'Root of .label file must be a JSON object',
        },
      ],
    };
  }

  const record = parsed as Record<string, unknown>;

  if (record.format !== OPEN_LABEL_FORMAT_ID) {
    return {
      success: false,
      errors: [
        {
          code: 'INVALID_FORMAT',
          message: `Invalid format identifier "${String(record.format)}", expected "${OPEN_LABEL_FORMAT_ID}"`,
        },
      ],
    };
  }

  const formatVersion = record.formatVersion;
  if (typeof formatVersion !== 'number' || !Number.isInteger(formatVersion) || formatVersion <= 0) {
    return {
      success: false,
      errors: [
        {
          code: 'UNSUPPORTED_FORMAT_VERSION',
          message: 'Invalid or missing "formatVersion" integer in container',
        },
      ],
    };
  }

  // 3. Reject future format versions
  if (formatVersion > CURRENT_FORMAT_VERSION) {
    return {
      success: false,
      errors: [
        {
          code: 'NEWER_FORMAT_VERSION',
          message: `This file was created by a newer version of the application (format v${formatVersion}, current is v${CURRENT_FORMAT_VERSION}).`,
        },
      ],
    };
  }

  // 4. Migrate if formatVersion < CURRENT_FORMAT_VERSION
  let docPayload = record.document;
  let migrated = false;
  const warnings: import('./document.types').DocumentWarning[] = [];

  if (formatVersion < CURRENT_FORMAT_VERSION) {
    const migrationResult = runDocumentMigrations(docPayload, formatVersion, CURRENT_FORMAT_VERSION);
    if (!migrationResult.success) {
      return {
        success: false,
        errors: [
          {
            code: 'MIGRATION_FAILED',
            message: migrationResult.error ?? `Failed migrating document from v${formatVersion} to v${CURRENT_FORMAT_VERSION}`,
          },
        ],
      };
    }
    docPayload = migrationResult.document;
    migrated = migrationResult.migrated;
    warnings.push(...migrationResult.warnings);
  }

  // 5. Validate the extracted domain document
  const docValidation = LabelDocumentSchema.safeParse(docPayload);
  if (!docValidation.success) {
    return {
      success: false,
      errors: docValidation.error.errors.map((err) => ({
        code: 'DOCUMENT_VALIDATION_FAILED',
        message: `${err.path.join('.') || 'document'}: ${err.message}`,
        details: err,
      })),
    };
  }

  return {
    success: true,
    document: docValidation.data,
    formatVersion,
    migrated,
    warnings,
  };
}
