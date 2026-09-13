/**
 * Performs controlled, shallow-to-medium flattening of nested objects.
 *
 * Example:
 *   { customer: { name: "Acme", code: "A1" }, tags: ["x", "y"] }
 * becomes:
 *   { "customer.name": "Acme", "customer.code": "A1", tags: ["x", "y"] }
 *
 * Rules:
 * - Plain nested objects are flattened using dot notation (e.g. parent.child).
 * - Arrays are PRESERVED as arrays (arbitrary array flattening is strictly avoided).
 * - Dates and primitives are preserved.
 */
export function flattenNestedRecord(
  record: Record<string, unknown>,
  prefix = '',
  maxDepth = 3
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(record)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      !(val instanceof Date) &&
      maxDepth > 0
    ) {
      const nested = flattenNestedRecord(val as Record<string, unknown>, fullKey, maxDepth - 1);
      Object.assign(result, nested);
    } else {
      result[fullKey] = val;
    }
  }

  return result;
}
