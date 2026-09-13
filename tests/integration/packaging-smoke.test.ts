import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

describe('Installer & Packaging Validation (Fase 10 - Bloques 5, 6, 7)', () => {
  const rootDir = path.join(__dirname, '../..');
  const releaseDir = path.join(rootDir, 'release');
  const builderConfigPath = path.join(rootDir, 'electron-builder.json');
  const packageJsonPath = path.join(rootDir, 'package.json');

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

  it('confirms the Windows x64 unpacked application binary exists', () => {
    const unpackedExe = path.join(releaseDir, 'win-unpacked', 'OpenLabels.exe');
    expect(fs.existsSync(unpackedExe)).toBe(true);
    const stats = fs.statSync(unpackedExe);
    expect(stats.size).toBeGreaterThan(1024 * 1024); // Greater than 1MB
  });

  it('confirms the NSIS installer executable and SHA-256 checksums exist and match', () => {
    const setupExe = path.join(releaseDir, 'OpenLabels Setup 0.1.0.exe');
    expect(fs.existsSync(setupExe)).toBe(true);
    const stats = fs.statSync(setupExe);
    expect(stats.size).toBeGreaterThan(10 * 1024 * 1024); // Greater than 10MB

    const checksumFile = path.join(releaseDir, 'SHA256SUMS.txt');
    expect(fs.existsSync(checksumFile)).toBe(true);

    const checksumContent = fs.readFileSync(checksumFile, 'utf8');
    const exeData = fs.readFileSync(setupExe);
    const expectedHash = crypto.createHash('sha256').update(exeData).digest('hex');

    expect(checksumContent).toContain(expectedHash);
  });
});
