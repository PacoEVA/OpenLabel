import React, { useState, useEffect } from 'react';
import type { AppSettings } from '../../../core/settings';
import { DEFAULT_APP_SETTINGS } from '../../../core/settings';
import type { PrinterProfile } from '../../../core/printing';
import {
  Settings as SettingsIcon,
  Palette,
  Layout,
  Printer,
  Database,
  Sliders,
  Info,
  X,
  RotateCcw,
  Check,
  AlertCircle,
  ShieldCheck,
  FileText,
} from 'lucide-react';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: (newSettings: AppSettings) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
}) => {
  const [activeTab, setActiveTab] = useState<
    'general' | 'appearance' | 'editor' | 'printing' | 'data' | 'advanced' | 'about'
  >('general');

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [profiles, setProfiles] = useState<PrinterProfile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingDiagnostics, setIsExportingDiagnostics] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const handleExportDiagnostics = async () => {
    if (!window.diagnosticsAPI) {
      setFeedback({ success: false, message: 'Diagnostics API is not available.' });
      return;
    }
    try {
      setIsExportingDiagnostics(true);
      const res = await window.diagnosticsAPI.exportDiagnosticsBundle();
      if (res.success) {
        setFeedback({ success: true, message: `Diagnostics exported successfully.` });
      } else if (res.error && !res.error.includes('canceled')) {
        setFeedback({ success: false, message: res.error });
      }
    } catch (err) {
      setFeedback({ success: false, message: (err as Error).message });
    } finally {
      setIsExportingDiagnostics(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Load current settings via IPC
      if (window.settingsAPI) {
        window.settingsAPI.getSettings().then((loaded) => {
          setSettings(loaded);
        });
      }

      // Load printer profiles for printing tab
      if (window.printAPI) {
        window.printAPI.listProfiles().then((list) => {
          setProfiles(list);
        });
      }

      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);

    try {
      if (window.settingsAPI) {
        const res = await window.settingsAPI.saveSettings(settings);
        if (res.success && res.settings) {
          setSettings(res.settings);
          setFeedback({ success: true, message: 'Settings saved successfully.' });
          if (onSettingsSaved) {
            onSettingsSaved(res.settings);
          }
        } else {
          setFeedback({ success: false, message: res.error || 'Failed to save settings.' });
        }
      } else {
        setFeedback({ success: true, message: 'Settings updated (local session).' });
      }
    } catch (err) {
      setFeedback({ success: false, message: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    setIsSaving(true);
    setFeedback(null);

    try {
      if (window.settingsAPI) {
        const res = await window.settingsAPI.resetDefaults();
        if (res.success && res.settings) {
          setSettings(res.settings);
          setFeedback({ success: true, message: 'Settings reset to factory defaults.' });
          if (onSettingsSaved) {
            onSettingsSaved(res.settings);
          }
        } else {
          setFeedback({ success: false, message: res.error || 'Failed to reset settings.' });
        }
      } else {
        setSettings(DEFAULT_APP_SETTINGS);
        setFeedback({ success: true, message: 'Defaults restored.' });
      }
    } catch (err) {
      setFeedback({ success: false, message: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl max-w-3xl w-full h-[650px] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <header className="px-5 py-3.5 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Application Preferences</h2>
              <p className="text-2xs text-zinc-400">Global environment configuration and editor defaults</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Modal Body: Left Tabs Sidebar + Right Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Navigation */}
          <aside className="w-48 bg-zinc-950/50 border-r border-zinc-800/80 p-2 space-y-1 text-xs select-none">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'general' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>General</span>
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'appearance' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Appearance</span>
            </button>
            <button
              onClick={() => setActiveTab('editor')}
              className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'editor' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Layout className="w-4 h-4" />
              <span>Editor</span>
            </button>
            <button
              onClick={() => setActiveTab('printing')}
              className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'printing' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Printing</span>
            </button>
            <button
              onClick={() => setActiveTab('data')}
              className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'data' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Data & Recovery</span>
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'advanced' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Advanced</span>
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'about' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>About</span>
            </button>
          </aside>

          {/* Right Content */}
          <main className="flex-1 p-6 overflow-y-auto space-y-5 text-xs text-zinc-300">
            {/* Feedback Alert */}
            {feedback && (
              <div
                className={`p-3 rounded-lg border flex items-center space-x-2 ${
                  feedback.success
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                    : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                }`}
              >
                {feedback.success ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{feedback.message}</span>
              </div>
            )}

            {/* TAB: GENERAL */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">General Environment</h3>
                <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-zinc-200 block">Application Language</span>
                      <span className="text-2xs text-zinc-500">Default interface locale</span>
                    </div>
                    <select
                      disabled
                      className="bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded border border-zinc-700 opacity-60 cursor-not-allowed"
                    >
                      <option value="en">English (US)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: APPEARANCE */}
            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">Theme & Appearance</h3>
                <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-lg space-y-3">
                  <div>
                    <label className="font-semibold text-zinc-200 block mb-1">Color Theme</label>
                    <p className="text-2xs text-zinc-400 mb-2">Select visual palette for workspace and panels</p>
                    <div className="grid grid-cols-3 gap-3">
                      {(['system', 'dark', 'light'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSettings({ ...settings, appearance: { theme: t } })}
                          className={`p-3 rounded-lg border text-center font-medium capitalize transition-all ${
                            settings.appearance.theme === t
                              ? 'bg-blue-600/30 text-blue-300 border-blue-500 ring-1 ring-blue-500'
                              : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: EDITOR */}
            {activeTab === 'editor' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">Editor & Canvas Defaults</h3>
                <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-lg space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-semibold text-zinc-200 block mb-1">Default Measurement Unit</label>
                      <select
                        value={settings.editor.defaultUnit}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            editor: { ...settings.editor, defaultUnit: e.target.value as 'mm' | 'inch' },
                          })
                        }
                        className="w-full bg-zinc-800 text-zinc-200 px-3 py-2 rounded border border-zinc-700 focus:outline-none focus:border-blue-500"
                      >
                        <option value="mm">Millimeters (mm)</option>
                        <option value="inch">Inches (in)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-zinc-200 block mb-1">Default DPI Resolution</label>
                      <select
                        value={settings.editor.defaultDpi}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            editor: { ...settings.editor, defaultDpi: Number(e.target.value) as 203 | 300 | 600 },
                          })
                        }
                        className="w-full bg-zinc-800 text-zinc-200 px-3 py-2 rounded border border-zinc-700 focus:outline-none focus:border-blue-500"
                      >
                        <option value={203}>203 DPI (Standard Thermal)</option>
                        <option value={300}>300 DPI (High Resolution)</option>
                        <option value={600}>600 DPI (Ultra Precision)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-800">
                    <div>
                      <label className="font-semibold text-zinc-200 block mb-1">Grid Size (mm)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="50"
                        value={settings.editor.gridSizeMm}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            editor: { ...settings.editor, gridSizeMm: parseFloat(e.target.value) || 5 },
                          })
                        }
                        className="w-full bg-zinc-800 text-zinc-200 px-3 py-2 rounded border border-zinc-700"
                      />
                    </div>

                    <div className="flex items-center space-x-2 pt-6">
                      <input
                        type="checkbox"
                        id="snapEnabled"
                        checked={settings.editor.snapEnabled}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            editor: { ...settings.editor, snapEnabled: e.target.checked },
                          })
                        }
                        className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0"
                      />
                      <label htmlFor="snapEnabled" className="font-semibold text-zinc-300 cursor-pointer select-none">
                        Enable magnetic snapping by default
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PRINTING */}
            {activeTab === 'printing' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">Hardware & Printing</h3>
                <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-lg space-y-4">
                  <div>
                    <label className="font-semibold text-zinc-200 block mb-1">Default Printer Profile</label>
                    <select
                      value={settings.printing.defaultPrinterProfileId || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          printing: {
                            ...settings.printing,
                            defaultPrinterProfileId: e.target.value || undefined,
                          },
                        })
                      }
                      className="w-full bg-zinc-800 text-zinc-200 px-3 py-2 rounded border border-zinc-700 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">(No default - prompt on print)</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.dpi} DPI • {p.language.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-zinc-200 block mb-1">Default Copies</label>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={settings.printing.defaultCopies}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          printing: {
                            ...settings.printing,
                            defaultCopies: Math.max(1, parseInt(e.target.value, 10) || 1),
                          },
                        })
                      }
                      className="w-full bg-zinc-800 text-zinc-200 px-3 py-2 rounded border border-zinc-700"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: DATA & RECOVERY */}
            {activeTab === 'data' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">Autosave & Session Recovery</h3>
                <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-lg space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="autosaveEnabled"
                      checked={settings.autosave.enabled}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          autosave: { ...settings.autosave, enabled: e.target.checked },
                        })
                      }
                      className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0"
                    />
                    <label htmlFor="autosaveEnabled" className="font-semibold text-zinc-200 cursor-pointer select-none">
                      Enable periodic snapshot autosave
                    </label>
                  </div>

                  <div>
                    <label className="font-semibold text-zinc-200 block mb-1">Autosave Debounce Interval (ms)</label>
                    <input
                      type="number"
                      min="500"
                      max="60000"
                      step="500"
                      value={settings.autosave.debounceMs}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          autosave: {
                            ...settings.autosave,
                            debounceMs: parseInt(e.target.value, 10) || 3000,
                          },
                        })
                      }
                      className="w-full bg-zinc-800 text-zinc-200 px-3 py-2 rounded border border-zinc-700"
                    />
                    <p className="text-2xs text-zinc-500 mt-1">Recommended: 3000 ms (3 seconds)</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: ADVANCED */}
            {activeTab === 'advanced' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">Advanced Settings & Reset</h3>
                <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-lg space-y-4">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Settings Schema Version:</span>
                    <span className="font-mono text-zinc-200 bg-zinc-800 px-2 py-0.5 rounded">v{settings.settingsVersion}</span>
                  </div>

                  <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-zinc-200 block">Diagnostics & Logs</span>
                      <span className="text-2xs text-zinc-500">Export a sanitized system and application diagnostics bundle</span>
                    </div>
                    <button
                      onClick={handleExportDiagnostics}
                      disabled={isExportingDiagnostics}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded font-medium transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{isExportingDiagnostics ? 'Exporting...' : 'Export Diagnostics'}</span>
                    </button>
                  </div>

                  <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-rose-300 block">Factory Reset</span>
                      <span className="text-2xs text-zinc-500">Restore all preferences to clean defaults</span>
                    </div>
                    <button
                      onClick={handleResetDefaults}
                      disabled={isSaving}
                      className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800 rounded font-medium transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5 inline mr-1.5" />
                      Reset Defaults
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: ABOUT */}
            {activeTab === 'about' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">About OpenLabels Designer</h3>
                <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-lg space-y-3 font-sans">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                      <ShieldCheck className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white">OpenLabels</h4>
                      <p className="text-2xs text-zinc-400">Open-source Industrial & Commercial Label Design Platform</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-2xs pt-3 border-t border-zinc-800 font-mono text-zinc-400">
                    <div>Version: <span className="text-zinc-200 font-semibold">0.1.0 (Phase 10 Release Candidate)</span></div>
                    <div>License: <span className="text-zinc-200 font-semibold">Open Source (MIT / Apache-2.0 Candidate)</span></div>
                    <div>Architecture: <span className="text-zinc-200">Electron Context-Isolated</span></div>
                    <div>Platform: <span className="text-zinc-200">Windows x64 / Cross-Platform Ready</span></div>
                  </div>

                  <p className="text-2xs text-zinc-500 pt-2 leading-relaxed">
                    Designed for deterministic thermal and standard printing without vendor lock-in. Supports native ZPL II, vector PDF, 1D/2D barcodes, external data connectivity, and controlled mass production.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Modal Footer */}
        <footer className="px-5 py-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs">
          <div className="text-zinc-500 text-2xs">
            Preferences are saved atomically to your user data profile.
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium flex items-center space-x-1.5 shadow-sm transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Preferences'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
