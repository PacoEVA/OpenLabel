import { describe, it, expect } from 'vitest';
import { PrintingService } from '../../../src/main/printing/printing.service';
import type { LabelDocument } from '../../../src/core/schemas/label.schema';

describe('PrintingService & IPC Business Layer (Bloque 8)', () => {
  const sampleDoc: LabelDocument = {
    version: '1.0.0',
    meta: {
      title: 'Canonical Label',
      author: 'Tester',
      created: '2026-09-12T10:00:00.000Z',
    },
    dimensions: {
      width: 100,
      height: 50,
      unit: 'mm',
      dpi: 203,
    },
    elements: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        type: 'text',
        x: 10,
        y: 10,
        width: 80,
        height: 15,
        rotation: 0,
        locked: false,
        content: 'Product Barcode',
        fontSize: 14,
        fontFamily: 'Helvetica',
        bold: false,
        italic: false,
        align: 'left',
      },
    ],
  };

  it('initializes with default seeded profiles', () => {
    const service = new PrintingService();
    const profiles = service.listProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(2);

    const zebraProfile = profiles.find((p) => p.language === 'zpl');
    expect(zebraProfile).toBeDefined();
    expect(zebraProfile?.dpi).toBe(203);
  });

  it('creates and enqueues a valid print job for ZPL profile', async () => {
    const service = new PrintingService();
    const profiles = service.listProfiles();
    const zplProfile = profiles.find((p) => p.language === 'zpl')!;

    const result = await service.createJob({
      document: sampleDoc,
      printerProfileId: zplProfile.id,
      copies: 2,
    });

    expect(result.success).toBe(true);
    expect(result.job).toBeDefined();
    expect(result.job?.printerProfileId).toBe(zplProfile.id);
    expect(result.job?.copies).toBe(2);
    expect(result.job?.status).toBe('queued');

    const job = service.getJob(result.job!.id);
    expect(job).toBeDefined();
  });

  it('fails cleanly when profile does not exist', async () => {
    const service = new PrintingService();
    const result = await service.createJob({
      document: sampleDoc,
      printerProfileId: '99999999-9999-4999-8999-999999999999',
      copies: 1,
    });

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('was not found');
  });

  it('fails cleanly when profile is disabled', async () => {
    const service = new PrintingService();
    const profiles = service.listProfiles();
    const target = profiles[0];

    // Disable profile
    service.saveProfile({
      ...target,
      enabled: false,
    });

    const result = await service.createJob({
      document: sampleDoc,
      printerProfileId: target.id,
      copies: 1,
    });

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('disabled');
  });

  it('validates profile saving and error reporting', () => {
    const service = new PrintingService();
    const badResult = service.saveProfile({
      name: 'Missing ID and connection',
    });

    expect(badResult.success).toBe(false);
    expect(badResult.errors).toBeDefined();
  });
});
