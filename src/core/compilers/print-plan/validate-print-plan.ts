import { PrintPlan } from './print-plan.types';
import { CompileResult, CompileError } from '../compile.types';

const TOLERANCE_MM = 0.05; // 50 microns tolerance for floating-point comparisons

/**
 * Validates a PrintPlan defensibly prior to passing it to any backend compiler.
 * Verifies page dimensions, element bounds, orthogonal rotations, and required attributes.
 */
export function validatePrintPlan(plan: PrintPlan): CompileResult<PrintPlan> {
  const errors: CompileError[] = [];
  const warnings = [...plan.warnings];

  // 1. Validate page dimensions
  if (plan.page.widthMm <= 0 || plan.page.heightMm <= 0) {
    errors.push({
      code: 'INVALID_DIMENSIONS',
      message: `PrintPlan page dimensions must be positive, got ${plan.page.widthMm}x${plan.page.heightMm} mm`,
    });
    return {
      success: false,
      errors,
      warnings,
    };
  }

  // 2. Validate elements
  for (const el of plan.elements) {
    // Basic coordinates and size
    if (el.xMm < 0 || el.yMm < 0) {
      errors.push({
        code: 'ELEMENT_OUT_OF_BOUNDS',
        message: `Element '${el.id}' has negative coordinates (${el.xMm}, ${el.yMm}) mm`,
        elementId: el.id,
      });
    }

    if (el.widthMm <= 0 || el.heightMm <= 0) {
      errors.push({
        code: 'INVALID_DIMENSIONS',
        message: `Element '${el.id}' must have positive dimensions, got ${el.widthMm}x${el.heightMm} mm`,
        elementId: el.id,
      });
    }

    // Rotation validation
    if (![0, 90, 180, 270].includes(el.rotation)) {
      errors.push({
        code: 'INVALID_DOCUMENT',
        message: `Element '${el.id}' has unsupported rotation angle ${el.rotation}°. Only 0, 90, 180, 270 are allowed.`,
        elementId: el.id,
      });
    }

    // Bounds checking against page dimensions
    const isRotated90or270 = el.rotation === 90 || el.rotation === 270;
    const effectiveWidth = isRotated90or270 ? el.heightMm : el.widthMm;
    const effectiveHeight = isRotated90or270 ? el.widthMm : el.heightMm;

    if (el.xMm + effectiveWidth > plan.page.widthMm + TOLERANCE_MM) {
      errors.push({
        code: 'ELEMENT_OUT_OF_BOUNDS',
        message: `Element '${el.id}' exceeds label width boundaries: ${el.xMm} + ${effectiveWidth} = ${(el.xMm + effectiveWidth).toFixed(2)} mm > ${plan.page.widthMm} mm`,
        elementId: el.id,
      });
    }

    if (el.yMm + effectiveHeight > plan.page.heightMm + TOLERANCE_MM) {
      errors.push({
        code: 'ELEMENT_OUT_OF_BOUNDS',
        message: `Element '${el.id}' exceeds label height boundaries: ${el.yMm} + ${effectiveHeight} = ${(el.yMm + effectiveHeight).toFixed(2)} mm > ${plan.page.heightMm} mm`,
        elementId: el.id,
      });
    }

    // Type-specific sanity checks
    if (el.type === 'text' && typeof el.content !== 'string') {
      errors.push({
        code: 'INVALID_DOCUMENT',
        message: `Text element '${el.id}' content must be a string`,
        elementId: el.id,
      });
    }

    if (el.type === 'barcode' && (!el.data || el.data.length === 0)) {
      errors.push({
        code: 'BARCODE_INVALID',
        message: `Barcode element '${el.id}' data cannot be empty`,
        elementId: el.id,
      });
    }

    if (el.type === 'line' && el.strokeWidthMm <= 0) {
      errors.push({
        code: 'INVALID_DIMENSIONS',
        message: `Line element '${el.id}' strokeWidth must be greater than 0 mm`,
        elementId: el.id,
      });
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
      warnings,
    };
  }

  return {
    success: true,
    data: plan,
    warnings,
  };
}
