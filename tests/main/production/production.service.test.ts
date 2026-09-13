import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ProductionService,
  ProductionPersistenceService,
} from '../../../src/main/production';
import { PrintQueue } from '../../../src/main/printing/print-queue';
import { PrinterProfileStore } from '../../../src/main/printing/printer-profile.store';
import { MockTransport } from '../../mocks/mock-transport';
import { type LabelDocument } from '../../../src/core/schemas/label.schema';
import { type PrinterProfile } from '../../../src/core/printing/printer-profile.schema';
import { runProductionPreflight } from '../../../src/core/production';

describe('ProductionService & Real PrintQueue Integration - Bloque 9', () => {
  let tempDir: string;
  let persistence: ProductionPersistenceService;
  let profileStore: PrinterProfileStore;
  let mockTransport: MockTransport;
  let queue: PrintQueue;
  let service: ProductionService;

  const sampleProfile: PrinterProfile = {
    id: 'e0000000-0000-4000-8000-000000000001',
    name: 'Real Queue Test Printer',
    enabled: true,
    language: 'zpl',
    dpi: 203,
    connection: {
      type: 'tcp',
      host: '127.0.0.1',
      port: 9100,
      timeoutMs: 5000,
    },
  };

  const sampleDoc: LabelDocument = {
    version: '1.0.0',
    meta: {
      title: 'Service Integration Test',
      author: 'Test Agent',
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
        id: 'e1111111-1111-4111-8111-111111111111',
        type: 'text',
        x: 10,
        y: 10,
        width: 80,
        height: 10,
        rotation: 0,
        locked: false,
        content: 'Batch Item: {name}',
        fontSize: 12,
        fontFamily: 'Arial',
        bold: false,
        italic: false,
        align: 'left',
      },
    ],
  };

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'openlabels-prod-service-test-'));
    persistence = new ProductionPersistenceService(path.join(tempDir, 'runs'));
    profileStore = new PrinterProfileStore([sampleProfile]);

    mockTransport = new MockTransport({ type: 'tcp', delayMs: 10 });
    queue = new PrintQueue([mockTransport]);

    service = new ProductionService({
      queue,
      profileStore,
      persistence,
      maxInFlight: 3,
    });

    await service.initialize();
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 30));
    try {
      if (fs.existsSync(tempDir)) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    } catch {
      // ignore transient Windows directory lock during test teardown
    }
  });

  it('runs a complete production batch through real PrintQueue and MockTransport', async () => {
    const records = [
      { index: 0, values: { name: 'Alpha' } },
      { index: 1, values: { name: 'Beta' } },
      { index: 2, values: { name: 'Gamma' } },
    ];

    const preflight = runProductionPreflight({
      document: sampleDoc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
    });
    expect(preflight.success).toBe(true);

    const plan = service.createPlan({
      document: sampleDoc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
      preflight,
    });
    expect(plan.totalLabels).toBe(3);

    const run = await service.createRun(plan);
    expect(run.status).toBe('ready');

    // Start production run
    const startedRun = await service.startRun(run.id);
    expect(startedRun.status).toBe('running');

    // Verify double-start protection: Calling startRun again returns current running state
    const duplicateStart = await service.startRun(run.id);
    expect(duplicateStart.status).toBe('running');

    // Wait until completion
    let finishedRun = await service.getRun(run.id);
    let attempts = 0;
    while (finishedRun && finishedRun.status === 'running' && attempts < 100) {
      await new Promise((r) => setTimeout(r, 50));
      finishedRun = await service.getRun(run.id);
      attempts++;
    }

    expect(finishedRun?.status).toBe('completed');
    expect(finishedRun?.successfulItems).toBe(3);
    expect(finishedRun?.failedItems).toBe(0);

    // Verify real PrintQueue and MockTransport processed exactly 3 dispatches
    expect(mockTransport.dispatches.length).toBe(3);

    // Verify persisted record on disk
    const persisted = await persistence.load(run.id);
    expect(persisted).not.toBeNull();
    expect(persisted?.run.status).toBe('completed');
    expect(persisted?.run.successfulItems).toBe(3);
  });

  it('supports pause and resume of a production run', async () => {
    const records = Array.from({ length: 6 }, (_, i) => ({
      index: i,
      values: { name: `Item-${i}` },
    }));

    const preflight = runProductionPreflight({
      document: sampleDoc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
    });

    const plan = service.createPlan({
      document: sampleDoc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
      preflight,
    });

    const run = await service.createRun(plan);
    await service.startRun(run.id);

    // Pause immediately
    const pausedRun = service.pauseRun(run.id);
    expect(pausedRun.status === 'pausing' || pausedRun.status === 'paused').toBe(true);

    // Wait until paused state settles
    let settled = await service.getRun(run.id);
    let attempts = 0;
    while (settled && settled.status === 'pausing' && attempts < 50) {
      await new Promise((r) => setTimeout(r, 20));
      settled = await service.getRun(run.id);
      attempts++;
    }

    expect(settled?.status).toBe('paused');

    // Resume execution
    const resumedRun = await service.resumeRun(run.id);
    expect(resumedRun.status).toBe('running');

    // Wait for full completion
    let finalRun = await service.getRun(run.id);
    attempts = 0;
    while (finalRun && finalRun.status === 'running' && attempts < 100) {
      await new Promise((r) => setTimeout(r, 50));
      finalRun = await service.getRun(run.id);
      attempts++;
    }

    expect(finalRun?.status).toBe('completed');
    expect(finalRun?.successfulItems).toBe(6);
  });

  it('supports cancel of a production run', async () => {
    const records = Array.from({ length: 10 }, (_, i) => ({
      index: i,
      values: { name: `CancelItem-${i}` },
    }));

    const preflight = runProductionPreflight({
      document: sampleDoc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
    });

    const plan = service.createPlan({
      document: sampleDoc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
      preflight,
    });

    const run = await service.createRun(plan);
    await service.startRun(run.id);

    const cancelledRun = service.cancelRun(run.id);
    expect(cancelledRun.status).toBe('cancelled');

    const finalRun = await service.getRun(run.id);
    expect(finalRun?.status).toBe('cancelled');
  });
});
