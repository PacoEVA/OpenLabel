import type { LabelDocument } from '../schemas/label.schema';

export interface TemplateMetadata {
  id: string;
  name: string;
  category: 'shipping' | 'product' | 'logistics' | 'custom';
  description: string;
  isBuiltIn: boolean;
  document: LabelDocument;
}

/**
 * Built-in read-only standard industrial and retail templates.
 */
export const BUILT_IN_TEMPLATES: TemplateMetadata[] = [
  {
    id: 'shipping-100x50',
    name: '100 × 50 mm Shipping Label',
    category: 'shipping',
    description: 'Standard domestic parcel delivery label with tracking barcode and recipient address.',
    isBuiltIn: true,
    document: {
      version: '1.0.0',
      meta: {
        title: 'Shipping 100x50mm',
        author: 'OpenLabels Built-in',
        created: '2026-01-01T00:00:00.000Z',
      },
      dimensions: {
        width: 100,
        height: 50,
        unit: 'mm',
        dpi: 203,
      },
      elements: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          type: 'text',
          x: 4,
          y: 4,
          width: 92,
          height: 6,
          rotation: 0,
          locked: false,
          content: 'PRIORITY EXPRESS POST',
          fontSize: 12,
          fontFamily: 'Roboto',
          bold: true,
          italic: false,
          align: 'left',
        },
        {
          id: '10000000-0000-4000-8000-000000000002',
          type: 'line',
          x: 4,
          y: 11,
          width: 92,
          height: 1,
          rotation: 0,
          locked: false,
          stroke: '#000000',
          strokeWidth: 0.5,
          orientation: 'horizontal',
        },
        {
          id: '10000000-0000-4000-8000-000000000003',
          type: 'text',
          x: 4,
          y: 13,
          width: 92,
          height: 12,
          rotation: 0,
          locked: false,
          content: 'SHIP TO: ACME Logistics Corp\n100 Industrial Parkway, Dock 4\nChicago, IL 60601',
          fontSize: 8,
          fontFamily: 'Roboto',
          bold: false,
          italic: false,
          align: 'left',
        },
        {
          id: '10000000-0000-4000-8000-000000000004',
          type: 'barcode',
          x: 10,
          y: 27,
          width: 80,
          height: 18,
          rotation: 0,
          locked: false,
          symbology: 'code128',
          data: '1Z9999999999999999',
          narrowBarRatio: 2,
          displayValue: true,
        },
      ],
    },
  },
  {
    id: 'product-50x30',
    name: '50 × 30 mm Product Retail Label',
    category: 'product',
    description: 'Compact retail price tag with EAN-13 barcode and SKU details.',
    isBuiltIn: true,
    document: {
      version: '1.0.0',
      meta: {
        title: 'Product 50x30mm',
        author: 'OpenLabels Built-in',
        created: '2026-01-01T00:00:00.000Z',
      },
      dimensions: {
        width: 50,
        height: 30,
        unit: 'mm',
        dpi: 203,
      },
      elements: [
        {
          id: '20000000-0000-4000-8000-000000000001',
          type: 'text',
          x: 2,
          y: 2,
          width: 46,
          height: 4,
          rotation: 0,
          locked: false,
          content: 'PREMIUM COFFEE BEANS',
          fontSize: 8,
          fontFamily: 'Roboto',
          bold: true,
          italic: false,
          align: 'center',
        },
        {
          id: '20000000-0000-4000-8000-000000000002',
          type: 'text',
          x: 2,
          y: 7,
          width: 46,
          height: 3,
          rotation: 0,
          locked: false,
          content: 'SKU: COF-ROAST-250G',
          fontSize: 6,
          fontFamily: 'Roboto',
          bold: false,
          italic: false,
          align: 'center',
        },
        {
          id: '20000000-0000-4000-8000-000000000003',
          type: 'barcode',
          x: 5,
          y: 11,
          width: 40,
          height: 14,
          rotation: 0,
          locked: false,
          symbology: 'ean13',
          data: '5901234123457',
          narrowBarRatio: 2,
          displayValue: true,
        },
        {
          id: '20000000-0000-4000-8000-000000000004',
          type: 'text',
          x: 2,
          y: 26,
          width: 46,
          height: 3,
          rotation: 0,
          locked: false,
          content: '$12.99 / UNIT',
          fontSize: 7,
          fontFamily: 'Roboto',
          bold: true,
          italic: false,
          align: 'center',
        },
      ],
    },
  },
  {
    id: 'logistics-100x150',
    name: '100 × 150 mm Logistics / Pallet Label',
    category: 'logistics',
    description: '4x6" warehouse pallet identifier with QR dispatch link and SSCC-18 barcode.',
    isBuiltIn: true,
    document: {
      version: '1.0.0',
      meta: {
        title: 'Logistics 100x150mm',
        author: 'OpenLabels Built-in',
        created: '2026-01-01T00:00:00.000Z',
      },
      dimensions: {
        width: 100,
        height: 150,
        unit: 'mm',
        dpi: 203,
      },
      elements: [
        {
          id: '30000000-0000-4000-8000-000000000001',
          type: 'text',
          x: 5,
          y: 5,
          width: 90,
          height: 8,
          rotation: 0,
          locked: false,
          content: 'GLOBAL LOGISTICS HUB',
          fontSize: 14,
          fontFamily: 'Roboto',
          bold: true,
          italic: false,
          align: 'left',
        },
        {
          id: '30000000-0000-4000-8000-000000000002',
          type: 'text',
          x: 5,
          y: 15,
          width: 60,
          height: 15,
          rotation: 0,
          locked: false,
          content: 'DESTINATION: BERLIN-SOUTH HUB\nGATE: D-12 | BAY: 4\nCARRIER: DHL FREIGHT',
          fontSize: 8,
          fontFamily: 'Roboto',
          bold: false,
          italic: false,
          align: 'left',
        },
        {
          id: '30000000-0000-4000-8000-000000000003',
          type: 'qrcode',
          x: 70,
          y: 14,
          width: 25,
          height: 25,
          rotation: 0,
          locked: false,
          data: 'https://openlabels.dev/track/HUB-BER-9921',
          errorCorrection: 'M',
        },
        {
          id: '30000000-0000-4000-8000-000000000004',
          type: 'line',
          x: 5,
          y: 43,
          width: 90,
          height: 1,
          rotation: 0,
          locked: false,
          stroke: '#000000',
          strokeWidth: 1,
          orientation: 'horizontal',
        },
        {
          id: '30000000-0000-4000-8000-000000000005',
          type: 'text',
          x: 5,
          y: 47,
          width: 90,
          height: 5,
          rotation: 0,
          locked: false,
          content: 'SSCC (SERIAL SHIPPING CONTAINER CODE)',
          fontSize: 9,
          fontFamily: 'Roboto',
          bold: true,
          italic: false,
          align: 'center',
        },
        {
          id: '30000000-0000-4000-8000-000000000006',
          type: 'barcode',
          x: 8,
          y: 55,
          width: 84,
          height: 35,
          rotation: 0,
          locked: false,
          symbology: 'code128',
          data: '003012345678901234',
          narrowBarRatio: 2,
          displayValue: true,
        },
      ],
    },
  },
];

/**
 * Clones a template document into a fresh, unsaved document instance:
 * 1. Deep copies all properties.
 * 2. Regenerates element UUIDs to guarantee unique identity.
 * 3. Updates document title and resets timestamp.
 */
export function cloneTemplate(templateDoc: LabelDocument, newTitle?: string): LabelDocument {
  const cloned: LabelDocument = JSON.parse(JSON.stringify(templateDoc));

  cloned.meta = {
    ...cloned.meta,
    title: newTitle || `${cloned.meta.title || 'Template'} (New)`,
    created: new Date().toISOString(),
  };

  // Regenerate UUIDs for all elements to ensure unique instance identity
  cloned.elements = cloned.elements.map((el) => ({
    ...el,
    id: crypto.randomUUID(),
  }));

  return cloned;
}
