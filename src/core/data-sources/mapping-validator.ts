import { DataField } from '../data/data.schema';
import { ResolvedRecord } from '../data/template-resolver';
import { Dataset } from './dataset.schema';
import { FieldMapping, FieldMappingRule } from './field-mapping.schema';
import { normalizeExternalValue, NormalizationError } from './normalization';

export type MappingValidationErrorCode =
  | 'UNKNOWN_FIELD'
  | 'UNKNOWN_COLUMN'
  | 'DUPLICATE_FIELD_MAPPING'
  | 'REQUIRED_FIELD_UNMAPPED'
  | 'INVALID_RULE';

export interface MappingValidationError {
  code: MappingValidationErrorCode;
  message: string;
  fieldId?: string;
  fieldName?: string;
  columnKey?: string;
}

export interface MappingValidationResult {
  valid: boolean;
  errors: MappingValidationError[];
}

/**
 * Validates a FieldMapping configuration against a Dataset structure and Label DataFields.
 *
 * Catches:
 * - Non-existent data fields referenced in rules.
 * - Non-existent dataset columns referenced in rules.
 * - Duplicate mappings targeting the same DataField.
 * - Required DataFields that lack a mapping rule and have no default value.
 * - Inconsistent rules where field ID and name do not match the definition.
 */
export function validateFieldMapping(
  mapping: FieldMapping,
  dataset: Dataset,
  dataFields: DataField[]
): MappingValidationResult {
  const errors: MappingValidationError[] = [];

  const fieldById = new Map<string, DataField>();
  const fieldByName = new Map<string, DataField>();
  for (const field of dataFields) {
    fieldById.set(field.id, field);
    fieldByName.set(field.name, field);
  }

  const columnKeys = new Set(dataset.columns.map((col) => col.key));
  const mappedFieldIds = new Set<string>();
  const mappedFieldNames = new Set<string>();

  for (const rule of mapping.rules) {
    // 1. Check if column exists in dataset
    if (!columnKeys.has(rule.sourceColumnKey)) {
      errors.push({
        code: 'UNKNOWN_COLUMN',
        message: `Dataset column '${rule.sourceColumnKey}' does not exist in the source dataset`,
        columnKey: rule.sourceColumnKey,
        fieldId: rule.dataFieldId,
        fieldName: rule.dataFieldName,
      });
    }

    // 2. Check if DataField exists by ID and Name
    const fieldByIdMatch = fieldById.get(rule.dataFieldId);
    const fieldByNameMatch = fieldByName.get(rule.dataFieldName);

    if (!fieldByIdMatch && !fieldByNameMatch) {
      errors.push({
        code: 'UNKNOWN_FIELD',
        message: `Target field with id '${rule.dataFieldId}' and name '${rule.dataFieldName}' does not exist in data model`,
        fieldId: rule.dataFieldId,
        fieldName: rule.dataFieldName,
        columnKey: rule.sourceColumnKey,
      });
    } else if (fieldByIdMatch && !fieldByNameMatch) {
      errors.push({
        code: 'INVALID_RULE',
        message: `Rule targets field id '${rule.dataFieldId}', but expected name '${fieldByIdMatch.name}', found '${rule.dataFieldName}'`,
        fieldId: rule.dataFieldId,
        fieldName: rule.dataFieldName,
        columnKey: rule.sourceColumnKey,
      });
    } else if (!fieldByIdMatch && fieldByNameMatch) {
      errors.push({
        code: 'INVALID_RULE',
        message: `Rule targets field name '${rule.dataFieldName}', but expected id '${fieldByNameMatch.id}', found '${rule.dataFieldId}'`,
        fieldId: rule.dataFieldId,
        fieldName: rule.dataFieldName,
        columnKey: rule.sourceColumnKey,
      });
    } else if (fieldByIdMatch && fieldByNameMatch && fieldByIdMatch.id !== fieldByNameMatch.id) {
      errors.push({
        code: 'INVALID_RULE',
        message: `Conflicting field definition between id '${rule.dataFieldId}' and name '${rule.dataFieldName}'`,
        fieldId: rule.dataFieldId,
        fieldName: rule.dataFieldName,
        columnKey: rule.sourceColumnKey,
      });
    }

    // 3. Duplicate checks
    if (mappedFieldIds.has(rule.dataFieldId) || mappedFieldNames.has(rule.dataFieldName)) {
      errors.push({
        code: 'DUPLICATE_FIELD_MAPPING',
        message: `Duplicate mapping rule targeting field '${rule.dataFieldName}'`,
        fieldId: rule.dataFieldId,
        fieldName: rule.dataFieldName,
        columnKey: rule.sourceColumnKey,
      });
    }
    mappedFieldIds.add(rule.dataFieldId);
    mappedFieldNames.add(rule.dataFieldName);
  }

  // 4. Check for unmapped required fields
  for (const field of dataFields) {
    if (field.type === 'input' && field.required) {
      const isMapped = mappedFieldIds.has(field.id) || mappedFieldNames.has(field.name);
      const hasDefault = field.defaultValue !== undefined && field.defaultValue.trim() !== '';

      if (!isMapped && !hasDefault) {
        errors.push({
          code: 'REQUIRED_FIELD_UNMAPPED',
          message: `Required input field '${field.name}' is not mapped and has no default value`,
          fieldId: field.id,
          fieldName: field.name,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface ApplyMappingResult {
  success: boolean;
  record: ResolvedRecord;
  errors: string[];
}

/**
 * Transforms a single DatasetRow into a ResolvedRecord according to the FieldMapping rules.
 * Values are normalized using normalizeExternalValue and the designated NullHandlingPolicy.
 */
export function applyMappingToRow(
  row: Record<string, unknown>,
  mapping: FieldMapping,
  dataFields: DataField[]
): ApplyMappingResult {
  const record: ResolvedRecord = {};
  const errors: string[] = [];

  const fieldById = new Map<string, DataField>();
  for (const field of dataFields) {
    fieldById.set(field.id, field);
  }

  for (const rule of mapping.rules) {
    const rawVal = row[rule.sourceColumnKey];
    const field = fieldById.get(rule.dataFieldId);

    const defaultVal =
      rule.fallbackValue !== undefined && rule.fallbackValue !== ''
        ? rule.fallbackValue
        : field && field.type === 'input'
        ? field.defaultValue
        : undefined;

    try {
      const normalized = normalizeExternalValue(rawVal, {
        nullHandling: rule.nullHandling,
        defaultValue: defaultVal,
        columnName: rule.sourceColumnKey,
      });
      record[rule.dataFieldName] = normalized;
    } catch (err: unknown) {
      const msg = err instanceof NormalizationError ? err.message : String(err);
      errors.push(`Error mapping field '${rule.dataFieldName}': ${msg}`);
    }
  }

  return {
    success: errors.length === 0,
    record,
    errors,
  };
}
