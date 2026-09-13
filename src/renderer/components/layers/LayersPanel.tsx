import React from 'react';
import {
  Layers as LayersIcon,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Type,
  Square,
  Minus,
  Barcode,
  QrCode,
  Image,
} from 'lucide-react';
import { useEditorStore } from '../../store/editor.store';
import { selectElements, selectSelectedElementIds } from '../../store/selectors';
import { LabelElement } from '../../../core/schemas/label.schema';

export const LayersPanel: React.FC = () => {
  const elements = useEditorStore(selectElements);
  const selectedIds = useEditorStore(selectSelectedElementIds);

  const selectElement = useEditorStore((s) => s.selectElement);
  const toggleLockElement = useEditorStore((s) => s.toggleLockElement);
  const reorderElement = useEditorStore((s) => s.reorderElement);

  const getElementIcon = (type: LabelElement['type']) => {
    switch (type) {
      case 'text':
        return <Type className="w-3.5 h-3.5 text-blue-400" />;
      case 'rectangle':
        return <Square className="w-3.5 h-3.5 text-emerald-400" />;
      case 'line':
        return <Minus className="w-3.5 h-3.5 text-amber-400" />;
      case 'barcode':
        return <Barcode className="w-3.5 h-3.5 text-purple-400" />;
      case 'qrcode':
        return <QrCode className="w-3.5 h-3.5 text-cyan-400" />;
      case 'image':
        return <Image className="w-3.5 h-3.5 text-pink-400" />;
      default:
        return <LayersIcon className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  // Layers in UI are displayed with top element at the top of the list (reversed slice)
  const reversedElements = [...elements].reverse();

  return (
    <aside className="w-64 bg-panel-bg border-l border-panel-border flex flex-col h-full text-xs select-none">
      <div className="h-10 px-3 border-b border-panel-border flex items-center justify-between bg-panel-header">
        <span className="font-semibold text-zinc-200 flex items-center space-x-1.5">
          <LayersIcon className="w-4 h-4 text-blue-400" />
          <span>Layers</span>
          <span className="text-2xs text-zinc-500 font-mono">({elements.length})</span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {reversedElements.length === 0 ? (
          <p className="text-zinc-500 italic p-3 text-center">No elements created yet.</p>
        ) : (
          reversedElements.map((el) => {
            const isSelected = selectedIds.includes(el.id);
            return (
              <div
                key={el.id}
                onClick={(e) => selectElement(el.id, e.shiftKey || e.ctrlKey || e.metaKey)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-600/30 text-white border border-blue-500/50'
                    : 'text-zinc-300 hover:bg-zinc-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  {getElementIcon(el.type)}
                  <span className="truncate capitalize font-medium">
                    {el.type === 'text' ? (el as any).content || 'Text' : el.type}
                  </span>
                  <span className="text-2xs text-zinc-500 font-mono">
                    {el.id.slice(0, 6)}
                  </span>
                </div>

                <div className="flex items-center space-x-0.5 ml-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => reorderElement(el.id, 'bringToFront')}
                    title="Bring to Front"
                    className="p-1 hover:bg-zinc-700/60 rounded text-zinc-400 hover:text-white"
                  >
                    <ChevronsUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => reorderElement(el.id, 'bringForward')}
                    title="Bring Forward"
                    className="p-1 hover:bg-zinc-700/60 rounded text-zinc-400 hover:text-white"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => reorderElement(el.id, 'sendBackward')}
                    title="Send Backward"
                    className="p-1 hover:bg-zinc-700/60 rounded text-zinc-400 hover:text-white"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => reorderElement(el.id, 'sendToBack')}
                    title="Send to Back"
                    className="p-1 hover:bg-zinc-700/60 rounded text-zinc-400 hover:text-white"
                  >
                    <ChevronsDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => toggleLockElement(el.id)}
                    title={el.locked ? 'Unlock' : 'Lock'}
                    className={`p-1 rounded ${
                      el.locked
                        ? 'text-amber-400'
                        : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    {el.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
