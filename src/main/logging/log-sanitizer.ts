const SENSITIVE_KEY_REGEX = /(password|passwd|pwd|secret|token|bearer|apikey|api_key|credential|privatekey)/i;

/**
 * Recursively sanitizes data before writing to log files or diagnostics.
 * Prevents accidental logging of passwords, tokens, API keys, and unbounded buffers.
 */
export function sanitizeLogData(input: unknown, depth = 0): unknown {
  if (depth > 5) return '[Max Depth Exceeded]';
  if (input === null || input === undefined) return input;

  if (typeof input === 'string') {
    return sanitizeLogString(input);
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return input;
  }

  if (input instanceof Error) {
    return {
      name: input.name,
      message: sanitizeLogString(input.message),
      stack: input.stack ? sanitizeLogString(input.stack) : undefined,
    };
  }

  if (Array.isArray(input)) {
    if (input.length > 50) {
      return `[Array with ${input.length} items truncated]`;
    }
    return input.map((item) => sanitizeLogData(item, depth + 1));
  }

  if (typeof input === 'object') {
    // Check for binary buffer
    if (input instanceof Uint8Array || Buffer.isBuffer(input)) {
      return `[Binary buffer: ${input.length} bytes]`;
    }

    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEY_REGEX.test(k)) {
        clean[k] = '***REDACTED***';
      } else {
        clean[k] = sanitizeLogData(v, depth + 1);
      }
    }
    return clean;
  }

  return String(input);
}

/**
 * Sanitizes strings by replacing authorization tokens and passwords with redacted tokens.
 */
export function sanitizeLogString(str: string): string {
  if (!str) return '';

  // Truncate excessively long strings (e.g. raw PDF bytes or huge ZPL)
  if (str.length > 2048) {
    str = str.substring(0, 2048) + '... [TRUNCATED]';
  }

  return str
    .replace(/(password|passwd|pwd|secret|token|bearer|key)\s*[:=]\s*['"]?[^\s,;'"&]+['"]?/gi, '$1=***REDACTED***')
    .replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer ***REDACTED***');
}
