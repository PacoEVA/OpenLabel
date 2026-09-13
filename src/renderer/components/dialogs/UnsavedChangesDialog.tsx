import React, { useEffect } from 'react';
import { AlertCircle, Save, Trash2, X } from 'lucide-react';

export interface UnsavedChangesDialogProps {
  isOpen: boolean;
  displayName: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  displayName,
  onSave,
  onDiscard,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-zinc-900 border border-zinc-700/70 rounded-lg shadow-2xl w-full max-w-md overflow-hidden text-zinc-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-800/40">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-sm text-zinc-100">Unsaved Changes</span>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-700/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2 text-xs">
          <p className="text-zinc-200 font-medium">
            Do you want to save the changes made to{' '}
            <span className="text-amber-300 font-semibold">{displayName}</span>?
          </p>
          <p className="text-zinc-400">
            Your changes will be permanently lost if you close or create a new label without saving.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-2 px-4 py-3 border-t border-zinc-800 bg-zinc-900/80">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 rounded font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onDiscard}
            className="px-3 py-1.5 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded font-medium flex items-center space-x-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Don&apos;t Save</span>
          </button>
          <button
            onClick={onSave}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded font-medium flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
};
