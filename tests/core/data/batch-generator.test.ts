import { describe, it, expect } from 'vitest';
import {
  generateRecords,
  BATCH_LIMITS,
} from '../../../src/core/data/batch-generator';
import { DataField } from '../../../src/core/data/data.schema';

describe('generateRecords', () => {
  const fixedNow = new Date(2026, 4, 1); // 2026-05-01
  const context = { now: fixedNow };

  const fields: DataField[] = [
    {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf1',
      name: 'product',
      type: 'static',
      value: 'Premium Widget',
    },
    {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf2',
      name: 'lot',
      type: 'input',
      required: true,
    },
    {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf3',
      name: 'mfg_date',
      type: 'date',
      mode: 'now',
      format: 'YYYY-MM-DD',
    },
    {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf4',
      name: 'serial',
      type: 'counter',
      start: 1,
      step: 1,
      padding: 4,
      prefix: 'SN-',
    },
  ];

  it('generates 1 record correctly', () => {
    const result = generateRecords({
      fields,
      count: 1,
      context,
      userInputs: { lot: 'LOT-99' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.records).toHaveLength(1);
      expect(result.records[0]).toEqual({
        product: 'Premium Widget',
        lot: 'LOT-99',
        mfg_date: '2026-05-01',
        serial: 'SN-0001',
      });
    }
  });

  it('generates 10 records with sequential counter progression and shared date', () => {
    const result = generateRecords({
      fields,
      count: 10,
      context,
      userInputs: { lot: 'LOT-99' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.records).toHaveLength(10);
      for (let i = 0; i < 10; i++) {
        expect(result.records[i].product).toBe('Premium Widget');
        expect(result.records[i].lot).toBe('LOT-99');
        expect(result.records[i].mfg_date).toBe('2026-05-01');
      }
      expect(result.records[0].serial).toBe('SN-0001');
      expect(result.records[4].serial).toBe('SN-0005');
      expect(result.records[9].serial).toBe('SN-0010');
    }
  });

  it('fails if count is less than 1, greater than max, or not an integer', () => {
    expect(
      generateRecords({ fields, count: 0, context, userInputs: { lot: 'A' } }).success
    ).toBe(false);

    expect(
      generateRecords({ fields, count: -5, context, userInputs: { lot: 'A' } }).success
    ).toBe(false);

    expect(
      generateRecords({ fields, count: 1.5, context, userInputs: { lot: 'A' } }).success
    ).toBe(false);

    expect(
      generateRecords({
        fields,
        count: BATCH_LIMITS.MAX_GENERATED_RECORDS + 1,
        context,
        userInputs: { lot: 'A' },
      }).success
    ).toBe(false);
  });

  it('fails if required input field is missing', () => {
    const result = generateRecords({
      fields,
      count: 5,
      context,
      userInputs: {}, // missing 'lot'
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0].code).toBe('REQUIRED_INPUT_MISSING');
    }
  });

  it('guarantees deterministic output given identical parameters', () => {
    const runA = generateRecords({
      fields,
      count: 5,
      context,
      userInputs: { lot: 'LOT-XYZ' },
    });

    const runB = generateRecords({
      fields,
      count: 5,
      context,
      userInputs: { lot: 'LOT-XYZ' },
    });

    expect(runA).toEqual(runB);
  });
});
