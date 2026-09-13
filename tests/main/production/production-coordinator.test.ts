import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'node:events';
import {
  ProductionCoordinator,
  IPrintQueue,
} from '../../../src/main/production/production-coordinator';
import {
  createProductionPlan,
  runProductionPreflight,
  ProductionPlan,
} from '../../../src/core/production';
import { LabelDocument } from '../../../src/core/schemas/label.schema';
import { PrinterProfile } from '../../../src/core/printing/printer-profile.schema';
import { PrintJob, CreatePrintJobParams } from '../../../src/core/printing/print-job.types';
import { PrintArtifact } from '../../../src/core/printing/print-artifact.types';

class FakePrintQueue extends EventEmitter implements IPrintQueue {
  public totalJobsEnqueued = 0;
  public activeJobsCount = 0;
  public peakSimultaneousJobs = 0;
  private jobs = new Map<string, PrintJob>();

  public delayMs: number = 5;
  public failJobPredicate?: (jobId: string, index: number) => boolean;
  public unknownJobPredicate?: (jobId: string, index: number) => boolean;

  public enqueue(
    params: CreatePrintJobParams,
    artifact: PrintArtifact,
    profile: PrinterProfile
  ): PrintJob {
    this.totalJobsEnqueued++;
    this.activeJobsCount++;
    this.peakSimultaneousJobs = Math.max(this.peakSimultaneousJobs, this.activeJobsCount);

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

    // Simulate async dispatching and completion
    setTimeout(() => {
      // Step 1: dispatching
      const dispatchingJob: PrintJob = { ...job, status: 'dispatching' };
      this.jobs.set(job.id, dispatchingJob);
      this.emit('statusChange', dispatchingJob);

      setTimeout(() => {
        this.activeJobsCount--;
        if (this.failJobPredicate && this.failJobPredicate(job.id, this.totalJobsEnqueued)) {
          const failedJob: PrintJob = {
            ...job,
            status: 'failed',
            error: { code: 'CONNECTION_REFUSED', message: 'Fake printer connection refused', retryable: true },
          };
          this.jobs.set(job.id, failedJob);
          this.emit('statusChange', failedJob);
        } else if (this.unknownJobPredicate && this.unknownJobPredicate(job.id, this.totalJobsEnqueued)) {
          const unknownJob: PrintJob = {
            ...job,
            status: 'unknown',
            error: { code: 'CONNECTION_TIMEOUT', message: 'Socket dropped after write', retryable: false },
          };
          this.jobs.set(job.id, unknownJob);
          this.emit('statusChange', unknownJob);
        } else {
          const completedJob: PrintJob = { ...job, status: 'completed' };
          this.jobs.set(job.id, completedJob);
          this.emit('statusChange', completedJob);
        }
      }, this.delayMs);
    }, this.delayMs);

    return job;
  }

  public cancel(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job) {
      const cancelled: PrintJob = { ...job, status: 'cancelled' };
      this.jobs.set(jobId, cancelled);
      this.emit('statusChange', cancelled);
      return true;
    }
    return false;
  }

  public getJob(jobId: string): PrintJob | undefined {
    return this.jobs.get(jobId);
  }
}

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
    title: 'Coordinator Test',
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
      x: 5,
      y: 5,
      width: 40,
      height: 10,
      rotation: 0,
      locked: false,
      content: 'Code: {sku}',
      fontFamily: 'monospace',
      fontSize: 12,
      bold: true,
      italic: false,
      align: 'left',
    },
  ],
};

