import { describe, it, expect } from 'vitest';
import { toZplOrientation } from '../../../../src/core/compilers/zpl/zpl-orientation';

describe('ZPL Orientation Mapping', () => {
  it('should map 0 degrees to Normal (N)', () => {
    expect(toZplOrientation(0)).toBe('N');
  });

  it('should map 90 degrees to Rotated (R)', () => {
    expect(toZplOrientation(90)).toBe('R');
  });

  it('should map 180 degrees to Inverted (I)', () => {
    expect(toZplOrientation(180)).toBe('I');
  });

  it('should map 270 degrees to Bottom-up (B)', () => {
    expect(toZplOrientation(270)).toBe('B');
  });

  it('should throw for unorthogonal or invalid angles', () => {
    // @ts-expect-error test invalid angle
    expect(() => toZplOrientation(45)).toThrow('Unsupported rotation angle');
  });
});
