import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'node:events';
import {
  CrashRecoveryService,
  ProductionPersistenceService,
  ProductionCoordinator,
  type IPrintQueue,
} from '../../../src/main/production';
import {
  type ProductionPlan,
  type ProductionRun,
  createProductionPlan,
  createProductionRun,
  runProductionPreflight,
} from '../../../src/core/production';
import { type LabelDocument } from '../../../src/core/schemas/label.schema';
import { type PrinterProfile } from '../../../src/core/printing/printer-profile.schema';
import { type PrintJob, type CreatePrintJobParams } from '../../../src/core/printing/print-job.types';
import { type PrintArtifact } from '../../../src/core/printing/print-artifact.types';

class FakePrintQueue extends EventEmitter implements IPrintQueue {
  public jobs = new Map<string, PrintJob>();

  public enqueue(params: CreatePrintJobParams, artifact: PrintArtifact, profile: PrinterProfile): PrintJob {
    const job: PrintJob = {
      id: params.id,
      printerProfileId: profile.id,
      artifactType: params.artifactType,
      copies: params.copies,
      status: 'queued',
      attempt: 1,
      maxAttempts: 1,
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);

    setTimeout(() => {
      const dispatchingJob: PrintJob = { ...job, status: 'dispatching' };
      this.jobs.set(job.id, dispatchingJob);
      this.emit('statusChange', dispatchingJob);

      setTimeout(() => {
        const completedJob: PrintJob = { ...job, status: 'completed' };
        this.jobs.set(job.id, completedJob);
        this.emit('statusChange', completedJob);
      }, 5);
    }, 5);

    return job;
  }

  public cancel(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job) {
      const cancelledJob: PrintJob = { ...job, status: 'cancelled' };
      this.jobs.set(job.id, cancelledJob);
      this.emit('statusChange', cancelledJob);
      return true;
    }
    return false;
  }

  public getJob(jobId: string): PrintJob | undefined {
    return this.jobs.get(jobId);
  }
}

