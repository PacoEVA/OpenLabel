import { z } from 'zod';
import { LabelDocumentSchema } from '../schemas/label.schema';

export const CURRENT_RECOVERY_VERSION = 1;

/**
 * Zod schema for crash recovery and autosave snapshots.
 */
export const RecoverySnapshotSchema = z.object({
  recoveryVersion: z.literal(CURRENT_RECOVERY_VERSION),
  documentId: z.string().min(1),
  sourcePath: z.string().nullable(),
  savedAt: z.string().datetime().or(z.string().min(1)),
  document: LabelDocumentSchema,
});

export type RecoverySnapshot = z.infer<typeof RecoverySnapshotSchema>;
