import { describe, it, expect } from 'vitest';
import {
  PrinterProfileSchema,
  validateCopies,
} from '../../../src/core/printing';
import { CreatePrintJobRequestSchema } from '../../../src/main/printing/printing.service';

describe('Printing Security Audit (Bloque 11)', () => {
  const validDoc = {
    version: '1.0.0',
    meta: { title: 'T', author: 'A', created: '2026-09-12T10:00:00.000Z' },
    dimensions: { width: 100, height: 50, unit: 'mm' as const, dpi: 203 as const },
    elements: [],
  };

  it('rejects malicious hosts containing shell or command injection attempts', () => {
    const attackPayloads = [
      '192.168.1.1; cat /etc/passwd',
      'localhost && calc.exe',
      'printer\n^XA^XZ',
      'host with spaces',
      '`whoami`.local',
    ];

    for (const host of attackPayloads) {
      const res = PrinterProfileSchema.safeParse({
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Attacker Profile',
        connection: { type: 'tcp', host, port: 9100 },
        language: 'zpl',
        dpi: 203,
      });

      expect(res.success).toBe(false);
    }
  });

  it('rejects raw ZPL injection attempts into CreatePrintJobRequest', () => {
    const rawAttack = {
      document: validDoc,
      printerProfileId: '11111111-1111-4111-8111-111111111111',
      copies: 1,
      // Attempt to sneak in arbitrary raw ZPL string to bypass compiler:
      rawZpl: '^XA^JUS^XZ',
    };

    const parsed = CreatePrintJobRequestSchema.parse(rawAttack);
    // Schema must strip or ignore arbitrary unvalidated payload:
    expect((parsed as Record<string, unknown>).rawZpl).toBeUndefined();
  });

  it('enforces upper and lower limits on requested copies to prevent DoS', () => {
    expect(validateCopies(0)).toBe(false);
    expect(validateCopies(-1)).toBe(false);
    expect(validateCopies(1000)).toBe(false);
    expect(validateCopies(1000000)).toBe(false);
    expect(validateCopies(NaN)).toBe(false);
    expect(validateCopies(Infinity)).toBe(false);

    expect(validateCopies(1)).toBe(true);
    expect(validateCopies(50)).toBe(true);
    expect(validateCopies(999)).toBe(true);
  });

  it('rejects non-UUID profile identifiers', () => {
    const res = CreatePrintJobRequestSchema.safeParse({
      document: validDoc,
      printerProfileId: '../../../etc/shadow',
      copies: 1,
    });

    expect(res.success).toBe(false);
  });
});
