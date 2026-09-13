import * as https from 'https';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { getLogger } from '../logging/logger';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  downloadUrl: string;
  sha256?: string;
}

export interface CheckUpdateResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion?: string;
  updateInfo?: UpdateInfo;
  error?: string;
}

/**
 * Hardcoded, immutable trusted release repository.
 * The renderer process CANNOT alter or tamper with this endpoint.
 */
const TRUSTED_RELEASE_URL = 'https://api.github.com/repos/PacoEVA/OpenLabels/releases/latest';

/**
 * Compares two semantic version strings (e.g. "0.2.0" > "0.1.0").
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, '').split('.').map(Number);
  const clean2 = v2.replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const num1 = clean1[i] || 0;
    const num2 = clean2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Secure Update Checker.
 * Verifies latest release from trusted source, requires user confirmation,
 * and validates SHA-256 checksums before installation.
 */
export class UpdateCheckerService {
  private readonly currentVersion: string;

  constructor(currentVersion = app.getVersion() || '0.1.0') {
    this.currentVersion = currentVersion;
  }

  public getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Checks GitHub Releases API for a newer version.
   */
  public async checkForUpdates(): Promise<CheckUpdateResult> {
    const logger = getLogger();
    logger.info('UpdateChecker', 'CHECK', 'Checking for software updates', {
      details: { currentVersion: this.currentVersion, url: TRUSTED_RELEASE_URL },
    });

    try {
      const releaseData = await this.fetchReleaseData(TRUSTED_RELEASE_URL);
      const remoteVersion = (releaseData.tag_name || '').replace(/^v/, '');

      if (!remoteVersion) {
        return {
          updateAvailable: false,
          currentVersion: this.currentVersion,
          error: 'Invalid release payload from server',
        };
      }

      const isNewer = compareSemver(remoteVersion, this.currentVersion) > 0;

      if (!isNewer) {
        return {
          updateAvailable: false,
          currentVersion: this.currentVersion,
          latestVersion: remoteVersion,
        };
      }

      // Find Windows setup artifact asset
      const assets = (releaseData.assets || []) as Array<{ name: string; browser_download_url: string; size: number }>;
      const setupAsset = assets.find((a) => a.name.endsWith('.exe'));

      return {
        updateAvailable: true,
        currentVersion: this.currentVersion,
        latestVersion: remoteVersion,
        updateInfo: {
          version: remoteVersion,
          releaseDate: releaseData.published_at || new Date().toISOString(),
          releaseNotes: releaseData.body || 'No release notes provided.',
          downloadUrl: setupAsset ? setupAsset.browser_download_url : releaseData.html_url,
        },
      };
    } catch (err) {
      logger.warn('UpdateChecker', 'CHECK_FAILED', 'Failed to check updates', {
        details: { error: (err as Error).message },
      });
      return {
        updateAvailable: false,
        currentVersion: this.currentVersion,
        error: (err as Error).message,
      };
    }
  }

  /**
   * Validates SHA-256 hash of a downloaded installer file against expected hash.
   */
  public async verifyInstallerIntegrity(filePath: string, expectedSha256: string): Promise<boolean> {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    const fileBuffer = await fs.promises.readFile(filePath);
    const calculated = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    return calculated.toLowerCase() === expectedSha256.trim().toLowerCase();
  }

  /**
   * Internal HTTPS fetcher with User-Agent header and timeout.
   */
  private fetchReleaseData(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': `OpenLabels-Desktop/${this.currentVersion}`,
          Accept: 'application/vnd.github.v3+json',
        },
        timeout: 10000,
      };

      const req = https.get(url, options, (res) => {
        if (res.statusCode === 404) {
          return reject(new Error('No releases found in repository.'));
        }
        if (res.statusCode && res.statusCode >= 400) {
          return reject(new Error(`Server returned HTTP status ${res.statusCode}`));
        }

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error('Failed to parse release response'));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Connection timed out while checking for updates'));
      });

      req.on('error', (err) => {
        reject(err);
      });
    });
  }
}
