import React, { useState, useEffect } from 'react';
import {
  FilePlus,
  FolderOpen,
  LayoutTemplate,
  Layers,
  Clock,
  Trash2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useEditorStore } from '../../store/editor.store';
import { useDocumentOperations } from '../../hooks/useDocumentOperations';
import { BUILT_IN_TEMPLATES, cloneTemplate } from '../../../core/templates/built-in-templates';
import type { RecentFileIPCItem } from '../../../preload/types';

interface EmptyStateHomeProps {
  onOpenTemplatePicker: () => void;
}

export const EmptyStateHome: React.FC<EmptyStateHomeProps> = ({ onOpenTemplatePicker }) => {
  const docOps = useDocumentOperations();
  const setDocument = useEditorStore((s) => s.setDocument);
  const newDocument = useEditorStore((s) => s.newDocument);

  const [recentFiles, setRecentFiles] = useState<RecentFileIPCItem[]>([]);
  const [isLoadingRecents, setIsLoadingRecents] = useState(false);

  useEffect(() => {
    const loadRecents = async () => {
      setIsLoadingRecents(true);
      try {
        if (typeof window !== 'undefined' && window.documentAPI) {
          const files = await window.documentAPI.getRecentFiles();
          setRecentFiles(files);
        }
      } catch {
        // Non-fatal
      } finally {
        setIsLoadingRecents(false);
      }
    };

    loadRecents();
  }, []);

  const handleClearRecents = async () => {
    if (typeof window !== 'undefined' && window.documentAPI) {
      await window.documentAPI.clearRecentFiles();
      setRecentFiles([]);
    }
  };

  const handleOpenTemplate = (tplDoc: any) => {
    const fresh = cloneTemplate(tplDoc);
    setDocument(fresh, { filePath: null });
  };

  return (
    <div className="w-full h-full flex flex-col bg-workspace-bg text-zinc-200 select-none overflow-y-auto">
      {/* Container */}
      <div className="max-w-5xl mx-auto w-full px-6 py-10 flex-1 flex flex-col justify-between">
        <div className="space-y-8">
          {/* Header Branding */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-6">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm shadow-blue-500/10">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-lg font-bold text-zinc-100 tracking-tight">OpenLabels</h1>
                  <span className="text-3xs font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                    v1.0.0
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Industrial & commercial precision label designer
                </p>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => newDocument({ dimensions: { width: 100, height: 50, unit: 'mm', dpi: 203 } })}
                className="px-2.5 py-1 text-2xs bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700/50 transition-colors"
                title="Create 100 × 50 mm blank label"
              >
                100 × 50 mm
              </button>
              <button
                onClick={() => newDocument({ dimensions: { width: 50, height: 30, unit: 'mm', dpi: 203 } })}
                className="px-2.5 py-1 text-2xs bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700/50 transition-colors"
                title="Create 50 × 30 mm blank label"
              >
                50 × 30 mm
              </button>
              <button
                onClick={() => newDocument({ dimensions: { width: 100, height: 150, unit: 'mm', dpi: 203 } })}
                className="px-2.5 py-1 text-2xs bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700/50 transition-colors"
                title="Create 100 × 150 mm blank label"
              >
                100 × 150 mm (4×6&quot;)
              </button>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* New Label */}
            <button
              onClick={docOps.handleNew}
              className="flex items-center space-x-3 p-4 bg-zinc-900/60 hover:bg-zinc-800/70 border border-zinc-800 hover:border-blue-500/50 rounded-xl transition-all group text-left shadow-sm"
            >
              <div className="p-2.5 rounded-lg bg-blue-600/10 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FilePlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-100 group-hover:text-blue-400 transition-colors">
                  New Label
                </h3>
                <p className="text-2xs text-zinc-400 mt-0.5">
                  Create a blank custom size label (Ctrl+N)
                </p>
              </div>
            </button>

            {/* Open Label */}
            <button
              onClick={docOps.handleOpen}
              className="flex items-center space-x-3 p-4 bg-zinc-900/60 hover:bg-zinc-800/70 border border-zinc-800 hover:border-indigo-500/50 rounded-xl transition-all group text-left shadow-sm"
            >
              <div className="p-2.5 rounded-lg bg-indigo-600/10 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-100 group-hover:text-indigo-400 transition-colors">
                  Open Existing
                </h3>
                <p className="text-2xs text-zinc-400 mt-0.5">
                  Browse a .label file on this machine (Ctrl+O)
                </p>
              </div>
            </button>

            {/* Templates */}
            <button
              onClick={onOpenTemplatePicker}
              className="flex items-center space-x-3 p-4 bg-zinc-900/60 hover:bg-zinc-800/70 border border-zinc-800 hover:border-emerald-500/50 rounded-xl transition-all group text-left shadow-sm"
            >
              <div className="p-2.5 rounded-lg bg-emerald-600/10 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <LayoutTemplate className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors">
                  Templates Library
                </h3>
                <p className="text-2xs text-zinc-400 mt-0.5">
                  Start from pre-configured industrial templates
                </p>
              </div>
            </button>
          </div>

          {/* Two-Column Section: Recents & Templates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Left: Recent Files */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center space-x-2 text-xs font-semibold text-zinc-300">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Recent Files</span>
                </div>
                {recentFiles.length > 0 && (
                  <button
                    onClick={handleClearRecents}
                    title="Clear Recent Files"
                    className="text-3xs text-zinc-500 hover:text-red-400 flex items-center space-x-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {isLoadingRecents ? (
                <div className="py-8 text-center text-zinc-500 text-xs">
                  Loading recent files...
                </div>
              ) : recentFiles.length === 0 ? (
                <div className="py-10 border border-dashed border-zinc-800/80 rounded-lg text-center text-zinc-500 text-xs space-y-1">
                  <p>No recent files opened yet</p>
                  <p className="text-3xs text-zinc-600">
                    Opened and saved .label files will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentFiles.map((file) => (
                    <div
                      key={file.filePath}
                      onClick={() => docOps.handleOpenPath(file.filePath)}
                      className="p-2.5 bg-zinc-900/40 hover:bg-zinc-800/80 border border-zinc-800/60 hover:border-zinc-700 rounded-lg cursor-pointer transition-colors flex items-center justify-between group"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="font-medium text-xs text-zinc-200 group-hover:text-blue-400 truncate transition-colors">
                          {file.displayName}
                        </div>
                        <div className="text-3xs text-zinc-500 truncate mt-0.5 font-mono">
                          {file.filePath}
                        </div>
                      </div>
                      <span className="text-3xs text-zinc-500 shrink-0">
                        {new Date(file.lastOpenedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Featured Built-in Templates */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center space-x-2 text-xs font-semibold text-zinc-300">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Standard Templates</span>
                </div>
                <button
                  onClick={onOpenTemplatePicker}
                  className="text-3xs text-blue-400 hover:text-blue-300 flex items-center space-x-1 transition-colors"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-2">
                {BUILT_IN_TEMPLATES.map((tpl) => (
                  <div
                    key={tpl.id}
                    onClick={() => handleOpenTemplate(tpl.document)}
                    className="p-3 bg-zinc-900/40 hover:bg-zinc-800/80 border border-zinc-800/60 hover:border-blue-500/40 rounded-lg cursor-pointer transition-colors flex items-center justify-between group"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-xs text-zinc-200 group-hover:text-blue-400 transition-colors flex items-center space-x-2">
                        <span>{tpl.name}</span>
                        <span className="text-3xs uppercase px-1 py-0.2 bg-zinc-800 text-zinc-400 rounded">
                          {tpl.category}
                        </span>
                      </div>
                      <div className="text-2xs text-zinc-400 line-clamp-1">
                        {tpl.description}
                      </div>
                    </div>
                    <div className="text-2xs font-mono text-zinc-400 text-right pl-3 shrink-0">
                      {tpl.document.dimensions.width} × {tpl.document.dimensions.height} mm
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center pt-8 border-t border-zinc-900 text-3xs text-zinc-600">
          OpenLabels — Built strictly with TypeScript, Electron, Zod, and Vitest
        </div>
      </div>
    </div>
  );
};
