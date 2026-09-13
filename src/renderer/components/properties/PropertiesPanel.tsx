import React from 'react';
import {
  Lock,
  Unlock,
  Copy,
  Trash2,
  Sliders,
  Type as TypeIcon,
  Barcode as BarcodeIcon,
  QrCode as QrIcon,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useEditorStore } from '../../store/editor.store';
import { selectFirstSelectedElement, selectDocument } from '../../store/selectors';
import {
  TextElement,
  RectangleElement,
  LineElement,
  BarcodeElement,
  QrCodeElement,
} from '../../../core/schemas/label.schema';
import { calculateEan13CheckDigit } from '../../../core/barcodes/symbologies/ean13';
import { validateBarcodeData } from '../../../core/barcodes/barcode-validator';
import { dotsToMm } from '../../../core/units/converter';
import { InsertVariableDropdown } from './InsertVariableDropdown';
import { extractFieldNames } from '../../../core/data/template-parser';

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
  const isBarcode = selectedElement.type === 'barcode';
  const isQrCode = selectedElement.type === 'qrcode';

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
              <div className="flex items-center justify-between mb-1">
                <label className="text-2xs text-zinc-500 block">Content</label>
                <InsertVariableDropdown
                  fields={document.dataModel?.fields ?? []}
                  disabled={selectedElement.locked}
                  onInsert={(placeholder) => {
                    const current = (selectedElement as TextElement).content;
                    updateElement(selectedElement.id, { content: current + placeholder }, true);
                  }}
                />
              </div>
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

        {/* Barcode 1D / 2D Properties */}
        {isBarcode && (() => {
          const barcodeEl = selectedElement as BarcodeElement;
          const dots = barcodeEl.narrowBarRatio || 2;
          const physicalMm = dotsToMm(dots, document.dimensions.dpi);
          const validation = validateBarcodeData(barcodeEl.symbology, barcodeEl.data);

          let eanCheckDigitInfo: {
            expected: number;
            actual: number;
            isValid: boolean;
            isCalculated: boolean;
          } | null = null;

          if (barcodeEl.symbology === 'ean13') {
            const digitsOnly = /^\d+$/.test(barcodeEl.data);
            if (digitsOnly && (barcodeEl.data.length === 12 || barcodeEl.data.length === 13)) {
              try {
                const expectedCheck = calculateEan13CheckDigit(barcodeEl.data.slice(0, 12));
                const is13 = barcodeEl.data.length === 13;
                const actualCheck = is13 ? parseInt(barcodeEl.data[12], 10) : expectedCheck;
                const isValid = is13 ? actualCheck === expectedCheck : true;
                eanCheckDigitInfo = {
                  expected: expectedCheck,
                  actual: actualCheck,
                  isValid,
                  isCalculated: !is13,
                };
              } catch {
                // Ignore calculation errors for live typing
              }
            }
          }

          return (
            <div className="pt-2 border-t border-zinc-800 space-y-3">
              <h4 className="text-2xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center space-x-1">
                <BarcodeIcon className="w-3 h-3" />
                <span>Barcode Properties</span>
              </h4>

              {/* Symbology Selector */}
              <div>
                <label className="text-2xs text-zinc-500 block mb-1">Symbology</label>
                <select
                  disabled={selectedElement.locked}
                  value={barcodeEl.symbology}
                  onChange={(e) =>
                    updateElement(
                      selectedElement.id,
                      { symbology: e.target.value as 'code128' | 'ean13' | 'datamatrix' | 'qrcode' },
                      true
                    )
                  }
                  className="w-full bg-zinc-900 border border-zinc-700/60 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="code128">Code 128 (Alphanumeric)</option>
                  <option value="ean13">EAN-13 (GS1 Retail)</option>
                  <option value="datamatrix">Data Matrix (ECC 200)</option>
                </select>
              </div>

              {/* Data Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-2xs text-zinc-500 block">Data / Value</label>
                  <InsertVariableDropdown
                    fields={document.dataModel?.fields ?? []}
                    disabled={selectedElement.locked}
                    onInsert={(placeholder) => {
                      const current = barcodeEl.data;
                      updateElement(selectedElement.id, { data: current + placeholder }, true);
                    }}
                  />
                </div>
                <input
                  type="text"
                  disabled={selectedElement.locked}
                  value={barcodeEl.data}
                  onChange={(e) =>
                    updateElement(selectedElement.id, { data: e.target.value }, true)
                  }
                  className={`w-full bg-zinc-900 border rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none disabled:opacity-50 ${
                    validation.valid || extractFieldNames(barcodeEl.data).length > 0
                      ? 'border-zinc-700/60 focus:border-blue-500'
                      : 'border-rose-500/80 focus:border-rose-400'
                  }`}
                />
                {extractFieldNames(barcodeEl.data).length > 0 ? (
                  <div className="mt-1 text-3xs text-blue-400 flex items-center space-x-1">
                    <span className="bg-blue-950/80 border border-blue-800/40 rounded px-1.5 py-0.5">
                      Variable Template: {extractFieldNames(barcodeEl.data).join(', ')}
                    </span>
                  </div>
                ) : !validation.valid ? (
                  <div className="mt-1 text-2xs text-rose-400 flex items-start space-x-1">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{validation.error}</span>
                  </div>
                ) : null}
              </div>

              {/* EAN-13 Specific Check Digit Status */}
              {barcodeEl.symbology === 'ean13' && (
                <div className="bg-zinc-900/80 border border-zinc-800 rounded p-2 text-2xs space-y-1">
                  <span className="text-zinc-400 font-semibold block">EAN-13 Check Digit:</span>
                  {eanCheckDigitInfo ? (
                    <div className="flex items-center space-x-1.5">
                      {eanCheckDigitInfo.isValid ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-emerald-300">
                            Digit: <strong className="font-mono">{eanCheckDigitInfo.expected}</strong>
                            {eanCheckDigitInfo.isCalculated ? ' (auto-computed)' : ' (valid check digit)'}
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span className="text-rose-300">
                            Invalid! Expected: <strong>{eanCheckDigitInfo.expected}</strong>, received: <strong>{eanCheckDigitInfo.actual}</strong>
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-zinc-500 italic">Enter 12 or 13 digits</span>
                  )}
                </div>
              )}

              {/* Display Human Readable Text Toggle */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="barcode-display-value"
                  disabled={selectedElement.locked}
                  checked={barcodeEl.displayValue}
                  onChange={(e) =>
                    updateElement(selectedElement.id, { displayValue: e.target.checked }, true)
                  }
                  className="rounded bg-zinc-900 border-zinc-700 text-blue-600 focus:ring-0 focus:ring-offset-0"
                />
                <label htmlFor="barcode-display-value" className="text-2xs text-zinc-300 cursor-pointer">
                  Show Human-Readable Text
                </label>
              </div>

              {/* X Dimension & Hardware Dots */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded p-2 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-2xs text-zinc-400 font-semibold">X Dimension</span>
                  <span className="text-2xs text-zinc-500">{document.dimensions.dpi} DPI</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-2xs text-zinc-500 block mb-1">Dots (k)</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      disabled={selectedElement.locked}
                      value={dots}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                        updateElement(selectedElement.id, { narrowBarRatio: val }, true);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-700/60 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-2xs text-zinc-500 block mb-1">Actual Width</label>
                    <div className="bg-zinc-800/60 border border-zinc-700/30 rounded px-2 py-1 text-zinc-300 text-xs font-mono">
                      {physicalMm.toFixed(3)} mm
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* QR Code Properties */}
        {isQrCode && (() => {
          const qrEl = selectedElement as QrCodeElement;
          const validation = validateBarcodeData('qrcode', qrEl.data, {
            errorCorrection: qrEl.errorCorrection,
          });

          return (
            <div className="pt-2 border-t border-zinc-800 space-y-3">
              <h4 className="text-2xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center space-x-1">
                <QrIcon className="w-3 h-3" />
                <span>QR Code Properties</span>
              </h4>

              {/* Data / Payload */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-2xs text-zinc-500 block">Data / URL</label>
                  <InsertVariableDropdown
                    fields={document.dataModel?.fields ?? []}
                    disabled={selectedElement.locked}
                    onInsert={(placeholder) => {
                      const current = qrEl.data;
                      updateElement(selectedElement.id, { data: current + placeholder }, true);
                    }}
                  />
                </div>
                <textarea
                  rows={3}
                  disabled={selectedElement.locked}
                  value={qrEl.data}
                  onChange={(e) =>
                    updateElement(selectedElement.id, { data: e.target.value }, true)
                  }
                  className={`w-full bg-zinc-900 border rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none disabled:opacity-50 resize-none ${
                    validation.valid || extractFieldNames(qrEl.data).length > 0
                      ? 'border-zinc-700/60 focus:border-blue-500'
                      : 'border-rose-500/80 focus:border-rose-400'
                  }`}
                />
                {extractFieldNames(qrEl.data).length > 0 ? (
                  <div className="mt-1 text-3xs text-blue-400 flex items-center space-x-1">
                    <span className="bg-blue-950/80 border border-blue-800/40 rounded px-1.5 py-0.5">
                      Variable Template: {extractFieldNames(qrEl.data).join(', ')}
                    </span>
                  </div>
                ) : !validation.valid ? (
                  <div className="mt-1 text-2xs text-rose-400 flex items-start space-x-1">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{validation.error}</span>
                  </div>
                ) : null}
              </div>

              {/* Error Correction Level */}
              <div>
                <label className="text-2xs text-zinc-500 block mb-1">Error Correction (ECC)</label>
                <select
                  disabled={selectedElement.locked}
                  value={qrEl.errorCorrection || 'M'}
                  onChange={(e) =>
                    updateElement(
                      selectedElement.id,
                      { errorCorrection: e.target.value as 'L' | 'M' | 'Q' | 'H' },
                      true
                    )
                  }
                  className="w-full bg-zinc-900 border border-zinc-700/60 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="L">L - Low (7% recovery)</option>
                  <option value="M">M - Medium (15% recovery)</option>
                  <option value="Q">Q - Quartile (25% recovery)</option>
                  <option value="H">H - High (30% recovery)</option>
                </select>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800 rounded p-2 text-2xs text-zinc-400">
                <span>Aspect Ratio: <strong>1:1</strong> (Standard 2D square matrix)</span>
              </div>
            </div>
          );
        })()}
      </div>
    </aside>
  );
};
