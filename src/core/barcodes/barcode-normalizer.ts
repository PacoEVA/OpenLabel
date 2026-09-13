import { BarcodeElement, QrCodeElement } from '../schemas/label.schema';
import { NormalizedBarcode, BarcodeSymbology, QrErrorCorrection } from './barcode.types';
import { validateBarcodeData } from './barcode-validator';
import { calculateQuietZone } from './quiet-zone';
import { calculateXDimension } from './x-dimension';
import { SupportedDpi, dotsToMm } from '../units/converter';
import { BarcodeDomainError } from './barcode-errors';

export interface NormalizationOptions {
  dpi?: SupportedDpi;
  defaultXDimensionMm?: number;
}

/**
 * Normalizes either a BarcodeElement or QrCodeElement into a unified NormalizedBarcode model,
 * resolving physical X Dimension dots/mm and quiet zones.
 */
export function normalizeBarcodeElement(
  element: BarcodeElement | QrCodeElement,
  options: NormalizationOptions = {}
): NormalizedBarcode {
  const dpi: SupportedDpi = options.dpi || 203;

  let symbology: BarcodeSymbology;
  let displayValue = false;
  let errorCorrection: QrErrorCorrection | undefined;
  let xDimensionDots: number | undefined;
  let xDimensionMm: number | undefined;

  if (element.type === 'qrcode') {
    symbology = 'qrcode';
    errorCorrection = element.errorCorrection || 'M';
    displayValue = false;
  } else {
    symbology = element.symbology;
    displayValue = element.displayValue ?? true;

    // Linear / 1D & Data Matrix X Dimension handling
    if (element.narrowBarRatio) {
      xDimensionDots = element.narrowBarRatio;
      xDimensionMm = dotsToMm(xDimensionDots, dpi);
    } else if (options.defaultXDimensionMm) {
      const q = calculateXDimension(options.defaultXDimensionMm, dpi);
      xDimensionDots = q.dots;
      xDimensionMm = q.physicalMm;
    }
  }

  // Validate payload
  const validation = validateBarcodeData(symbology, element.data, { errorCorrection });
  if (!validation.valid) {
    throw new BarcodeDomainError(
      validation.errorCode || 'INVALID_DATA',
      validation.error || 'Invalid barcode data',
      symbology
    );
  }

  const quietZone = calculateQuietZone(symbology, xDimensionMm || 0.33);

  return {
    symbology,
    data: validation.normalizedData || element.data,
    widthMm: element.width,
    heightMm: element.height,
    rotation: element.rotation,
    displayValue,
    xDimensionMm,
    xDimensionDots,
    errorCorrection,
    quietZone,
  };
}
