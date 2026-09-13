import { describe, it, expect } from 'vitest';
import {
  AppSettingsSchema,
  DEFAULT_APP_SETTINGS,
  CURRENT_SETTINGS_VERSION,
  migrateAppSettings,
} from '../../../src/core/settings';

describe('AppSettings and Settings Migration (Fase 10 - Bloque 1)', () => {
  describe('Default AppSettings', () => {
    it('provides valid default settings complying with AppSettingsSchema', () => {
      const parsed = AppSettingsSchema.safeParse(DEFAULT_APP_SETTINGS);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.settingsVersion).toBe(CURRENT_SETTINGS_VERSION);
        expect(parsed.data.appearance.theme).toBe('system');
        expect(parsed.data.editor.defaultUnit).toBe('mm');
        expect(parsed.data.editor.defaultDpi).toBe(203);
        expect(parsed.data.editor.gridSizeMm).toBe(5);
        expect(parsed.data.editor.snapEnabled).toBe(true);
        expect(parsed.data.printing.defaultCopies).toBe(1);
        expect(parsed.data.autosave.enabled).toBe(true);
        expect(parsed.data.autosave.debounceMs).toBe(3000);
      }
    });
  });

  describe('Validation of Invalid Values', () => {
    it('rejects invalid theme', () => {
      const invalid = {
        ...DEFAULT_APP_SETTINGS,
        appearance: { theme: 'solarized-pink' },
      };
      const result = AppSettingsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid DPI', () => {
      const invalid = {
        ...DEFAULT_APP_SETTINGS,
        editor: { ...DEFAULT_APP_SETTINGS.editor, defaultDpi: 1200 },
      };
      const result = AppSettingsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid unit', () => {
      const invalid = {
        ...DEFAULT_APP_SETTINGS,
        editor: { ...DEFAULT_APP_SETTINGS.editor, defaultUnit: 'cm' },
      };
      const result = AppSettingsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid grid size (< 0.5 or > 50 mm)', () => {
      const tooSmall = {
        ...DEFAULT_APP_SETTINGS,
        editor: { ...DEFAULT_APP_SETTINGS.editor, gridSizeMm: 0.1 },
      };
      expect(AppSettingsSchema.safeParse(tooSmall).success).toBe(false);

      const tooLarge = {
        ...DEFAULT_APP_SETTINGS,
        editor: { ...DEFAULT_APP_SETTINGS.editor, gridSizeMm: 100 },
      };
      expect(AppSettingsSchema.safeParse(tooLarge).success).toBe(false);
    });

    it('rejects invalid copies (< 1 or > 999 or non-integer)', () => {
      const zeroCopies = {
        ...DEFAULT_APP_SETTINGS,
        printing: { defaultCopies: 0 },
      };
      expect(AppSettingsSchema.safeParse(zeroCopies).success).toBe(false);

      const floatCopies = {
        ...DEFAULT_APP_SETTINGS,
        printing: { defaultCopies: 2.5 },
      };
      expect(AppSettingsSchema.safeParse(floatCopies).success).toBe(false);

      const hugeCopies = {
        ...DEFAULT_APP_SETTINGS,
        printing: { defaultCopies: 5000 },
      };
      expect(AppSettingsSchema.safeParse(hugeCopies).success).toBe(false);
    });

    it('rejects invalid autosave debounce (< 500ms or > 60000ms)', () => {
      const tooFast = {
        ...DEFAULT_APP_SETTINGS,
        autosave: { enabled: true, debounceMs: 100 },
      };
      expect(AppSettingsSchema.safeParse(tooFast).success).toBe(false);

      const tooSlow = {
        ...DEFAULT_APP_SETTINGS,
        autosave: { enabled: true, debounceMs: 120000 },
      };
      expect(AppSettingsSchema.safeParse(tooSlow).success).toBe(false);
    });
  });

  describe('Settings Version and Migrations', () => {
    it('accepts current version directly without migration', () => {
      const res = migrateAppSettings(DEFAULT_APP_SETTINGS);
      expect(res.success).toBe(true);
      expect(res.migrated).toBe(false);
      expect(res.settings?.settingsVersion).toBe(CURRENT_SETTINGS_VERSION);
    });

    it('migrates old unversioned/v0 settings to current version with defaults', () => {
      const legacy = {
        appearance: { theme: 'dark' },
        editor: { defaultDpi: 300 },
        // other fields missing
      };

      const res = migrateAppSettings(legacy);
      expect(res.success).toBe(true);
      expect(res.migrated).toBe(true);
      expect(res.settings?.settingsVersion).toBe(CURRENT_SETTINGS_VERSION);
      expect(res.settings?.appearance.theme).toBe('dark');
      expect(res.settings?.editor.defaultDpi).toBe(300);
      expect(res.settings?.editor.defaultUnit).toBe('mm');
      expect(res.settings?.autosave.debounceMs).toBe(3000);
    });

    it('rejects future unsupported version', () => {
      const future = {
        settingsVersion: 99,
        appearance: { theme: 'dark' },
      };

      const res = migrateAppSettings(future);
      expect(res.success).toBe(false);
      expect(res.error).toContain('is newer than supported version');
    });

    it('rejects non-object raw payloads gracefully', () => {
      expect(migrateAppSettings(null).success).toBe(false);
      expect(migrateAppSettings('invalid-json-string').success).toBe(false);
      expect(migrateAppSettings([1, 2, 3]).success).toBe(false);
    });

    it('fails migration if migrated result violates schema constraints', () => {
      const brokenLegacy = {
        settingsVersion: 0,
        editor: { defaultUnit: 'kilometers' }, // invalid unit
      };

      const res = migrateAppSettings(brokenLegacy);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Settings validation failed');
    });
  });
});
