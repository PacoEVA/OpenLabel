import { DataField, StaticField, InputField, DateField, CounterField } from './data.schema';
import { ResolvedRecord, resolveStaticAndInputFields } from './template-resolver';
import { ResolutionContext, resolveDatesForRecord } from './date-engine';
import { resolveCountersForRecord } from './counter-engine';

export const BATCH_LIMITS = {
  MAX_FIELDS: 500,
  MAX_PREVIEW_RECORDS: 100,
  MAX_GENERATED_RECORDS: 10000,
} as const;

export interface BatchGeneratorOptions {
  fields: DataField[];
  count: number;
  context: ResolutionContext;
  userInputs?: Record<string, string>;
}

export interface BatchGenerationError {
  code: 'COUNT_OUT_OF_RANGE' | 'TOO_MANY_FIELDS' | 'REQUIRED_INPUT_MISSING';
  message: string;
}

export type BatchGenerationResult =
  | {
      success: true;
      records: ResolvedRecord[];
    }
  | {
      success: false;
      errors: BatchGenerationError[];
    };

/**
 * Generates an array of ResolvedRecords based on field definitions, runtime inputs,
 * batch count, and shared temporal context.
 *
 * Requirements:
 * - Pure and deterministic.
 * - All records share the exact same context.now timestamp.
 * - Counters advance deterministically per recordIndex (0 to count - 1).
 * - Enforces safety limits: count <= 10,000, fields <= 500.
 */
export function generateRecords(options: BatchGeneratorOptions): BatchGenerationResult {
  const { fields, count, context, userInputs = {} } = options;
  const errors: BatchGenerationError[] = [];

  if (!Number.isInteger(count) || count < 1 || count > BATCH_LIMITS.MAX_GENERATED_RECORDS) {
    errors.push({
      code: 'COUNT_OUT_OF_RANGE',
      message: `Batch count must be an integer between 1 and ${BATCH_LIMITS.MAX_GENERATED_RECORDS}. Received: ${count}`,
    });
  }

  if (fields.length > BATCH_LIMITS.MAX_FIELDS) {
    errors.push({
      code: 'TOO_MANY_FIELDS',
      message: `Number of fields (${fields.length}) exceeds maximum allowed (${BATCH_LIMITS.MAX_FIELDS})`,
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // 1. Resolve static and input values
  const staticAndInputFields = fields.filter(
    (f): f is StaticField | InputField => f.type === 'static' || f.type === 'input'
  );
  const staticAndInputResult = resolveStaticAndInputFields(staticAndInputFields, userInputs);

  if (!staticAndInputResult.success) {
    return {
      success: false,
      errors: staticAndInputResult.errors.map((msg) => ({
        code: 'REQUIRED_INPUT_MISSING',
        message: msg,
      })),
    };
  }

  // 2. Resolve date fields (shared context.now across all records in the batch)
  const dateFields = fields.filter((f): f is DateField => f.type === 'date');
  const dateRecord = resolveDatesForRecord(dateFields, context);

  // 3. Extract counter fields
  const counterFields = fields.filter((f): f is CounterField => f.type === 'counter');

  // 4. Base record shared by all records (static, input, date)
  const baseRecord: ResolvedRecord = {
    ...staticAndInputResult.record,
    ...dateRecord,
  };

  // 5. Generate records with counter progressions
  const records: ResolvedRecord[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const counterRecord = resolveCountersForRecord(counterFields, i);
    records[i] = {
      ...baseRecord,
      ...counterRecord,
    };
  }

  return {
    success: true,
    records,
  };
}
