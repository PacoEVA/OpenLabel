import { describe, it, expect } from 'vitest';
import {
  resolveCounterValue,
  resolveCountersForRecord,
} from '../../../src/core/data/counter-engine';
import { CounterField } from '../../../src/core/data/data.schema';

describe('resolveCounterValue', () => {
  const baseCounter: CounterField = {
    id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
    name: 'serial',
    type: 'counter',
    start: 1,
    step: 1,
    padding: 4,
    prefix: 'SN-',
    suffix: '-QC',
  };

  it('resolves start value at record index 0', () => {
    const val = resolveCounterValue(baseCounter, 0);
    expect(val).toBe('SN-0001-QC');
  });

  it('respects step and generates sequential progression', () => {
    const counterWithStep: CounterField = {
      ...baseCounter,
      start: 10,
      step: 5,
      padding: 3,
      prefix: '',
      suffix: '',
    };

    expect(resolveCounterValue(counterWithStep, 0)).toBe('010');
    expect(resolveCounterValue(counterWithStep, 1)).toBe('015');
    expect(resolveCounterValue(counterWithStep, 2)).toBe('020');
    expect(resolveCounterValue(counterWithStep, 3)).toBe('025');
  });

  it('handles zero padding properly when number exceeds padding length', () => {
    const smallPadding: CounterField = {
      ...baseCounter,
      start: 999,
      step: 1,
      padding: 2,
      prefix: 'ID:',
      suffix: undefined,
    };

    expect(resolveCounterValue(smallPadding, 0)).toBe('ID:999');
    expect(resolveCounterValue(smallPadding, 1)).toBe('ID:1000');
  });

  it('is strictly deterministic and does not mutate the counter definition', () => {
    const counterCopy = { ...baseCounter };
    const freezeCopy = Object.freeze({ ...baseCounter });

    // Call multiple times out of order
    const val1 = resolveCounterValue(freezeCopy, 2);
    const val0 = resolveCounterValue(freezeCopy, 0);
    const val1Again = resolveCounterValue(freezeCopy, 2);

    expect(val1).toBe('SN-0003-QC');
    expect(val0).toBe('SN-0001-QC');
    expect(val1Again).toBe('SN-0003-QC');
    expect(freezeCopy).toEqual(counterCopy);
  });

  it('throws error on negative or non-integer record index', () => {
    expect(() => resolveCounterValue(baseCounter, -1)).toThrow();
    expect(() => resolveCounterValue(baseCounter, 1.5)).toThrow();
  });
});

describe('resolveCountersForRecord', () => {
  it('resolves multiple counter fields for a record index', () => {
    const counterA: CounterField = {
      id: 'a81d4fae-7dec-11d0-a765-00a0c91e6bf6',
      name: 'item_no',
      type: 'counter',
      start: 100,
      step: 1,
      padding: 3,
    };
    const counterB: CounterField = {
      id: 'b81d4fae-7dec-11d0-a765-00a0c91e6bf6',
      name: 'batch_seq',
      type: 'counter',
      start: 1,
      step: 10,
      padding: 4,
      prefix: 'B',
    };

    const record0 = resolveCountersForRecord([counterA, counterB], 0);
    expect(record0).toEqual({
      item_no: '100',
      batch_seq: 'B0001',
    });

    const record1 = resolveCountersForRecord([counterA, counterB], 1);
    expect(record1).toEqual({
      item_no: '101',
      batch_seq: 'B0011',
    });
  });
});
