import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AutosaveService } from '../../../src/main/documents/autosave.service';
import type { LabelDocument } from '../../../src/core/schemas/label.schema';
import type { RecoverySnapshot } from '../../../src/core/documents/recovery-snapshot.schema';

describe('AutosaveService (Bloque 8 & 9)', () => {
  let tempDir: string;
  let service: AutosaveService;

  const validDoc: LabelDocument = {
    version: '1.0.0',
    meta: {
      title: 'Crash Recovery Label',
      author: 'Tester',
      created: '2026-09-12T10:00:00.000Z',
    },
    dimensions: {
      width: 100,
      height: 50,
      unit: 'mm',
      dpi: 203,
    },
    elements: [],
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openlabels-autosave-'));
    service = new AutosaveService(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('starts with empty recovery list', async () => {
    const items = await service.getRecoveryItems();
    expect(items).toEqual([]);
  });

  it('saves and retrieves valid recovery snapshot', async () => {
    const snapshot: RecoverySnapshot = {
      recoveryVersion: 1,
      documentId: 'doc-uuid-123',
      sourcePath: '/path/shipping.label',
      savedAt: new Date().toISOString(),
      document: validDoc,
    };

    const res = await service.saveSnapshot(snapshot);
    expect(res.success).toBe(true);
    expect(res.snapshot?.documentId).toBe('doc-uuid-123');

    const items = await service.getRecoveryItems();
    expect(items.length).toBe(1);
    expect(items[0].documentId).toBe('doc-uuid-123');
    expect(items[0].sourcePath).toBe('/path/shipping.label');
    expect(items[0].document.meta.title).toBe('Crash Recovery Label');
  });

  it('rejects invalid snapshot', async () => {
    const badSnapshot = {
      recoveryVersion: 1,
      documentId: 'doc-uuid-bad',
      // missing savedAt and invalid document
      document: { invalid: true },
    };

    const res = await service.saveSnapshot(badSnapshot);
    expect(res.success).toBe(false);
    expect(res.errors).toBeDefined();

    const items = await service.getRecoveryItems();
    expect(items.length).toBe(0);
  });

  it('sorts multiple snapshots newest first', async () => {
    const older: RecoverySnapshot = {
      recoveryVersion: 1,
      documentId: 'doc-1',
      sourcePath: null,
      savedAt: '2026-09-12T08:00:00.000Z',
      document: validDoc,
    };

    const newer: RecoverySnapshot = {
      recoveryVersion: 1,
      documentId: 'doc-2',
      sourcePath: null,
      savedAt: '2026-09-12T12:00:00.000Z',
      document: validDoc,
    };

    await service.saveSnapshot(older);
    await service.saveSnapshot(newer);

    const items = await service.getRecoveryItems();
    expect(items.length).toBe(2);
    expect(items[0].documentId).toBe('doc-2');
    expect(items[1].documentId).toBe('doc-1');
  });

  it('removes recovery snapshot by documentId', async () => {
    const snapshot: RecoverySnapshot = {
      recoveryVersion: 1,
      documentId: 'doc-to-remove',
      sourcePath: null,
      savedAt: new Date().toISOString(),
      document: validDoc,
    };

    await service.saveSnapshot(snapshot);
    expect((await service.getRecoveryItems()).length).toBe(1);

    const removed = await service.removeSnapshot('doc-to-remove');
    expect(removed).toBe(true);
    expect((await service.getRecoveryItems()).length).toBe(0);
  });

  it('cleans up corrupted files when querying recovery items', async () => {
    const corruptFile = path.join(tempDir, 'corrupt.recovery.json');
    fs.writeFileSync(corruptFile, 'MALFORMED CONTENT');

    const items = await service.getRecoveryItems();
    expect(items.length).toBe(0);
    // File was pruned
    expect(fs.existsSync(corruptFile)).toBe(false);
  });
});
