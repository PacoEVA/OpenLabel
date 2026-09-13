import { z } from 'zod';

/**
 * Policy governing how null, undefined, or empty values from external sources are handled.
 * - 'empty': Converts null/undefined to empty string ("").
 * - 'default': Uses the fallbackValue or the DataField's defaultValue if available.
 * - 'error': Throws/reports a validation error if the source value is null/undefined.
 */
export const NullHandlingPolicySchema = z.enum(['empty', 'default', 'error']);
export type NullHandlingPolicy = z.infer<typeof NullHandlingPolicySchema>;

/**
 * Mapping rule connecting an external dataset column to an internal DataField.
 */
export const FieldMappingRuleSchema = z.object({
  dataFieldId: z.string().uuid({ message: 'dataFieldId must be a valid UUID' }),
  dataFieldName: z.string().min(1, { message: 'dataFieldName cannot be empty' }),
  sourceColumnKey: z.string().min(1, { message: 'sourceColumnKey cannot be empty' }),
  nullHandling: NullHandlingPolicySchema.default('default'),
  fallbackValue: z.string().optional(),
});

export type FieldMappingRule = z.infer<typeof FieldMappingRuleSchema>;

/**
 * Collection of mapping rules with validation preventing duplicate mappings to the same DataField.
 */
export const FieldMappingSchema = z
  .object({
    rules: z.array(FieldMappingRuleSchema).default([]),
  })
  .refine(
    (mapping) => {
      const fieldIds = new Set<string>();
      for (const rule of mapping.rules) {
        if (fieldIds.has(rule.dataFieldId)) {
          return false;
        }
        fieldIds.add(rule.dataFieldId);
      }
      return true;
    },
    { message: 'Multiple mapping rules cannot target the same DataField ID' }
  )
  .refine(
    (mapping) => {
      const fieldNames = new Set<string>();
      for (const rule of mapping.rules) {
        if (fieldNames.has(rule.dataFieldName)) {
          return false;
        }
        fieldNames.add(rule.dataFieldName);
      }
      return true;
    },
    { message: 'Multiple mapping rules cannot target the same DataField name' }
  );

export type FieldMapping = z.infer<typeof FieldMappingSchema>;
