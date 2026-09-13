import { describe, it, expect } from 'vitest';
import { MockTransport } from '../../mocks/mock-transport';
import type { PrinterProfile, ZplPrintArtifact } from '../../../src/core/printing';

describe('PrintTransport & MockTransport (Bloque 2)', () => {
  const profile: PrinterProfile = {
    id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
    name: 'Mock Zebra',
    connection: { type: 'tcp', host: '127.0.0.1', port: 9100, timeoutMs: 1000 },
    language: 'zpl',
    dpi: 203,
    enabled: true,
  };

  const artifact: ZplPrintArtifact = {
    type: 'zpl',
    data: '^XA^FDHello^FS^XZ',
    dpi: 203,
  };

  it('delivers successfully and reports byte count', async () => {
    const transport = new MockTransport();
    const result = await transport.send(profile, artifact, { jobId: 'job-1', attempt: 1 });

    expect(result.success).toBe(true);
    expect(result.bytesWritten).toBeGreaterThan(0);
    expect(transport.dispatches).toHaveLength(1);
    expect(transport.dispatches[0].context.jobId).toBe('job-1');
  });

  it('handles simulated failures with structured print error', async () => {
    const transport = new MockTransport({
      shouldFail: true,
      failureError: {
        code: 'CONNECTION_TIMEOUT',
        message: 'Timed out connecting to port 9100',
        retryable: true,
      },
    });

    const result = await transport.send(profile, artifact, { jobId: 'job-2', attempt: 1 });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('CONNECTION_TIMEOUT');
    expect(result.error?.retryable).toBe(true);
  });

  it('respects cancellation signal', async () => {
    const transport = new MockTransport();
    const controller = new AbortController();
    controller.abort();

    const result = await transport.send(profile, artifact, {
      jobId: 'job-3',
      attempt: 1,
      signal: controller.signal,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('CANCELLED');
  });
});
