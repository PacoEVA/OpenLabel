import { describe, it, expect } from 'vitest';
import { validateDataMatrix, DATAMATRIX_MAX_CHARS } from '../../../src/core/barcodes/symbologies/datamatrix';

describe('Pure Data Matrix Domain Validation', () => {
  it('should accept valid payload for Data Matrix ECC 200', () => {
    const res = validateDataMatrix('(01)08412345678908(17)261231(10)LOT-9988');
    expect(res.valid).toBe(true);
    expect(res.normalizedData).toBe('(01)08412345678908(17)261231(10)LOT-9988');
  });

  it('should reject empty payload', () => {
    const res = validateDataMatrix('');
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe('INVALID_DATA');
    expect(res.error).toContain('cannot be empty');
  });

  it('should reject payload exceeding maximum character capacity', () => {
    const tooLong = 'D'.repeat(DATAMATRIX_MAX_CHARS + 1);
    const res = validateDataMatrix(tooLong);
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe('INVALID_LENGTH');
    expect(res.error).toContain('exceeds maximum capacity');
  });
});
