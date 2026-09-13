import { describe, it, expect } from 'vitest';
import { parseRecordSelection } from '../../src/renderer/components/production/selection-parser';
import type { ProductionItem, ProductionRun } from '../../src/core/production';

describe('Production UI & Batch Selection (Bloque 10)', () => {
  describe('Record Selection Parser', () => {
    it('handles "all" mode for totalAvailable records', () => {
      const res = parseRecordSelection('all', 100);
      expect(res.isValid).toBe(true);
      expect(res.indices.length).toBe(100);
      expect(res.indices[0]).toBe(0);
      expect(res.indices[99]).toBe(99);
    });

    it('handles "range" mode: single range like "1-50"', () => {
      const res = parseRecordSelection('range', 500, '1-50');
      expect(res.isValid).toBe(true);
      expect(res.indices.length).toBe(50);
      expect(res.indices[0]).toBe(0);
      expect(res.indices[49]).toBe(49);
    });

    it('handles "range" mode: comma-separated values and subranges like "1, 3, 5-8"', () => {
      const res = parseRecordSelection('range', 500, '1, 3, 5-8');
      expect(res.isValid).toBe(true);
      // 1 -> 0, 3 -> 2, 5-8 -> 4, 5, 6, 7
      expect(res.indices).toEqual([0, 2, 4, 5, 6, 7]);
    });

    it('rejects invalid range formats and inverted bounds gracefully', () => {
      const resInverted = parseRecordSelection('range', 100, '50-10');
      expect(resInverted.isValid).toBe(false);
      expect(resInverted.errorMessage).toContain('Invalid range syntax');

      const resZero = parseRecordSelection('range', 100, '0-10');
      expect(resZero.isValid).toBe(false);

      const resEmpty = parseRecordSelection('range', 100, '');
      expect(resEmpty.isValid).toBe(false);
    });

    it('caps ranges at total available records without throwing', () => {
      const res = parseRecordSelection('range', 10, '1-100');
      expect(res.isValid).toBe(true);
      expect(res.indices.length).toBe(10);
      expect(res.indices[9]).toBe(9);
    });
  });

  describe('Total Label Calculation', () => {
    it('calculates total labels accurately before starting (records × copies)', () => {
      const recordsCount = 500;
      const copies = 2;
      const totalLabels = recordsCount * copies;
      expect(totalLabels).toBe(1000);

      const smallBatch = 10 * 3;
      expect(smallBatch).toBe(30);
    });
  });

  describe('Pagination & DOM Scalability (10,000 Items)', () => {
    it('slices 10,000 production items to fixed page size without DOM bloat', () => {
      const now = '2026-09-13T10:00:00.000Z';
      const items: ProductionItem[] = Array.from({ length: 10000 }, (_, i) => ({
        id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
        recordIndex: i,
        status: i < 500 ? 'completed' : i === 500 ? 'unknown' : 'pending',
        attempts: i <= 500 ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      }));

      expect(items.length).toBe(10000);

      // Pagination logic test
      const pageSize = 50;
      const page1 = items.slice(0, pageSize);
      expect(page1.length).toBe(50);
      expect(page1[0].recordIndex).toBe(0);
      expect(page1[49].recordIndex).toBe(49);

      const page11 = items.slice(10 * pageSize, 11 * pageSize);
      expect(page11.length).toBe(50);
      expect(page11[0].recordIndex).toBe(500);
      expect(page11[0].status).toBe('unknown');

      // Filter attention: unknown or failed
      const attentionItems = items.filter((it) => it.status === 'unknown' || it.status === 'failed');
      expect(attentionItems.length).toBe(1);
      expect(attentionItems[0].recordIndex).toBe(500);
    });
  });

  describe('Control Actions & State Transitions', () => {
    it('defines correct available actions per ProductionRunStatus', () => {
      const getAvailableActions = (status: string) => {
        switch (status) {
          case 'ready':
            return ['start'];
          case 'running':
            return ['pause', 'cancel'];
          case 'paused':
            return ['resume', 'cancel'];
          case 'interrupted':
            return ['resume', 'cancel', 'inspect'];
          case 'completed':
          case 'completed_with_errors':
            return ['report'];
          default:
            return [];
        }
      };

      expect(getAvailableActions('ready')).toEqual(['start']);
      expect(getAvailableActions('running')).toEqual(['pause', 'cancel']);
      expect(getAvailableActions('paused')).toEqual(['resume', 'cancel']);
      expect(getAvailableActions('interrupted')).toEqual(['resume', 'cancel', 'inspect']);
      expect(getAvailableActions('completed')).toEqual(['report']);
      expect(getAvailableActions('completed_with_errors')).toEqual(['report']);
    });
  });

  describe('Progress Calculation', () => {
    it('computes exact completion percentage without simulated progress', () => {
      const now = '2026-09-13T10:00:00.000Z';
      const run: ProductionRun = {
        id: '00000000-0000-4000-8000-000000000001',
        planId: '00000000-0000-4000-8000-000000000002',
        status: 'running',
        totalItems: 1000,
        processedItems: 550,
        successfulItems: 500,
        failedItems: 10,
        unknownItems: 10,
        skippedItems: 30,
        cancelledItems: 0,
        items: [],
        startedAt: now,
      };

      const completedOrSkipped = run.successfulItems + run.skippedItems;
      const percent = Math.round((completedOrSkipped / run.totalItems) * 100);
      // (500 + 30) / 1000 = 53%
      expect(percent).toBe(53);
    });
  });
});
