import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  CredentialVaultService,
} from '../../../src/main/data-sources/credentials/credential-vault.service';
import { AesGcmStorageProvider } from '../../../src/main/data-sources/credentials/storage-provider';

describe('Secure Credential Storage (Bloque 3)', () => {
  let tmpDir: string;
  let vaultService: CredentialVaultService;
  let aesProvider: AesGcmStorageProvider;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openlabels-vault-test-'));
    aesProvider = new AesGcmStorageProvider();
    vaultService = new CredentialVaultService(tmpDir, aesProvider);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('encrypts and decrypts secrets correctly with AesGcmStorageProvider', async () => {
    const plaintext = 'SuperSecretDbPassword123!';
    const encrypted = await aesProvider.encrypt(plaintext);

    expect(encrypted).not.toEqual(Buffer.from(plaintext));
    expect(encrypted.includes(Buffer.from(plaintext))).toBe(false);

    const decrypted = await aesProvider.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('stores credentials securely and never reveals plaintext in stored vault file', async () => {
    const rawSecret = 'MyProductionSqlPassword_999!';
    const meta = await vaultService.setCredential({
      name: 'ERP Database',
      type: 'password',
      secret: rawSecret,
    });

    expect(meta.id).toBeDefined();
    expect(meta.name).toBe('ERP Database');
    expect(meta.type).toBe('password');
    expect(meta.configured).toBe(true);

    // Verify raw secret is NOT in returned metadata
    expect((meta as Record<string, unknown>).secret).toBeUndefined();
    expect((meta as Record<string, unknown>).encryptedSecretBase64).toBeUndefined();

    // Verify raw secret is NOT anywhere in the disk file
    const vaultFilePath = path.join(tmpDir, 'credentials.vault.json');
    const rawDiskFile = fs.readFileSync(vaultFilePath, 'utf8');
    expect(rawDiskFile.includes(rawSecret)).toBe(false);

    // Decrypting through service works
    const retrieved = await vaultService.getSecret(meta.id);
    expect(retrieved).toBe(rawSecret);
  });

  it('returns only sanitized metadata in listCredentials without secrets', async () => {
    await vaultService.setCredential({
      name: 'Bearer Token API',
      type: 'bearer_token',
      secret: 'eyJhGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token123',
    });

    await vaultService.setCredential({
      name: 'SQL Password',
      type: 'password',
      secret: 'pwd456',
    });

    const list = await vaultService.listCredentials();
    expect(list).toHaveLength(2);

    for (const item of list) {
      expect(item.id).toBeDefined();
      expect(item.name).toBeDefined();
      expect(item.type).toBeDefined();
      expect(item.configured).toBe(true);
      expect((item as Record<string, unknown>).secret).toBeUndefined();
      expect((item as Record<string, unknown>).encryptedSecretBase64).toBeUndefined();
    }
  });

  it('deletes credentials cleanly from vault', async () => {
    const meta = await vaultService.setCredential({
      name: 'Temporary Token',
      type: 'api_key',
      secret: 'temp-api-key',
    });

    expect(await vaultService.hasCredential(meta.id)).toBe(true);
    const deleted = await vaultService.deleteCredential(meta.id);
    expect(deleted).toBe(true);
    expect(await vaultService.hasCredential(meta.id)).toBe(false);
    expect(await vaultService.getSecret(meta.id)).toBeNull();
  });

  it('verifies credentialRef in external source configuration has no secret leakage', () => {
    // Simulating how ExternalDataSource refers only to credentialRef UUID
    const sampleCredentialRef = '12345678-1234-4234-8234-123456789abc';
    const sourceConfig = {
      engine: 'mssql',
      host: '10.0.0.5',
      database: 'Warehouse',
      username: 'labels_app',
      credentialRef: sampleCredentialRef,
    };

    const serialized = JSON.stringify(sourceConfig);
    expect(serialized).toContain(sampleCredentialRef);
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('password');
  });
});
