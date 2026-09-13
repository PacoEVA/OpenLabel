/**
 * OpenLabels - ZPL Field Data Escaping & Injection Protection
 * Safely escapes user input for ZPL ^FD fields using ^FH (Field Hex) notation.
 *
 * In ZPL II, when ^FH is active:
 * - '_' indicates a 2-digit hex sequence (_xx).
 * - '^' is the command delimiter (e.g. ^FS, ^XZ).
 * - '~' is the immediate command prefix (e.g. ~JA, ~SD).
 *
 * Escaping caret, tilde, underscore, and control characters ensures that user payloads
 * can never prematurely terminate field data or execute arbitrary printer commands.
 */

export function escapeZplFieldData(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    return '';
  }

  let result = '';
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    const code = raw.charCodeAt(i);

    if (char === '_') {
      result += '_5f';
    } else if (char === '^') {
      result += '_5e';
    } else if (char === '~') {
      result += '_7e';
    } else if (char === '\n') {
      result += '_0a';
    } else if (char === '\r') {
      result += '_0d';
    } else if (code < 32 || code === 127) {
      // Escape other ASCII control characters as 2-digit hex
      result += `_${code.toString(16).padStart(2, '0')}`;
    } else {
      result += char;
    }
  }

  return result;
}
