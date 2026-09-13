import type { DocumentWarning } from '../document.types';

/**
 * Contract for a single sequential format migration step (e.g. v1 -> v2).
 */
export interface LabelMigration {
  readonly fromVersion: number;
  readonly toVersion: number;

  /**
   * Transforms raw document structure from fromVersion to toVersion.
   * Must be deterministic and pure.
   */
  migrate(rawDoc: unknown): {
    readonly success: boolean;
    readonly document?: unknown;
    readonly warnings?: DocumentWarning[];
    readonly error?: string;
  };
}
