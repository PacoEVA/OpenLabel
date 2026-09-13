import { describe, it, expect } from 'vitest';
import { PrinterProfileStore } from '../../../src/main/printing/printer-profile.store';

describe('PrinterProfileStore (Bloque 5)', () => {
  const validUuid1 = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
  const validUuid2 = 'b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e';

  it('stores and retrieves validated profiles', () => {
    const store = new PrinterProfileStore();

    const saved = store.save({
      id: validUuid1,
      name: 'Packaging Zebra',
      connection: { type: 'tcp', host: '192.168.1.150', port: 9100 },
      language: 'zpl',
      dpi: 300,
      enabled: true,
    });

    expect(saved.id).toBe(validUuid1);
    expect(saved.createdAt).toBeDefined();
    expect(saved.updatedAt).toBeDefined();

    const retrieved = store.get(validUuid1);
    expect(retrieved?.name).toBe('Packaging Zebra');
    expect(store.list()).toHaveLength(1);
  });

  it('rejects invalid profile structures with Zod error', () => {
    const store = new PrinterProfileStore();

    expect(() => {
      store.save({
        id: 'bad-uuid',
        name: 'Invalid',
        connection: { type: 'tcp', host: '192.168.1.100', port: 9100 },
        language: 'zpl',
      });
    }).toThrow();
  });

  it('updates existing profile and preserves createdAt', () => {
    const store = new PrinterProfileStore();

    const initial = store.save({
      id: validUuid2,
      name: 'Initial Name',
      connection: { type: 'system', printerName: 'HP Office' },
      language: 'pdf',
      enabled: true,
    });

    const createdAt = initial.createdAt;

    const updated = store.save({
      id: validUuid2,
      name: 'Updated Name',
      connection: { type: 'system', printerName: 'HP Office 2' },
      language: 'pdf',
      enabled: false,
    });

    expect(updated.name).toBe('Updated Name');
    expect(updated.createdAt).toBe(createdAt);
    expect(store.list()).toHaveLength(1);
  });

  it('deletes profiles by ID', () => {
    const store = new PrinterProfileStore();

    store.save({
      id: validUuid1,
      name: 'To Delete',
      connection: { type: 'system', printerName: 'Trash Printer' },
      language: 'pdf',
      enabled: true,
    });

    expect(store.get(validUuid1)).toBeDefined();
    const deleted = store.delete(validUuid1);
    expect(deleted).toBe(true);
    expect(store.get(validUuid1)).toBeUndefined();
    expect(store.delete(validUuid1)).toBe(false);
  });
});
