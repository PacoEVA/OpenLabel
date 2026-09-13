import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  RecentFilesService,
  MAX_RECENT_FILES,
} from '../../../src/main/documents/recent-files.service';

describe('RecentFilesService (Bloque 7)', () => {
  let tempDir: string;
  let storageFile: string;
  let service: RecentFilesService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openlabels-recents-'));
    storageFile = path.join(tempDir, 'recent-files.json');
    service = new RecentFilesService(storageFile);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('starts with an empty recent files list', async () => {
    const list = await service.getRecentFiles();
    expect(list).toEqual([]);
  });

  it('adds recent files, bumps them to top, and deduplicates', async () => {
    // Create dummy files on disk so getRecentFiles won't prune them
    const file1 = path.join(tempDir, 'file1.label');
    const file2 = path.join(tempDir, 'file2.label');
    fs.writeFileSync(file1, '{}');
    fs.writeFileSync(file2, '{}');

    await service.addRecentFile(file1, 'Label 1');
    let list = await service.getRecentFiles();
    expect(list.length).toBe(1);
    expect(list[0].displayName).toBe('Label 1');

    await service.addRecentFile(file2, 'Label 2');
    list = await service.getRecentFiles();
    expect(list.length).toBe(2);
    expect(list[0].displayName).toBe('Label 2');
    expect(list[1].displayName).toBe('Label 1');

    // Re-add file1 -> bumps to top, no duplicate
    await service.addRecentFile(file1, 'Label 1 Reopened');
    list = await service.getRecentFiles();
    expect(list.length).toBe(2);
    expect(list[0].filePath).toBe(file1);
    expect(list[0].displayName).toBe('Label 1 Reopened');
    expect(list[1].filePath).toBe(file2);
  });

  it('enforces maximum limit of 10 items', async () => {
    for (let i = 1; i <= 15; i++) {
      const file = path.join(tempDir, `item-${i}.label`);
      fs.writeFileSync(file, '{}');
      await service.addRecentFile(file, `Item ${i}`);
    }

    const list = await service.getRecentFiles();
    expect(list.length).toBe(MAX_RECENT_FILES);
    expect(list[0].displayName).toBe('Item 15');
    expect(list[MAX_RECENT_FILES - 1].displayName).toBe('Item 6');
  });

  it('automatically prunes entries for files deleted from disk', async () => {
    const file1 = path.join(tempDir, 'stay.label');
    const file2 = path.join(tempDir, 'remove.label');
    fs.writeFileSync(file1, '{}');
    fs.writeFileSync(file2, '{}');

    await service.addRecentFile(file1, 'Stay');
    await service.addRecentFile(file2, 'Remove');

    expect((await service.getRecentFiles()).length).toBe(2);

    // Delete file2 from disk
    fs.unlinkSync(file2);

    const prunedList = await service.getRecentFiles();
    expect(prunedList.length).toBe(1);
    expect(prunedList[0].displayName).toBe('Stay');
  });

  it('clears all recent files', async () => {
    const file = path.join(tempDir, 'sample.label');
    fs.writeFileSync(file, '{}');
    await service.addRecentFile(file, 'Sample');

    expect((await service.getRecentFiles()).length).toBe(1);

    await service.clearRecentFiles();
    expect((await service.getRecentFiles()).length).toBe(0);
  });
});
