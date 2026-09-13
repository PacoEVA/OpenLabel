import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { deserializeLabelFile } from '../../src/core/documents';
import { migrateAppSettings, CURRENT_SETTINGS_VERSION } from '../../src/core/settings';
import { runProductionPreflight } from '../../src/core/production';
import { DatasetSchema, Dataset } from '../../src/core/data-sources';
import type { LabelDocument } from '../../src/core/schemas/label.schema';
import type { PrinterProfile } from '../../src/core/printing';

describe('Phase 10 - Migration & Performance Smoke Tests (Bloque 13)', () => {
  const examplesDir = path.join(__dirname, '../../examples');

  describe('Document & Settings Migration Smoke Tests', () => {
    it('successfully loads and validates synthetic shipping-label.label example', () => {
      const filePath = path.join(examplesDir, 'shipping-label.label');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf8');

      const res = deserializeLabelFile(content);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.document.meta.title).toBe('Standard Logistics Shipping Label');
        expect(res.document.elements.length).toBe(5);
        expect(res.document.dimensions.dpi).toBe(203);
      }
    });

    it('successfully loads and validates synthetic product-badge.label example', () => {
      const filePath = path.join(examplesDir, 'product-badge.label');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf8');

      const res = deserializeLabelFile(content);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.document.meta.title).toBe('Retail Product Shelf Badge');
        expect(res.document.elements.length).toBe(3);
        expect(res.document.dimensions.dpi).toBe(300);
      }
    });

    it('migrates legacy unversioned settings gracefully to current schema', () => {
      const legacyRaw = {
        appearance: { theme: 'dark' },
        editor: { defaultUnit: 'inch', defaultDpi: 300, gridSizeMm: 5, snapEnabled: true },
        printing: { defaultCopies: 2 },
        autosave: { enabled: true, debounceMs: 2500 },
      };

      const res = migrateAppSettings(legacyRaw);
      expect(res.success).toBe(true);
      expect(res.settings?.settingsVersion).toBe(CURRENT_SETTINGS_VERSION);
      expect(res.settings?.appearance.theme).toBe('dark');
      expect(res.settings?.editor.defaultUnit).toBe('inch');
    });

    it('guarantees user documents and settings are preserved on uninstall', () => {
      const builderPath = path.join(__dirname, '../../electron-builder.json');
      const builderConfig = JSON.parse(fs.readFileSync(builderPath, 'utf8'));
      expect(builderConfig.nsis.deleteAppDataOnUninstall).toBe(false);
    });
  });

  describe('Performance Baselines', () => {
    const testDoc: LabelDocument = {
      version: '1.0.0',
      meta: {
        title: 'Performance Test Document',
        author: 'Tester',
        created: '2026-09-13T10:00:00.000Z',
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
          height: 10,
          rotation: 0,
          locked: false,
          content: 'SKU: {{sku}}',
          fontSize: 12,
          fontFamily: 'sans-serif',
          bold: false,
          italic: false,
          align: 'left',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          type: 'barcode',
          x: 10,
          y: 25,
          width: 80,
          height: 20,
          rotation: 0,
          locked: false,
          symbology: 'code128',
          data: '{{barcode}}',
          narrowBarRatio: 2,
          displayValue: true,
        },
      ],
    };

    const testProfile: PrinterProfile = {
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      name: 'Perf Test Zebra',
      enabled: true,
      language: 'zpl',
      dpi: 203,
      connection: {
        type: 'tcp',
        host: '192.168.1.100',
        port: 9100,
        timeoutMs: 5000,
      },
      createdAt: '2026-09-13T00:00:00.000Z',
      updatedAt: '2026-09-13T00:00:00.000Z',
    };

    it('validates 100-row dataset schema in under 50ms', () => {
      const rawRows = Array.from({ length: 100 }, (_, i) => ({
        sku: `PROD-${i}`,
        barcode: `BC-${1000 + i}`,
      }));

      const start = performance.now();
      const dataset: Dataset = {
        columns: [
          { key: 'sku', label: 'SKU', inferredType: 'string' },
          { key: 'barcode', label: 'Barcode', inferredType: 'string' },
        ],
        rows: rawRows,
        truncated: false,
        totalRows: 100,
      };
      const validated = DatasetSchema.parse(dataset);
      const duration = performance.now() - start;

      expect(validated.totalRows).toBe(100);
      expect(duration).toBeLessThan(50);
    });

    it('completes 1,000-row preflight check in under 250ms', () => {
      const records = Array.from({ length: 1000 }, (_, i) => ({
        index: i,
        values: {
          sku: `SKU-${i}`,
          barcode: `CODE128-${i}`,
        },
      }));

      const start = performance.now();
      const preflightResult = runProductionPreflight({
        document: testDoc,
        printerProfile: testProfile,
        records,
      });
      const duration = performance.now() - start;

      expect(preflightResult.success).toBe(true);
      expect(preflightResult.validItems).toBe(1000);
      expect(duration).toBeLessThan(250);
    });
  });
});
