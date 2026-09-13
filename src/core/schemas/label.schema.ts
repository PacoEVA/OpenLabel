import { z } from 'zod';
import { LabelDataModelSchema, LabelDataModel } from '../data/data.schema';
import { ExternalDataSourceSchema, ExternalDataSource } from '../data-sources/datasource.schema';
import { FieldMappingSchema, FieldMapping } from '../data-sources/field-mapping.schema';

/**
 * OpenLabels - Label Document Schema & Types
 * Validated runtime boundaries and inferred TypeScript models.
 */

// Supported Units
export const LabelUnitSchema = z.enum(['mm', 'inch']);
export type LabelUnit = z.infer<typeof LabelUnitSchema>;

// Supported Hardware DPIs
export const LabelDpiSchema = z.union([
  z.literal(203),
  z.literal(300),
  z.literal(600),
]);
export type LabelDpi = z.infer<typeof LabelDpiSchema>;

// Supported Orthogonal Rotations
export const LabelRotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);
export type LabelRotation = z.infer<typeof LabelRotationSchema>;

// Barcode Symbologies
export const BarcodeSymbologySchema = z.enum([
  'code128',
  'ean13',
  'datamatrix',
  'qrcode',
]);
export type BarcodeSymbology = z.infer<typeof BarcodeSymbologySchema>;

// Base Element Schema
export const BaseElementSchema = z.object({
  id: z.string().uuid(),
  x: z.number().min(0, { message: 'x coordinate must be >= 0' }),
  y: z.number().min(0, { message: 'y coordinate must be >= 0' }),
  width: z.number().positive({ message: 'width must be greater than 0' }),
  height: z.number().positive({ message: 'height must be greater than 0' }),
  rotation: LabelRotationSchema,
  locked: z.boolean(),
});

// Text Element Schema
export const TextElementSchema = BaseElementSchema.extend({
  type: z.literal('text'),
  content: z.string(),
  fontSize: z.number().positive(),
  fontFamily: z.string().default('monospace'),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  align: z.enum(['left', 'center', 'right']).default('left'),
});
export type TextElement = z.infer<typeof TextElementSchema>;

// Barcode Element Schema
export const BarcodeElementSchema = BaseElementSchema.extend({
  type: z.literal('barcode'),
  symbology: BarcodeSymbologySchema,
  data: z.string().min(1, { message: 'Barcode data cannot be empty' }),
  narrowBarRatio: z.number().int().min(1, { message: 'narrowBarRatio must be an integer >= 1' }),
  displayValue: z.boolean().default(true),
});
export type BarcodeElement = z.infer<typeof BarcodeElementSchema>;

// QR Code Element Schema
export const QrCodeElementSchema = BaseElementSchema.extend({
  type: z.literal('qrcode'),
  data: z.string().min(1, { message: 'QRCode data cannot be empty' }),
  errorCorrection: z.enum(['L', 'M', 'Q', 'H']).default('M'),
});
export type QrCodeElement = z.infer<typeof QrCodeElementSchema>;

// Rectangle Element Schema
export const RectangleElementSchema = BaseElementSchema.extend({
  type: z.literal('rectangle'),
  strokeWidth: z.number().min(0).default(1),
  fill: z.string().optional(),
  stroke: z.string().default('#000000'),
  cornerRadius: z.number().min(0).default(0),
});
export type RectangleElement = z.infer<typeof RectangleElementSchema>;

// Line Element Schema
export const LineElementSchema = BaseElementSchema.extend({
  type: z.literal('line'),
  strokeWidth: z.number().positive().default(1),
  stroke: z.string().default('#000000'),
  orientation: z.enum(['horizontal', 'vertical', 'diagonal']).default('horizontal'),
});
export type LineElement = z.infer<typeof LineElementSchema>;

// Image Element Schema
export const ImageElementSchema = BaseElementSchema.extend({
  type: z.literal('image'),
  source: z.string().min(1, { message: 'Image source cannot be empty' }),
  format: z.enum(['png', 'jpeg', 'bmp', 'svg']).default('png'),
});
export type ImageElement = z.infer<typeof ImageElementSchema>;

// Discriminated Union for all Label Elements
export const LabelElementSchema = z.discriminatedUnion('type', [
  TextElementSchema,
  BarcodeElementSchema,
  QrCodeElementSchema,
  RectangleElementSchema,
  LineElementSchema,
  ImageElementSchema,
]);
export type LabelElement = z.infer<typeof LabelElementSchema>;

// Semantic Version Regex (e.g. 1.0.0, 1.0.0-beta.1)
const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export const SemanticVersionSchema = z.string().regex(SEMVER_REGEX, {
  message: 'Version must follow semantic versioning format (e.g. "1.0.0")',
});

// Document Meta Schema
export const DocumentMetaSchema = z.object({
  title: z.string().min(1, { message: 'Title cannot be empty' }),
  author: z.string().default(''),
  created: z.string().datetime({ message: 'Created date must be a valid ISO 8601 string' }),
});
export type DocumentMeta = z.infer<typeof DocumentMetaSchema>;

// Label Dimensions Schema
export const LabelDimensionsSchema = z.object({
  width: z.number().positive({ message: 'Label width must be greater than 0' }),
  height: z.number().positive({ message: 'Label height must be greater than 0' }),
  unit: LabelUnitSchema,
  dpi: LabelDpiSchema,
});
export type LabelDimensions = z.infer<typeof LabelDimensionsSchema>;

// Root Document Schema
export const LabelDocumentSchema = z.object({
  version: SemanticVersionSchema,
  meta: DocumentMetaSchema,
  dimensions: LabelDimensionsSchema,
  elements: z.array(LabelElementSchema),
  dataModel: LabelDataModelSchema.optional(),
  dataSources: z.array(ExternalDataSourceSchema).optional(),
  fieldMappings: z.record(z.string(), FieldMappingSchema).optional(),
});
export type LabelDocument = z.infer<typeof LabelDocumentSchema>;
