import { describe, it, expect } from 'vitest';
import {
  runProductionPreflight,
  createProductionPlan,
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
  createdAt: '2026-09-13T00:00:00.000Z',
  updatedAt: '2026-09-13T00:00:00.000Z',
};

function getBaseDocument(): LabelDocument {
  return {
    version: '1.0.0',
    meta: {
      title: 'Snapshot Test',
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
        content: 'Item: {itemName} - {serial}',
        fontFamily: 'monospace',
        fontSize: 12,
        bold: true,
        italic: false,
        align: 'left',
      },
    ],
    dataModel: {
      fields: [
        {
          id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380001',
          name: 'serial',
          type: 'counter',
          start: 100,
          step: 1,
          padding: 5,
          prefix: 'SN-',
        },
      ],
    },
  };
}

describe('Production Snapshots & Counter Freezing (Bloque 3)', () => {
  it('freezes document template into an immutable snapshot', () => {
    const records = [
      { index: 0, values: { itemName: 'Part A' } },
      { index: 1, values: { itemName: 'Part B' } },
    ];

    const doc = getBaseDocument();
    const preflight = runProductionPreflight({
      document: doc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
    });
    expect(preflight.success).toBe(true);

    const plan = createProductionPlan({
      document: doc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
      preflight,
    });

    // Mutate the original document
    doc.dimensions.width = 150;
    doc.elements[0].x = 50;

    // Snapshot in plan MUST NOT change
    expect(plan.documentSnapshot.dimensions.width).toBe(100);
    expect(plan.documentSnapshot.elements[0].x).toBe(5);
  });

  it('freezes counter values per record index deterministically', () => {
    const doc = getBaseDocument();
    const records = [
      { index: 0, values: { itemName: 'Gear' } },
      { index: 1, values: { itemName: 'Pulley' } },
      { index: 2, values: { itemName: 'Shaft' } },
    ];

    const preflight = runProductionPreflight({
      document: doc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
    });

    const plan = createProductionPlan({
      document: doc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
      preflight,
    });

    expect(plan.records[0].values['serial']).toBe('SN-00100');
    expect(plan.records[1].values['serial']).toBe('SN-00101');
    expect(plan.records[2].values['serial']).toBe('SN-00102');

    // Simulating retry of Record 1: the frozen value MUST still be SN-00101
    expect(plan.records[1].values['serial']).toBe('SN-00101');
  });

  it('detects stale preflight when template or records change after preflight', () => {
    const doc = getBaseDocument();
    const records = [{ index: 0, values: { itemName: 'Original' } }];

    const preflight = runProductionPreflight({
      document: doc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 1,
    });

    // Alter records before creating plan
    const modifiedRecords = [{ index: 0, values: { itemName: 'ModifiedAfterPreflight' } }];

    expect(() =>
      createProductionPlan({
        document: doc,
        printerProfile: sampleProfile,
        records: modifiedRecords,
        copiesPerRecord: 1,
        preflight,
      })
    ).toThrow(/Preflight is stale/);
  });

  it('refuses to create a plan from a failed preflight', () => {
    const doc = getBaseDocument();
    const failedPreflight = {
      success: false,
      validItems: 0,
      invalidItems: 1,
      fingerprint: 'fp-failed',
      issues: [],
      executedAt: new Date().toISOString(),
    };

    expect(() =>
      createProductionPlan({
        document: doc,
        printerProfile: sampleProfile,
        records: [{ index: 0, values: { itemName: 'Item' } }],
        copiesPerRecord: 1,
        preflight: failedPreflight,
      })
    ).toThrow(/Cannot create ProductionPlan with a failed preflight/);
  });

  it('instantiates ProductionRun with pending items and correct total count', () => {
    const doc = getBaseDocument();
    const records = [
      { index: 0, values: { itemName: 'A' } },
      { index: 1, values: { itemName: 'B' } },
    ];

    const preflight = runProductionPreflight({
      document: doc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 3,
    });

    const plan = createProductionPlan({
      document: doc,
      printerProfile: sampleProfile,
      records,
      copiesPerRecord: 3,
      preflight,
    });

    expect(plan.totalLabels).toBe(6);

    const run = createProductionRun(plan);
    expect(run.status).toBe('ready');
    expect(run.planId).toBe(plan.id);
    expect(run.items).toHaveLength(2);
    expect(run.items.every((it) => it.status === 'pending')).toBe(true);
    expect(run.totalItems).toBe(2);
  });
});
