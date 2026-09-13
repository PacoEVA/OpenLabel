import { describe, it, expect } from 'vitest';
import { DEFAULT_APP_SETTINGS, AppSettings } from '../../src/core/settings';

describe('Settings UI State & Preferences (Fase 10 - Bloque 2)', () => {
  it('initializes with default settings structure', () => {
    const settings: AppSettings = { ...DEFAULT_APP_SETTINGS };
    expect(settings.appearance.theme).toBe('system');
    expect(settings.editor.defaultUnit).toBe('mm');
    expect(settings.editor.defaultDpi).toBe(203);
    expect(settings.editor.gridSizeMm).toBe(5);
    expect(settings.editor.snapEnabled).toBe(true);
    expect(settings.printing.defaultCopies).toBe(1);
    expect(settings.autosave.enabled).toBe(true);
    expect(settings.autosave.debounceMs).toBe(3000);
  });

  it('updates appearance theme state cleanly', () => {
    let settings: AppSettings = { ...DEFAULT_APP_SETTINGS };
    settings = {
      ...settings,
      appearance: { theme: 'dark' },
    };
    expect(settings.appearance.theme).toBe('dark');
  });

  it('updates editor settings while preserving defaults', () => {
    let settings: AppSettings = { ...DEFAULT_APP_SETTINGS };
    settings = {
      ...settings,
      editor: {
        ...settings.editor,
        defaultUnit: 'inch',
        defaultDpi: 300,
        gridSizeMm: 10,
        snapEnabled: false,
      },
    };
    expect(settings.editor.defaultUnit).toBe('inch');
    expect(settings.editor.defaultDpi).toBe(300);
    expect(settings.editor.gridSizeMm).toBe(10);
    expect(settings.editor.snapEnabled).toBe(false);
  });

  it('updates autosave debounce and state', () => {
    let settings: AppSettings = { ...DEFAULT_APP_SETTINGS };
    settings = {
      ...settings,
      autosave: {
        enabled: false,
        debounceMs: 5000,
      },
    };
    expect(settings.autosave.enabled).toBe(false);
    expect(settings.autosave.debounceMs).toBe(5000);
  });
});
