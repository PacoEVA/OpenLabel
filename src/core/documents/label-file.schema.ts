import { z } from 'zod';
import { LabelDocumentSchema } from '../schemas/label.schema';

/**
 * The current format version for the `.label` file container.
 * Incremented whenever structural changes to the outer container occur.
 */
export const CURRENT_FORMAT_VERSION = 1;

/**
 * Standard identifier for OpenLabels `.label` container files.
 */
export const OPEN_LABEL_FORMAT_ID = 'open-label' as const;

/**
 * Schema validating the root structure of a `.label` JSON file container.
 */
export const LabelFileSchema = z.object({
  format: z.literal(OPEN_LABEL_FORMAT_ID, {
    errorMap: () => ({ message: 'Invalid file format identifier, expected "open-label"' }),
  }),
  formatVersion: z
    .number()
    .int('formatVersion must be an integer')
    .positive('formatVersion must be a positive integer'),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  document: LabelDocumentSchema,
});

export type LabelFile = z.infer<typeof LabelFileSchema>;
