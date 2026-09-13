import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compareSemver, UpdateCheckerService } from '../../../src/main/updates/update-checker';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

// Mock electron
vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn().mockReturnValue('0.1.0'),
    getPath: vi.fn().mockReturnValue('/mock/userData'),
  },
}));

describe('Update Architecture & SemVer Logic (Fase 10 - Bloque 10)', () => {
  describe('compareSemver', () => {
    it('correctly compares semantic versions', () => {
      expect(compareSemver('0.2.0', '0.1.0')).toBe(1);
      expect(compareSemver('0.1.1', '0.1.0')).toBe(1);
      expect(compareSemver('1.0.0', '0.9.9')).toBe(1);
      expect(compareSemver('0.1.0', '0.1.0')).toBe(0);
      expect(compareSemver('0.1.0', '0.2.0')).toBe(-1);
      expect(compareSemver('v0.2.0', '0.1.0')).toBe(1);
    });
  });

  describe('UpdateCheckerService', () => {
    let service: UpdateCheckerService;
    let tmpDir: string;

    beforeEach(() => {
      service = new UpdateCheckerService('0.1.0');
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openlabels-update-test-'));
    });

    it('initializes with expected current version', () => {
      expect(service.getCurrentVersion()).toBe('0.1.0');
    });

    it('verifies integrity of downloaded installer files using SHA-256', async () => {
      const dummyFilePath = path.join(tmpDir, 'test-installer.exe');
      const content = Buffer.from('mock installer binary payload for test');
      fs.writeFileSync(dummyFilePath, content);

      const realHash = crypto.createHash('sha256').update(content).digest('hex');

      const isValid = await service.verifyInstallerIntegrity(dummyFilePath, realHash);
      expect(isValid).toBe(true);

      const isInvalid = await service.verifyInstallerIntegrity(dummyFilePath, 'wronghash123456');
      expect(isInvalid).toBe(false);
    });

    it('returns false when verifying non-existent installer file', async () => {
      const missing = path.join(tmpDir, 'missing.exe');
      const isValid = await service.verifyInstallerIntegrity(missing, 'anyhash');
      expect(isValid).toBe(false);
    });
  });
});
