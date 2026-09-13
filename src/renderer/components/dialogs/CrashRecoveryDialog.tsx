import React, { useState, useEffect } from 'react';
import { History, FileText, Trash2, ArrowRight } from 'lucide-react';
import { useEditorStore } from '../../store/editor.store';
import type { RecoverySnapshot } from '../../../core/documents/recovery-snapshot.schema';

export const CrashRecoveryDialog: React.FC = () => {
  const [snapshot, setSnapshot] = useState<RecoverySnapshot | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const setDocument = useEditorStore((s) => s.setDocument);

  useEffect(() => {
    // Scan for crash recovery items at application startup
    const checkRecovery = async () => {
      if (typeof window === 'undefined' || !window.documentAPI) return;
      try {
        const items = await window.documentAPI.getRecoveryItems();
        if (items && items.length > 0) {
          setSnapshot(items[0]);
          setIsOpen(true);
        }
      } catch {
        // Non-fatal
      }
    };

    checkRecovery();
  }, []);

  if (!isOpen || !snapshot) return null;

  const formattedDate = new Date(snapshot.savedAt).toLocaleString();

  const handleRecover = async () => {
    setDocument(snapshot.document, {
      filePath: snapshot.sourcePath,
    });
    // Mark the document as dirty so the recovered edits aren't lost
    // Clean up recovery file on disk
    if (typeof window !== 'undefined' && window.documentAPI) {
      await window.documentAPI.removeRecoveryItem(snapshot.documentId);
    }
    setIsOpen(false);
  };

  const handleDiscard = async () => {
    if (typeof window !== 'undefined' && window.documentAPI) {
      await window.documentAPI.removeRecoveryItem(snapshot.documentId);
    }
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-zinc-900 border border-zinc-700/70 rounded-lg shadow-2xl w-full max-w-md overflow-hidden text-zinc-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-800/40">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-sm text-zinc-100">Document Recovery</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 text-xs">
          <p className="text-zinc-200">
            OpenLabels detected unsaved work from a previous session. Would you like to recover it?
          </p>

          <div className="bg-zinc-800/60 p-3 rounded border border-zinc-700/50 space-y-1">
            <div className="flex items-center space-x-1.5 font-medium text-zinc-200">
              <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate">{snapshot.document.meta.title || 'Untitled Label'}</span>
            </div>
            {snapshot.sourcePath && (
              <p className="text-zinc-400 text-2xs truncate">Source: {snapshot.sourcePath}</p>
            )}
            <p className="text-zinc-500 text-2xs">Last autosaved: {formattedDate}</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-2 px-4 py-3 border-t border-zinc-800 bg-zinc-900/80">
          <button
            onClick={handleDiscard}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-red-300 hover:bg-zinc-800 rounded font-medium flex items-center space-x-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Discard</span>
          </button>
          <button
            onClick={handleRecover}
            className="px-3.5 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <span>Recover Document</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
