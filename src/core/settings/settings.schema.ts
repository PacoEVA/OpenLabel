import { z } from 'zod';

/**
 * Current schema version for AppSettings.
 * Independent of LabelDocument.version and LabelFile.formatVersion.
 */
export const CURRENT_SETTINGS_VERSION = 1;

/**
 * Zod schema for AppSettings enforcing valid application preferences.
 */
export const AppSettingsSchema = z.object({
  settingsVersion: z.number().int().min(1, { message: 'settingsVersion must be an integer >= 1' }),

  appearance: z.object({
    theme: z.enum(['system', 'light', 'dark'], {
      errorMap: () => ({ message: "theme must be 'system', 'light', or 'dark'" }),
    }).default('system'),
  }),

  editor: z.object({
    defaultUnit: z.enum(['mm', 'inch'], {
      errorMap: () => ({ message: "defaultUnit must be 'mm' or 'inch'" }),
    }).default('mm'),
    defaultDpi: z.union([z.literal(203), z.literal(300), z.literal(600)], {
      errorMap: () => ({ message: 'defaultDpi must be 203, 300, or 600' }),
    }).default(203),
    gridSizeMm: z
      .number()
      .min(0.5, { message: 'gridSizeMm must be at least 0.5 mm' })
      .max(50, { message: 'gridSizeMm cannot exceed 50 mm' })
      .default(5),
    snapEnabled: z.boolean().default(true),
  }),

  printing: z.object({
    defaultPrinterProfileId: z
      .string()
      .uuid({ message: 'defaultPrinterProfileId must be a valid UUID' })
      .optional(),
    defaultCopies: z
      .number()
      .int({ message: 'defaultCopies must be an integer' })
      .min(1, { message: 'defaultCopies must be >= 1' })
      .max(999, { message: 'defaultCopies cannot exceed 999' })
      .default(1),
  }),

  autosave: z.object({
    enabled: z.boolean().default(true),
    debounceMs: z
      .number()
      .int({ message: 'debounceMs must be an integer' })
      .min(500, { message: 'debounceMs must be at least 500ms' })
      .max(60000, { message: 'debounceMs cannot exceed 60000ms' })
      .default(3000),
  }),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

/**
 * Standard default settings loaded on first run or when resetting configuration.
 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  settingsVersion: CURRENT_SETTINGS_VERSION,
  appearance: {
    theme: 'system',
  },
  editor: {
    defaultUnit: 'mm',
    defaultDpi: 203,
    gridSizeMm: 5,
    snapEnabled: true,
  },
  printing: {
    defaultCopies: 1,
  },
  autosave: {
    enabled: true,
    debounceMs: 3000,
  },
};
