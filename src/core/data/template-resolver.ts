import { parseTemplate } from './template-parser';
import { DataField } from './data.schema';

export type ResolvedRecord = Record<string, string>;

export interface TemplateResolveError {
  code: 'PARSER_ERROR' | 'MISSING_FIELD_VALUE';
  message: string;
  fieldName?: string;
}

export type ResolveTemplateResult =
  | {
      success: true;
      value: string;
    }
  | {
      success: false;
      error: TemplateResolveError;
    };

/**
 * Resolves a template string by replacing placeholders with values from ResolvedRecord.
 *
 * Rules:
 * - Unclosed or malformed placeholders fail with PARSER_ERROR.
 * - Missing fields NEVER silently resolve to empty strings; they return MISSING_FIELD_VALUE error.
 * - Escaped braces ({{ -> {, }} -> }) are properly preserved from parseTemplate.
 */
export function resolveTemplate(
  template: string,
  record: ResolvedRecord
): ResolveTemplateResult {
  const parseResult = parseTemplate(template);
  if (!parseResult.success) {
    return {
      success: false,
      error: {
        code: 'PARSER_ERROR',
        message: parseResult.errors[0].message,
      },
    };
  }

  let result = '';
  for (const token of parseResult.tokens) {
    if (token.type === 'text') {
      result += token.value;
    } else if (token.type === 'field') {
      const val = record[token.name];
      if (val === undefined || val === null) {
        return {
          success: false,
          error: {
            code: 'MISSING_FIELD_VALUE',
            message: `Missing value for field '${token.name}' in template`,
            fieldName: token.name,
          },
        };
      }
      result += val;
    }
  }

  return {
    success: true,
    value: result,
  };
}

export interface ResolveStaticAndInputResult {
  success: boolean;
  record: ResolvedRecord;
  errors: string[];
}

/**
 * Evaluates static and input field definitions against user-supplied inputs.
 * Validates required inputs and applies default values.
 */
export function resolveStaticAndInputFields(
  fields: DataField[],
  userInputs: Record<string, string> = {}
): ResolveStaticAndInputResult {
  const record: ResolvedRecord = {};
  const errors: string[] = [];

  for (const field of fields) {
    if (field.type === 'static') {
      record[field.name] = field.value;
    } else if (field.type === 'input') {
      const provided = userInputs[field.name];
      if (provided !== undefined && provided !== null && provided.trim() !== '') {
        record[field.name] = provided;
      } else if (field.defaultValue !== undefined && field.defaultValue !== '') {
        record[field.name] = field.defaultValue;
      } else if (field.required) {
        errors.push(`Required input field '${field.name}' is missing`);
      } else {
        record[field.name] = '';
      }
    }
  }

  return {
    success: errors.length === 0,
    record,
    errors,
  };
}
