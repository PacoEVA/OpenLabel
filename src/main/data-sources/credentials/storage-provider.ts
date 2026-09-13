import crypto from 'node:crypto';

export interface SecureStorageProvider {
  encrypt(plaintext: string): Promise<Buffer>;
  decrypt(ciphertext: Buffer): Promise<string>;
  isAvailable(): boolean;
}

/**
 * Production SecureStorageProvider utilizing Electron's native OS keychain safeStorage.
 */
export class ElectronSafeStorageProvider implements SecureStorageProvider {
  isAvailable(): boolean {
    try {
      // Dynamic require or import to prevent bundling crashes in headless Node environments
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { safeStorage } = require('electron');
      return safeStorage ? safeStorage.isEncryptionAvailable() : false;
    } catch {
      return false;
    }
  }

  async encrypt(plaintext: string): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { safeStorage } = require('electron');
    if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
      throw new Error('Electron safeStorage is not available on this platform/environment');
    }
    return safeStorage.encryptString(plaintext);
  }

  async decrypt(ciphertext: Buffer): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { safeStorage } = require('electron');
    if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
      throw new Error('Electron safeStorage is not available on this platform/environment');
    }
    return safeStorage.decryptString(ciphertext);
  }
}

/**
 * Fallback & test SecureStorageProvider using AES-256-GCM.
 */
export class AesGcmStorageProvider implements SecureStorageProvider {
  private readonly key: Buffer;

  constructor(secretKeyHex?: string) {
    if (secretKeyHex) {
      this.key = Buffer.from(secretKeyHex, 'hex');
    } else {
      // Deterministic machine/test fallback key or random key
      this.key = crypto.createHash('sha256').update('OpenLabels-SecureVault-Key-Fallback').digest();
    }
  }

  isAvailable(): boolean {
    return true;
  }

  async encrypt(plaintext: string): Promise<Buffer> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Format: [12 bytes IV] [16 bytes AuthTag] [Ciphertext]
    return Buffer.concat([iv, tag, encrypted]);
  }

  async decrypt(ciphertext: Buffer): Promise<string> {
    if (ciphertext.length < 28) {
      throw new Error('Invalid ciphertext length in AesGcmStorageProvider');
    }
    const iv = ciphertext.subarray(0, 12);
    const tag = ciphertext.subarray(12, 28);
    const data = ciphertext.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
