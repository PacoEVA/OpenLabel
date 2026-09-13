import bwipjs from 'bwip-js';
import { NormalizedBarcode, BarcodeSymbology, QrErrorCorrection } from '../../core/barcodes/barcode.types';
import { validateBarcodeData } from '../../core/barcodes/barcode-validator';

export interface BarcodeRenderSuccess {
  success: true;
  svg: string;
}

export interface BarcodeRenderFailure {
  success: false;
  error: string;
  errorCode: string;
}

export type BarcodeRenderResult = BarcodeRenderSuccess | BarcodeRenderFailure;

export interface BwipAdapterOptions {
  symbology: BarcodeSymbology;
  data: string;
  displayValue?: boolean;
  errorCorrection?: QrErrorCorrection;
  scale?: number;
  height?: number;
  width?: number;
}

/**
 * Translates OpenLabels symbology into BWIPP / bwip-js barcode identifier (bcid).
 */
function toBwipBcid(symbology: BarcodeSymbology): string {
  switch (symbology) {
    case 'code128':
      return 'code128';
    case 'ean13':
      return 'ean13';
    case 'qrcode':
      return 'qrcode';
    case 'datamatrix':
      return 'datamatrix';
    default:
      return symbology;
  }
}

interface BwipExtendedOptions extends bwipjs.RenderOptions {
  eclevel?: string;
}

/**
 * OpenLabels - Isolated bwip-js adapter.
 * Validates domain rules first, invokes bwip-js toSVG safely, and guarantees no unhandled exceptions.
 */
export function renderBarcodeSvg(
  input: BwipAdapterOptions | NormalizedBarcode
): BarcodeRenderResult {
  const symbology = input.symbology;
  const data = input.data;

  const displayValue =
    'displayValue' in input ? input.displayValue : true;

  const errorCorrection =
    'errorCorrection' in input ? input.errorCorrection : undefined;

  // 1. Validate payload with pure domain engine
  const validation = validateBarcodeData(symbology, data, { errorCorrection });
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error || 'Invalid barcode data',
      errorCode: validation.errorCode || 'INVALID_DATA',
    };
  }

  const textToRender = validation.normalizedData || data;
  const bcid = toBwipBcid(symbology);

  // 2. Build bwip-js render options
  const opts: BwipExtendedOptions = {
    bcid,
    text: textToRender,
    scale: 2,
    rotate: 'N',
  };

  if (symbology === 'code128' || symbology === 'ean13') {
    opts.includetext = displayValue;
    opts.textxalign = 'center';
    opts.textsize = 10;
    opts.height = 12; // Aspect height in mm for linear bars
  } else if (symbology === 'qrcode') {
    opts.eclevel = errorCorrection || 'M';
  }

  // 3. Invoke bwip-js toSVG inside try-catch boundary
  try {
    const svg = bwipjs.toSVG(opts);
    if (!svg || typeof svg !== 'string' || !svg.includes('<svg')) {
      return {
        success: false,
        error: 'Failed to generate SVG barcode: empty output received from generator',
        errorCode: 'RENDER_ERROR',
      };
    }

    return {
      success: true,
      svg,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `bwip-js generation error: ${message}`,
      errorCode: 'RENDER_ERROR',
    };
  }
}
