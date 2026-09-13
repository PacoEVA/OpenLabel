import React, { useState, useEffect } from 'react';
import { LayoutTemplate, X, ArrowRight, Sparkles, User, Box } from 'lucide-react';
import { useEditorStore } from '../../store/editor.store';
import { cloneTemplate } from '../../../core/templates/built-in-templates';
import type { TemplateSummaryIPC } from '../../../preload/types';

interface TemplatePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TemplatePickerDialog: React.FC<TemplatePickerDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'builtIn' | 'user'>('builtIn');
  const [builtInTemplates, setBuiltInTemplates] = useState<TemplateSummaryIPC[]>([]);
  const [userTemplates, setUserTemplates] = useState<TemplateSummaryIPC[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const setDocument = useEditorStore((s) => s.setDocument);

  useEffect(() => {
    if (!isOpen) return;

    const loadTemplates = async () => {
      setIsLoading(true);
      try {
        if (typeof window !== 'undefined' && window.documentAPI) {
          const res = await window.documentAPI.listTemplates();
          setBuiltInTemplates(res.builtIn);
          setUserTemplates(res.user);
        }
      } catch {
        // Non-fatal
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplates();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectTemplate = async (template: TemplateSummaryIPC) => {
    try {
      if (typeof window !== 'undefined' && window.documentAPI) {
        const rawDoc = await window.documentAPI.getTemplate(template.id, template.isBuiltIn);
        if (rawDoc) {
          // Deep clone and regenerate UUIDs
          const freshDoc = cloneTemplate(rawDoc);
          setDocument(freshDoc, { filePath: null });
          onClose();
        }
      }
    } catch {
      // Non-fatal
    }
  };

  const currentList = activeTab === 'builtIn' ? builtInTemplates : userTemplates;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-zinc-900 border border-zinc-700/70 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden text-zinc-200 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-800/40">
          <div className="flex items-center space-x-2">
            <LayoutTemplate className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-sm text-zinc-100">Label Templates</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-700/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 px-4 pt-2 text-xs">
          <button
            onClick={() => setActiveTab('builtIn')}
            className={`pb-2 px-3 flex items-center space-x-1.5 font-medium border-b-2 transition-colors ${
              activeTab === 'builtIn'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Built-in Standard ({builtInTemplates.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('user')}
            className={`pb-2 px-3 flex items-center space-x-1.5 font-medium border-b-2 transition-colors ${
              activeTab === 'user'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>My Templates ({userTemplates.length})</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto min-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-zinc-500 text-xs">
              Loading templates...
            </div>
          ) : currentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-500 text-xs space-y-2">
              <Box className="w-8 h-8 text-zinc-600" />
              <p>No templates available in this category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentList.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  className="bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/60 hover:border-blue-500/50 p-3 rounded-lg cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-100 group-hover:text-blue-400 transition-colors">
                        {tpl.name}
                      </span>
                      <span className="text-3xs uppercase font-bold tracking-wider px-1.5 py-0.5 bg-zinc-700/60 text-zinc-300 rounded border border-zinc-600/40">
                        {tpl.category}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-2xs leading-relaxed line-clamp-2">
                      {tpl.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-zinc-700/30 flex items-center justify-between text-2xs text-zinc-400">
                    <span className="font-mono">
                      {tpl.dimensions.width} × {tpl.dimensions.height} {tpl.dimensions.unit}
                    </span>
                    <span className="text-blue-400 font-medium flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                      <span>Use</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
