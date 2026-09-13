import { describe, it, expect } from 'vitest';
import { findFieldUsages, renameFieldInDocument } from '../../../src/core/data/field-usage';
import { LabelDocument } from '../../../src/core/schemas/label.schema';

describe('findFieldUsages', () => {
  const doc: LabelDocument = {
    version: '1.0.0',
    meta: {
      title: 'Usage Test',
      author: '',
      created: '2026-03-01T00:00:00.000Z',
    },
    dimensions: {
      width: 100,
      height: 50,
      unit: 'mm',
      dpi: 203,
    },
    dataModel: {
      fields: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'serial',
          type: 'counter',
          start: 1,
          step: 1,
          padding: 4,
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'unused',
          type: 'static',
          value: 'Hello',
        },
      ],
    },
    elements: [
      {
        id: 'aaaa1111-1111-1111-1111-111111111111',
        type: 'text',
        x: 10,
        y: 10,
        width: 80,
        height: 10,
        rotation: 0,
        locked: false,
        content: 'SN: {serial}',
        fontSize: 12,
        fontFamily: 'monospace',
        bold: false,
        italic: false,
        align: 'left',
      },
      {
        id: 'bbbb2222-2222-2222-2222-222222222222',
        type: 'barcode',
        x: 10,
        y: 25,
        width: 80,
        height: 15,
        rotation: 0,
        locked: false,
        symbology: 'code128',
        data: '{serial}',
        narrowBarRatio: 2,
        displayValue: true,
      },
    ],
  };

  it('locates elements referencing a field', () => {
    const usages = findFieldUsages(doc, 'serial');
    expect(usages).toHaveLength(2);
    expect(usages[0]).toEqual({
      elementId: 'aaaa1111-1111-1111-1111-111111111111',
      elementType: 'text',
      property: 'content',
    });
    expect(usages[1]).toEqual({
      elementId: 'bbbb2222-2222-2222-2222-222222222222',
      elementType: 'barcode',
      property: 'data',
    });
  });

  it('returns empty array if field is unused', () => {
    const usages = findFieldUsages(doc, 'unused');
    expect(usages).toEqual([]);
  });
});

describe('renameFieldInDocument', () => {
  const doc: LabelDocument = {
    version: '1.0.0',
    meta: {
      title: 'Rename Test',
      author: '',
      created: '2026-03-01T00:00:00.000Z',
    },
    dimensions: {
      width: 100,
      height: 50,
      unit: 'mm',
      dpi: 203,
    },
    dataModel: {
      fields: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'serial',
          type: 'counter',
          start: 1,
          step: 1,
          padding: 4,
        },
      ],
    },
    elements: [
      {
        id: 'aaaa1111-1111-1111-1111-111111111111',
        type: 'text',
        x: 10,
        y: 10,
        width: 80,
        height: 10,
        rotation: 0,
        locked: false,
        content: 'serial: {serial} (literal serial)',
        fontSize: 12,
        fontFamily: 'monospace',
        bold: false,
        italic: false,
        align: 'left',
      },
    ],
  };

  it('atomically updates dataModel definition and element templates', () => {
    const updated = renameFieldInDocument(doc, 'serial', 'serial_num');

    expect(updated.dataModel?.fields[0].name).toBe('serial_num');
    const textEl = updated.elements[0];
    if (textEl.type === 'text') {
      expect(textEl.content).toBe('serial: {serial_num} (literal serial)');
    }
  });
});
