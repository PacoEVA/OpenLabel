import { LabelDpi, LabelRotation, BarcodeSymbology } from '../../schemas/label.schema';
import { CompileWarning } from '../compile.types';
import { QuietZoneConfig, QrErrorCorrection } from '../../barcodes/barcode.types';

export interface PrintPlanPage {
  widthMm: number;
  heightMm: number;
  dpi: LabelDpi;
}

export interface PrintPlanBaseElement {
  id: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotation: LabelRotation;
  locked: boolean;
}

export interface PrintPlanText extends PrintPlanBaseElement {
  type: 'text';
  content: string;
  fontSizePt: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
}

export interface PrintPlanRectangle extends PrintPlanBaseElement {
  type: 'rectangle';
  strokeWidthMm: number;
  fill?: string;
  stroke: string;
  cornerRadiusMm: number;
}

export interface PrintPlanLine extends PrintPlanBaseElement {
  type: 'line';
  strokeWidthMm: number;
  stroke: string;
  orientation: 'horizontal' | 'vertical' | 'diagonal';
}

export interface PrintPlanBarcode extends PrintPlanBaseElement {
  type: 'barcode';
  symbology: BarcodeSymbology;
  data: string;
  normalizedData: string;
  displayValue: boolean;
  narrowBarRatio: number;
  xDimensionMm: number;
  quietZone?: QuietZoneConfig;
  errorCorrection?: QrErrorCorrection;
}

export interface PrintPlanImage extends PrintPlanBaseElement {
  type: 'image';
  source: string;
  format: 'png' | 'jpeg' | 'bmp' | 'svg';
}

export type PrintPlanElement =
  | PrintPlanText
  | PrintPlanRectangle
  | PrintPlanLine
  | PrintPlanBarcode
  | PrintPlanImage;

export interface PrintPlan {
  page: PrintPlanPage;
  elements: PrintPlanElement[];
  warnings: CompileWarning[];
}