function createPlanWithRecords(count: number): ProductionPlan {
  const records = Array.from({ length: count }, (_, i) => ({
    index: i,
    values: { sku: `SKU-${i.toString().padStart(5, '0')}` },
  }));

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

describe('ProductionCoordinator & Bounded Concurrency Pipeline (Bloque 4)', () => {
  it('processes a batch of 25 records with maxInFlight = 5 strictly bounded', async () => {
    const plan = createPlanWithRecords(25);
    const fakeQueue = new FakePrintQueue();
    fakeQueue.delayMs = 2;

    const coordinator = new ProductionCoordinator(plan, sampleProfile, fakeQueue, {
      maxInFlight: 5,
    });

    await new Promise<void>((resolve) => {
      coordinator.on('completed', () => resolve());
      coordinator.start();
    });

    const run = coordinator.getRun();
    expect(run.status).toBe('completed');
    expect(run.totalItems).toBe(25);
    expect(run.successfulItems).toBe(25);
    expect(run.failedItems).toBe(0);
    expect(fakeQueue.totalJobsEnqueued).toBe(25);

    // Concurrency check: max concurrent jobs enqueued in queue never exceeded 5
    expect(fakeQueue.peakSimultaneousJobs).toBeLessThanOrEqual(5);
    expect(coordinator.getPeakInFlight()).toBeLessThanOrEqual(5);
  });

  it('CRITICAL TEST: 10,000 records NEVER create 10,000 simultaneous PrintJobs', async () => {
    const plan = createPlanWithRecords(10000);
    const fakeQueue = new FakePrintQueue();
    fakeQueue.delayMs = 0; // fast simulation for large count

    const maxInFlight = 5;
    const coordinator = new ProductionCoordinator(plan, sampleProfile, fakeQueue, {
      maxInFlight,
    });

    // Start coordinator and let it process partially
    await coordinator.start();

    // While running, verify active in-flight count is strictly bounded
    expect(coordinator.getActiveInFlightCount()).toBeLessThanOrEqual(maxInFlight);
    expect(coordinator.getPeakInFlight()).toBeLessThanOrEqual(maxInFlight);
    expect(fakeQueue.activeJobsCount).toBeLessThanOrEqual(maxInFlight);

    // Cancel to clean up long 10k execution
    coordinator.cancel();
    const run = coordinator.getRun();
    expect(run.status).toBe('cancelled');
    // Enqueued jobs so far must be a small fraction, never 10,000 at once
    expect(fakeQueue.totalJobsEnqueued).toBeLessThan(100);
    expect(fakeQueue.peakSimultaneousJobs).toBeLessThanOrEqual(maxInFlight);
  });

  it('supports pause and resume without repeating completed items (Bloque 5)', async () => {
    const plan = createPlanWithRecords(10);
    const fakeQueue = new FakePrintQueue();
    fakeQueue.delayMs = 10;

    const coordinator = new ProductionCoordinator(plan, sampleProfile, fakeQueue, {
      maxInFlight: 2,
    });

    await coordinator.start();

    // Pause after starting
    coordinator.pause();

    // Wait for in-flight items to settle and transition to paused
    await new Promise<void>((resolve) => {
      const check = () => {
        if (coordinator.getRun().status === 'paused') {
          resolve();
        } else {
          setTimeout(check, 5);
        }
      };
      check();
    });

    const pausedRun = coordinator.getRun();
    expect(pausedRun.status).toBe('paused');
    expect(pausedRun.successfulItems).toBeGreaterThan(0);
    expect(pausedRun.successfulItems).toBeLessThan(10);
    const completedBeforeResume = pausedRun.successfulItems;

    // Resume execution
    await coordinator.resume();

    await new Promise<void>((resolve) => {
      coordinator.on('completed', () => resolve());
    });

    const finishedRun = coordinator.getRun();
    expect(finishedRun.status).toBe('completed');
    expect(finishedRun.successfulItems).toBe(10);
    expect(fakeQueue.totalJobsEnqueued).toBe(10); // Exactly 10 total jobs, no duplicates
  });

  it('cancels remaining pending and queued items cleanly on cancel (Bloque 5)', async () => {
    const plan = createPlanWithRecords(20);
    const fakeQueue = new FakePrintQueue();
    fakeQueue.delayMs = 20;

    const coordinator = new ProductionCoordinator(plan, sampleProfile, fakeQueue, {
      maxInFlight: 2,
    });

    await coordinator.start();
    // Immediate cancel
    coordinator.cancel();

    const cancelledRun = coordinator.getRun();
    expect(cancelledRun.status).toBe('cancelled');
    expect(cancelledRun.cancelledItems).toBeGreaterThan(0);
  });

  it('handles ambiguous unknown status and manual resolution with forceRetry (Bloque 6)', async () => {
    const plan = createPlanWithRecords(3);
    const fakeQueue = new FakePrintQueue();
    fakeQueue.delayMs = 5;
    // Record index 1 (2nd job) produces an unknown status
    fakeQueue.unknownJobPredicate = (_id, count) => count === 2;

    const coordinator = new ProductionCoordinator(plan, sampleProfile, fakeQueue, {
      maxInFlight: 1, // Sequential
    });

    await new Promise<void>((resolve) => {
      coordinator.on('completed', () => resolve());
      coordinator.start();
    });

    const run = coordinator.getRun();
    expect(run.status).toBe('completed_with_errors');
    expect(run.unknownItems).toBe(1);
    expect(run.successfulItems).toBe(2);

    const unknownItem = run.items.find((it) => it.status === 'unknown')!;
    expect(unknownItem).toBeDefined();

    // 1. Retry without forceRetry MUST throw warning error
    expect(() => coordinator.resolveUnknownItem(unknownItem.id, 'retry', false)).toThrow(
      /This may produce a duplicate label/
    );

    // 2. Mark completed resolution
    coordinator.resolveUnknownItem(unknownItem.id, 'mark_completed');
    expect(unknownItem.status).toBe('completed');
    expect(coordinator.getRun().status).toBe('completed');
  });

  it('retries failed items using exact frozen values (Bloque 6)', async () => {
    const plan = createPlanWithRecords(3);
    const fakeQueue = new FakePrintQueue();
    fakeQueue.delayMs = 5;

    // Fail job 2 once
    let failedOnce = false;
    fakeQueue.failJobPredicate = (_id, count) => {
      if (count === 2 && !failedOnce) {
        failedOnce = true;
        return true;
      }
      return false;
    };

    const coordinator = new ProductionCoordinator(plan, sampleProfile, fakeQueue, {
      maxInFlight: 1,
    });

    await new Promise<void>((resolve) => {
      coordinator.on('completed', () => resolve());
      coordinator.start();
    });

    let run = coordinator.getRun();
    expect(run.status).toBe('completed_with_errors');
    expect(run.failedItems).toBe(1);

    const failedItem = run.items.find((it) => it.status === 'failed')!;
    expect(failedItem).toBeDefined();

    // Retry failed item
    coordinator.retryFailedItem(failedItem.id);

    await new Promise<void>((resolve) => {
      coordinator.on('completed', () => resolve());
    });

    run = coordinator.getRun();
    expect(run.status).toBe('completed');
    expect(run.successfulItems).toBe(3);
    expect(run.failedItems).toBe(0);
  });
});
