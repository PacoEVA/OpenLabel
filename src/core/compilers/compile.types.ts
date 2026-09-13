/**
 * OpenLabels - Common Compilation Types
 * Strongly typed results, errors, and warnings for compilers and output pipelines.
 */

export type CompileErrorCode =
  | 'INVALID_DOCUMENT'
  | 'ELEMENT_OUT_OF_BOUNDS'
  | 'UNSUPPORTED_ELEMENT'
  | 'UNSUPPORTED_CHARACTER'
  | 'INVALID_DIMENSIONS'
  | 'BARCODE_INVALID'
  | 'BARCODE_TOO_LARGE'
  | 'FONT_UNAVAILABLE'
  | 'IMAGE_SOURCE_UNAVAILABLE'
  | 'PDF_RENDER_FAILED'
  | 'ZPL_COMPILE_FAILED';

export type CompileWarningCode =
  | 'BARCODE_X_DIMENSION_ADJUSTED'
  | 'FONT_FALLBACK'
  | 'UNSUPPORTED_UNICODE_FOR_ZPL_FONT'
  | 'ELEMENT_CLIPPED'
  | 'IMAGE_RASTERIZED';

export interface CompileError {
  code: CompileErrorCode | string;
  message: string;
  elementId?: string;
}

export interface CompileWarning {
  code: CompileWarningCode | string;
  message: string;
  elementId?: string;
}

export type CompileResult<T> =
  | {
      success: true;
      data: T;
      warnings: CompileWarning[];
    }
  | {
      success: false;
      errors: CompileError[];
      warnings: CompileWarning[];
    };