describe('CrashRecoveryService & Startup Recovery - Bloque 8', () => {
  let tempDir: string;
  let persistence: ProductionPersistenceService;
  let recoveryService: CrashRecoveryService;

  const sampleProfile: PrinterProfile = {
    id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    name: 'Zebra ZT410 203DPI',
    enabled: true,
    language: 'zpl',
    dpi: 203,
    connection: {
      type: 'tcp',
      host: '192.168.1.50',
      port: 9100,
      timeoutMs: 5000,
    },
  };

  const sampleDoc: LabelDocument = {
    version: '1.0.0',
    meta: {
      title: 'Recovery Test',
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
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380001',
        type: 'text',
        x: 10,
        y: 10,
        width: 80,
        height: 10,
        rotation: 0,
        locked: false,
        content: 'Product: {name}',
        fontSize: 12,
        fontFamily: 'Arial',
        bold: false,
        italic: false,
        align: 'left',
      },
    ],
  };

  function makePlan(records: Array<{ index: number; values: Record<string, string> }>): ProductionPlan {
    const preflight = runProductionPreflight({
      document: sampleDoc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
    });

    return createProductionPlan({
      document: sampleDoc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
      preflight,
    });
  }

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'openlabels-recovery-test-'));
    persistence = new ProductionPersistenceService(tempDir);
    recoveryService = new CrashRecoveryService(persistence);
  });

  afterEach(async () => {
    if (fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('CRITICAL: Simulates app crash during execution, verifies run becomes interrupted and dispatching item becomes unknown', async () => {
    const plan = makePlan([
      { index: 0, values: { name: 'Item A' } },
      { index: 1, values: { name: 'Item B' } },
      { index: 2, values: { name: 'Item C' } },
    ]);

    // Simulate run that crashed while item 1 was dispatching
    const activeRun: ProductionRun = {
      ...createProductionRun(plan),
      status: 'running',
      startedAt: '2026-09-13T10:00:00.000Z',
      items: [
        {
          id: '20000000-0000-4000-8000-000000000001',
          recordIndex: 0,
          status: 'completed',
          attempts: 1,
          createdAt: '2026-09-13T10:00:00.000Z',
          updatedAt: '2026-09-13T10:00:01.000Z',
        },
        {
          id: '20000000-0000-4000-8000-000000000002',
          recordIndex: 1,
          status: 'dispatching', // In-flight when crash happened!
          attempts: 1,
          createdAt: '2026-09-13T10:00:00.000Z',
          updatedAt: '2026-09-13T10:00:02.000Z',
        },
        {
          id: '20000000-0000-4000-8000-000000000003',
          recordIndex: 2,
          status: 'pending',
          attempts: 0,
          createdAt: '2026-09-13T10:00:00.000Z',
          updatedAt: '2026-09-13T10:00:00.000Z',
        },
      ],
    };

    // Save crashed state to disk
    await persistence.save(plan, activeRun);

    // Simulate app restart: Startup reconciliation
    const reconciled = await recoveryService.reconcilePersistedRuns();
    expect(reconciled.length).toBe(1);
    expect(reconciled[0].recovered).toBe(true);
    expect(reconciled[0].run.status).toBe('interrupted');

    // Item 1 (dispatching) MUST be marked unknown with duplicate warning
    expect(reconciled[0].run.items[1].status).toBe('unknown');
    expect(reconciled[0].run.items[1].error?.code).toBe('DISPATCH_INTERRUPTED');
    expect(reconciled[0].run.items[1].error?.retryable).toBe(false);

    // Reload from disk and confirm persistence
    const reloaded = await persistence.load(activeRun.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.run.status).toBe('interrupted');
    expect(reloaded?.run.items[1].status).toBe('unknown');
    expect(reloaded?.run.items[2].status).toBe('pending');
  });

  it('validates printer profile availability before resuming interrupted run', async () => {
    const plan = makePlan([{ index: 0, values: { name: 'Item A' } }]);

    const interruptedRun: ProductionRun = {
      ...createProductionRun(plan),
      status: 'interrupted',
    };

    // Profile matches
    const validCheck = recoveryService.validateResume(plan, interruptedRun, sampleProfile);
    expect(validCheck.canResume).toBe(true);

    // Missing profile
    const missingCheck = recoveryService.validateResume(plan, interruptedRun, null);
    expect(missingCheck.canResume).toBe(false);
    expect(missingCheck.error).toContain('missing');

    // Mismatched profile
    const wrongProfile: PrinterProfile = { ...sampleProfile, id: 'c9999999-9999-4999-8999-999999999999' };
    const mismatchCheck = recoveryService.validateResume(plan, interruptedRun, wrongProfile);
    expect(mismatchCheck.canResume).toBe(false);
    expect(mismatchCheck.error).toContain('mismatch');
  });

  it('allows resuming an interrupted run and finishing remaining pending items', async () => {
    const plan = makePlan([
      { index: 0, values: { name: 'Item A' } },
      { index: 1, values: { name: 'Item B' } },
    ]);

    // Item 0 is completed, Item 1 was reset to pending after crash
    const interruptedRun: ProductionRun = {
      ...createProductionRun(plan),
      status: 'interrupted',
      startedAt: '2026-09-13T10:00:00.000Z',
      items: [
        {
          id: '30000000-0000-4000-8000-000000000001',
          recordIndex: 0,
          status: 'completed',
          attempts: 1,
          createdAt: '2026-09-13T10:00:00.000Z',
          updatedAt: '2026-09-13T10:00:01.000Z',
        },
        {
          id: '30000000-0000-4000-8000-000000000002',
          recordIndex: 1,
          status: 'pending',
          attempts: 0,
          createdAt: '2026-09-13T10:00:00.000Z',
          updatedAt: '2026-09-13T10:00:00.000Z',
        },
      ],
    };

    const fakeQueue = new FakePrintQueue();
    const coordinator = new ProductionCoordinator(plan, sampleProfile, fakeQueue, {
      existingRun: interruptedRun,
    });

    expect(coordinator.getRun().status).toBe('interrupted');

    await new Promise<void>((resolve) => {
      coordinator.on('completed', () => {
        resolve();
      });
      coordinator.resume();
    });

    const finalRun = coordinator.getRun();
    expect(finalRun.status).toBe('completed');
    expect(finalRun.successfulItems).toBe(2);
    expect(finalRun.items[1].status).toBe('completed');
  });
});
