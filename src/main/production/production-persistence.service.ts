import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import {
  type ProductionRun,
  type ProductionPlan,
  ProductionRunSchema,
  ProductionPlanSchema,
} from '../../core/production';
import { atomicWriteFile } from '../documents/document.service';
import { z } from 'zod';

export const PersistedProductionRecordSchema = z.object({
  plan: ProductionPlanSchema,
  run: ProductionRunSchema,
  savedAt: z.string().datetime(),
});
export type PersistedProductionRecord = z.infer<typeof PersistedProductionRecordSchema>;

/**
 * Service providing durable, atomic file-based persistence for ProductionRuns and Plans.
 *
 * Guarantees:
 * - Atomic file replacement via temporary files (prevents corrupt runs on unexpected shutdown).
 * - Stores plan snapshots, item states, progress counters, errors, and printJob references.
 * - Excludes heavy binary artifacts (PDF bytes, ZPL strings).
 */
export class ProductionPersistenceService {
  private readonly dirPath: string;

  constructor(customDirPath?: string) {
    if (customDirPath) {
      this.dirPath = customDirPath;
    } else {
      try {
        const userData = app.getPath('userData');
        this.dirPath = path.join(userData, 'production-runs');
      } catch {
        this.dirPath = path.join(process.cwd(), '.production-runs');
      }
    }
  }

  public getDirectoryPath(): string {
    return this.dirPath;
  }

  private async ensureDir(): Promise<void> {
    if (!fs.existsSync(this.dirPath)) {
      await fs.promises.mkdir(this.dirPath, { recursive: true });
    }
  }

  /**
   * Persists a ProductionRun and its corresponding ProductionPlan snapshot atomically.
   */
  public async save(plan: ProductionPlan, run: ProductionRun): Promise<void> {
    await this.ensureDir();

    const record: PersistedProductionRecord = {
      plan,
      run,
      savedAt: new Date().toISOString(),
    };

    const validated = PersistedProductionRecordSchema.parse(record);
    const targetFile = path.join(this.dirPath, `${run.id}.json`);
    const serialized = JSON.stringify(validated, null, 2);

    await atomicWriteFile(targetFile, serialized);
  }

  /**
   * Loads a persisted record by runId.
   */
  public async load(runId: string): Promise<PersistedProductionRecord | null> {
    const filePath = path.join(this.dirPath, `${runId}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const json = JSON.parse(content);
      return PersistedProductionRecordSchema.parse(json);
    } catch {
      return null;
    }
  }

  /**
   * Lists all persisted production runs sorted by savedAt descending.
   */
  public async list(): Promise<PersistedProductionRecord[]> {
    await this.ensureDir();

    const entries = await fs.promises.readdir(this.dirPath);
    const records: PersistedProductionRecord[] = [];

    for (const entry of entries) {
      if (entry.endsWith('.json') && !entry.startsWith('.')) {
        const filePath = path.join(this.dirPath, entry);
        try {
          const content = await fs.promises.readFile(filePath, 'utf8');
          const json = JSON.parse(content);
          const parsed = PersistedProductionRecordSchema.safeParse(json);
          if (parsed.success) {
            records.push(parsed.data);
          }
        } catch {
          // Ignore corrupt entry
        }
      }
    }

    // Sort descending by savedAt
    records.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    return records;
  }

  /**
   * Deletes a persisted production run file.
   */
  public async delete(runId: string): Promise<boolean> {
    const filePath = path.join(this.dirPath, `${runId}.json`);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  }
}
