import React from 'react';
import {
  MousePointer,
  Type,
  Square,
  Minus,
  Hand,
  Barcode,
  QrCode,
} from 'lucide-react';
import { useEditorStore, ToolType } from '../../store/editor.store';
import { selectActiveTool } from '../../store/selectors';

interface ToolItem {
  id: ToolType | 'barcode' | 'qrcode';
  label: string;
  icon: React.ReactNode;
  shortcut: string;
}

const TOOLS: ToolItem[] = [
  { id: 'select', label: 'Select (V)', icon: <MousePointer className="w-4 h-4" />, shortcut: 'V' },
  { id: 'text', label: 'Text Tool (T)', icon: <Type className="w-4 h-4" />, shortcut: 'T' },
  { id: 'rectangle', label: 'Rectangle Tool (R)', icon: <Square className="w-4 h-4" />, shortcut: 'R' },
  { id: 'line', label: 'Line Tool (L)', icon: <Minus className="w-4 h-4" />, shortcut: 'L' },
  { id: 'pan', label: 'Pan Tool (H)', icon: <Hand className="w-4 h-4" />, shortcut: 'H' },
];

export const Toolbar: React.FC = () => {
  const activeTool = useEditorStore(selectActiveTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);

  return (
    <aside className="w-12 bg-panel-bg border-r border-panel-border flex flex-col items-center py-3 space-y-2 select-none z-10">
      {TOOLS.map((tool) => {
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id as ToolType)}
            title={tool.label}
            className={`w-8 h-8 rounded flex items-center justify-center transition-all ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/50'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            }`}
          >
            {tool.icon}
          </button>
        );
      })}

      <div className="w-6 h-px bg-zinc-800 my-1" />

      {/* Placeholders for Barcode & QR (Phases 2-3) */}
      <button
        disabled
        title="Barcode (Placeholder - Phase 3)"
        className="w-8 h-8 rounded flex items-center justify-center text-zinc-600 cursor-not-allowed opacity-50"
      >
        <Barcode className="w-4 h-4" />
      </button>

      <button
        disabled
        title="QR Code (Placeholder - Phase 3)"
        className="w-8 h-8 rounded flex items-center justify-center text-zinc-600 cursor-not-allowed opacity-50"
      >
        <QrCode className="w-4 h-4" />
      </button>
    </aside>
  );
};
