import { describe, it, expect, beforeEach } from 'vitest';
import {
  runDocumentMigrations,
  registerMigration,
  clearMigrations,
} from '../../../src/core/documents/migrations/migrate';
import type { LabelMigration } from '../../../src/core/documents/migrations/migration.types';

describe('Document Migrations Infrastructure (Bloque 2)', () => {
  beforeEach(() => {
    clearMigrations();
  });

  it('returns unchanged document when source and target versions match', () => {
    const raw = { title: 'No Migration Needed' };
    const res = runDocumentMigrations(raw, 1, 1);

    expect(res.success).toBe(true);
    expect(res.migrated).toBe(false);
    expect(res.document).toEqual(raw);
    expect(res.warnings).toHaveLength(0);
  });

  it('rejects version downgrades cleanly', () => {
    const raw = { title: 'Downgrade Attempt' };
    const res = runDocumentMigrations(raw, 3, 1);

    expect(res.success).toBe(false);
    expect(res.migrated).toBe(false);
    expect(res.error).toContain('Downgrade');
  });

  it('fails with clear error when a required migration step is missing in the chain', () => {
    const raw = { version: '0.9.0' };
    // Only register v2 -> v3, but we need v1 -> v3 (missing v1 -> v2)
    const v2ToV3: LabelMigration = {
      fromVersion: 2,
      toVersion: 3,
      migrate: (doc: unknown) => ({ success: true, document: doc }),
    };

    const res = runDocumentMigrations(raw, 1, 3, [v2ToV3]);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Missing migration step from format v1 to v2');
  });

  it('executes sequential, multi-step migrations deterministically', () => {
    const initial = {
      title: 'Legacy',
      oldFormat: true,
    };

    const step1: LabelMigration = {
      fromVersion: 1,
      toVersion: 2,
      migrate: (doc: unknown) => ({
        success: true,
        document: {
          ...(doc as Record<string, unknown>),
          v2Field: 'added-in-v2',
        },
        warnings: [{ code: 'V1_UPGRADE', message: 'Upgraded from v1' }],
      }),
    };

    const step2: LabelMigration = {
      fromVersion: 2,
      toVersion: 3,
      migrate: (doc: unknown) => ({
        success: true,
        document: {
          ...(doc as Record<string, unknown>),
          v3Field: 'added-in-v3',
        },
        warnings: [{ code: 'V2_UPGRADE', message: 'Upgraded from v2' }],
      }),
    };

    const res = runDocumentMigrations(initial, 1, 3, [step1, step2]);
    expect(res.success).toBe(true);
    expect(res.migrated).toBe(true);
    expect(res.document).toEqual({
      title: 'Legacy',
      oldFormat: true,
      v2Field: 'added-in-v2',
      v3Field: 'added-in-v3',
    });
    expect(res.warnings).toHaveLength(2);
    expect(res.warnings[0].code).toBe('V1_UPGRADE');
    expect(res.warnings[1].code).toBe('V2_UPGRADE');
  });

  it('fails gracefully when a migration step returns failure', () => {
    const brokenStep: LabelMigration = {
      fromVersion: 1,
      toVersion: 2,
      migrate: () => ({
        success: false,
        error: 'Corrupted legacy data cannot be transformed',
      }),
    };

    const res = runDocumentMigrations({}, 1, 2, [brokenStep]);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Corrupted legacy data');
  });
});
