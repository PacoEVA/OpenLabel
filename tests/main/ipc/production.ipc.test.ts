import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerProductionIpcHandlers } from '../../../src/main/ipc/production.ipc';
import { ProductionService } from '../../../src/main/production/production.service';
import { PrintQueue } from '../../../src/main/printing/print-queue';
import { MockTransport } from '../../mocks/mock-transport';
import { PrinterProfileStore } from '../../../src/main/printing/printer-profile.store';
import { ProductionPersistenceService } from '../../../src/main/production/production-persistence.service';
import type { LabelDocument } from '../../../src/core/schemas/label.schema';
import type { PrinterProfile } from '../../../src/core/printing/printer-profile.schema';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const handlers: Record<string, Function> = {};
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: Function) => {
      handlers[channel] = handler;
    }),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

describe('Production IPC Handlers (Bloque 12)', () => {
  let tmpDir: string;
  let transport: MockTransport;
  let queue: PrintQueue;
  let profileStore: PrinterProfileStore;
  let persistence: ProductionPersistenceService;
  let service: ProductionService;

  const validProfile: PrinterProfile = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'IPC Test Zebra',
    language: 'zpl',
    dpi: 203,
    enabled: true,
    connection: {
      type: 'tcp',
      host: '127.0.0.1',
      port: 9100,
      timeoutMs: 3000,
    },
  };

  const validDoc: LabelDocument = {
    version: '1.0.0',
    meta: { title: 'IPC Label', author: 'Test', created: '2026-09-13T10:00:00.000Z' },
    dimensions: { width: 100, height: 50, unit: 'mm', dpi: 203 },
    elements: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openlabels-prod-ipc-'));
    transport = new MockTransport();
    queue = new PrintQueue([transport]);
    profileStore = new PrinterProfileStore();
    profileStore.save(validProfile);
    persistence = new ProductionPersistenceService(tmpDir);

    service = new ProductionService({
      queue,
      profileStore,
      persistence,
    });

    registerProductionIpcHandlers(service);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('registers all required production IPC channels', () => {
    expect(handlers['production:preflight']).toBeDefined();
    expect(handlers['production:create-plan-and-run']).toBeDefined();
    expect(handlers['production:start-run']).toBeDefined();
    expect(handlers['production:pause-run']).toBeDefined();
    expect(handlers['production:resume-run']).toBeDefined();
    expect(handlers['production:cancel-run']).toBeDefined();
    expect(handlers['production:get-run']).toBeDefined();
    expect(handlers['production:list-runs']).toBeDefined();
    expect(handlers['production:resolve-unknown']).toBeDefined();
    expect(handlers['production:retry-failed']).toBeDefined();
    expect(handlers['production:skip-item']).toBeDefined();
    expect(handlers['production:export-report']).toBeDefined();
  });

  describe('production:preflight', () => {
    it('rejects invalid payload without proper structure', async () => {
      const res = await handlers['production:preflight']({}, { invalid: true });
      expect(res.success).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
    });

    it('performs preflight and returns fingerprint and validation status', async () => {
      const payload = {
        document: validDoc,
        printerProfile: validProfile,
        records: [{ index: 0, values: { sku: 'TEST-123' } }],
        copiesPerRecord: 1,
      };

      const res = await handlers['production:preflight']({}, payload);
      expect(res.success).toBe(true);
      expect(res.result.validItems).toBe(1);
      expect(res.result.fingerprint).toBeDefined();
    });
  });

  describe('production:create-plan-and-run & start-run', () => {
    it('creates plan and run via IPC and starts execution', async () => {
      const createRes = await handlers['production:create-plan-and-run']({}, {
        document: validDoc,
        printerProfile: validProfile,
        records: [{ index: 0, values: { sku: 'IPC-001' } }],
        copiesPerRecord: 1,
      });

      expect(createRes.success).toBe(true);
      expect(createRes.plan).toBeDefined();
      expect(createRes.run).toBeDefined();
      expect(createRes.run.status).toBe('ready');

      // Start run
      const startRes = await handlers['production:start-run']({}, createRes.run.id);
      expect(startRes.success).toBe(true);
      expect(['running', 'completed']).toContain(startRes.run.status);
    });

    it('rejects start-run with invalid UUID', async () => {
      const res = await handlers['production:start-run']({}, 'not-a-uuid');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid run UUID');
    });
  });

  describe('production:export-report', () => {
    it('generates and exports JSON and CSV reports for a run', async () => {
      const createRes = await handlers['production:create-plan-and-run']({}, {
        document: validDoc,
        printerProfile: validProfile,
        records: [{ index: 0, values: { sku: 'REP-001' } }],
        copiesPerRecord: 2,
      });

      const runId = createRes.run.id;

      // JSON report
      const jsonRes = await handlers['production:export-report']({}, {
        runId,
        format: 'json',
      });
      expect(jsonRes.success).toBe(true);
      expect(jsonRes.format).toBe('json');
      expect(jsonRes.content).toContain(runId);

      // CSV report
      const csvRes = await handlers['production:export-report']({}, {
        runId,
        format: 'csv',
      });
      expect(csvRes.success).toBe(true);
      expect(csvRes.format).toBe('csv');
      expect(csvRes.content).toContain('--- PRODUCTION RUN SUMMARY ---');
      expect(csvRes.content).toContain(runId);
    });
  });
});
