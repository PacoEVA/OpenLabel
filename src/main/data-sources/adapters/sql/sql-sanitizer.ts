import { SqlEngine } from '../../../../core/data-sources';

const FORBIDDEN_SQL_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'MERGE',
  'EXEC',
  'EXECUTE',
  'GRANT',
  'REVOKE',
  'BACKUP',
  'RESTORE',
  'SHUTDOWN',
  'XP_',
  'SP_',
];

/**
 * Validates that a user-provided SQL query is strictly a single, read-only SELECT statement.
 */
export function validateReadOnlyQuery(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim();
  if (!trimmed) {
    return { valid: false, error: 'SQL query cannot be empty' };
  }

  // 1. Check for multiple statements separated by semicolon
  // Strips single-quoted string literals to avoid false positives on ';' inside strings
  const withoutStrings = trimmed.replace(/'(?:''|[^'])*'/g, '');
  const statements = withoutStrings
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (statements.length > 1) {
    return {
      valid: false,
      error: 'Multiple SQL statements are strictly forbidden. Only a single query is allowed.',
    };
  }

  // 2. Must start with SELECT or WITH (for CTEs leading to SELECT)
  const normalizedStart = withoutStrings.trim().toUpperCase();
  if (!normalizedStart.startsWith('SELECT') && !normalizedStart.startsWith('WITH')) {
    return {
      valid: false,
      error: 'Query must be a read-only SELECT statement.',
    };
  }

  // 3. Scan for forbidden modification/administrative keywords as whole tokens
  const upperSql = withoutStrings.toUpperCase();
  for (const keyword of FORBIDDEN_SQL_KEYWORDS) {
    // Regex matching keyword surrounded by word boundaries or whitespace
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(upperSql)) {
      return {
        valid: false,
        error: `Query contains forbidden modification or administrative keyword '${keyword}'. Only read-only queries are permitted.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Escapes database identifiers (table or column names) securely according to engine syntax.
 */
export function escapeSqlIdentifier(name: string, engine: SqlEngine = 'mssql'): string {
  const cleanName = name.trim();
  if (engine === 'mssql') {
    // Escape ']' by doubling it ']]' and wrap in brackets
    return `[${cleanName.replace(/\]/g, ']]')}]`;
  }
  // Standard SQL / Postgres / MySQL double quotes
  return `"${cleanName.replace(/"/g, '""')}"`;
}

/**
 * Sanitizes error messages by scrubbing any occurrences of passwords, tokens, or raw credentials.
 */
export function sanitizeSqlErrorMessage(error: unknown, secret?: string | null): string {
  let msg = error instanceof Error ? error.message : String(error);

  if (secret && secret.trim().length > 0) {
    // Replace all occurrences of secret with asterisks
    msg = msg.split(secret).join('******');
  }

  // Scrub common password patterns like password=..., pwd=...
  msg = msg.replace(/(password|pwd)\s*=\s*[^\s;]+/gi, '$1=******');

  return msg;
}
