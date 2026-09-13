import { describe, it, expect } from 'vitest';
import {
  buildProductionReport,
  exportProductionReportToJson,
  exportProductionReportToCsv,
  sanitizeReportString,
} from '../../../src/core/production/production-report';
import type { ProductionPlan, ProductionRun } from '../../../src/core/production/production.schema';

describe('Production Reports (Bloque 11)', () => {
  const mockPlan: ProductionPlan = {
    id: '00000000-0000-4000-8000-000000000001',
    documentSnapshot: {
      version: '1.0.0',
      meta: { title: 'Test', author: 'Auto', created: '2026-09-13T10:00:00.000Z' },
      dimensions: { width: 100, height: 50, unit: 'mm', dpi: 203 },
      elements: [],
    },
    printerProfileId: '00000000-0000-4000-8000-000000000002',
    records: [
      { index: 0, values: { sku: 'SKU-001' } },
      { index: 1, values: { sku: 'SKU-002' } },
      { index: 2, values: { sku: 'SKU-003' } },
    ],
    copiesPerRecord: 2,
    totalLabels: 6,
    preflight: {
      success: true,
      validItems: 3,
      invalidItems: 0,
      fingerprint: 'fp-1234',
      issues: [],
      executedAt: '2026-09-13T10:00:00.000Z',
    },
    createdAt: '2026-09-13T10:00:00.000Z',
  };

  const mockRun: ProductionRun = {
    id: '11111111-1111-4111-8111-111111111111',
    planId: mockPlan.id,
    status: 'completed_with_errors',
    totalItems: 3,
    processedItems: 3,
    successfulItems: 1,
    failedItems: 1,
    unknownItems: 1,
    skippedItems: 0,
    cancelledItems: 0,
    startedAt: '2026-09-13T10:00:00.000Z',
    completedAt: '2026-09-13T10:01:30.000Z', // 90 seconds = 90,000 ms
    items: [
      {
        id: '22222222-2222-4222-8222-222222222201',
        recordIndex: 0,
        status: 'completed',
        attempts: 1,
        printJobId: '33333333-3333-4333-8333-333333333301',
        createdAt: '2026-09-13T10:00:01.000Z',
        updatedAt: '2026-09-13T10:00:05.000Z',
      },
      {
        id: '22222222-2222-4222-8222-222222222202',
        recordIndex: 1,
        status: 'failed',
        attempts: 2,
        error: {
          code: 'TCP_CONNECTION_REFUSED',
          message: 'Failed to connect with token: secret_token_xyz123',
          retryable: false,
        },
        createdAt: '2026-09-13T10:00:05.000Z',
        updatedAt: '2026-09-13T10:00:15.000Z',
      },
      {
        id: '22222222-2222-4222-8222-222222222203',
        recordIndex: 2,
        status: 'unknown',
        attempts: 1,
        printJobId: '33333333-3333-4333-8333-333333333303',
        createdAt: '2026-09-13T10:00:15.000Z',
        updatedAt: '2026-09-13T10:01:30.000Z',
      },
    ],
  };

  it('builds a complete production report with correct metrics and duration', () => {
    const report = buildProductionReport(mockPlan, mockRun);

    expect(report.version).toBe('1.0.0');
    expect(report.summary.runId).toBe(mockRun.id);
    expect(report.summary.planId).toBe(mockPlan.id);
    expect(report.summary.status).toBe('completed_with_errors');
    expect(report.summary.durationMs).toBe(90000);
    expect(report.summary.totalItems).toBe(3);
    expect(report.summary.successfulItems).toBe(1);
    expect(report.summary.failedItems).toBe(1);
    expect(report.summary.unknownItems).toBe(1);
    expect(report.summary.totalLabels).toBe(6);

    // Check errors list (contains both failed and unknown items)
    expect(report.errors.length).toBe(2);
    expect(report.errors[0].code).toBe('TCP_CONNECTION_REFUSED');
    expect(report.errors[1].code).toBe('AMBIGUOUS_DELIVERY');
  });

  it('sanitizes sensitive tokens or passwords in error messages', () => {
    const dirtyError = 'Database auth failed for password: my_super_secret_pwd!';
    const sanitized = sanitizeReportString(dirtyError);
    expect(sanitized).not.toContain('my_super_secret_pwd!');
    expect(sanitized).toContain('password=***REDACTED***');

    const bearerError = 'Invalid authorization header Bearer eyJhbGciOi...';
    const sanitizedBearer = sanitizeReportString(bearerError);
    expect(sanitizedBearer).toContain('Bearer ***REDACTED***');

    // Report generation automatically sanitizes
    const report = buildProductionReport(mockPlan, mockRun);
    expect(report.errors[0].message).not.toContain('secret_token_xyz123');
    expect(report.errors[0].message).toContain('token=***REDACTED***');
  });

  it('exports report to valid JSON', () => {
    const report = buildProductionReport(mockPlan, mockRun);
    const jsonStr = exportProductionReportToJson(report);

    expect(() => JSON.parse(jsonStr)).not.toThrow();
    const parsed = JSON.parse(jsonStr);
    expect(parsed.summary.runId).toBe(mockRun.id);
    expect(parsed.items.length).toBe(3);
  });

  it('exports report to RFC 4180 compliant CSV', () => {
    const report = buildProductionReport(mockPlan, mockRun);
    const csvStr = exportProductionReportToCsv(report);

    expect(csvStr).toContain('--- PRODUCTION RUN SUMMARY ---');
    expect(csvStr).toContain('--- PRODUCTION ITEMS BREAKDOWN ---');
    expect(csvStr).toContain('Run ID,11111111-1111-4111-8111-111111111111');
    expect(csvStr).toContain('Total Labels,6');

    // Headers
    expect(csvStr).toContain('Item ID,Record Index,Status,Attempts,Print Job ID,Error Code,Error Message');

    // Rows
    expect(csvStr).toContain('22222222-2222-4222-8222-222222222201,1,completed,1,33333333-3333-4333-8333-333333333301,,');
    expect(csvStr).toContain('TCP_CONNECTION_REFUSED');
  });
});
