import { describe, it, expect } from 'vitest';
import {
  reconcileInterruptedRun,
  type ProductionRun,
  type ProductionItem,
} from '../../../src/core/production';

describe('Crash Recovery Domain - Bloque 8', () => {
  const baseRun: ProductionRun = {
    id: 'f0000000-0000-4000-8000-000000000001',
    planId: 'f0000000-0000-4000-8000-000000000002',
    status: 'running',
    totalItems: 4,
    processedItems: 2,
    successfulItems: 1,
    failedItems: 0,
    unknownItems: 0,
    skippedItems: 0,
    cancelledItems: 0,
    items: [
      {
        id: '10000000-0000-4000-8000-000000000001',
        recordIndex: 0,
        status: 'completed',
        attempts: 1,
        createdAt: '2026-09-13T10:00:00.000Z',
        updatedAt: '2026-09-13T10:00:05.000Z',
      },
      {
        id: '10000000-0000-4000-8000-000000000002',
        recordIndex: 1,
        status: 'dispatching',
        attempts: 1,
        createdAt: '2026-09-13T10:00:00.000Z',
        updatedAt: '2026-09-13T10:00:08.000Z',
      },
      {
        id: '10000000-0000-4000-8000-000000000003',
        recordIndex: 2,
        status: 'queued',
        attempts: 0,
        createdAt: '2026-09-13T10:00:00.000Z',
        updatedAt: '2026-09-13T10:00:09.000Z',
      },
      {
        id: '10000000-0000-4000-8000-000000000004',
        recordIndex: 3,
        status: 'pending',
        attempts: 0,
        createdAt: '2026-09-13T10:00:00.000Z',
        updatedAt: '2026-09-13T10:00:00.000Z',
      },
    ],
  };

  it('converts a running run to interrupted with unknown dispatching item', () => {
    const result = reconcileInterruptedRun(baseRun);

    expect(result.recovered).toBe(true);
    expect(result.run.status).toBe('interrupted');
    expect(result.run.interruptedAt).toBeDefined();

    // Item 0: was completed -> remains completed
    expect(result.run.items[0].status).toBe('completed');

    // Item 1: was dispatching -> MUST become unknown (risk of duplicate physically printed label)
    expect(result.run.items[1].status).toBe('unknown');
    expect(result.run.items[1].error?.code).toBe('DISPATCH_INTERRUPTED');
    expect(result.run.items[1].error?.retryable).toBe(false);

    // Item 2: was queued (not physically sent) -> safely resets to pending
    expect(result.run.items[2].status).toBe('pending');

    // Item 3: was pending -> remains pending
    expect(result.run.items[3].status).toBe('pending');

    // Counters
    expect(result.run.successfulItems).toBe(1);
    expect(result.run.unknownItems).toBe(1);
    expect(result.run.failedItems).toBe(0);
    expect(result.run.processedItems).toBe(2); // 1 completed + 1 unknown
  });

  it('converts a pausing run to interrupted', () => {
    const pausingRun: ProductionRun = {
      ...baseRun,
      status: 'pausing',
    };

    const result = reconcileInterruptedRun(pausingRun);
    expect(result.recovered).toBe(true);
    expect(result.run.status).toBe('interrupted');
  });

  it('safely resets validating and compiling items to pending', () => {
    const runWithCompiling: ProductionRun = {
      ...baseRun,
      items: [
        {
          ...baseRun.items[0],
          status: 'validating',
        },
        {
          ...baseRun.items[1],
          status: 'compiling',
        },
      ],
      totalItems: 2,
    };

    const result = reconcileInterruptedRun(runWithCompiling);
    expect(result.run.items[0].status).toBe('pending');
    expect(result.run.items[1].status).toBe('pending');
  });

  it('ignores completed, failed, paused, or draft runs', () => {
    const completedRun: ProductionRun = { ...baseRun, status: 'completed' };
    const pausedRun: ProductionRun = { ...baseRun, status: 'paused' };
    const draftRun: ProductionRun = { ...baseRun, status: 'draft' };

    expect(reconcileInterruptedRun(completedRun).recovered).toBe(false);
    expect(reconcileInterruptedRun(pausedRun).recovered).toBe(false);
    expect(reconcileInterruptedRun(draftRun).recovered).toBe(false);
  });
});
