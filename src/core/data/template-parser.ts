import { FIELD_NAME_REGEX } from './data.schema';

export type TemplateToken =
  | { type: 'text'; value: string }
  | { type: 'field'; name: string };

export interface TemplateParseError {
  code:
    | 'UNCLOSED_PLACEHOLDER'
    | 'EMPTY_PLACEHOLDER'
    | 'INVALID_FIELD_NAME'
    | 'UNEXPECTED_CLOSING_BRACE';
  message: string;
  position: number;
}

export type ParseTemplateResult =
  | {
      success: true;
      tokens: TemplateToken[];
      fieldNames: string[];
    }
  | {
      success: false;
      errors: TemplateParseError[];
    };

/**
 * Tokenizes a template string into plain text and field references.
 *
 * Rules:
 * - Placeholders follow `{field_name}` syntax matching FIELD_NAME_REGEX.
 * - Literal braces are escaped via `{{` -> `{` and `}}` -> `}`.
 * - Syntax errors (unclosed, empty, invalid identifier) are reported with exact positions.
 */
export function parseTemplate(template: string): ParseTemplateResult {
  const tokens: TemplateToken[] = [];
  const errors: TemplateParseError[] = [];
  let textBuffer = '';
  let i = 0;
  const len = template.length;

  const flushText = () => {
    if (textBuffer.length > 0) {
      tokens.push({ type: 'text', value: textBuffer });
      textBuffer = '';
    }
  };

  while (i < len) {
    const ch = template[i];
    const nextCh = i + 1 < len ? template[i + 1] : null;

    // Escaped open brace: {{ -> {
    if (ch === '{' && nextCh === '{') {
      textBuffer += '{';
      i += 2;
      continue;
    }

    // Escaped close brace: }} -> }
    if (ch === '}' && nextCh === '}') {
      textBuffer += '}';
      i += 2;
      continue;
    }

    // Open placeholder: {
    if (ch === '{') {
      const openPos = i;
      const closePos = template.indexOf('}', i + 1);

      if (closePos === -1) {
        errors.push({
          code: 'UNCLOSED_PLACEHOLDER',
          message: `Unclosed placeholder starting at index ${openPos}`,
          position: openPos,
        });
        break;
      }

      const rawContent = template.slice(openPos + 1, closePos);

      // Check for nested open brace inside placeholder, e.g. {foo{bar}
      if (rawContent.includes('{')) {
        errors.push({
          code: 'UNCLOSED_PLACEHOLDER',
          message: `Malformed placeholder with nested open brace at index ${openPos}`,
          position: openPos,
        });
        break;
      }

      if (rawContent.length === 0) {
        errors.push({
          code: 'EMPTY_PLACEHOLDER',
          message: `Empty placeholder '{}' at index ${openPos}`,
          position: openPos,
        });
        i = closePos + 1;
        continue;
      }

      if (!FIELD_NAME_REGEX.test(rawContent)) {
        errors.push({
          code: 'INVALID_FIELD_NAME',
          message: `Invalid field identifier '${rawContent}' in placeholder at index ${openPos}`,
          position: openPos,
        });
        i = closePos + 1;
        continue;
      }

      // Valid placeholder
      flushText();
      tokens.push({ type: 'field', name: rawContent });
      i = closePos + 1;
      continue;
    }

    // Unexpected stray closing brace
    if (ch === '}') {
      errors.push({
        code: 'UNEXPECTED_CLOSING_BRACE',
        message: `Unexpected closing brace '}' at index ${i}`,
        position: i,
      });
      i++;
      continue;
    }

    // Regular character
    textBuffer += ch;
    i++;
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  flushText();

  const fieldNames = Array.from(
    new Set(
      tokens
        .filter((t): t is { type: 'field'; name: string } => t.type === 'field')
        .map((t) => t.name)
    )
  );

  return {
    success: true,
    tokens,
    fieldNames,
  };
}

/**
 * Extracts all unique field names referenced within a template string.
 * Returns empty array if template contains syntax errors.
 */
export function extractFieldNames(template: string): string[] {
  const result = parseTemplate(template);
  return result.success ? result.fieldNames : [];
}

/**
 * Replaces references to oldName with newName safely using tokenization.
 * Literal text matching oldName is untouched.
 */
export function renameFieldInTemplate(
  template: string,
  oldName: string,
  newName: string
): string {
  const result = parseTemplate(template);
  if (!result.success) {
    return template;
  }

  let reconstructed = '';
  for (const token of result.tokens) {
    if (token.type === 'text') {
      // Escape braces in literal text when reconstructing
      const escaped = token.value.replace(/\{/g, '{{').replace(/\}/g, '}}');
      reconstructed += escaped;
    } else if (token.type === 'field') {
      const targetName = token.name === oldName ? newName : token.name;
      reconstructed += `{${targetName}}`;
    }
  }

  return reconstructed;
}
