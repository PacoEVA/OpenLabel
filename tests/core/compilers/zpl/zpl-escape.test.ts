import { describe, it, expect } from 'vitest';
import { escapeZplFieldData } from '../../../../src/core/compilers/zpl/zpl-escape';

describe('ZPL Escaping & Injection Protection', () => {
  it('should preserve standard safe alphanumeric text', () => {
    expect(escapeZplFieldData('HELLO')).toBe('HELLO');
    expect(escapeZplFieldData('Part-10492/B')).toBe('Part-10492/B');
  });

  it('should neutralize end-of-label injection (ABC^XZ)', () => {
    const escaped = escapeZplFieldData('ABC^XZ');
    expect(escaped).toBe('ABC_5eXZ');
    // Ensure raw caret is not present in output
    expect(escaped).not.toContain('^');
  });

  it('should neutralize cancel-all-jobs command injection (~JA)', () => {
    const escaped = escapeZplFieldData('~JA');
    expect(escaped).toBe('_7eJA');
    expect(escaped).not.toContain('~');
  });

  it('should neutralize save-settings command injection (^XA^JUS^XZ)', () => {
    const escaped = escapeZplFieldData('^XA^JUS^XZ');
    expect(escaped).toBe('_5eXA_5eJUS_5eXZ');
    expect(escaped).not.toContain('^');
  });

  it('should escape underscore (_) to prevent collisions with hex decoder', () => {
    const escaped = escapeZplFieldData('ORDER_NUMBER_123');
    expect(escaped).toBe('ORDER_5fNUMBER_5f123');
  });

  it('should safely escape newlines and carriage returns', () => {
    const escaped = escapeZplFieldData('Line 1\r\nLine 2');
    expect(escaped).toBe('Line 1_0d_0aLine 2');
  });

  it('should escape non-printable ASCII control characters', () => {
    const withNullAndBell = `A\x00B\x07C`;
    const escaped = escapeZplFieldData(withNullAndBell);
    expect(escaped).toBe('A_00B_07C');
  });

  it('should return empty string for empty input or non-string input', () => {
    expect(escapeZplFieldData('')).toBe('');
    // @ts-expect-error test invalid types
    expect(escapeZplFieldData(null)).toBe('');
  });
});
