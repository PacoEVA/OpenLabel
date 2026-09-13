import type { DocumentWarning } from '../document.types';
import type { LabelMigration } from './migration.types';

export interface MigrationRunResult {
  readonly success: boolean;
  readonly document?: unknown;
  readonly migrated: boolean;
  readonly warnings: DocumentWarning[];
  readonly error?: string;
}

const registeredMigrations: LabelMigration[] = [];

/**
 * Registers a new migration step into the sequential pipeline.
 */
export function registerMigration(migration: LabelMigration): void {
  // Prevent duplicate migrations for the same step
  const exists = registeredMigrations.some(
    (m) => m.fromVersion === migration.fromVersion && m.toVersion === migration.toVersion
  );
  if (!exists) {
    registeredMigrations.push(migration);
    // Keep migrations sorted by fromVersion
    registeredMigrations.sort((a, b) => a.fromVersion - b.fromVersion);
  }
}

/**
 * Clears registered migrations (primarily for test isolation).
 */
export function clearMigrations(): void {
  registeredMigrations.length = 0;
}

/**
 * Runs a deterministic, sequential migration path from fromVersion to targetVersion.
 */
export function runDocumentMigrations(
  rawDocument: unknown,
  fromVersion: number,
  targetVersion: number,
  migrations: LabelMigration[] = registeredMigrations
): MigrationRunResult {
  if (fromVersion === targetVersion) {
    return {
      success: true,
      document: rawDocument,
      migrated: false,
      warnings: [],
    };
  }

  if (fromVersion > targetVersion) {
    return {
      success: false,
      migrated: false,
      warnings: [],
      error: `Downgrade from v${fromVersion} to v${targetVersion} is not supported.`,
    };
  }

  let currentDoc = rawDocument;
  let currentVersion = fromVersion;
  const accumulatedWarnings: DocumentWarning[] = [];

  while (currentVersion < targetVersion) {
    const nextVersion = currentVersion + 1;
    const step = migrations.find(
      (m) => m.fromVersion === currentVersion && m.toVersion === nextVersion
    );

    if (!step) {
      return {
        success: false,
        migrated: currentVersion > fromVersion,
        warnings: accumulatedWarnings,
        error: `Missing migration step from format v${currentVersion} to v${nextVersion}.`,
      };
    }

    const stepResult = step.migrate(currentDoc);
    if (!stepResult.success) {
      return {
        success: false,
        migrated: currentVersion > fromVersion,
        warnings: accumulatedWarnings,
        error: stepResult.error ?? `Migration failed at step v${currentVersion} -> v${nextVersion}.`,
      };
    }

    if (stepResult.warnings) {
      accumulatedWarnings.push(...stepResult.warnings);
    }

    currentDoc = stepResult.document;
    currentVersion = nextVersion;
  }

  return {
    success: true,
    document: currentDoc,
    migrated: true,
    warnings: accumulatedWarnings,
  };
}
