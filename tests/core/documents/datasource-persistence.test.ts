import { describe, it, expect } from 'vitest';
import { LabelDocument } from '../../../src/core/schemas/label.schema';
import { serializeLabelFile } from '../../../src/core/documents/serialize-label';
import { deserializeLabelFile } from '../../../src/core/documents/deserialize-label';

describe('Data Sources and Field Mappings Persistence in .label (Bloque 10)', () => {
  const sampleDocWithSources: LabelDocument = {
    version: '1.0.0',
    meta: {
      title: 'Persistent Data Sources Label',
      author: 'Tester',
      created: '2026-09-12T12:00:00.000Z',
    },
    dimensions: {
      width: 100,
      height: 50,
      unit: 'mm',
      dpi: 203,
    },
    elements: [],
    dataModel: {
      fields: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'sku',
          type: 'input',
          required: true,
        },
      ],
    },
    dataSources: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'ERP SQL Server',
        type: 'sql',
        enabled: true,
        config: {
          engine: 'mssql',
          host: '10.0.0.5',
          port: 1433,
          database: 'Inventory',
          username: 'label_app',
          credentialRef: '33333333-3333-4333-8333-333333333333',
          queryMode: 'table',
          tableName: 'Items',
          timeoutMs: 30000,
          encrypt: true,
          trustServerCertificate: false,
        },
      },
    ],
    fieldMappings: {
      '22222222-2222-4222-8222-222222222222': {
        rules: [
          {
            dataFieldId: '11111111-1111-4111-8111-111111111111',
            dataFieldName: 'sku',
            sourceColumnKey: 'item_sku',
            nullHandling: 'default',
          },
        ],
      },
    },
  };

  it('serializes and deserializes documents with dataSources and fieldMappings', () => {
    const saveRes = serializeLabelFile(sampleDocWithSources);
    expect(saveRes.success).toBe(true);
    if (!saveRes.success) return;

    const json = saveRes.json;
    expect(json).toContain('ERP SQL Server');
    expect(json).toContain('item_sku');
    expect(json).toContain('33333333-3333-4333-8333-333333333333'); // credentialRef UUID

    const loadRes = deserializeLabelFile(json);
    expect(loadRes.success).toBe(true);
    if (!loadRes.success) return;

    expect(loadRes.document.dataSources).toHaveLength(1);
    expect(loadRes.document.dataSources![0].name).toBe('ERP SQL Server');
    expect(loadRes.document.fieldMappings).toBeDefined();
    expect(
      loadRes.document.fieldMappings!['22222222-2222-4222-8222-222222222222'].rules
    ).toHaveLength(1);
  });

  it('strictly ensures secrets and temporary previews are NEVER in serialized .label JSON', () => {
    const maliciousDoc: any = {
      ...sampleDocWithSources,
      dataSources: [
        {
          ...sampleDocWithSources.dataSources![0],
          config: {
            ...sampleDocWithSources.dataSources![0].config,
            password: 'LEAKED_PASSWORD_123',
            secret: 'LEAKED_SECRET_456',
            token: 'LEAKED_TOKEN_789',
          },
          cachedDataset: { rows: [{ id: 1, secretData: 'PRIVATE' }] },
          previewRows: [{ id: 1 }],
        },
      ],
    };

    const saveRes = serializeLabelFile(maliciousDoc);
    expect(saveRes.success).toBe(true);
    if (!saveRes.success) return;

    const json = saveRes.json;
    expect(json).not.toContain('LEAKED_PASSWORD_123');
    expect(json).not.toContain('LEAKED_SECRET_456');
    expect(json).not.toContain('LEAKED_TOKEN_789');
    expect(json).not.toContain('cachedDataset');
    expect(json).not.toContain('previewRows');
  });

  it('preserves backward compatibility with legacy documents lacking dataSources', () => {
    const legacyDocJson = JSON.stringify({
      format: 'open-label',
      formatVersion: 1,
      document: {
        version: '1.0.0',
        meta: {
          title: 'Legacy Label',
          author: 'Old Version',
          created: '2025-01-01T00:00:00.000Z',
        },
        dimensions: {
          width: 50,
          height: 30,
          unit: 'mm',
          dpi: 203,
        },
        elements: [],
      },
    });

    const loadRes = deserializeLabelFile(legacyDocJson);
    expect(loadRes.success).toBe(true);
    if (!loadRes.success) return;

    expect(loadRes.document.meta.title).toBe('Legacy Label');
    expect(loadRes.document.dataSources).toBeUndefined();
    expect(loadRes.document.fieldMappings).toBeUndefined();
  });
});
