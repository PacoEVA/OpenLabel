import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SettingsService } from '../../../src/main/settings/settings.service';
import { DEFAULT_APP_SETTINGS, CURRENT_SETTINGS_VERSION } from '../../../src/core/settings';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('SettingsService & Atomic Persistence (Fase 10 - Bloque 2)', () => {
  let tmpDir: string;
  let settingsFile: string;
  let service: SettingsService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openlabels-settings-test-'));
    settingsFile = path.join(tmpDir, 'settings.json');
    service = new SettingsService(settingsFile);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('returns default settings on first run when file does not exist', async () => {
    expect(fs.existsSync(settingsFile)).toBe(false);

    const settings = await service.getSettings();
    expect(settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(settings.settingsVersion).toBe(CURRENT_SETTINGS_VERSION);
  });

  it('saves settings atomically and reads them back intact', async () => {
    const updated = {
      ...DEFAULT_APP_SETTINGS,
      appearance: { theme: 'dark' as const },
      editor: {
        ...DEFAULT_APP_SETTINGS.editor,
        defaultDpi: 300 as const,
        defaultUnit: 'inch' as const,
      },
    };

    const saveRes = await service.saveSettings(updated);
    expect(saveRes.success).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);

    // Create a new instance pointing to same file to verify disk state
    const newService = new SettingsService(settingsFile);
    const loaded = await newService.getSettings();
    expect(loaded.appearance.theme).toBe('dark');
    expect(loaded.editor.defaultDpi).toBe(300);
    expect(loaded.editor.defaultUnit).toBe('inch');
  });

  it('automatically migrates legacy unversioned settings file and persists v1', async () => {
    const legacy = {
      appearance: { theme: 'light' },
      editor: { defaultDpi: 600 },
    };
    await fs.promises.writeFile(settingsFile, JSON.stringify(legacy), 'utf8');

    const loaded = await service.getSettings();
    expect(loaded.settingsVersion).toBe(CURRENT_SETTINGS_VERSION);
    expect(loaded.appearance.theme).toBe('light');
    expect(loaded.editor.defaultDpi).toBe(600);
    expect(loaded.editor.defaultUnit).toBe('mm'); // filled with default

    // Verify disk content was updated with v1 format
    const onDisk = JSON.parse(await fs.promises.readFile(settingsFile, 'utf8'));
    expect(onDisk.settingsVersion).toBe(CURRENT_SETTINGS_VERSION);
  });

  it('quarantines corrupt JSON file and falls back to default settings safely', async () => {
    await fs.promises.writeFile(settingsFile, '{ this is corrupted non-json content }}}', 'utf8');

    const loaded = await service.getSettings();
    expect(loaded).toEqual(DEFAULT_APP_SETTINGS);

    // Verify quarantine file was created
    const files = await fs.promises.readdir(tmpDir);
    const corruptFile = files.find((f) => f.includes('settings.json.corrupt'));
    expect(corruptFile).toBeDefined();
  });

  it('rejects invalid settings payloads with descriptive Zod errors', async () => {
    const invalid = {
      settingsVersion: 1,
      appearance: { theme: 'neon-purple' },
    };

    const res = await service.saveSettings(invalid);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Validation error');
  });

  it('resets settings to factory defaults atomically', async () => {
    // Write modified
    await service.saveSettings({
      ...DEFAULT_APP_SETTINGS,
      appearance: { theme: 'light' as const },
    });

    const reset = await service.resetDefaults();
    expect(reset.appearance.theme).toBe('system');

    const loaded = await service.getSettings();
    expect(loaded.appearance.theme).toBe('system');
  });
});
