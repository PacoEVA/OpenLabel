import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerDataSourceIpcHandlers } from '../../../src/main/ipc/datasource.ipc';
import { CredentialVaultService } from '../../../src/main/data-sources/credentials/credential-vault.service';
import { AesGcmStorageProvider } from '../../../src/main/data-sources/credentials/storage-provider';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const handlers: Record<string, Function> = {};
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: Function) => {
      handlers[channel] = handler;
    }),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
}));

describe('DataSource IPC Handlers (Bloque 11)', () => {
  let tmpDir: string;
  let vaultService: CredentialVaultService;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openlabels-ipc-test-'));
    vaultService = new CredentialVaultService(tmpDir, new AesGcmStorageProvider());
    registerDataSourceIpcHandlers(vaultService);
  });

  it('registers all required datasource channels', () => {
    expect(handlers['datasource:select-file']).toBeDefined();
    expect(handlers['datasource:test']).toBeDefined();
    expect(handlers['datasource:preview']).toBeDefined();
    expect(handlers['datasource:list-credentials']).toBeDefined();
    expect(handlers['datasource:set-credential']).toBeDefined();
    expect(handlers['datasource:delete-credential']).toBeDefined();
  });

  describe('datasource:select-file', () => {
    it('opens dialog with appropriate filters and returns selected path', async () => {
      const { dialog } = await import('electron');
      vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
        canceled: false,
        filePaths: ['/safe/path/data.csv'],
      });

      const res = await handlers['datasource:select-file']({}, 'csv');
      expect(res.canceled).toBe(false);
      expect(res.filePath).toBe('/safe/path/data.csv');
      expect(dialog.showOpenDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [{ name: 'CSV Files (*.csv)', extensions: ['csv', 'txt'] }],
        })
      );
    });
  });

  describe('datasource:test', () => {
    it('rejects invalid source configurations with descriptive error', async () => {
      const invalidSource = {
        id: 'bad-uuid',
        name: '',
        type: 'csv',
        config: {},
      };

      const res = await handlers['datasource:test']({}, invalidSource);
      expect(res.success).toBe(false);
      expect(res.message).toContain('Configuración inválida');
    });
  });

  describe('datasource:set-credential and list-credentials', () => {
    it('sets credential, encrypts it, and returns only sanitized metadata', async () => {
      const setRes = await handlers['datasource:set-credential']({}, {
        name: 'ERP Secret',
        type: 'password',
        secret: 'SuperSecretDbPassword123',
      });

      expect(setRes.success).toBe(true);
      expect(setRes.credential).toBeDefined();
      expect(setRes.credential.name).toBe('ERP Secret');
      expect(setRes.credential.configured).toBe(true);
      // Raw secret must NEVER be echoed back to renderer!
      expect(setRes.credential.secret).toBeUndefined();

      const list = await handlers['datasource:list-credentials']({});
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('ERP Secret');
      expect(list[0].secret).toBeUndefined();
    });

    it('rejects empty secret or invalid payload', async () => {
      const res = await handlers['datasource:set-credential']({}, {
        name: 'Empty Secret',
        type: 'password',
        secret: '',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Payload de credencial inválido');
    });
  });

  describe('datasource:delete-credential', () => {
    it('deletes credential by id', async () => {
      const setRes = await handlers['datasource:set-credential']({}, {
        name: 'To Delete',
        type: 'api_key',
        secret: 'key123',
      });

      const credId = setRes.credential.id;
      const delRes = await handlers['datasource:delete-credential']({}, credId);
      expect(delRes.success).toBe(true);

      const list = await handlers['datasource:list-credentials']({});
      expect(list).toHaveLength(0);
    });
  });
});
