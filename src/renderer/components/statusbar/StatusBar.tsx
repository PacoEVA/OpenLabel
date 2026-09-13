import React from 'react';
import { useEditorStore } from '../../store/editor.store';
import {
  selectDocument,
  selectZoom,
  selectElements,
  selectSelectedElementIds,
  selectActiveTool,
} from '../../store/selectors';

export const StatusBar: React.FC = () => {
  const document = useEditorStore(selectDocument);
  const zoom = useEditorStore(selectZoom);
  const elements = useEditorStore(selectElements);
  const selectedIds = useEditorStore(selectSelectedElementIds);
  const activeTool = useEditorStore(selectActiveTool);

  const zoomPercent = Math.round(zoom * 100);

  return (
    <footer className="h-6 bg-panel-header border-t border-panel-border flex items-center justify-between px-3 text-2xs text-zinc-400 select-none font-mono">
      <div className="flex items-center space-x-3">
        <span className="text-blue-400 uppercase font-bold tracking-wider">{activeTool} TOOL</span>
        <span className="text-zinc-700">|</span>
        <span>
          {document.dimensions.width} × {document.dimensions.height} {document.dimensions.unit}
        </span>
        <span className="text-zinc-700">|</span>
        <span>{document.dimensions.dpi} DPI</span>
      </div>

      <div className="flex items-center space-x-3">
        <span>
          {elements.length} {elements.length === 1 ? 'element' : 'elements'}
          {selectedIds.length > 0 && ` (${selectedIds.length} selected)`}
        </span>
        <span className="text-zinc-700">|</span>
        <span>ZOOM: {zoomPercent}%</span>
        <span className="text-zinc-700">|</span>
        <span className="text-emerald-500">READY</span>
      </div>
    </footer>
  );
};
