import { describe, it, expect } from 'vitest';
import {
  SystemPrinterTransport,
  type SystemPrintExecutor,
} from '../../../src/main/printing/transports/system-printer.transport';
import type {
  PrinterProfile,
  PdfPrintArtifact,
  ZplPrintArtifact,
} from '../../../src/core/printing';

describe('SystemPrinterTransport (Bloque 7)', () => {
  const profileSystem: PrinterProfile = {
    id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
    name: 'HP Office Laser',
    connection: { type: 'system', printerName: 'HP_LaserJet_Pro' },
    language: 'pdf',
    enabled: true,
  };

  const samplePdf: PdfPrintArtifact = {
    type: 'pdf',
    data: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]),
  };

  it('canHandle evaluates system connection and PDF artifact correctly', () => {
    const transport = new SystemPrinterTransport();
    expect(transport.canHandle(profileSystem, samplePdf)).toBe(true);

    const zplArtifact: ZplPrintArtifact = { type: 'zpl', data: '^XA^XZ', dpi: 203 };
    expect(transport.canHandle(profileSystem, zplArtifact)).toBe(false);

    const tcpProfile: PrinterProfile = {
      ...profileSystem,
      connection: { type: 'tcp', host: '127.0.0.1', port: 9100, timeoutMs: 5000 },
    };
    expect(transport.canHandle(tcpProfile, samplePdf)).toBe(false);
  });

  it('dispatches PDF to system printer executor successfully', async () => {
    let capturedPrinter = '';
    let capturedBytes = 0;

    const mockExecutor: SystemPrintExecutor = async (printerName, pdfData) => {
      capturedPrinter = printerName;
      capturedBytes = pdfData.byteLength;
      return { success: true };
    };

    const transport = new SystemPrinterTransport(mockExecutor);
    const result = await transport.send(profileSystem, samplePdf, { jobId: 'job-sys-1', attempt: 1 });

    expect(result.success).toBe(true);
    expect(result.bytesWritten).toBe(samplePdf.data.byteLength);
    expect(capturedPrinter).toBe('HP_LaserJet_Pro');
    expect(capturedBytes).toBe(samplePdf.data.byteLength);
  });

  it('handles spooler errors returned by executor', async () => {
    const mockExecutor: SystemPrintExecutor = async (printerName) => {
      return {
        success: false,
        error: {
          code: 'SPOOLER_ERROR',
          message: `Spooler failed: printer ${printerName} is offline`,
          retryable: true,
        },
      };
    };

    const transport = new SystemPrinterTransport(mockExecutor);
    const result = await transport.send(profileSystem, samplePdf, { jobId: 'job-sys-err', attempt: 1 });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SPOOLER_ERROR');
    expect(result.error?.retryable).toBe(true);
  });

  it('handles cancellation signal before dispatch', async () => {
    const mockExecutor: SystemPrintExecutor = async () => ({ success: true });
    const transport = new SystemPrinterTransport(mockExecutor);

    const controller = new AbortController();
    controller.abort();

    const result = await transport.send(profileSystem, samplePdf, {
      jobId: 'job-sys-cancel',
      attempt: 1,
      signal: controller.signal,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('CANCELLED');
  });
});
