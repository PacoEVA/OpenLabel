import type { PrinterDpi } from './printer-profile.schema';

/**
 * Native ZPL II string artifact produced by the ZPL compiler.
 */
export interface ZplPrintArtifact {
  readonly type: 'zpl';
  readonly data: string;
  readonly dpi: PrinterDpi;
}

/**
 * Standard PDF binary bytes artifact produced by the PDF renderer.
 */
export interface PdfPrintArtifact {
  readonly type: 'pdf';
  readonly data: Uint8Array;
}

/**
 * Discriminated union of compiled print artifacts.
 */
export type PrintArtifact = ZplPrintArtifact | PdfPrintArtifact;

/**
 * Type guard for ZPL print artifacts.
 */
export function isZplArtifact(artifact: PrintArtifact): artifact is ZplPrintArtifact {
  return artifact.type === 'zpl';
}

/**
 * Type guard for PDF print artifacts.
 */
export function isPdfArtifact(artifact: PrintArtifact): artifact is PdfPrintArtifact {
  return artifact.type === 'pdf';
}
