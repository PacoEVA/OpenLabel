import React from 'react';
import { Lock, Unlock, Copy, Trash2, Sliders, Type as TypeIcon } from 'lucide-react';
import { useEditorStore } from '../../store/editor.store';
import { selectFirstSelectedElement, selectDocument } from '../../store/selectors';
import { TextElement, RectangleElement, LineElement } from '../../../core/schemas/label.schema';

export const PropertiesPanel: React.FC = () => {
  const selectedElement = useEditorStore(selectFirstSelectedElement);
  const document = useEditorStore(selectDocument);
  const updateElement = useEditorStore((s) => s.updateElement);
  const removeElement = useEditorStore((s) => s.removeElement);
  const duplicateElement = useEditorStore((s) => s.duplicateElement);
  const toggleLockElement = useEditorStore((s) => s.toggleLockElement);

  if (!selectedElement) {
    return (
      <aside className="w-64 bg-panel-bg border-l border-panel-border flex flex-col p-4 text-xs text-zinc-500 select-none">
        <div className="flex items-center space-x-2 text-zinc-400 font-semibold mb-3">
          <Sliders className="w-4 h-4" />
          <span>Properties</span>
        </div>
        <p className="italic">No element selected. Click an element on the canvas to inspect and edit its physical properties.</p>
      </aside>
    );
  }

  const handleNumberChange = (
    field: 'x' | 'y' | 'width' | 'height',
    rawVal: string,
    minVal: number = 0
  ) => {
    const val = parseFloat(rawVal);
    if (!isNaN(val)) {
      updateElement(selectedElement.id, { [field]: Math.max(minVal, val) }, true);
    }
  };

  const handleRotationChange = (rawAngle: string) => {
    const angle = parseInt(rawAngle, 10);
    if ([0, 90, 180, 270].includes(angle)) {
      updateElement(selectedElement.id, { rotation: angle as 0 | 90 | 180 | 270 }, true);
    }
  };

  const isText = selectedElement.type === 'text';
  const isRect = selectedElement.type === 'rectangle';
  const isLine = selectedElement.type === 'line';

  return (
    <aside className="w-64 bg-panel-bg border-l border-panel-border flex flex-col h-full text-xs select-none">
      {/* Header */}
      <div className="h-10 px-3 border-b border-panel-border flex items-center justify-between bg-panel-header">
        <span className="font-semibold text-zinc-200 capitalize flex items-center space-x-1.5">
          <span>{selectedElement.type}</span>
          <span className="text-2xs text-zinc-500 font-mono">
            ({selectedElement.id.slice(0, 8)})
          </span>
        </span>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => duplicateElement(selectedElement.id)}
            title="Duplicate"
            className="p-1 hover:bg-zinc-700/60 rounded text-zinc-400 hover:text-zinc-100"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => toggleLockElement(selectedElement.id)}
            title={selectedElement.locked ? 'Unlock' : 'Lock'}
            className={`p-1 rounded ${
              selectedElement.locked
                ? 'bg-amber-500/20 text-amber-400'
                : 'hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {selectedElement.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => removeElement(selectedElement.id)}
            title="Delete"
            disabled={selectedElement.locked}
            className="p-1 hover:bg-red-500/20 rounded text-zinc-400 hover:text-red-400 disabled:opacity-30"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Transform Group */}
        <div>
          <h4 className="text-2xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Geometry ({document.dimensions.unit})
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-2xs text-zinc-500 block mb-1">X Position</label>
              <input
                type="number"
                step="0.5"
                disabled={selectedElement.locked}
                value={selectedElement.x}
                onChange={(e) => handleNumberChange('x', e.target.value, 0)}
                className="w-full bg-zinc-900 border border-zinc-700/60 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-2xs text-zinc-500 block mb-1">Y Position</label>
              <input
                type="number"
                step="0.5"
                disabled={selectedElement.locked}
                value={selectedElement.y}
                onChange={(e) => handleNumberChange('y', e.target.value, 0)}
                className="w-full bg-zinc-900 border border-zinc-700/60 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-2xs text-zinc-500 block mb-1">Width</label>
              <input
                type="number"
                step="0.5"
                disabled={selectedElement.locked}
                value={selectedElement.width}
                onChange={(e) => handleNumberChange('width', e.target.value, 0.1)}
                className="w-full bg-zinc-900 border border-zinc-700/60 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-2xs text-zinc-500 block mb-1">Height</label>
              <input
                type="number"
                step="0.5"
                disabled={selectedElement.locked}
                value={selectedElement.height}
                onChange={(e) => handleNumberChange('height', e.target.value, 0.1)}
                className="w-full bg-zinc-900 border border-zinc-700/60 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Rotation */}
        <div>
          <label className="text-2xs text-zinc-500 block mb-1">Rotation (°)</label>
          <select
            value={selectedElement.rotation}
            disabled={selectedElement.locked}
            onChange={(e) => handleRotationChange(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700/60 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value={0}>0°</option>
            <option value={90}>90°</option>
            <option value={180}>180°</option>
            <option value={270}>270°</option>
          </select>
        </div>

        {/* Type-Specific Properties */}
        {isText && (
          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <h4 className="text-2xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center space-x-1">
              <TypeIcon className="w-3 h-3" />
              <span>Text Properties</span>
            </h4>
            <div>
              <label className="text-2xs text-zinc-500 block mb-1">Content</label>
              <input
                type="text"
                disabled={selectedElement.locked}
                value={(selectedElement as TextElement).content}
                onChange={(e) =>
                  updateElement(selectedElement.id, { content: e.target.value }, true)
                }
                className="w-full bg-zinc-900 border border-zinc-700/60 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-2xs text-zinc-500 block mb-1">Font Size</label>
                <input
                  type="number"
                  min="4"
                  disabled={selectedElement.locked}
                  value={(selectedElement as TextElement).fontSize}
                  onChange={(e) =>
                    updateElement(
                      selectedElement.id,
                      { fontSize: Math.max(4, parseFloat(e.target.value) || 12) },
                      true
                    )
                  }
                  className="w-full bg-zinc-900 border border-zinc-700/60 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-2xs text-zinc-500 block mb-1">Align</label>
                <select
                  disabled={selectedElement.locked}
                  value={(selectedElement as TextElement).align}
                  onChange={(e) =>
                    updateElement(
                      selectedElement.id,
                      { align: e.target.value as 'left' | 'center' | 'right' },
                      true
                    )
                  }
                  className="w-full bg-zinc-900 border border-zinc-700/60 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {isRect && (
          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <h4 className="text-2xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Rectangle Style
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-2xs text-zinc-500 block mb-1">Stroke Width</label>
                <input
                  type="number"
                  min="0"
                  disabled={selectedElement.locked}
                  value={(selectedElement as RectangleElement).strokeWidth}
                  onChange={(e) =>
                    updateElement(
                      selectedElement.id,
                      { strokeWidth: Math.max(0, parseFloat(e.target.value) || 0) },
                      true
                    )
                  }
                  className="w-full bg-zinc-900 border border-zinc-700/60 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-2xs text-zinc-500 block mb-1">Corner Radius</label>
                <input
                  type="number"
                  min="0"
                  disabled={selectedElement.locked}
                  value={(selectedElement as RectangleElement).cornerRadius}
                  onChange={(e) =>
                    updateElement(
                      selectedElement.id,
                      { cornerRadius: Math.max(0, parseFloat(e.target.value) || 0) },
                      true
                    )
                  }
                  className="w-full bg-zinc-900 border border-zinc-700/60 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        )}

        {isLine && (
          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <h4 className="text-2xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Line Style
            </h4>
            <div>
              <label className="text-2xs text-zinc-500 block mb-1">Stroke Width</label>
              <input
                type="number"
                min="0.1"
                disabled={selectedElement.locked}
                value={(selectedElement as LineElement).strokeWidth}
                onChange={(e) =>
                  updateElement(
                    selectedElement.id,
                    { strokeWidth: Math.max(0.1, parseFloat(e.target.value) || 1) },
                    true
                  )
                }
                className="w-full bg-zinc-900 border border-zinc-700/60 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
