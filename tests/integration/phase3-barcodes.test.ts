import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../src/renderer/store/editor.store';
import { BarcodeElement, QrCodeElement } from '../../src/core/schemas/label.schema';
import { renderBarcodeSvg } from '../../src/renderer/barcodes/bwip-adapter';
import { getOrRenderBarcodeSvg, clearBarcodeCache } from '../../src/renderer/barcodes/barcode-cache';
import { calculateXDimension } from '../../src/core/barcodes/x-dimension';
import { validateBarcodeData } from '../../src/core/barcodes/barcode-validator';

describe('Phase 3 End-to-End Barcode Integration', () => {
  beforeEach(() => {
    clearBarcodeCache();
    // Reset store with a fresh default document
    useEditorStore.setState(useEditorStore.getInitialState());
  });

  it('should support creating a Barcode element and verifying preview generation', () => {
    const store = useEditorStore.getState();

    const barcode: BarcodeElement = {
      id: 'bc-int-1',
      type: 'barcode',
      x: 10,
      y: 10,
      width: 50,
      height: 20,
      rotation: 0,
      locked: false,
      symbology: 'code128',
      data: 'BATCH-2026',
      narrowBarRatio: 2,
      displayValue: true,
    };

    store.addElement(barcode);

    const doc = useEditorStore.getState().document;
    expect(doc.elements.length).toBe(1);
    expect(doc.elements[0].id).toBe('bc-int-1');

    // Verify preview renders successfully
    const preview = getOrRenderBarcodeSvg({
      symbology: barcode.symbology,
      data: barcode.data,
      displayValue: barcode.displayValue,
    });
    expect(preview.success).toBe(true);
    if (preview.success) {
      expect(preview.svg).toContain('<svg');
      expect(preview.svg).toContain('</svg>');
    }
  });

  it('should handle changing data, displaying errors on invalid payload, and correcting errors', () => {
    const barcode: BarcodeElement = {
      id: 'bc-ean-test',
      type: 'barcode',
      x: 5,
      y: 5,
      width: 40,
      height: 25,
      rotation: 0,
      locked: false,
      symbology: 'ean13',
      data: '8412345678905', // valid 13-digit EAN-13
      narrowBarRatio: 2,
      displayValue: true,
    };

    useEditorStore.getState().addElement(barcode);

    // 1. Initial valid render
    let renderResult = getOrRenderBarcodeSvg({
      symbology: barcode.symbology,
      data: barcode.data,
      displayValue: barcode.displayValue,
    });
    expect(renderResult.success).toBe(true);

    // 2. Corrupt the data to invalid check digit
    useEditorStore.getState().updateElement('bc-ean-test', { data: '8412345678909' }, true);
    const updatedEl = useEditorStore.getState().document.elements[0] as BarcodeElement;

    renderResult = getOrRenderBarcodeSvg({
      symbology: updatedEl.symbology,
      data: updatedEl.data,
      displayValue: updatedEl.displayValue,
    });
    expect(renderResult.success).toBe(false);
    if (!renderResult.success) {
      expect(renderResult.errorCode).toBe('INVALID_CHECK_DIGIT');
      expect(renderResult.error).toContain('Invalid EAN-13 check digit');
    }

    // 3. Correct data to 12 digits (auto-check digit calculation)
    useEditorStore.getState().updateElement('bc-ean-test', { data: '841234567890' }, true);
    const correctedEl = useEditorStore.getState().document.elements[0] as BarcodeElement;

    renderResult = getOrRenderBarcodeSvg({
      symbology: correctedEl.symbology,
      data: correctedEl.data,
      displayValue: correctedEl.displayValue,
    });
    expect(renderResult.success).toBe(true);
  });

  it('should allow switching symbology between Code 128, EAN-13 and Data Matrix', () => {
    const barcode: BarcodeElement = {
      id: 'bc-sym-switch',
      type: 'barcode',
      x: 10,
      y: 10,
      width: 45,
      height: 20,
      rotation: 0,
      locked: false,
      symbology: 'code128',
      data: '123456789012',
      narrowBarRatio: 2,
      displayValue: true,
    };

    useEditorStore.getState().addElement(barcode);

    // Switch to EAN-13
    useEditorStore.getState().updateElement('bc-sym-switch', { symbology: 'ean13' }, true);
    let el = useEditorStore.getState().document.elements[0] as BarcodeElement;
    expect(el.symbology).toBe('ean13');
    expect(validateBarcodeData(el.symbology, el.data).valid).toBe(true);

    // Switch to Data Matrix
    useEditorStore.getState().updateElement('bc-sym-switch', { symbology: 'datamatrix' }, true);
    el = useEditorStore.getState().document.elements[0] as BarcodeElement;
    expect(el.symbology).toBe('datamatrix');
    expect(validateBarcodeData(el.symbology, el.data).valid).toBe(true);

    const dmRender = getOrRenderBarcodeSvg({
      symbology: el.symbology,
      data: el.data,
    });
    expect(dmRender.success).toBe(true);
  });

  it('should support modifying X Dimension and quantizing correctly for 203, 300, and 600 DPI', () => {
    // 203 DPI: 1 dot = 0.1251 mm
    const q203 = calculateXDimension(0.33, 203);
    expect(q203.dots).toBe(3);
    expect(q203.physicalMm).toBeCloseTo(0.375, 2);

    // 300 DPI: 1 dot = 0.0847 mm
    const q300 = calculateXDimension(0.33, 300);
    expect(q300.dots).toBe(4);
    expect(q300.physicalMm).toBeCloseTo(0.339, 2);

    // 600 DPI: 1 dot = 0.0423 mm
    const q600 = calculateXDimension(0.33, 600);
    expect(q600.dots).toBe(8);
    expect(q600.physicalMm).toBeCloseTo(0.339, 2);
  });

  it('should support undo and redo operations on barcode element edits', () => {
    const store = useEditorStore.getState();

    const barcode: BarcodeElement = {
      id: 'bc-undo-test',
      type: 'barcode',
      x: 10,
      y: 10,
      width: 40,
      height: 20,
      rotation: 0,
      locked: false,
      symbology: 'code128',
      data: 'INITIAL-DATA',
      narrowBarRatio: 2,
      displayValue: true,
    };

    store.addElement(barcode);
    expect(useEditorStore.getState().document.elements.length).toBe(1);

    // Update data with history snapshot
    useEditorStore.getState().updateElement('bc-undo-test', { data: 'UPDATED-DATA' }, true);
    let el = useEditorStore.getState().document.elements[0] as BarcodeElement;
    expect(el.data).toBe('UPDATED-DATA');

    // Undo -> should revert to INITIAL-DATA
    useEditorStore.getState().undo();
    el = useEditorStore.getState().document.elements[0] as BarcodeElement;
    expect(el.data).toBe('INITIAL-DATA');

    // Redo -> should return to UPDATED-DATA
    useEditorStore.getState().redo();
    el = useEditorStore.getState().document.elements[0] as BarcodeElement;
    expect(el.data).toBe('UPDATED-DATA');
  });

  it('should support creating and configuring QR Code with error correction', () => {
    const store = useEditorStore.getState();

    const qr: QrCodeElement = {
      id: 'qr-int-1',
      type: 'qrcode',
      x: 15,
      y: 15,
      width: 25,
      height: 25,
      rotation: 0,
      locked: false,
      data: 'https://openlabels.io/barcode-preview',
      errorCorrection: 'H',
    };

    store.addElement(qr);
    expect(useEditorStore.getState().document.elements.length).toBe(1);

    const preview = renderBarcodeSvg({
      symbology: 'qrcode',
      data: qr.data,
      errorCorrection: qr.errorCorrection,
    });
    expect(preview.success).toBe(true);
    if (preview.success) {
      expect(preview.svg).toContain('<svg');
    }
  });
});
