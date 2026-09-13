import { describe, it, expect } from 'vitest';
import {
  ProductionPlanSchema,
  ProductionRunSchema,
  ProductionItemSchema,
  ProductionRecordSchema,
  ProductionErrorSchema,
  canTransitionProductionRun,
  canTransitionProductionItem,
  isTerminalRunStatus,
  isTerminalItemStatus,
  MAX_PRODUCTION_RECORDS,
  ProductionPlan,
  ProductionRun,
} from '../../../src/core/production';
import { LabelDocument } from '../../../src/core/schemas/label.schema';

const sampleDocument: LabelDocument = {
  version: '1.0.0',
  meta: {
    title: 'Test Label',
    author: 'Tester',
    created: '2026-09-13T00:00:00.000Z',
  },
  dimensions: {
    width: 100,
    height: 50,
    unit: 'mm',
    dpi: 203,
  },
  elements: [
    {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
      type: 'text',
      x: 10,
      y: 10,
      width: 40,
      height: 10,
      rotation: 0,
      locked: false,
      content: 'Sample {sku}',
      fontFamily: 'monospace',
      fontSize: 12,
      bold: true,
      italic: false,
      align: 'left',
    },
  ],
};

const validPlanData: ProductionPlan = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  documentSnapshot: sampleDocument,
  printerProfileId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  records: [
    {
      index: 0,
      sourceRowIndex: 0,
      values: { sku: 'ABC-123' },
    },
    {
      index: 1,
      sourceRowIndex: 1,
      values: { sku: 'DEF-456' },
    },
  ],
  copiesPerRecord: 2,
  totalLabels: 4,
  preflight: {
    success: true,
    validItems: 2,
    invalidItems: 0,
    fingerprint: 'fp-12345678',
    issues: [],
    executedAt: new Date().toISOString(),
  },
  createdAt: new Date().toISOString(),
};

