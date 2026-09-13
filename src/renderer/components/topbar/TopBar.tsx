import React, { useState } from 'react';
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Magnet,
  Layers,
  Share2,
  Printer,
  Factory,
  Settings as SettingsIcon,
  FilePlus,
  FolderOpen,
  Save,
  FileDown,
  LayoutTemplate,
  Bookmark,
  XSquare,
} from 'lucide-react';
import { useEditorStore } from '../../store/editor.store';
import {
  selectDocument,
  selectSession,
  selectIsDocumentOpen,
  selectZoom,
  selectGrid,
  selectSnap,
  selectCanUndo,
  selectCanRedo,
} from '../../store/selectors';
import { ExportPreviewDialog } from '../export/ExportPreviewDialog';
import { PrintDialog } from '../printing/PrintDialog';
import { ProductionModal } from '../production/ProductionModal';
import { SettingsDialog } from '../settings/SettingsDialog';
import { useDocumentOperations } from '../../hooks/useDocumentOperations';
import { UnsavedChangesDialog } from '../dialogs/UnsavedChangesDialog';
import { TemplatePickerDialog } from '../dialogs/TemplatePickerDialog';
import { SaveTemplateDialog } from '../dialogs/SaveTemplateDialog';

export const TopBar: React.FC = () => {
  const document = useEditorStore(selectDocument);
  const session = useEditorStore(selectSession);
  const isDocumentOpen = useEditorStore(selectIsDocumentOpen);
  const zoom = useEditorStore(selectZoom);
  const grid = useEditorStore(selectGrid);
  const snap = useEditorStore(selectSnap);
  const canUndoAction = useEditorStore(selectCanUndo);
  const canRedoAction = useEditorStore(selectCanRedo);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isProductionOpen, setIsProductionOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);

  const docOps = useDocumentOperations();

  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const setZoom = useEditorStore((s) => s.setZoom);
  const resetView = useEditorStore((s) => s.resetView);
  const setGrid = useEditorStore((s) => s.setGrid);
  const setSnap = useEditorStore((s) => s.setSnap);

  const zoomPercent = Math.round(zoom * 100);

  return (
    <header className="h-10 bg-panel-header border-b border-panel-border flex items-center justify-between px-3 text-xs select-none">
      {/* Document Info & File Actions */}
      <div className="flex items-center space-x-2">
        {/* Document Title & Dirty State */}
        <div className="flex items-center space-x-1.5 mr-1">
          <Layers className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="font-semibold text-zinc-100 tracking-wide max-w-[160px] truncate" title={session.displayName}>
            {session.displayName}
          </span>
          {session.isDirty && (
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
          )}
        </div>

        {/* Quick File Operations */}
        <div className="flex items-center space-x-0.5 bg-zinc-800/80 p-0.5 rounded border border-zinc-700/50">
          <button
            onClick={docOps.handleNew}
            title="New Label (Ctrl+N)"
            className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-700/60 rounded transition-colors"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={docOps.handleOpen}
            title="Open Label (Ctrl+O)"
            className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-700/60 rounded transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={docOps.handleSave}
            title={`Save Label (Ctrl+S)${session.isDirty ? ' - Unsaved Changes' : ''}`}
            className={`p-1 rounded transition-colors ${
              session.isDirty
                ? 'text-amber-300 hover:text-amber-200 hover:bg-amber-950/40'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-700/60'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={docOps.handleSaveAs}
            title="Save Label As... (Ctrl+Shift+S)"
            className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-700/60 rounded transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
          </button>
          <div className="h-3.5 w-px bg-zinc-700/60 mx-0.5" />
          <button
            onClick={() => setIsTemplatePickerOpen(true)}
            title="Templates Library"
            className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-700/60 rounded transition-colors"
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
          </button>
          {isDocumentOpen && (
            <>
              <button
                onClick={() => setIsSaveTemplateOpen(true)}
                title="Save as Template"
                className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-700/60 rounded transition-colors"
              >
                <Bookmark className="w-3.5 h-3.5" />
              </button>
              <div className="h-3.5 w-px bg-zinc-700/60 mx-0.5" />
              <button
                onClick={docOps.handleClose}
                title="Close Document"
                className="p-1 text-zinc-400 hover:text-red-300 hover:bg-zinc-700/60 rounded transition-colors"
              >
                <XSquare className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center space-x-1.5 text-zinc-400 text-2xs bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/50">
          <span>{document.dimensions.width} × {document.dimensions.height} {document.dimensions.unit}</span>
          <span className="text-zinc-600">|</span>
          <span>{document.dimensions.dpi} DPI</span>
        </div>
      </div>

      {/* Center Controls: Undo / Redo & View Helpers */}
      <div className="flex items-center space-x-1">
        <button
          onClick={undo}
          disabled={!canUndoAction}
          title="Undo (Ctrl+Z)"
          className={`p-1.5 rounded transition-colors ${
            canUndoAction
              ? 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
              : 'text-zinc-600 cursor-not-allowed'
          }`}
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedoAction}
          title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
          className={`p-1.5 rounded transition-colors ${
            canRedoAction
              ? 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
              : 'text-zinc-600 cursor-not-allowed'
          }`}
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-zinc-700/60 mx-1.5" />

        {/* Grid Toggle */}
        <button
          onClick={() => setGrid({ enabled: !grid.enabled })}
          title={`Grid (${grid.enabled ? 'Enabled' : 'Disabled'})`}
          className={`p-1.5 rounded transition-colors ${
            grid.enabled
              ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
              : 'text-zinc-400 hover:bg-zinc-700/60'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
        </button>

        {/* Snap Toggle */}
        <button
          onClick={() => setSnap({ enabled: !snap.enabled })}
          title={`Snapping (${snap.enabled ? 'Enabled' : 'Disabled'})`}
          className={`p-1.5 rounded transition-colors ${
            snap.enabled
              ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
              : 'text-zinc-400 hover:bg-zinc-700/60'
          }`}
        >
          <Magnet className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right Controls: Zoom */}
      <div className="flex items-center space-x-1">
        <button
          onClick={() => setZoom(zoom - 0.25)}
          title="Zoom Out"
          disabled={zoom <= 0.25}
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700/60 rounded disabled:opacity-40"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={resetView}
          title="Reset View to 100%"
          className="px-2 py-0.5 text-zinc-200 hover:bg-zinc-700/60 rounded font-mono text-xs"
        >
          {zoomPercent}%
        </button>
        <button
          onClick={() => setZoom(zoom + 0.25)}
          title="Zoom In"
          disabled={zoom >= 4.0}
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700/60 rounded disabled:opacity-40"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={resetView}
          title="Fit to Screen / 100%"
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700/60 rounded"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-zinc-700/60 mx-1" />

        {/* Export / Preview Dialog Trigger */}
        <button
          onClick={() => setIsExportOpen(true)}
          title="Export & Preview ZPL II / PDF"
          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs flex items-center space-x-1.5 font-medium transition-colors shadow-sm ml-1"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>

        {/* Print Dialog Trigger */}
        <button
          onClick={() => setIsPrintOpen(true)}
          title="Print to Hardware / OS Spooler (Phase 5)"
          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs flex items-center space-x-1.5 font-medium transition-colors shadow-sm ml-1"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print</span>
        </button>

        {/* Massive Production Batch Trigger (Phase 9) */}
        <button
          onClick={() => setIsProductionOpen(true)}
          title="Massive Batch Production & Industrial Control (Phase 9)"
          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs flex items-center space-x-1.5 font-medium transition-colors shadow-sm ml-1"
        >
          <Factory className="w-3.5 h-3.5" />
          <span>Production</span>
        </button>

        {/* Global Settings Trigger (Phase 10) */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          title="Application Preferences & Environment Settings (Phase 10)"
          className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-700/60 rounded transition-colors ml-1"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>

      <ExportPreviewDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />

      <PrintDialog
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
      />

      <ProductionModal
        isOpen={isProductionOpen}
        onClose={() => setIsProductionOpen(false)}
      />

      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <UnsavedChangesDialog
        isOpen={docOps.isUnsavedDialogOpen}
        displayName={docOps.displayName}
        onSave={docOps.handleModalSave}
        onDiscard={docOps.handleModalDiscard}
        onCancel={docOps.handleModalCancel}
      />

      <TemplatePickerDialog
        isOpen={isTemplatePickerOpen}
        onClose={() => setIsTemplatePickerOpen(false)}
      />

      <SaveTemplateDialog
        isOpen={isSaveTemplateOpen}
        onClose={() => setIsSaveTemplateOpen(false)}
      />
    </header>
  );
};
