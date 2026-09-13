import { LabelDocument } from '../schemas/label.schema';
import { PrinterProfile } from '../printing/printer-profile.schema';
import {
  ProductionPlan,
  ProductionPlanSchema,
  ProductionRun,
  ProductionRunSchema,
  ProductionRecord,
  ProductionPreflightResult,
  ProductionItem,
} from './production.schema';
import { computePreflightFingerprint } from './preflight';
import { resolveCountersForRecord } from '../data/counter-engine';
import { CounterField } from '../data/data.schema';

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4 UUID generator for pure TS
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface CreateProductionPlanInput {
  id?: string;
  document: LabelDocument;
  printerProfile: PrinterProfile;
  records: Array<{
    index?: number;
    sourceRowIndex?: number;
    values: Record<string, string>;
  }>;
  copiesPerRecord?: number;
  preflight: ProductionPreflightResult;
}

/**
 * Creates an immutable, fully snapshot-frozen ProductionPlan.
 *
 * Rules:
 * - Freezes document template via deep clone so canvas edits do not alter the run.
 * - Injects and freezes counter/serial values per record index so retries reuse the exact same serial.
 * - Verifies preflight validity and staleness; throws if preflight failed or fingerprint is stale.
 * - Computes totalLabels = records.length * copiesPerRecord.
 */
export function createProductionPlan(input: CreateProductionPlanInput): ProductionPlan {
  const {
    id = generateUuid(),
    document,
    printerProfile,
    records,
    copiesPerRecord = 1,
    preflight,
  } = input;

  // 1. Verify preflight success
  if (!preflight.success) {
    throw new Error('Cannot create ProductionPlan with a failed preflight result');
  }

  // 2. Prepare normalized records
  const normalizedRecords: ProductionRecord[] = records.map((rec, i) => ({
    index: rec.index ?? i,
    sourceRowIndex: rec.sourceRowIndex,
    values: { ...rec.values },
  }));

  // 3. Verify fingerprint staleness
  const currentFingerprint = computePreflightFingerprint(
    document,
    printerProfile,
    normalizedRecords,
    copiesPerRecord
  );

  if (preflight.fingerprint !== currentFingerprint) {
    throw new Error('Preflight is stale: template, records, printer, or copies have changed since preflight was executed');
  }

  // 4. Freeze counter fields into record values
  const counterFields: CounterField[] = (document.dataModel?.fields || []).filter(
    (f): f is CounterField => f.type === 'counter'
  );

  if (counterFields.length > 0) {
    for (const record of normalizedRecords) {
      const generatedCounters = resolveCountersForRecord(counterFields, record.index);
      // Injected counters become part of the immutable values snapshot
      record.values = {
        ...generatedCounters,
        ...record.values,
      };
    }
  }

  // 5. Deep freeze document snapshot
  const documentSnapshot: LabelDocument = JSON.parse(JSON.stringify(document));

  const planData: ProductionPlan = {
    id,
    documentSnapshot,
    printerProfileId: printerProfile.id,
    records: normalizedRecords,
    copiesPerRecord,
    totalLabels: normalizedRecords.length * copiesPerRecord,
    preflight,
    createdAt: new Date().toISOString(),
  };

  return ProductionPlanSchema.parse(planData);
}

/**
 * Instantiates a ProductionRun and its individual ProductionItems from an immutable ProductionPlan.
 */
export function createProductionRun(plan: ProductionPlan, runId?: string): ProductionRun {
  const now = new Date().toISOString();
  const id = runId || generateUuid();

  const items: ProductionItem[] = plan.records.map((rec) => ({
    id: generateUuid(),
    recordIndex: rec.index,
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  }));

  const runData: ProductionRun = {
    id,
    planId: plan.id,
    status: 'ready',
    items,
    totalItems: items.length,
    processedItems: 0,
    successfulItems: 0,
    failedItems: 0,
    unknownItems: 0,
    skippedItems: 0,
    cancelledItems: 0,
  };

  return ProductionRunSchema.parse(runData);
}
