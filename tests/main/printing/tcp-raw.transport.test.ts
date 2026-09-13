import { describe, it, expect } from 'vitest';
import * as net from 'node:net';
import { TcpRawTransport } from '../../../src/main/printing/transports/tcp-raw.transport';
import type { PrinterProfile, ZplPrintArtifact, PdfPrintArtifact } from '../../../src/core/printing';

describe('TcpRawTransport (Bloque 4)', () => {
  const profileBase: PrinterProfile = {
    id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
    name: 'Local Test Thermal',
    connection: { type: 'tcp', host: '127.0.0.1', port: 9100, timeoutMs: 2000 },
    language: 'zpl',
    dpi: 203,
    enabled: true,
  };

  const sampleZpl: ZplPrintArtifact = {
    type: 'zpl',
    data: '^XA^PW800^LL400^LH0,0^FO50,50^A0N,30,30^FDHello Zebra Net^FS^XZ',
    dpi: 203,
  };

  it('canHandle evaluates connection type and artifact format correctly', () => {
    const transport = new TcpRawTransport();
    expect(transport.canHandle(profileBase, sampleZpl)).toBe(true);

    const pdfArtifact: PdfPrintArtifact = { type: 'pdf', data: new Uint8Array([1, 2, 3]) };
    expect(transport.canHandle(profileBase, pdfArtifact)).toBe(false);

    const systemProfile: PrinterProfile = {
      ...profileBase,
      connection: { type: 'system', printerName: 'Laser' },
    };
    expect(transport.canHandle(systemProfile, sampleZpl)).toBe(false);
  });

  it('successfully delivers exact ZPL payload to local TCP server', async () => {
    let receivedData = '';
    let serverDone!: () => void;
    const serverReceived = new Promise<void>((resolve) => {
      serverDone = resolve;
    });

    const server = net.createServer((socket) => {
      socket.on('data', (chunk) => {
        receivedData += chunk.toString('utf8');
      });
      socket.on('end', () => {
        serverDone();
        socket.end();
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as net.AddressInfo;
    const serverPort = address.port;

    try {
      const profile: PrinterProfile = {
        ...profileBase,
        connection: { type: 'tcp', host: '127.0.0.1', port: serverPort, timeoutMs: 2000 },
      };

      const transport = new TcpRawTransport();
      const result = await transport.send(profile, sampleZpl, { jobId: 'job-tcp-1', attempt: 1 });

      expect(result.success).toBe(true);
      expect(result.bytesWritten).toBe(Buffer.from(sampleZpl.data, 'utf8').byteLength);

      await serverReceived;
      expect(receivedData).toBe(sampleZpl.data);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('captures connection refused when port is closed', async () => {
    // Port 1 is universally refused
    const profile: PrinterProfile = {
      ...profileBase,
      connection: { type: 'tcp', host: '127.0.0.1', port: 1, timeoutMs: 1000 },
    };

    const transport = new TcpRawTransport();
    const result = await transport.send(profile, sampleZpl, { jobId: 'job-tcp-refused', attempt: 1 });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('CONNECTION_REFUSED');
    expect(result.error?.retryable).toBe(true);
  });

  it('captures connection timeout correctly', async () => {
    // 192.0.2.1 is TEST-NET-1 (RFC 5737), non-routable IP that drops packets, triggering timeout
    const profile: PrinterProfile = {
      ...profileBase,
      connection: { type: 'tcp', host: '192.0.2.1', port: 9100, timeoutMs: 150 },
    };

    const transport = new TcpRawTransport();
    const result = await transport.send(profile, sampleZpl, { jobId: 'job-timeout', attempt: 1 });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('CONNECTION_TIMEOUT');
    expect(result.error?.retryable).toBe(true);
  });

  it('testConnection returns success when endpoint is listening', async () => {
    const server = net.createServer((socket) => {
      socket.end();
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as net.AddressInfo;

    try {
      const transport = new TcpRawTransport();
      const status = await transport.testConnection('127.0.0.1', address.port, 1000);
      expect(status.success).toBe(true);
      expect(status.message).toContain('Successfully');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('testConnection returns failure when endpoint is down', async () => {
    const transport = new TcpRawTransport();
    const status = await transport.testConnection('127.0.0.1', 1, 500);
    expect(status.success).toBe(false);
    expect(status.message).toContain('failed');
  });
});
