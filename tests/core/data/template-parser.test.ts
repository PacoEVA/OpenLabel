import { describe, it, expect } from 'vitest';
import {
  parseTemplate,
  extractFieldNames,
  renameFieldInTemplate,
} from '../../../src/core/data/template-parser';

describe('parseTemplate', () => {
  it('parses plain text without placeholders', () => {
    const result = parseTemplate('Hello World! 123');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.tokens).toEqual([{ type: 'text', value: 'Hello World! 123' }]);
      expect(result.fieldNames).toEqual([]);
    }
  });

  it('parses single placeholder', () => {
    const result = parseTemplate('{product_name}');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.tokens).toEqual([{ type: 'field', name: 'product_name' }]);
      expect(result.fieldNames).toEqual(['product_name']);
    }
  });

  it('parses text with multiple placeholders and intermixed text', () => {
    const result = parseTemplate('LOT: {lot} | SN: {serial_1} | EXP: {exp_date}');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.tokens).toEqual([
        { type: 'text', value: 'LOT: ' },
        { type: 'field', name: 'lot' },
        { type: 'text', value: ' | SN: ' },
        { type: 'field', name: 'serial_1' },
        { type: 'text', value: ' | EXP: ' },
        { type: 'field', name: 'exp_date' },
      ]);
      expect(result.fieldNames).toEqual(['lot', 'serial_1', 'exp_date']);
    }
  });

  it('deduplicates field names when placeholder appears multiple times', () => {
    const result = parseTemplate('{code}-{name}-{code}');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.fieldNames).toEqual(['code', 'name']);
    }
  });

  it('handles escaped braces {{ -> { and }} -> }', () => {
    const result = parseTemplate('JSON format: {{"key": "{value}"}}');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.tokens).toEqual([
        { type: 'text', value: 'JSON format: {"key": "' },
        { type: 'field', name: 'value' },
        { type: 'text', value: '"}' },
      ]);
      expect(result.fieldNames).toEqual(['value']);
    }
  });

  it('detects unclosed placeholder error', () => {
    const result = parseTemplate('Hello {unclosed');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('UNCLOSED_PLACEHOLDER');
      expect(result.errors[0].position).toBe(6);
    }
  });

  it('detects nested open brace error', () => {
    const result = parseTemplate('{foo{bar}');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0].code).toBe('UNCLOSED_PLACEHOLDER');
    }
  });

  it('detects empty placeholder {}', () => {
    const result = parseTemplate('Empty {} field');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0].code).toBe('EMPTY_PLACEHOLDER');
      expect(result.errors[0].position).toBe(6);
    }
  });

  it('detects invalid field identifiers in placeholders', () => {
    const cases = ['{123bad}', '{bad-kebab}', '{bad space}', '{bad.dot}'];
    for (const testCase of cases) {
      const result = parseTemplate(testCase);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('INVALID_FIELD_NAME');
      }
    }
  });

  it('detects unexpected closing brace', () => {
    const result = parseTemplate('Stray } closing brace');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0].code).toBe('UNEXPECTED_CLOSING_BRACE');
      expect(result.errors[0].position).toBe(6);
    }
  });
});

describe('extractFieldNames', () => {
  it('extracts unique field names from valid template', () => {
    expect(extractFieldNames('A: {field_a}, B: {field_b}, A again: {field_a}')).toEqual([
      'field_a',
      'field_b',
    ]);
  });

  it('returns empty array if template has syntax error', () => {
    expect(extractFieldNames('Broken {broken')).toEqual([]);
  });
});

describe('renameFieldInTemplate', () => {
  it('renames placeholder without affecting matching plain text', () => {
    const template = 'serial: {serial} (not serial)';
    const updated = renameFieldInTemplate(template, 'serial', 'serial_number');
    expect(updated).toBe('serial: {serial_number} (not serial)');
  });

  it('preserves escaped braces when reconstructing', () => {
    const template = 'Code: {{{code}}}'; // {{ = literal {, {code} = field, }} = literal }
    const updated = renameFieldInTemplate(template, 'code', 'barcode_id');
    expect(updated).toBe('Code: {{{barcode_id}}}');
  });

  it('returns original template unchanged if syntax is invalid', () => {
    const broken = 'Invalid {syntax';
    expect(renameFieldInTemplate(broken, 'syntax', 'fixed')).toBe(broken);
  });
});
