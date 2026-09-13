import { describe, it, expect, vi } from 'vitest';
import { PrintQueue } from '../../../src/main/printing/print-queue';
import { MockTransport } from '../../mocks/mock-transport';
import type {
  PrinterProfile,
  ZplPrintArtifact,
  PdfPrintArtifact,
  PrintJob,
} from '../../../src/core/printing';

describe('PrintQueue (Bloque 3)', () => {
  const profileZebra1: PrinterProfile = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Zebra Line 1',
    connection: { type: 'tcp', host: '192.168.1.10', port: 9100, timeoutMs: 1000 },
    language: 'zpl',
    dpi: 203,
    enabled: true,
  };

  const profileZebra2: PrinterProfile = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Zebra Line 2',
    connection: { type: 'tcp', host: '192.168.1.20', port: 9100, timeoutMs: 1000 },
    language: 'zpl',
    dpi: 203,
    enabled: true,
  };

  const zplArtifact: ZplPrintArtifact = {
    type: 'zpl',
    data: '^XA^FDTest^FS^XZ',
    dpi: 203,
  };

  it('enqueues and completes a successful job', async () => {
    const transport = new MockTransport();
    const queue = new PrintQueue([transport]);

    const statusUpdates: string[] = [];
    queue.on('statusChange', (job: PrintJob) => {
      statusUpdates.push(job.status);
    });

    const job = queue.enqueue(
      {
        id: 'job-1',
        printerProfileId: profileZebra1.id,
        artifactType: 'zpl',
        copies: 1,
      },
      zplArtifact,
      profileZebra1
    );

    expect(job.status).toBe('queued');

    // Wait for async processing
    await vi.waitFor(() => {
      expect(queue.getJob('job-1')?.status).toBe('completed');
    });

    const completedJob = queue.getJob('job-1');
    expect(completedJob?.status).toBe('completed');
    expect(completedJob?.startedAt).toBeDefined();
    expect(completedJob?.completedAt).toBeDefined();
    expect(statusUpdates).toContain('validating');
    expect(statusUpdates).toContain('dispatching');
    expect(statusUpdates).toContain('completed');
    expect(transport.dispatches).toHaveLength(1);
  });

  it('dispatches multiple copies correctly', async () => {
    const transport = new MockTransport();
    const queue = new PrintQueue([transport]);

    queue.enqueue(
      {
        id: 'job-copies',
        printerProfileId: profileZebra1.id,
        artifactType: 'zpl',
        copies: 3,
      },
      zplArtifact,
      profileZebra1
    );

    await vi.waitFor(() => {
      expect(queue.getJob('job-copies')?.status).toBe('completed');
    });

    expect(transport.dispatches).toHaveLength(3);
  });

  it('fails immediately when artifact and profile are incompatible', async () => {
    const transport = new MockTransport();
    const queue = new PrintQueue([transport]);

    const pdfArtifact: PdfPrintArtifact = {
      type: 'pdf',
      data: new Uint8Array([1, 2, 3]),
    };

    queue.enqueue(
      {
        id: 'job-incompat',
        printerProfileId: profileZebra1.id,
        artifactType: 'pdf',
        copies: 1,
      },
      pdfArtifact,
      profileZebra1 // ZPL profile with PDF artifact -> incompatible!
    );

    await vi.waitFor(() => {
      expect(queue.getJob('job-incompat')?.status).toBe('failed');
    });

    const failed = queue.getJob('job-incompat');
    expect(failed?.status).toBe('failed');
    expect(failed?.error?.code).toBe('UNSUPPORTED_ARTIFACT');
    expect(transport.dispatches).toHaveLength(0);
  });

  it('enforces 1 active job per printer profile (serial processing)', async () => {
    let releaseGate!: () => void;
    const pauseGate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });

    const transport = new MockTransport();
    transport.pauseGate = pauseGate;
    const queue = new PrintQueue([transport]);

    queue.enqueue(
      { id: 'job-seq-1', printerProfileId: profileZebra1.id, artifactType: 'zpl', copies: 1 },
      zplArtifact,
      profileZebra1
    );

    queue.enqueue(
      { id: 'job-seq-2', printerProfileId: profileZebra1.id, artifactType: 'zpl', copies: 1 },
      zplArtifact,
      profileZebra1
    );

    // Job 1 must be in dispatching while waiting on pauseGate
    await vi.waitFor(() => {
      expect(queue.getJob('job-seq-1')?.status).toBe('dispatching');
    });

    // Job 2 must still be queued because Job 1 is active on printer 1
    const j2WhileJ1Active = queue.getJob('job-seq-2');
    expect(j2WhileJ1Active?.status).toBe('queued');

    // Release the gate so Job 1 can complete
    transport.pauseGate = undefined;
    releaseGate();

    // Now both should complete sequentially
    await vi.waitFor(
      () => {
        expect(queue.getJob('job-seq-1')?.status).toBe('completed');
        expect(queue.getJob('job-seq-2')?.status).toBe('completed');
      },
      { timeout: 3000 }
    );
  });

  it('allows concurrent jobs on different printers', async () => {
    const transport = new MockTransport({ delayMs: 50 });
    const queue = new PrintQueue([transport]);

    queue.enqueue(
      { id: 'job-p1', printerProfileId: profileZebra1.id, artifactType: 'zpl', copies: 1 },
      zplArtifact,
      profileZebra1
    );

    queue.enqueue(
      { id: 'job-p2', printerProfileId: profileZebra2.id, artifactType: 'zpl', copies: 1 },
      zplArtifact,
      profileZebra2
    );

    // Both should enter dispatching around the same time
    await vi.waitFor(() => {
      expect(queue.getJob('job-p1')?.status).toBe('dispatching');
      expect(queue.getJob('job-p2')?.status).toBe('dispatching');
    });

    await vi.waitFor(
      () => {
        expect(queue.getJob('job-p1')?.status).toBe('completed');
        expect(queue.getJob('job-p2')?.status).toBe('completed');
      },
      { timeout: 3000 }
    );
  });

  it('cancels queued job without dispatching', async () => {
    const transport = new MockTransport({ delayMs: 100 });
    const queue = new PrintQueue([transport]);

    queue.enqueue(
      { id: 'job-c1', printerProfileId: profileZebra1.id, artifactType: 'zpl', copies: 1 },
      zplArtifact,
      profileZebra1
    );

    queue.enqueue(
      { id: 'job-c2', printerProfileId: profileZebra1.id, artifactType: 'zpl', copies: 1 },
      zplArtifact,
      profileZebra1
    );

    const cancelled = queue.cancelJob('job-c2');
    expect(cancelled).toBe(true);

    const j2 = queue.getJob('job-c2');
    expect(j2?.status).toBe('cancelled');

    await vi.waitFor(() => {
      expect(queue.getJob('job-c1')?.status).toBe('completed');
    });

    // Verify job-c2 was never dispatched
    const dispatchesForC2 = transport.dispatches.filter((d) => d.context.jobId === 'job-c2');
    expect(dispatchesForC2).toHaveLength(0);
  });

  it('re-tries transient errors and eventually completes', async () => {
    const transport = new MockTransport();
    // Fail first call with retryable CONNECTION_REFUSED, succeed on second call
    transport.setShouldFail(true, {
      code: 'CONNECTION_REFUSED',
      message: 'Connection refused by printer',
      retryable: true,
    });

    const queue = new PrintQueue([transport]);

    queue.enqueue(
      { id: 'job-retry', printerProfileId: profileZebra1.id, artifactType: 'zpl', copies: 1, maxAttempts: 2 },
      zplArtifact,
      profileZebra1
    );

    // Wait until job transitions into retry_wait
    await vi.waitFor(() => {
      expect(queue.getJob('job-retry')?.status).toBe('retry_wait');
    });

    // Make second attempt succeed
    transport.setShouldFail(false);

    // Wait until job completes
    await vi.waitFor(
      () => {
        expect(queue.getJob('job-retry')?.status).toBe('completed');
      },
      { timeout: 5000 }
    );

    const completed = queue.getJob('job-retry');
    expect(completed?.status).toBe('completed');
    expect(completed?.attempt).toBe(2);
  });

  it('fails permanently when max attempts are exceeded', async () => {
    const transport = new MockTransport({
      shouldFail: true,
      failureError: {
        code: 'CONNECTION_TIMEOUT',
        message: 'Socket timeout',
        retryable: true,
      },
    });

    const queue = new PrintQueue([transport]);

    queue.enqueue(
      { id: 'job-max', printerProfileId: profileZebra1.id, artifactType: 'zpl', copies: 1, maxAttempts: 1 },
      zplArtifact,
      profileZebra1
    );

    await vi.waitFor(() => {
      expect(queue.getJob('job-max')?.status).toBe('failed');
    });

    const failed = queue.getJob('job-max');
    expect(failed?.status).toBe('failed');
    expect(failed?.attempt).toBe(1);
    expect(failed?.error?.code).toBe('CONNECTION_TIMEOUT');
  });

  it('supports manual retry for failed jobs', async () => {
    const transport = new MockTransport({
      shouldFail: true,
      failureError: {
        code: 'CONNECTION_REFUSED',
        message: 'Printer off',
        retryable: true,
      },
    });

    const queue = new PrintQueue([transport]);

    queue.enqueue(
      { id: 'job-manual-retry', printerProfileId: profileZebra1.id, artifactType: 'zpl', copies: 1, maxAttempts: 1 },
      zplArtifact,
      profileZebra1
    );

    await vi.waitFor(() => {
      expect(queue.getJob('job-manual-retry')?.status).toBe('failed');
    });

    // Fix printer connection in mock
    transport.setShouldFail(false);

    // Manually retry
    const retried = queue.retryJob('job-manual-retry');
    expect(retried).toBe(true);

    await vi.waitFor(() => {
      expect(queue.getJob('job-manual-retry')?.status).toBe('completed');
    });

    expect(queue.getJob('job-manual-retry')?.status).toBe('completed');
  });
});
