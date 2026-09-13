import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  CredentialMetadata,
  SetCredentialPayload,
  CredentialMetadataSchema,
} from '../../../core/data-sources/credentials.schema';
import {
  SecureStorageProvider,
  ElectronSafeStorageProvider,
  AesGcmStorageProvider,
} from './storage-provider';

interface VaultStoredEntry {
  id: string;
  name: string;
  type: SetCredentialPayload['type'];
  encryptedSecretBase64: string;
  createdAt: string;
  updatedAt: string;
}

interface VaultFileStructure {
  version: number;
  entries: Record<string, VaultStoredEntry>;
}

export class CredentialVaultService {
  private readonly vaultFilePath: string;
  private readonly storageProvider: SecureStorageProvider;
  private cachedVault: VaultFileStructure | null = null;

  constructor(vaultDir: string, storageProvider?: SecureStorageProvider) {
    if (!fs.existsSync(vaultDir)) {
      fs.mkdirSync(vaultDir, { recursive: true });
    }
    this.vaultFilePath = path.join(vaultDir, 'credentials.vault.json');

    if (storageProvider) {
      this.storageProvider = storageProvider;
    } else {
      const electronProvider = new ElectronSafeStorageProvider();
      this.storageProvider = electronProvider.isAvailable()
        ? electronProvider
        : new AesGcmStorageProvider();
    }
  }

  private loadVault(): VaultFileStructure {
    if (this.cachedVault) {
      return this.cachedVault;
    }

    if (!fs.existsSync(this.vaultFilePath)) {
      this.cachedVault = { version: 1, entries: {} };
      return this.cachedVault;
    }

    try {
      const raw = fs.readFileSync(this.vaultFilePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.entries === 'object') {
        this.cachedVault = parsed as VaultFileStructure;
        return this.cachedVault;
      }
    } catch {
      // Corrupt or unreadable file fallback
    }

    this.cachedVault = { version: 1, entries: {} };
    return this.cachedVault;
  }

  private saveVault(vault: VaultFileStructure): void {
    const tmpPath = `${this.vaultFilePath}.tmp-${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(vault, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.vaultFilePath);
    this.cachedVault = vault;
  }

  /**
   * Returns sanitized metadata list of all configured credentials.
   * Safe to return to the renderer process.
   */
  async listCredentials(): Promise<CredentialMetadata[]> {
    const vault = this.loadVault();
    const result: CredentialMetadata[] = [];

    for (const entry of Object.values(vault.entries)) {
      const meta: CredentialMetadata = {
        id: entry.id,
        name: entry.name,
        type: entry.type,
        configured: true,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      };
      // Validate with schema to ensure no secrets or extra fields leaked
      result.push(CredentialMetadataSchema.parse(meta));
    }

    return result;
  }

  /**
   * Retrieves the decrypted secret.
   * MAIN PROCESS ONLY - NEVER expose this method to renderer IPC!
   */
  async getSecret(credentialId: string): Promise<string | null> {
    const vault = this.loadVault();
    const entry = vault.entries[credentialId];
    if (!entry) {
      return null;
    }

    const ciphertext = Buffer.from(entry.encryptedSecretBase64, 'base64');
    return this.storageProvider.decrypt(ciphertext);
  }

  /**
   * Encrypts and stores a new or updated credential.
   * Returns only safe metadata.
   */
  async setCredential(payload: SetCredentialPayload): Promise<CredentialMetadata> {
    const vault = this.loadVault();
    const id = payload.id ?? crypto.randomUUID();
    const now = new Date().toISOString();

    const existing = vault.entries[id];
    const encryptedBuf = await this.storageProvider.encrypt(payload.secret);

    const entry: VaultStoredEntry = {
      id,
      name: payload.name,
      type: payload.type,
      encryptedSecretBase64: encryptedBuf.toString('base64'),
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    vault.entries[id] = entry;
    this.saveVault(vault);

    const meta: CredentialMetadata = {
      id: entry.id,
      name: entry.name,
      type: entry.type,
      configured: true,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };

    return CredentialMetadataSchema.parse(meta);
  }

  /**
   * Deletes a credential from the secure vault.
   */
  async deleteCredential(credentialId: string): Promise<boolean> {
    const vault = this.loadVault();
    if (!vault.entries[credentialId]) {
      return false;
    }

    delete vault.entries[credentialId];
    this.saveVault(vault);
    return true;
  }

  /**
   * Checks if a credential ID exists without decrypting.
   */
  async hasCredential(credentialId: string): Promise<boolean> {
    const vault = this.loadVault();
    return Boolean(vault.entries[credentialId]);
  }
}
