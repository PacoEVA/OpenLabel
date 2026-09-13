import { z } from 'zod';
import { LabelDocumentSchema } from '../schemas/label.schema';

/**
 * Lifecycle states of a ProductionRun.
 */
export const ProductionRunStatusSchema = z.enum([
  'draft',
  'preflighting',
  'ready',
  'running',
  'pausing',
  'paused',
  'cancelling',
  'cancelled',
  'completed',
  'completed_with_errors',
  'failed',
  'interrupted',
]);
export type ProductionRunStatus = z.infer<typeof ProductionRunStatusSchema>;

/**
 * Lifecycle states of an individual ProductionItem.
 */
export const ProductionItemStatusSchema = z.enum([
  'pending',
  'validating',
  'compiling',
  'queued',
  'dispatching',
  'completed',
  'failed',
  'unknown',
  'skipped',
  'cancelled',
]);
export type ProductionItemStatus = z.infer<typeof ProductionItemStatusSchema>;

/**
 * Structured error capturing failures occurring on an individual ProductionItem.
 */
export const ProductionErrorSchema = z.object({
  code: z.string().min(1, { message: 'Error code cannot be empty' }),
  message: z.string().min(1, { message: 'Error message cannot be empty' }),
  elementId: z.string().optional(),
  fieldName: z.string().optional(),
  retryable: z.boolean().default(false),
});
export type ProductionError = z.infer<typeof ProductionErrorSchema>;

/**
 * Stable, normalized data record frozen into the ProductionPlan.
 * Completely decoupled from the external source once materialized.
 */
export const ProductionRecordSchema = z.object({
  index: z.number().int().min(0, { message: 'Record index must be an integer >= 0' }),
  sourceRowIndex: z.number().int().min(0).optional(),
  values: z.record(z.string(), z.string()),
});
export type ProductionRecord = z.infer<typeof ProductionRecordSchema>;

/**
 * Represents the execution state of an individual label production record.
 */
export const ProductionItemSchema = z.object({
  id: z.string().uuid({ message: 'Item ID must be a valid UUID' }),
  recordIndex: z.number().int().min(0, { message: 'Record index must be >= 0' }),
  status: ProductionItemStatusSchema.default('pending'),
  attempts: z.number().int().min(0).default(0),
  printJobId: z.string().uuid().optional(),
  error: ProductionErrorSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProductionItem = z.infer<typeof ProductionItemSchema>;

/**
 * Detailed issue discovered during the ProductionPreflight phase.
 */
export const ProductionPreflightIssueSchema = z.object({
  level: z.enum(['error', 'warning']),
  recordIndex: z.number().int().min(0).optional(),
  elementId: z.string().optional(),
  fieldName: z.string().optional(),
  code: z.string().min(1),
  message: z.string().min(1),
});
export type ProductionPreflightIssue = z.infer<typeof ProductionPreflightIssueSchema>;

/**
 * Immutable outcome of the preflight validation phase.
 */
export const ProductionPreflightResultSchema = z.object({
  success: z.boolean(),
  validItems: z.number().int().min(0),
  invalidItems: z.number().int().min(0),
  fingerprint: z.string().min(1, { message: 'Preflight fingerprint is required' }),
  issues: z.array(ProductionPreflightIssueSchema).default([]),
  executedAt: z.string().datetime(),
});
export type ProductionPreflightResult = z.infer<typeof ProductionPreflightResultSchema>;

export const MAX_PRODUCTION_RECORDS = 10000;

/**
 * Frozen, immutable specification prepared for a production run.
 */
export const ProductionPlanSchema = z.object({
  id: z.string().uuid({ message: 'Plan ID must be a valid UUID' }),
  documentSnapshot: LabelDocumentSchema,
  printerProfileId: z.string().uuid({ message: 'printerProfileId must be a valid UUID' }),
  records: z
    .array(ProductionRecordSchema)
    .min(1, { message: 'ProductionPlan must contain at least 1 record' })
    .max(MAX_PRODUCTION_RECORDS, {
      message: `ProductionPlan exceeds maximum limit of ${MAX_PRODUCTION_RECORDS} records`,
    }),
  copiesPerRecord: z
    .number()
    .int({ message: 'copiesPerRecord must be an integer' })
    .min(1, { message: 'copiesPerRecord must be >= 1' })
    .default(1),
  totalLabels: z.number().int().min(1),
  preflight: ProductionPreflightResultSchema,
  createdAt: z.string().datetime(),
});
export type ProductionPlan = z.infer<typeof ProductionPlanSchema>;

/**
 * Executing instance of a ProductionPlan tracking batch progress and items.
 */
export const ProductionRunSchema = z.object({
  id: z.string().uuid({ message: 'Run ID must be a valid UUID' }),
  planId: z.string().uuid({ message: 'Plan ID must be a valid UUID' }),
  status: ProductionRunStatusSchema.default('draft'),
  items: z.array(ProductionItemSchema).default([]),
  totalItems: z.number().int().min(0),
  processedItems: z.number().int().min(0).default(0),
  successfulItems: z.number().int().min(0).default(0),
  failedItems: z.number().int().min(0).default(0),
  unknownItems: z.number().int().min(0).default(0),
  skippedItems: z.number().int().min(0).default(0),
  cancelledItems: z.number().int().min(0).default(0),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  interruptedAt: z.string().datetime().optional(),
});
export type ProductionRun = z.infer<typeof ProductionRunSchema>;
