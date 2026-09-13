import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

describe('Installer & Packaging Validation (Fase 10 - Bloques 5, 6, 7)', () => {
  const rootDir = path.join(__dirname, '../..');
  const releaseDir = path.join(rootDir, 'release');
  const builderConfigPath = path.join(rootDir, 'electron-builder.json');
  const packageJsonPath = path.join(rootDir, 'package.json');
  const unpackedExePath = path.join(releaseDir, 'win-unpacked', 'OpenLabels.exe');
  const setupExePath = path.join(releaseDir, 'OpenLabels Setup 0.1.0.exe');
  const checksumFilePath = path.join(releaseDir, 'SHA256SUMS.txt');

  it('verifies electron-builder.json configuration adheres to non-elevated, safe defaults', () => {
    expect(fs.existsSync(builderConfigPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(builderConfigPath, 'utf8'));

    expect(config.appId).toBe('com.openlabels.designer');
    expect(config.productName).toBe('OpenLabels');
    expect(config.nsis.oneClick).toBe(false);
    expect(config.nsis.perMachine).toBe(false); // Per-user install, no unnecessary admin elevation
    expect(config.nsis.deleteAppDataOnUninstall).toBe(false); // User data preserved on uninstall
    expect(config.nsis.allowToChangeInstallationDirectory).toBe(true);
  });

  it('validates package.json semver and single pipeline scripts', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    expect(pkg.version).toBe('0.1.0');
    expect(pkg.scripts.typecheck).toBe('tsc --noEmit');
    expect(pkg.scripts.test).toBe('vitest run');
    expect(pkg.scripts.build).toBeDefined();
    expect(pkg.scripts.package).toBe('electron-builder --dir');
    expect(pkg.scripts.dist).toBe('electron-builder');
  });

  it.skipIf(!fs.existsSync(unpackedExePath))('confirms the Windows x64 unpacked application binary exists', () => {
    const stats = fs.statSync(unpackedExePath);
    expect(stats.size).toBeGreaterThan(1024 * 1024); // Greater than 1MB
  });

  it.skipIf(!fs.existsSync(setupExePath) || !fs.existsSync(checksumFilePath))('confirms the NSIS installer executable and SHA-256 checksums exist and match', () => {
    const stats = fs.statSync(setupExePath);
    expect(stats.size).toBeGreaterThan(10 * 1024 * 1024); // Greater than 10MB

    const checksumContent = fs.readFileSync(checksumFilePath, 'utf8');
    const exeData = fs.readFileSync(setupExePath);
    const expectedHash = crypto.createHash('sha256').update(exeData).digest('hex');

    expect(checksumContent).toContain(expectedHash);
  });
});
