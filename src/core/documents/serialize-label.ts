import { LabelDocument, LabelDocumentSchema } from '../schemas/label.schema';
import { CURRENT_FORMAT_VERSION, OPEN_LABEL_FORMAT_ID, LabelFile } from './label-file.schema';
import type { SaveLabelResult } from './document.types';

export interface SerializeOptions {
  readonly pretty?: boolean;
}

/**
 * Serializes a validated LabelDocument into a standardized `.label` container JSON string.
 * Strips any editor session state and guarantees format compliance.
 */
export function serializeLabelFile(
  document: LabelDocument,
  options: SerializeOptions = { pretty: true }
): SaveLabelResult {
  // 1. Validate the document defensively against LabelDocumentSchema
  const validation = LabelDocumentSchema.safeParse(document);
  if (!validation.success) {
    return {
      success: false,
      errors: validation.error.errors.map((err) => ({
        code: 'DOCUMENT_VALIDATION_FAILED',
        message: `${err.path.join('.') || 'root'}: ${err.message}`,
        details: err,
      })),
    };
  }

  const now = new Date().toISOString();

  // 2. Wrap inside the canonical format container
  const container: LabelFile = {
    format: OPEN_LABEL_FORMAT_ID,
    formatVersion: CURRENT_FORMAT_VERSION,
    updatedAt: now,
    document: validation.data,
  };

  try {
    const json = options.pretty
      ? JSON.stringify(container, null, 2)
      : JSON.stringify(container);

    return {
      success: true,
      json,
    };
  } catch (err: unknown) {
    return {
      success: false,
      errors: [
        {
          code: 'INVALID_JSON',
          message: err instanceof Error ? err.message : 'Failed to stringify label container to JSON',
        },
      ],
    };
  }
}
