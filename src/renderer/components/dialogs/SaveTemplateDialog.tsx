import React, { useState } from 'react';
import { Bookmark, X, Save } from 'lucide-react';
import { useEditorStore } from '../../store/editor.store';
import { selectDocument } from '../../store/selectors';

interface SaveTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SaveTemplateDialog: React.FC<SaveTemplateDialogProps> = ({ isOpen, onClose }) => {
  const document = useEditorStore(selectDocument);
  const [templateName, setTemplateName] = useState(document.meta.title || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!templateName.trim()) {
      setError('Please enter a template name.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (typeof window !== 'undefined' && window.documentAPI) {
        const res = await window.documentAPI.saveAsTemplate(templateName.trim(), document);
        if (res.success) {
          onClose();
        } else {
          setError(res.errors?.[0] || 'Failed to save template.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-zinc-900 border border-zinc-700/70 rounded-lg shadow-2xl w-full max-w-sm overflow-hidden text-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-800/40">
          <div className="flex items-center space-x-2">
            <Bookmark className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-sm text-zinc-100">Save as Template</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-700/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 text-xs">
          <p className="text-zinc-400">
            Save this design as a reusable template in your personal template library.
          </p>

          <div className="space-y-1">
            <label className="text-2xs font-semibold text-zinc-300">Template Name</label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Shipping 4x2 Custom"
              className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-zinc-100 text-xs focus:outline-none focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
            />
          </div>

          {error && <p className="text-red-400 text-2xs">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 px-4 py-3 border-t border-zinc-800 bg-zinc-900/80">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 rounded font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded font-medium flex items-center space-x-1.5 transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Template'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
