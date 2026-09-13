import { describe, it, expect } from 'vitest';
import {
  runProductionPreflight,
  computePreflightFingerprint,
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

const baseDocument: LabelDocument = {
  version: '1.0.0',
  meta: {
    title: 'Preflight Test',
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
      content: 'Item: {itemName}',
      fontFamily: 'monospace',
      fontSize: 12,
      bold: true,
      italic: false,
      align: 'left',
    },
    {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380002',
      type: 'barcode',
      x: 5,
      y: 20,
      width: 50,
      height: 20,
      rotation: 0,
      locked: false,
      symbology: 'ean13',
      data: '{eanCode}',
      narrowBarRatio: 2,
      displayValue: true,
    },
  ],
};

describe('ProductionPreflight Engine (Bloque 2)', () => {
  it('succeeds for valid records with matching printer profile', () => {
    const result = runProductionPreflight({
      document: baseDocument,
      printerProfile: sampleProfile,
      records: [
        { index: 0, values: { itemName: 'Screw M4', eanCode: '4006381333931' } },
        { index: 1, values: { itemName: 'Bolt M6', eanCode: '4006381333931' } },
      ],
      copiesPerRecord: 2,
    });

    expect(result.success).toBe(true);
    expect(result.validItems).toBe(2);
    expect(result.invalidItems).toBe(0);
    expect(result.issues).toHaveLength(0);
    expect(result.fingerprint).toMatch(/^fp-/);
  });

  it('detects missing variable in a specific record', () => {
    const result = runProductionPreflight({
      document: baseDocument,
      printerProfile: sampleProfile,
      records: [
        { index: 0, values: { itemName: 'Screw M4', eanCode: '4006381333931' } },
        { index: 1, values: { eanCode: '4006381333931' } }, // missing itemName
      ],
    });

    expect(result.success).toBe(false);
    expect(result.validItems).toBe(1);
    expect(result.invalidItems).toBe(1);

    const issue = result.issues.find((i) => i.code === 'MISSING_VARIABLE_VALUE');
    expect(issue).toBeDefined();
    expect(issue?.recordIndex).toBe(1);
    expect(issue?.fieldName).toBe('itemName');
  });

  it('detects invalid EAN-13 checksum on a specific record', () => {
    const result = runProductionPreflight({
      document: baseDocument,
      printerProfile: sampleProfile,
      records: [
        { index: 0, values: { itemName: 'Screw M4', eanCode: '4006381333931' } },
        { index: 37, values: { itemName: 'Defective EAN', eanCode: '4006381333930' } }, // bad checksum
      ],
    });

    expect(result.success).toBe(false);
    expect(result.validItems).toBe(1);
    expect(result.invalidItems).toBe(1);

    const eanIssue = result.issues.find((i) => i.recordIndex === 37);
    expect(eanIssue).toBeDefined();
    expect(eanIssue?.code).toBe('INVALID_CHECK_DIGIT');
    expect(eanIssue?.elementId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380002');
  });

  it('detects DPI mismatch between document and printer profile', () => {
    const mismatchProfile: PrinterProfile = {
      ...sampleProfile,
      dpi: 300,
    };

    const result = runProductionPreflight({
      document: baseDocument,
      printerProfile: mismatchProfile,
      records: [{ index: 0, values: { itemName: 'Screw', eanCode: '4006381333931' } }],
    });

    expect(result.success).toBe(false);
    const dpiIssue = result.issues.find((i) => i.code === 'DPI_MISMATCH');
    expect(dpiIssue).toBeDefined();
  });

  it('detects invalid QR code data on a specific record', () => {
    const docWithQr: LabelDocument = {
      ...baseDocument,
      elements: [
        ...baseDocument.elements,
        {
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380003',
          type: 'qrcode',
          x: 60,
          y: 5,
          width: 25,
          height: 25,
          rotation: 0,
          locked: false,
          data: '{qrValue}',
          errorCorrection: 'M',
        },
      ],
    };

    const result = runProductionPreflight({
      document: docWithQr,
      printerProfile: sampleProfile,
      records: [
        { index: 0, values: { itemName: 'Screw', eanCode: '4006381333931', qrValue: '' } }, // empty QR data is invalid
      ],
    });

    expect(result.success).toBe(false);
    const qrIssue = result.issues.find((i) => i.elementId === 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380003');
    expect(qrIssue).toBeDefined();
    expect(qrIssue?.code).toBe('INVALID_DATA');
  });

  it('warns when element boundaries exceed label dimensions', () => {
    const docWithOverflow: LabelDocument = {
      ...baseDocument,
      elements: [
        {
          ...baseDocument.elements[0],
          x: 95, // 95 + 40 = 135mm > 100mm width
        },
      ],
    };

    const result = runProductionPreflight({
      document: docWithOverflow,
      printerProfile: sampleProfile,
      records: [{ index: 0, values: { itemName: 'Overflow Item' } }],
    });

    // Warning does not cause preflight failure if there are no errors
    const warning = result.issues.find((i) => i.code === 'ELEMENT_OUT_OF_BOUNDS_X');
    expect(warning).toBeDefined();
    expect(warning?.level).toBe('warning');
    expect(result.success).toBe(true);
  });

  it('rejects invalid copies or empty records', () => {
    const emptyResult = runProductionPreflight({
      document: baseDocument,
      printerProfile: sampleProfile,
      records: [],
      copiesPerRecord: 0,
    });

    expect(emptyResult.success).toBe(false);
    expect(emptyResult.issues.some((i) => i.code === 'EMPTY_RECORDS')).toBe(true);
    expect(emptyResult.issues.some((i) => i.code === 'INVALID_COPIES')).toBe(true);
  });

  it('generates a deterministic fingerprint independent of timestamp', () => {
    const records = [
      { index: 0, values: { itemName: 'A', eanCode: '4006381333931' } },
      { index: 1, values: { itemName: 'B', eanCode: '4006381333931' } },
    ];

    const fp1 = computePreflightFingerprint(baseDocument, sampleProfile, records, 2);
    const fp2 = computePreflightFingerprint(baseDocument, sampleProfile, records, 2);
    expect(fp1).toBe(fp2);

    // Modifying record changes fingerprint
    const fpModified = computePreflightFingerprint(
      baseDocument,
      sampleProfile,
      [{ index: 0, values: { itemName: 'Modified', eanCode: '4006381333931' } }],
      2
    );
    expect(fpModified).not.toBe(fp1);
  });
});
