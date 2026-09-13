import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ProductionPersistenceService } from '../../../src/main/production/production-persistence.service';
import {
  createProductionPlan,
  runProductionPreflight,
  createProductionRun,
} from '../../../src/core/production';
import { LabelDocument } from '../../../src/core/schemas/label.schema';
import { PrinterProfile } from '../../../src/core/printing/printer-profile.schema';

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
    title: 'Persistence Test',
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

describe('ProductionPersistenceService (Bloque 7)', () => {
  let tempDir: string;
  let service: ProductionPersistenceService;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `openlabels-prod-test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
    service = new ProductionPersistenceService(tempDir);
  });

  afterEach(async () => {
    if (fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('saves and loads a ProductionRun and plan snapshot', async () => {
    const records = [
      { index: 0, values: { sku: 'SKU-001' } },
      { index: 1, values: { sku: 'SKU-002' } },
    ];

    const preflight = runProductionPreflight({
      document: sampleDoc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
    });

    const plan = createProductionPlan({
      document: sampleDoc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
      preflight,
    });

    const run = createProductionRun(plan);
    run.status = 'running';
    run.items[0].status = 'completed';

    await service.save(plan, run);

    const loaded = await service.load(run.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.run.id).toBe(run.id);
    expect(loaded?.run.status).toBe('running');
    expect(loaded?.run.items[0].status).toBe('completed');
    expect(loaded?.plan.id).toBe(plan.id);
    expect(loaded?.plan.records[0].values['sku']).toBe('SKU-001');
  });

  it('lists historical runs ordered descending by savedAt', async () => {
    const records = [{ index: 0, values: { sku: 'A' } }];
    const preflight = runProductionPreflight({
      document: sampleDoc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
    });
    const plan = createProductionPlan({
      document: sampleDoc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
      preflight,
    });

    const run1 = createProductionRun(plan);
    const run2 = createProductionRun(plan);

    await service.save(plan, run1);
    await new Promise((r) => setTimeout(r, 10));
    await service.save(plan, run2);

    const list = await service.list();
    expect(list).toHaveLength(2);
    // Most recent first
    expect(list[0].run.id).toBe(run2.id);
    expect(list[1].run.id).toBe(run1.id);
  });

  it('deletes a persisted production run file', async () => {
    const records = [{ index: 0, values: { sku: 'A' } }];
    const preflight = runProductionPreflight({
      document: sampleDoc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
    });
    const plan = createProductionPlan({
      document: sampleDoc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
      preflight,
    });
    const run = createProductionRun(plan);

    await service.save(plan, run);
    expect(await service.load(run.id)).not.toBeNull();

    const deleted = await service.delete(run.id);
    expect(deleted).toBe(true);
    expect(await service.load(run.id)).toBeNull();
  });
});
