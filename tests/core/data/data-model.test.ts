import { describe, it, expect } from 'vitest';
import {
  DataFieldSchema,
  LabelDataModelSchema,
  StaticField,
  InputField,
  DateField,
  CounterField,
} from '../../../src/core/data';

describe('DataField & LabelDataModel Schemas (Bloque 1)', () => {
  const validUUID = '11111111-1111-4111-8111-111111111111';
  const validUUID2 = '22222222-2222-4222-8222-222222222222';

  describe('StaticFieldSchema', () => {
    it('validates a valid static field', () => {
      const field: StaticField = {
        id: validUUID,
        name: 'plant_code',
        type: 'static',
        value: 'PLANT-42',
      };
      const result = DataFieldSchema.safeParse(field);
      expect(result.success).toBe(true);
    });

    it('rejects an invalid UUID', () => {
      const field = {
        id: 'not-a-uuid',
        name: 'plant_code',
        type: 'static',
        value: 'PLANT-42',
      };
      const result = DataFieldSchema.safeParse(field);
      expect(result.success).toBe(false);
    });
  });

  describe('Field Name Identifier Rules', () => {
    it('accepts valid identifier names', () => {
      const validNames = ['lot', 'serial_number', 'Product_123', '_private_field', 'X'];
      for (const name of validNames) {
        const field = {
          id: validUUID,
          name,
          type: 'static',
          value: 'val',
        };
        expect(DataFieldSchema.safeParse(field).success).toBe(true);
      }
    });

    it('rejects invalid field names', () => {
      const invalidNames = [
        '',
        '123serial', // starts with digit
        'lot-number', // contains hyphen
        'lot number', // contains space
        '{lot}', // contains braces
        'user.name', // contains dot
        'lot$special', // special characters
      ];
      for (const name of invalidNames) {
        const field = {
          id: validUUID,
          name,
          type: 'static',
          value: 'val',
        };
        const res = DataFieldSchema.safeParse(field);
        expect(res.success).toBe(false);
      }
    });
  });

  describe('InputFieldSchema', () => {
    it('validates a required input field with default value', () => {
      const field: InputField = {
        id: validUUID,
        name: 'operator_id',
        type: 'input',
        required: true,
        defaultValue: 'OP-01',
      };
      const result = DataFieldSchema.safeParse(field);
      expect(result.success).toBe(true);
    });
  });

  describe('DateFieldSchema', () => {
    it('validates now mode date field', () => {
      const field: DateField = {
        id: validUUID,
        name: 'print_date',
        type: 'date',
        mode: 'now',
        format: 'YYYY-MM-DD',
      };
      const result = DataFieldSchema.safeParse(field);
      expect(result.success).toBe(true);
    });

    it('validates relative mode date field with offset', () => {
      const field: DateField = {
        id: validUUID,
        name: 'expiry_date',
        type: 'date',
        mode: 'relative',
        offset: { days: 30, months: 1 },
        format: 'DD/MM/YYYY',
      };
      const result = DataFieldSchema.safeParse(field);
      expect(result.success).toBe(true);
    });

    it('rejects relative mode without an offset specification', () => {
      const field = {
        id: validUUID,
        name: 'expiry_date',
        type: 'date',
        mode: 'relative',
        format: 'DD/MM/YYYY',
      };
      const result = DataFieldSchema.safeParse(field);
      expect(result.success).toBe(false);
    });

    it('rejects empty format', () => {
      const field = {
        id: validUUID,
        name: 'now_date',
        type: 'date',
        mode: 'now',
        format: '',
      };
      const result = DataFieldSchema.safeParse(field);
      expect(result.success).toBe(false);
    });
  });

  describe('CounterFieldSchema', () => {
    it('validates a valid counter field configuration', () => {
      const field: CounterField = {
        id: validUUID,
        name: 'serial_counter',
        type: 'counter',
        start: 100,
        step: 5,
        padding: 6,
        prefix: 'SN-',
        suffix: '-A',
      };
      const result = DataFieldSchema.safeParse(field);
      expect(result.success).toBe(true);
    });

    it('rejects counter step less than 1', () => {
      const field = {
        id: validUUID,
        name: 'counter_bad',
        type: 'counter',
        start: 1,
        step: 0,
        padding: 4,
      };
      const result = DataFieldSchema.safeParse(field);
      expect(result.success).toBe(false);
    });

    it('rejects counter padding less than 0', () => {
      const field = {
        id: validUUID,
        name: 'counter_bad',
        type: 'counter',
        start: 1,
        step: 1,
        padding: -1,
      };
      const result = DataFieldSchema.safeParse(field);
      expect(result.success).toBe(false);
    });

    it('rejects non-integer counter start or step', () => {
      const fieldFloatStart = {
        id: validUUID,
        name: 'counter_bad',
        type: 'counter',
        start: 1.5,
        step: 1,
        padding: 4,
      };
      expect(DataFieldSchema.safeParse(fieldFloatStart).success).toBe(false);

      const fieldFloatStep = {
        id: validUUID,
        name: 'counter_bad',
        type: 'counter',
        start: 1,
        step: 2.5,
        padding: 4,
      };
      expect(DataFieldSchema.safeParse(fieldFloatStep).success).toBe(false);
    });
  });

  describe('LabelDataModelSchema', () => {
    it('validates a data model with distinct fields', () => {
      const model = {
        fields: [
          {
            id: validUUID,
            name: 'serial',
            type: 'counter',
            start: 1,
            step: 1,
            padding: 5,
          },
          {
            id: validUUID2,
            name: 'lot',
            type: 'input',
            required: true,
          },
        ],
      };
      const result = LabelDataModelSchema.safeParse(model);
      expect(result.success).toBe(true);
    });

    it('rejects duplicate field names within the data model', () => {
      const model = {
        fields: [
          {
            id: validUUID,
            name: 'serial',
            type: 'counter',
            start: 1,
            step: 1,
            padding: 5,
          },
          {
            id: validUUID2,
            name: 'serial', // Duplicate name
            type: 'static',
            value: 'ABC',
          },
        ],
      };
      const result = LabelDataModelSchema.safeParse(model);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('Field names must be unique');
    });

    it('rejects duplicate field IDs within the data model', () => {
      const model = {
        fields: [
          {
            id: validUUID,
            name: 'serial_1',
            type: 'counter',
            start: 1,
            step: 1,
            padding: 5,
          },
          {
            id: validUUID, // Duplicate ID
            name: 'serial_2',
            type: 'static',
            value: 'ABC',
          },
        ],
      };
      const result = LabelDataModelSchema.safeParse(model);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('Field ids must be unique');
    });
  });
});
