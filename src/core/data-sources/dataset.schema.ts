import { z } from 'zod';

/**
 * Supported inferred data types for external dataset columns.
 */
export const DatasetColumnTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'null',
  'mixed',
]);

export type DatasetColumnType = z.infer<typeof DatasetColumnTypeSchema>;

/**
 * Metadata describing an individual column discovered from an external source.
 */
export const DatasetColumnSchema = z.object({
  key: z.string().min(1, { message: 'Column key cannot be empty' }),
  label: z.string().min(1, { message: 'Column label cannot be empty' }),
  inferredType: DatasetColumnTypeSchema,
});

export type DatasetColumn = z.infer<typeof DatasetColumnSchema>;

/**
 * A single raw row extracted from an external source before domain normalization.
 */
export const DatasetRowSchema = z.record(z.string(), z.unknown());

export type DatasetRow = z.infer<typeof DatasetRowSchema>;

/**
 * Standardized, tabular representation of data extracted from any external adapter.
 */
export const DatasetSchema = z.object({
  columns: z.array(DatasetColumnSchema),
  rows: z.array(DatasetRowSchema),
  totalRows: z.number().int().min(0).optional(),
  truncated: z.boolean().default(false),
});

export type Dataset = z.infer<typeof DatasetSchema>;
