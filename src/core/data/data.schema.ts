import { z } from 'zod';

/**
 * Valid format tokens for dates in OpenLabels.
 */
export const SUPPORTED_DATE_FORMATS = [
  'YYYY-MM-DD',
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'YYYYMMDD',
  'DD-MM-YYYY',
] as const;

export const DateFormatSchema = z.enum(SUPPORTED_DATE_FORMATS);
export type DateFormat = z.infer<typeof DateFormatSchema>;
export type SupportedDateFormat = DateFormat;

/**
 * Identifier naming convention for variable fields.
 * Must start with letter or underscore, followed by letters, digits or underscores.
 */
export const FIELD_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Relative date offset specification.
 */
export const DateOffsetSchema = z
  .object({
    days: z.number().int().optional(),
    months: z.number().int().optional(),
    years: z.number().int().optional(),
  })
  .refine(
    (offset) =>
      offset.days !== undefined ||
      offset.months !== undefined ||
      offset.years !== undefined,
    { message: 'DateOffset must specify at least one of: days, months, or years' }
  );

export type DateOffset = z.infer<typeof DateOffsetSchema>;

/**
 * Base schema shared by all data field variants.
 */
export const BaseFieldSchema = z.object({
  id: z.string().uuid({ message: 'Field id must be a valid UUID' }),
  name: z
    .string()
    .min(1, { message: 'Field name cannot be empty' })
    .regex(FIELD_NAME_REGEX, {
      message:
        'Field name must start with a letter or underscore and contain only alphanumeric characters and underscores',
    }),
});

/**
 * Static field representing a centralized constant value.
 */
export const StaticFieldSchema = BaseFieldSchema.extend({
  type: z.literal('static'),
  value: z.string(),
});

export type StaticField = z.infer<typeof StaticFieldSchema>;

/**
 * Input field representing runtime user-prompted data.
 */
export const InputFieldSchema = BaseFieldSchema.extend({
  type: z.literal('input'),
  required: z.boolean().default(true),
  defaultValue: z.string().optional(),
});

export type InputField = z.infer<typeof InputFieldSchema>;


/**
 * Date field supporting current timestamp or calculated relative offsets.
 */
export const DateFieldObjectSchema = BaseFieldSchema.extend({
  type: z.literal('date'),
  mode: z.enum(['now', 'relative']),
  offset: DateOffsetSchema.optional(),
  format: DateFormatSchema,
});

export const DateFieldSchema = DateFieldObjectSchema.refine(
  (field) => {
    if (field.mode === 'relative' && !field.offset) {
      return false;
    }
    return true;
  },
  { message: 'DateField in relative mode requires an offset specification' }
);

export type DateField = z.infer<typeof DateFieldSchema>;

/**
 * Counter field for generating progressive numeric sequences with optional padding and affixes.
 */
export const CounterFieldSchema = BaseFieldSchema.extend({
  type: z.literal('counter'),
  start: z.number().int({ message: 'Counter start must be an integer' }).default(1),
  step: z
    .number()
    .int({ message: 'Counter step must be an integer' })
    .min(1, { message: 'Counter step must be >= 1' })
    .default(1),
  padding: z
    .number()
    .int({ message: 'Counter padding must be an integer' })
    .min(0, { message: 'Counter padding must be >= 0' })
    .default(0),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
});

export type CounterField = z.infer<typeof CounterFieldSchema>;

/**
 * Discriminated union of all supported DataField variants.
 */
export const DataFieldSchema = z
  .discriminatedUnion('type', [
    StaticFieldSchema,
    InputFieldSchema,
    DateFieldObjectSchema,
    CounterFieldSchema,
  ])
  .refine(
    (field) => {
      if (field.type === 'date' && field.mode === 'relative' && !field.offset) {
        return false;
      }
      return true;
    },
    { message: 'DateField in relative mode requires an offset specification' }
  );

export type DataField = z.infer<typeof DataFieldSchema>;

/**
 * LabelDataModel schema containing all defined fields with strict name uniqueness validation.
 */
export const LabelDataModelSchema = z
  .object({
    fields: z.array(DataFieldSchema).default([]),
  })
  .refine(
    (model) => {
      const names = new Set<string>();
      for (const field of model.fields) {
        if (names.has(field.name)) {
          return false;
        }
        names.add(field.name);
      }
      return true;
    },
    { message: 'Field names must be unique within the data model' }
  )
  .refine(
    (model) => {
      const ids = new Set<string>();
      for (const field of model.fields) {
        if (ids.has(field.id)) {
          return false;
        }
        ids.add(field.id);
      }
      return true;
    },
    { message: 'Field ids must be unique within the data model' }
  );

export type LabelDataModel = z.infer<typeof LabelDataModelSchema>;
