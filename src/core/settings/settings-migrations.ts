import {
  AppSettings,
  AppSettingsSchema,
  CURRENT_SETTINGS_VERSION,
  DEFAULT_APP_SETTINGS,
} from './settings.schema';

export interface SettingsMigrationResult {
  success: boolean;
  settings?: AppSettings;
  error?: string;
  migrated?: boolean;
}

export type SettingsMigrationFn = (raw: Record<string, unknown>) => Record<string, unknown>;

export interface SettingsMigrationStep {
  fromVersion: number;
  toVersion: number;
  migrate: SettingsMigrationFn;
}

/**
 * Sequential migration registry for AppSettings.
 * Version steps are added sequentially (e.g. 0 -> 1, 1 -> 2, etc.).
 */
export const SETTINGS_MIGRATIONS: SettingsMigrationStep[] = [
  // Migration from unversioned / v0 raw settings to v1
  {
    fromVersion: 0,
    toVersion: 1,
    migrate: (raw) => {
      const appearance = (raw.appearance as Record<string, unknown>) || {};
      const editor = (raw.editor as Record<string, unknown>) || {};
      const printing = (raw.printing as Record<string, unknown>) || {};
      const autosave = (raw.autosave as Record<string, unknown>) || {};

      return {
        settingsVersion: 1,
        appearance: {
          theme: appearance.theme ?? DEFAULT_APP_SETTINGS.appearance.theme,
        },
        editor: {
          defaultUnit: editor.defaultUnit ?? DEFAULT_APP_SETTINGS.editor.defaultUnit,
          defaultDpi: editor.defaultDpi ?? DEFAULT_APP_SETTINGS.editor.defaultDpi,
          gridSizeMm: editor.gridSizeMm ?? DEFAULT_APP_SETTINGS.editor.gridSizeMm,
          snapEnabled: editor.snapEnabled ?? DEFAULT_APP_SETTINGS.editor.snapEnabled,
        },
        printing: {
          defaultPrinterProfileId: printing.defaultPrinterProfileId,
          defaultCopies: printing.defaultCopies ?? DEFAULT_APP_SETTINGS.printing.defaultCopies,
        },
        autosave: {
          enabled: autosave.enabled ?? DEFAULT_APP_SETTINGS.autosave.enabled,
          debounceMs: autosave.debounceMs ?? DEFAULT_APP_SETTINGS.autosave.debounceMs,
        },
      };
    },
  },
];

/**
 * Validates, migrates, and returns normalized AppSettings from untrusted data.
 * Pure TypeScript function with zero external or native dependencies.
 */
export function migrateAppSettings(raw: unknown): SettingsMigrationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      success: false,
      error: 'Invalid settings payload: expected an object',
    };
  }

  let data = { ...(raw as Record<string, unknown>) };
  let version = typeof data.settingsVersion === 'number' ? data.settingsVersion : 0;

  // Future unsupported version check
  if (version > CURRENT_SETTINGS_VERSION) {
    return {
      success: false,
      error: `Settings version ${version} is newer than supported version ${CURRENT_SETTINGS_VERSION}. Please update OpenLabels.`,
    };
  }

  let migrated = false;

  // Sequentially apply migrations if older version
  while (version < CURRENT_SETTINGS_VERSION) {
    const step = SETTINGS_MIGRATIONS.find((m) => m.fromVersion === version);
    if (!step) {
      return {
        success: false,
        error: `No migration path found for settings version ${version} to ${version + 1}`,
      };
    }

    try {
      data = step.migrate(data);
      version = step.toVersion;
      migrated = true;
    } catch (err) {
      return {
        success: false,
        error: `Settings migration from v${step.fromVersion} to v${step.toVersion} failed: ${(err as Error).message}`,
      };
    }
  }

  // Validate resulting payload against the current AppSettingsSchema
  const parseResult = AppSettingsSchema.safeParse(data);
  if (!parseResult.success) {
    const issues = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return {
      success: false,
      error: `Settings validation failed: ${issues}`,
    };
  }

  return {
    success: true,
    settings: parseResult.data,
    migrated,
  };
}
