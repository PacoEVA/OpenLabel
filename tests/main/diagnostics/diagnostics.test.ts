import { describe, it, expect, vi } from 'vitest';
import { DiagnosticsService } from '../../../src/main/diagnostics/diagnostics.service';
import { DEFAULT_APP_SETTINGS } from '../../../src/core/settings';

// Mock electron app & dialog if needed
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/userData'),
  },
  dialog: {
    showSaveDialog: vi.fn(),
  },
}));

describe('Diagnostics Service (Fase 10 - Bloque 4)', () => {
  it('generates a complete, structured diagnostics bundle without exposing credentials', async () => {
    const service = new DiagnosticsService();
    const bundle = await service.generateBundle();

    expect(bundle).toBeDefined();
    expect(bundle.version).toBe('1.0.0');
    expect(bundle.generatedAt).toBeTypeOf('string');

    // System inspection
    expect(bundle.system).toBeDefined();
    expect(bundle.system.platform).toBeTypeOf('string');
    expect(bundle.system.arch).toBeTypeOf('string');
    expect(bundle.system.nodeVersion).toBeTypeOf('string');
    expect(bundle.system.totalMemoryMb).toBeGreaterThan(0);

    // Settings
    expect(bundle.settings).toBeDefined();
    expect(bundle.settings.settingsVersion).toBe(DEFAULT_APP_SETTINGS.settingsVersion);
    expect(bundle.settings.appearance.theme).toBeDefined();

    // Profiles
    expect(Array.isArray(bundle.printerProfiles)).toBe(true);

    // Recent logs
    expect(Array.isArray(bundle.recentLogs)).toBe(true);

    // Verify sanitization: Ensure no sensitive keys exist in bundle
    const rawJson = JSON.stringify(bundle);
    expect(rawJson).not.toContain('***REDACTED***PASSWORD');
    expect(rawJson).not.toContain('Bearer eyJ');
  });

  it('handles save dialog cancellation gracefully', async () => {
    const { dialog } = await import('electron');
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({
      canceled: true,
      filePath: '',
    });

    const service = new DiagnosticsService();
    const result = await service.exportBundleWithDialog();

    expect(result.success).toBe(false);
    expect(result.error).toContain('canceled');
  });
});
