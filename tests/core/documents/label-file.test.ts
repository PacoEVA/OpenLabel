import { describe, it, expect } from 'vitest';
import {
  serializeLabelFile,
  deserializeLabelFile,
  CURRENT_FORMAT_VERSION,
} from '../../../src/core/documents';
import type { LabelDocument } from '../../../src/core/schemas/label.schema';

describe('Label File Container & Serialization (Bloque 1)', () => {
  const canonicalDoc: LabelDocument = {
    version: '1.0.0',
    meta: {
      title: 'Canonical Shipping Label',
      author: 'Tester',
      created: '2026-09-12T10:00:00.000Z',
    },
    dimensions: {
      width: 100,
      height: 75,
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
        content: 'OpenLabels Phase 6',
        fontSize: 16,
        fontFamily: 'Helvetica',
        bold: true,
        italic: false,
        align: 'left',
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        type: 'barcode',
        x: 10,
        y: 30,
        width: 80,
        height: 25,
        rotation: 0,
        locked: false,
        symbology: 'code128',
        data: 'OL-123456',
        narrowBarRatio: 1,
        displayValue: true,
      },
    ],
  };

  it('performs lossless round-trip serialization and deserialization', () => {
    const saveRes = serializeLabelFile(canonicalDoc);
    expect(saveRes.success).toBe(true);

    if (saveRes.success) {
      expect(saveRes.json).toContain('"format": "open-label"');
      expect(saveRes.json).toContain(`"formatVersion": ${CURRENT_FORMAT_VERSION}`);

      const loadRes = deserializeLabelFile(saveRes.json);
      expect(loadRes.success).toBe(true);

      if (loadRes.success) {
        expect(loadRes.formatVersion).toBe(CURRENT_FORMAT_VERSION);
        expect(loadRes.migrated).toBe(false);
        expect(loadRes.document).toEqual(canonicalDoc);
      }
    }
  });

  it('serializes with and without pretty-printing indentation', () => {
    const prettyRes = serializeLabelFile(canonicalDoc, { pretty: true });
    const compactRes = serializeLabelFile(canonicalDoc, { pretty: false });

    expect(prettyRes.success).toBe(true);
    expect(compactRes.success).toBe(true);

    if (prettyRes.success && compactRes.success) {
      expect(prettyRes.json).toContain('\n');
      expect(compactRes.json).not.toContain('\n');
    }
  });

  it('rejects empty, whitespace, and truncated JSON', () => {
    const res1 = deserializeLabelFile('');
    expect(res1.success).toBe(false);
    if (!res1.success) {
      expect(res1.errors[0].code).toBe('INVALID_JSON');
    }

    const res2 = deserializeLabelFile('   \n  \t ');
    expect(res2.success).toBe(false);
    if (!res2.success) {
      expect(res2.errors[0].code).toBe('INVALID_JSON');
    }

    const res3 = deserializeLabelFile('{"format": "open-label", "formatVersion": 1, ');
    expect(res3.success).toBe(false);
    if (!res3.success) {
      expect(res3.errors[0].code).toBe('INVALID_JSON');
    }
  });

  it('rejects files with invalid format identifier or invalid root structure', () => {
    const resArray = deserializeLabelFile('["open-label", 1]');
    expect(resArray.success).toBe(false);
    if (!resArray.success) {
      expect(resArray.errors[0].code).toBe('INVALID_FORMAT');
    }

    const resWrongFormat = deserializeLabelFile(
      JSON.stringify({
        format: 'another-app-label',
        formatVersion: 1,
        document: canonicalDoc,
      })
    );
    expect(resWrongFormat.success).toBe(false);
    if (!resWrongFormat.success) {
      expect(resWrongFormat.errors[0].code).toBe('INVALID_FORMAT');
    }
  });

  it('rejects files from future format versions without attempting partial load', () => {
    const futureJson = JSON.stringify({
      format: 'open-label',
      formatVersion: 999, // Future version!
      document: canonicalDoc,
    });

    const res = deserializeLabelFile(futureJson);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors[0].code).toBe('NEWER_FORMAT_VERSION');
      expect(res.errors[0].message).toContain('newer version of the application');
    }
  });

  it('rejects files with invalid domain document schema', () => {
    const badDocJson = JSON.stringify({
      format: 'open-label',
      formatVersion: 1,
      document: {
        ...canonicalDoc,
        dimensions: {
          ...canonicalDoc.dimensions,
          width: -50, // Invalid!
        },
      },
    });

    const res = deserializeLabelFile(badDocJson);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors[0].code).toBe('DOCUMENT_VALIDATION_FAILED');
      expect(res.errors[0].message).toContain('dimensions.width');
    }
  });
});