describe('Production Domain Schemas & State Machines', () => {
  describe('ProductionPlanSchema', () => {
    it('validates a correct production plan', () => {
      const parsed = ProductionPlanSchema.parse(validPlanData);
      expect(parsed.id).toBe(validPlanData.id);
      expect(parsed.records).toHaveLength(2);
      expect(parsed.totalLabels).toBe(4);
      expect(parsed.copiesPerRecord).toBe(2);
    });

    it('rejects an invalid UUID for id', () => {
      const invalid = { ...validPlanData, id: 'not-a-uuid' };
      const res = ProductionPlanSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it('rejects an invalid UUID for printerProfileId', () => {
      const invalid = { ...validPlanData, printerProfileId: 'invalid-printer-id' };
      const res = ProductionPlanSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it('rejects copiesPerRecord < 1', () => {
      const invalid = { ...validPlanData, copiesPerRecord: 0 };
      const res = ProductionPlanSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it('rejects non-integer copiesPerRecord', () => {
      const invalid = { ...validPlanData, copiesPerRecord: 1.5 };
      const res = ProductionPlanSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it('rejects empty records array', () => {
      const invalid = { ...validPlanData, records: [] };
      const res = ProductionPlanSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it('rejects records exceeding MAX_PRODUCTION_RECORDS', () => {
      const excessiveRecords = Array.from({ length: MAX_PRODUCTION_RECORDS + 1 }, (_, i) => ({
        index: i,
        values: { code: `ITEM-${i}` },
      }));
      const invalid = { ...validPlanData, records: excessiveRecords };
      const res = ProductionPlanSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });
  });

  describe('ProductionRecordSchema & ProductionErrorSchema', () => {
    it('validates a correct production record', () => {
      const rec = ProductionRecordSchema.parse({
        index: 0,
        sourceRowIndex: 5,
        values: { name: 'Widget' },
      });
      expect(rec.index).toBe(0);
      expect(rec.sourceRowIndex).toBe(5);
    });

    it('rejects negative index', () => {
      const res = ProductionRecordSchema.safeParse({
        index: -1,
        values: {},
      });
      expect(res.success).toBe(false);
    });

    it('validates production error schema', () => {
      const err = ProductionErrorSchema.parse({
        code: 'BARCODE_TOO_LONG',
        message: 'Barcode length exceeds boundary',
        elementId: 'elem-1',
        fieldName: 'sku',
        retryable: false,
      });
      expect(err.code).toBe('BARCODE_TOO_LONG');
      expect(err.retryable).toBe(false);
    });
  });

  describe('ProductionItemSchema', () => {
    it('validates an item with default pending status and 0 attempts', () => {
      const now = new Date().toISOString();
      const item = ProductionItemSchema.parse({
        id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        recordIndex: 0,
        createdAt: now,
        updatedAt: now,
      });
      expect(item.status).toBe('pending');
      expect(item.attempts).toBe(0);
    });

    it('accepts valid printJobId and error in failed item', () => {
      const now = new Date().toISOString();
      const item = ProductionItemSchema.parse({
        id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        recordIndex: 2,
        status: 'failed',
        attempts: 1,
        printJobId: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
        error: {
          code: 'DISPATCH_TIMEOUT',
          message: 'Printer did not acknowledge within 5000ms',
          retryable: true,
        },
        createdAt: now,
        updatedAt: now,
      });
      expect(item.status).toBe('failed');
      expect(item.error?.code).toBe('DISPATCH_TIMEOUT');
    });
  });

  describe('ProductionRunSchema', () => {
    it('validates a new draft production run', () => {
      const runData: ProductionRun = {
        id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
        planId: validPlanData.id,
        status: 'draft',
        items: [],
        totalItems: 2,
        processedItems: 0,
        successfulItems: 0,
        failedItems: 0,
        unknownItems: 0,
        skippedItems: 0,
        cancelledItems: 0,
      };
      const parsed = ProductionRunSchema.parse(runData);
      expect(parsed.status).toBe('draft');
      expect(parsed.totalItems).toBe(2);
    });
  });

  describe('ProductionRun State Machine', () => {
    it('allows valid forward transitions', () => {
      expect(canTransitionProductionRun('draft', 'preflighting')).toBe(true);
      expect(canTransitionProductionRun('preflighting', 'ready')).toBe(true);
      expect(canTransitionProductionRun('ready', 'running')).toBe(true);
      expect(canTransitionProductionRun('running', 'pausing')).toBe(true);
      expect(canTransitionProductionRun('pausing', 'paused')).toBe(true);
      expect(canTransitionProductionRun('paused', 'running')).toBe(true);
      expect(canTransitionProductionRun('running', 'completed')).toBe(true);
      expect(canTransitionProductionRun('running', 'completed_with_errors')).toBe(true);
      expect(canTransitionProductionRun('running', 'cancelling')).toBe(true);
      expect(canTransitionProductionRun('cancelling', 'cancelled')).toBe(true);
      expect(canTransitionProductionRun('running', 'interrupted')).toBe(true);
      expect(canTransitionProductionRun('interrupted', 'running')).toBe(true);
      expect(canTransitionProductionRun('interrupted', 'cancelled')).toBe(true);
      expect(canTransitionProductionRun('completed_with_errors', 'running')).toBe(true);
    });

    it('rejects invalid transitions', () => {
      expect(canTransitionProductionRun('draft', 'running')).toBe(false);
      expect(canTransitionProductionRun('draft', 'completed')).toBe(false);
      expect(canTransitionProductionRun('ready', 'completed')).toBe(false);
      expect(canTransitionProductionRun('completed', 'running')).toBe(false);
      expect(canTransitionProductionRun('cancelled', 'running')).toBe(false);
      expect(canTransitionProductionRun('failed', 'draft')).toBe(false);
      // Same state transition is rejected
      expect(canTransitionProductionRun('running', 'running')).toBe(false);
    });

    it('identifies terminal run states accurately', () => {
      expect(isTerminalRunStatus('completed')).toBe(true);
      expect(isTerminalRunStatus('cancelled')).toBe(true);
      expect(isTerminalRunStatus('failed')).toBe(true);

      expect(isTerminalRunStatus('completed_with_errors')).toBe(false);
      expect(isTerminalRunStatus('draft')).toBe(false);
      expect(isTerminalRunStatus('preflighting')).toBe(false);
      expect(isTerminalRunStatus('ready')).toBe(false);
      expect(isTerminalRunStatus('running')).toBe(false);
      expect(isTerminalRunStatus('pausing')).toBe(false);
      expect(isTerminalRunStatus('paused')).toBe(false);
      expect(isTerminalRunStatus('interrupted')).toBe(false);
    });
  });

  describe('ProductionItem State Machine', () => {
    it('allows valid forward item transitions', () => {
      expect(canTransitionProductionItem('pending', 'validating')).toBe(true);
      expect(canTransitionProductionItem('validating', 'compiling')).toBe(true);
      expect(canTransitionProductionItem('compiling', 'queued')).toBe(true);
      expect(canTransitionProductionItem('queued', 'dispatching')).toBe(true);
      expect(canTransitionProductionItem('dispatching', 'completed')).toBe(true);
      expect(canTransitionProductionItem('dispatching', 'failed')).toBe(true);
      expect(canTransitionProductionItem('dispatching', 'unknown')).toBe(true);
    });

    it('allows resolving ambiguous unknown state', () => {
      // Manual resolution actions
      expect(canTransitionProductionItem('unknown', 'pending')).toBe(true); // Retry anyway
      expect(canTransitionProductionItem('unknown', 'completed')).toBe(true); // Mark completed
      expect(canTransitionProductionItem('unknown', 'skipped')).toBe(true); // Skip
      expect(canTransitionProductionItem('unknown', 'dispatching')).toBe(false); // cannot jump straight to dispatch
    });

    it('allows retry or skip for failed items', () => {
      expect(canTransitionProductionItem('failed', 'pending')).toBe(true); // Retry
      expect(canTransitionProductionItem('failed', 'skipped')).toBe(true); // Skip
      expect(canTransitionProductionItem('failed', 'completed')).toBe(false); // cannot mark completed directly
    });

    it('allows cancellation or skipping from pending/validating/compiling/queued', () => {
      expect(canTransitionProductionItem('pending', 'skipped')).toBe(true);
      expect(canTransitionProductionItem('pending', 'cancelled')).toBe(true);
      expect(canTransitionProductionItem('validating', 'cancelled')).toBe(true);
      expect(canTransitionProductionItem('compiling', 'cancelled')).toBe(true);
      expect(canTransitionProductionItem('queued', 'cancelled')).toBe(true);
      // Once dispatching, cancellation cannot be guaranteed
      expect(canTransitionProductionItem('dispatching', 'cancelled')).toBe(false);
    });

    it('rejects invalid transitions for items', () => {
      expect(canTransitionProductionItem('pending', 'completed')).toBe(false);
      expect(canTransitionProductionItem('queued', 'completed')).toBe(false);
      expect(canTransitionProductionItem('completed', 'pending')).toBe(false);
      expect(canTransitionProductionItem('completed', 'failed')).toBe(false);
      expect(canTransitionProductionItem('cancelled', 'pending')).toBe(false);
      expect(canTransitionProductionItem('skipped', 'pending')).toBe(false);
      expect(canTransitionProductionItem('pending', 'pending')).toBe(false);
    });

    it('identifies terminal item states accurately', () => {
      expect(isTerminalItemStatus('completed')).toBe(true);
      expect(isTerminalItemStatus('skipped')).toBe(true);
      expect(isTerminalItemStatus('cancelled')).toBe(true);

      expect(isTerminalItemStatus('pending')).toBe(false);
      expect(isTerminalItemStatus('validating')).toBe(false);
      expect(isTerminalItemStatus('compiling')).toBe(false);
      expect(isTerminalItemStatus('queued')).toBe(false);
      expect(isTerminalItemStatus('dispatching')).toBe(false);
      expect(isTerminalItemStatus('failed')).toBe(false);
      expect(isTerminalItemStatus('unknown')).toBe(false);
    });
  });
});
