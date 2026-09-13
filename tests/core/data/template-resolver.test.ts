import { describe, it, expect } from 'vitest';
import {
  resolveTemplate,
  resolveStaticAndInputFields,
  ResolvedRecord,
} from '../../../src/core/data/template-resolver';
import { StaticField, InputField } from '../../../src/core/data/data.schema';

describe('resolveTemplate', () => {
  it('resolves static and input values correctly', () => {
    const record: ResolvedRecord = {
      product: 'ACME Anvil',
      batch: 'B-2026',
    };
    const template = 'Product: {product} | Batch: {batch}';
    const result = resolveTemplate(template, record);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe('Product: ACME Anvil | Batch: B-2026');
    }
  });

  it('fails with typed error on missing field value (never returns empty string silently)', () => {
    const record: ResolvedRecord = {
      product: 'Widget',
    };
    const template = 'Product: {product}, Serial: {serial}';
    const result = resolveTemplate(template, record);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('MISSING_FIELD_VALUE');
      expect(result.error.fieldName).toBe('serial');
      expect(result.error.message).toContain("Missing value for field 'serial'");
    }
  });

  it('fails with PARSER_ERROR if template is malformed', () => {
    const record: ResolvedRecord = { foo: 'bar' };
    const result = resolveTemplate('{unclosed_template', record);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('PARSER_ERROR');
    }
  });

  it('preserves escaped braces correctly', () => {
    const record: ResolvedRecord = { code: '123' };
    const template = 'Payload: {{"id": {code}}}';
    const result = resolveTemplate(template, record);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe('Payload: {"id": 123}');
    }
  });
});

describe('resolveStaticAndInputFields', () => {
  const staticField: StaticField = {
    id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
    name: 'company',
    type: 'static',
    value: 'Global Industries',
  };

  const requiredInput: InputField = {
    id: 'a81d4fae-7dec-11d0-a765-00a0c91e6bf7',
    name: 'operator',
    type: 'input',
    required: true,
  };

  const optionalInputWithDefault: InputField = {
    id: 'b81d4fae-7dec-11d0-a765-00a0c91e6bf8',
    name: 'shift',
    type: 'input',
    required: false,
    defaultValue: 'Morning',
  };

  it('resolves static fields and inputs with values provided', () => {
    const result = resolveStaticAndInputFields(
      [staticField, requiredInput, optionalInputWithDefault],
      { operator: 'Alice', shift: 'Night' }
    );

    expect(result.success).toBe(true);
    expect(result.record).toEqual({
      company: 'Global Industries',
      operator: 'Alice',
      shift: 'Night',
    });
  });

  it('uses defaultValue when optional input is not provided', () => {
    const result = resolveStaticAndInputFields(
      [staticField, requiredInput, optionalInputWithDefault],
      { operator: 'Bob' }
    );

    expect(result.success).toBe(true);
    expect(result.record.shift).toBe('Morning');
  });

  it('reports error when required input field is not provided', () => {
    const result = resolveStaticAndInputFields(
      [staticField, requiredInput, optionalInputWithDefault],
      {} // missing operator
    );

    expect(result.success).toBe(false);
    expect(result.errors).toContain("Required input field 'operator' is missing");
  });
});
