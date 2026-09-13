import { describe, it, expect } from 'vitest';
import {
  PrinterProfileSchema,
  isZplArtifact,
  isPdfArtifact,
  canTransitionPrintJob,
  isArtifactCompatibleWithProfile,
  isErrorRetryable,
  calculateRetryDelayMs,
  validateCopies,
  type PrinterProfile,
  type ZplPrintArtifact,
  type PdfPrintArtifact,
} from '../../../src/core/printing';

describe('Printing Domain Model (Bloque 1)', () => {
  const validProfileId = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';

  describe('PrinterProfileSchema', () => {
    it('validates a correct TCP ZPL printer profile', () => {
      const raw = {
        id: validProfileId,
        name: 'Warehouse Zebra ZD421',
        connection: {
          type: 'tcp',
          host: '192.168.1.100',
          port: 9100,
          timeoutMs: 5000,
        },
        language: 'zpl',
        dpi: 203,
        enabled: true,
      };

      const result = PrinterProfileSchema.safeParse(raw);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dpi).toBe(203);
        expect(result.data.connection.type).toBe('tcp');
      }
    });

    it('validates a correct System PDF printer profile', () => {
      const raw = {
        id: validProfileId,
        name: 'Office LaserJet Pro',
        connection: {
          type: 'system',
          printerName: 'HP LaserJet M404n',
        },
        language: 'pdf',
        enabled: true,
      };

      const result = PrinterProfileSchema.safeParse(raw);
      expect(result.success).toBe(true);
    });

    it('rejects ZPL profile without hardware DPI', () => {
      const raw = {
        id: validProfileId,
        name: 'Zebra without DPI',
        connection: {
          type: 'tcp',
          host: '10.0.0.50',
          port: 9100,
        },
        language: 'zpl',
        // missing dpi!
      };

      const result = PrinterProfileSchema.safeParse(raw);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('DPI');
      }
    });

    it('rejects invalid host with illegal characters', () => {
      const raw = {
        id: validProfileId,
        name: 'Bad Host Zebra',
        connection: {
          type: 'tcp',
          host: 'bad host with spaces; rm -rf',
          port: 9100,
        },
        language: 'zpl',
        dpi: 300,
      };

      const result = PrinterProfileSchema.safeParse(raw);
      expect(result.success).toBe(false);
    });

    it('rejects invalid port ranges', () => {
      const raw = {
        id: validProfileId,
        name: 'Bad Port Zebra',
        connection: {
          type: 'tcp',
          host: '192.168.1.50',
          port: 70000, // Invalid!
        },
        language: 'zpl',
        dpi: 203,
      };

      const result = PrinterProfileSchema.safeParse(raw);
      expect(result.success).toBe(false);
    });

    it('rejects non-UUID profile id', () => {
      const raw = {
        id: 'not-a-valid-uuid',
        name: 'Zebra',
        connection: {
          type: 'tcp',
          host: '192.168.1.50',
          port: 9100,
        },
        language: 'zpl',
        dpi: 203,
      };

      const result = PrinterProfileSchema.safeParse(raw);
      expect(result.success).toBe(false);
    });
  });

  describe('PrintArtifact Type Guards', () => {
    it('correctly discriminates ZPL and PDF artifacts', () => {
      const zpl: ZplPrintArtifact = {
        type: 'zpl',
        data: '^XA^XZ',
        dpi: 203,
      };
      const pdf: PdfPrintArtifact = {
        type: 'pdf',
        data: new Uint8Array([0x25, 0x50, 0x44, 0x46]), // %PDF
      };

      expect(isZplArtifact(zpl)).toBe(true);
      expect(isPdfArtifact(zpl)).toBe(false);

      expect(isPdfArtifact(pdf)).toBe(true);
      expect(isZplArtifact(pdf)).toBe(false);
    });
  });

  describe('State Machine: canTransitionPrintJob', () => {
    it('allows valid sequential workflow transitions', () => {
      expect(canTransitionPrintJob('queued', 'validating')).toBe(true);
      expect(canTransitionPrintJob('validating', 'dispatching')).toBe(true);
      expect(canTransitionPrintJob('dispatching', 'completed')).toBe(true);
    });

    it('allows error, retry and ambiguity transitions', () => {
      expect(canTransitionPrintJob('validating', 'failed')).toBe(true);
      expect(canTransitionPrintJob('dispatching', 'failed')).toBe(true);
      expect(canTransitionPrintJob('dispatching', 'unknown')).toBe(true);
      expect(canTransitionPrintJob('failed', 'retry_wait')).toBe(true);
      expect(canTransitionPrintJob('retry_wait', 'queued')).toBe(true);
      expect(canTransitionPrintJob('unknown', 'failed')).toBe(true);
    });

    it('allows valid cancellations', () => {
      expect(canTransitionPrintJob('queued', 'cancelled')).toBe(true);
      expect(canTransitionPrintJob('validating', 'cancelled')).toBe(true);
      expect(canTransitionPrintJob('retry_wait', 'cancelled')).toBe(true);
    });

    it('rejects forbidden and backward transitions from terminal states', () => {
      expect(canTransitionPrintJob('completed', 'queued')).toBe(false);
      expect(canTransitionPrintJob('completed', 'cancelled')).toBe(false);
      expect(canTransitionPrintJob('cancelled', 'dispatching')).toBe(false);
      expect(canTransitionPrintJob('queued', 'completed')).toBe(false);
      expect(canTransitionPrintJob('queued', 'queued')).toBe(false);
    });
  });

  describe('Compatibility: isArtifactCompatibleWithProfile', () => {
    const tcpZplProfile: PrinterProfile = {
      id: validProfileId,
      name: 'Thermal 203 DPI',
      connection: { type: 'tcp', host: '192.168.1.100', port: 9100, timeoutMs: 5000 },
      language: 'zpl',
      dpi: 203,
      enabled: true,
    };

    const systemPdfProfile: PrinterProfile = {
      id: validProfileId,
      name: 'Laser Spooler',
      connection: { type: 'system', printerName: 'Office-Laser' },
      language: 'pdf',
      enabled: true,
    };

    it('accepts matching TCP ZPL profile and artifact', () => {
      const artifact: ZplPrintArtifact = { type: 'zpl', data: '^XA^XZ', dpi: 203 };
      const res = isArtifactCompatibleWithProfile(artifact, tcpZplProfile);
      expect(res.compatible).toBe(true);
    });

    it('accepts matching System PDF profile and artifact', () => {
      const artifact: PdfPrintArtifact = { type: 'pdf', data: new Uint8Array([1, 2, 3]) };
      const res = isArtifactCompatibleWithProfile(artifact, systemPdfProfile);
      expect(res.compatible).toBe(true);
    });

    it('rejects if profile is disabled', () => {
      const disabledProfile = { ...tcpZplProfile, enabled: false };
      const artifact: ZplPrintArtifact = { type: 'zpl', data: '^XA^XZ', dpi: 203 };
      const res = isArtifactCompatibleWithProfile(artifact, disabledProfile);
      expect(res.compatible).toBe(false);
      expect(res.reason).toContain('disabled');
    });

    it('rejects ZPL DPI mismatch', () => {
      const artifact: ZplPrintArtifact = { type: 'zpl', data: '^XA^XZ', dpi: 300 };
      const res = isArtifactCompatibleWithProfile(artifact, tcpZplProfile);
      expect(res.compatible).toBe(false);
      expect(res.reason).toContain('300 DPI cannot be printed on a 203 DPI profile');
    });

    it('rejects cross-language assignments (ZPL to PDF profile or vice versa)', () => {
      const zplArtifact: ZplPrintArtifact = { type: 'zpl', data: '^XA^XZ', dpi: 203 };
      const res1 = isArtifactCompatibleWithProfile(zplArtifact, systemPdfProfile);
      expect(res1.compatible).toBe(false);

      const pdfArtifact: PdfPrintArtifact = { type: 'pdf', data: new Uint8Array([1, 2, 3]) };
      const res2 = isArtifactCompatibleWithProfile(pdfArtifact, tcpZplProfile);
      expect(res2.compatible).toBe(false);
    });
  });

  describe('Retry Policy & Limits', () => {
    it('classifies retryable vs non-retryable errors correctly', () => {
      expect(isErrorRetryable('CONNECTION_REFUSED')).toBe(true);
      expect(isErrorRetryable('CONNECTION_TIMEOUT')).toBe(true);
      expect(isErrorRetryable('CONNECTION_RESET')).toBe(true);
      expect(isErrorRetryable('SPOOLER_ERROR')).toBe(true);

      expect(isErrorRetryable('INVALID_REQUEST')).toBe(false);
      expect(isErrorRetryable('PRINTER_PROFILE_NOT_FOUND')).toBe(false);
      expect(isErrorRetryable('DPI_MISMATCH')).toBe(false);
      expect(isErrorRetryable('COMPILE_FAILED')).toBe(false);
      expect(isErrorRetryable('CANCELLED')).toBe(false);
    });

    it('computes correct backoff delays', () => {
      expect(calculateRetryDelayMs(1)).toBe(0);
      expect(calculateRetryDelayMs(2)).toBe(2000);
      expect(calculateRetryDelayMs(3)).toBe(5000);
      expect(calculateRetryDelayMs(4)).toBe(10000);
    });

    it('validates copy bounds', () => {
      expect(validateCopies(1)).toBe(true);
      expect(validateCopies(10)).toBe(true);
      expect(validateCopies(999)).toBe(true);

      expect(validateCopies(0)).toBe(false);
      expect(validateCopies(-5)).toBe(false);
      expect(validateCopies(1000)).toBe(false);
      expect(validateCopies(2.5)).toBe(false);
    });
  });
});
