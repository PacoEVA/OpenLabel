import { describe, it, expect } from 'vitest';
import {
  LabelDocument,
  compileLabelToZpl,
  buildPrintPlan,
  serializeLabelFile,
  deserializeLabelFile,
} from '../../src/core';
import {
  generateRecords,
  resolveDocument,
  findFieldUsages,
  renameFieldInDocument,
} from '../../src/core/data';

describe('Phase 7 Integration - Variable Data Pipeline', () => {
  const fixedNow = new Date(2026, 8, 12); // 2026-09-12

  const templateDoc: LabelDocument = {
    version: '1.0.0',
    meta: {
      title: 'Variable Shipping Label',
      author: 'QA Automation',
      created: '2026-09-12T00:00:00.000Z',
    },
    dimensions: {
      width: 100,
      height: 60,
      unit: 'mm',
      dpi: 203,
    },
    dataModel: {
      fields: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'company',
          type: 'static',
          value: 'Acme Logistics',
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'operator',
          type: 'input',
          required: true,
          defaultValue: 'Default Operator',
        },
        {
          id: '33333333-3333-3333-3333-333333333333',
          name: 'mfg_date',
          type: 'date',
          mode: 'now',
          format: 'YYYY-MM-DD',
        },
        {
          id: '44444444-4444-4444-4444-444444444444',
          name: 'exp_date',
          type: 'date',
          mode: 'relative',
          offset: { days: 90 },
          format: 'YYYY-MM-DD',
        },
        {
          id: '55555555-5555-5555-5555-555555555555',
          name: 'serial',
          type: 'counter',
          start: 1001,
          step: 1,
          padding: 6,
          prefix: 'SN-',
        },
      ],
    },
    elements: [
      {
        id: 'aaaa0001-0000-0000-0000-000000000001',
        type: 'text',
        x: 5,
        y: 5,
        width: 90,
        height: 8,
        rotation: 0,
        locked: false,
        content: '{company} | Op: {operator}',
        fontSize: 12,
        fontFamily: 'monospace',
        bold: true,
        italic: false,
        align: 'left',
      },
      {
        id: 'aaaa0002-0000-0000-0000-000000000002',
        type: 'text',
        x: 5,
        y: 15,
        width: 90,
        height: 6,
        rotation: 0,
        locked: false,
        content: 'Mfg: {mfg_date} | Exp: {exp_date}',
        fontSize: 10,
        fontFamily: 'monospace',
        bold: false,
        italic: false,
        align: 'left',
      },
      {
        id: 'aaaa0003-0000-0000-0000-000000000003',
        type: 'barcode',
        x: 5,
        y: 25,
        width: 90,
        height: 18,
        rotation: 0,
        locked: false,
        symbology: 'code128',
        data: '{serial}',
        narrowBarRatio: 2,
        displayValue: true,
      },
      {
        id: 'aaaa0004-0000-0000-0000-000000000004',
        type: 'qrcode',
        x: 75,
        y: 25,
        width: 20,
        height: 20,
        rotation: 0,
        locked: false,
        data: 'https://track.acme.com/item/{serial}',
        errorCorrection: 'M',
      },
    ],
  };

  it('executes full pipeline: template -> batch generation -> resolved documents -> ZPL output', () => {
    // 1. Batch Record Generation
    const batchResult = generateRecords({
      fields: templateDoc.dataModel!.fields,
      count: 3,
      context: { now: fixedNow },
      userInputs: { operator: 'Alice Smith' },
    });

    expect(batchResult.success).toBe(true);
    if (!batchResult.success) return;

    expect(batchResult.records).toHaveLength(3);
    expect(batchResult.records[0].company).toBe('Acme Logistics');
    expect(batchResult.records[0].operator).toBe('Alice Smith');
    expect(batchResult.records[0].mfg_date).toBe('2026-09-12');
    expect(batchResult.records[0].serial).toBe('SN-001001');

    expect(batchResult.records[1].serial).toBe('SN-001002');
    expect(batchResult.records[2].serial).toBe('SN-001003');

    // 2. Resolve Document for Record 0
    const resolvedResult0 = resolveDocument(templateDoc, batchResult.records[0]);
    expect(resolvedResult0.success).toBe(true);
    if (!resolvedResult0.success) return;

    const resolvedDoc0 = resolvedResult0.document;

    // Verify Template Document remains untouched
    expect((templateDoc.elements[0] as any).content).toBe('{company} | Op: {operator}');
    expect((templateDoc.elements[2] as any).data).toBe('{serial}');

    // Verify Resolved Document contains substituted concrete data
    expect((resolvedDoc0.elements[0] as any).content).toBe('Acme Logistics | Op: Alice Smith');
    expect((resolvedDoc0.elements[1] as any).content).toContain('Mfg: 2026-09-12 | Exp:');
    expect((resolvedDoc0.elements[2] as any).data).toBe('SN-001001');
    expect((resolvedDoc0.elements[3] as any).data).toBe('https://track.acme.com/item/SN-001001');

    // 3. Build PrintPlan on Resolved Document
    const printPlanRes = buildPrintPlan(resolvedDoc0);
    expect(printPlanRes.success).toBe(true);

    // 4. Compile to ZPL II
    const zplRes = compileLabelToZpl(resolvedDoc0);
    expect(zplRes.success).toBe(true);
    if (zplRes.success) {
      expect(zplRes.data).toContain('^XA');
      expect(zplRes.data).toContain('Acme Logistics | Op: Alice Smith');
      expect(zplRes.data).toContain('SN-001001');
      expect(zplRes.data).not.toContain('{company}');
      expect(zplRes.data).not.toContain('{serial}');
      expect(zplRes.data).toContain('^XZ');
    }
  });

  it('re-validates barcode data and rejects invalid resolved payloads', () => {
    const docWithEan: LabelDocument = {
      ...templateDoc,
      dataModel: {
        fields: [
          {
            id: '66666666-6666-6666-6666-666666666666',
            name: 'ean_val',
            type: 'input',
            required: true,
          },
        ],
      },
      elements: [
        {
          id: 'aaaa0005-0000-0000-0000-000000000005',
          type: 'barcode',
          x: 10,
          y: 10,
          width: 80,
          height: 20,
          rotation: 0,
          locked: false,
          symbology: 'ean13',
          data: '{ean_val}',
          narrowBarRatio: 2,
          displayValue: true,
        },
      ],
    };

    // Attempting resolution with invalid non-numeric EAN
    const badResolution = resolveDocument(docWithEan, { ean_val: 'NOT-A-NUMBER' });
    expect(badResolution.success).toBe(false);
    if (!badResolution.success) {
      expect(badResolution.errors[0].code).toBe('INVALID_BARCODE');
      expect(badResolution.errors[0].message).toContain('EAN-13');
    }

    // Resolution with valid 13-digit EAN
    const goodResolution = resolveDocument(docWithEan, { ean_val: '4006381333931' });
    expect(goodResolution.success).toBe(true);
  });

  it('supports atomic field renaming across document references', () => {
    const usages = findFieldUsages(templateDoc, 'serial');
    expect(usages).toHaveLength(2); // Barcode and QR

    const renamedDoc = renameFieldInDocument(templateDoc, 'serial', 'tracking_code');
    expect(renamedDoc.dataModel?.fields.find((f) => f.name === 'tracking_code')).toBeDefined();
    expect(renamedDoc.dataModel?.fields.find((f) => f.name === 'serial')).toBeUndefined();

    const barcodeEl = renamedDoc.elements[2] as any;
    expect(barcodeEl.data).toBe('{tracking_code}');

    const qrEl = renamedDoc.elements[3] as any;
    expect(qrEl.data).toBe('https://track.acme.com/item/{tracking_code}');
  });

  it('persists and round-trips full variable data model in .label file container', () => {
    const serialized = serializeLabelFile(templateDoc);
    expect(serialized.success).toBe(true);

    if (serialized.success) {
      const deserialized = deserializeLabelFile(serialized.json);
      expect(deserialized.success).toBe(true);
      if (deserialized.success) {
        expect(deserialized.document.dataModel?.fields).toHaveLength(5);
        expect(deserialized.document).toEqual(templateDoc);
      }
    }
  });
});
