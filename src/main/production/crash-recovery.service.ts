import { ProductionPersistenceService } from './production-persistence.service';
import { reconcileInterruptedRun, type CrashReconciliationResult } from '../../core/production/crash-recovery';
import { type ProductionRun, type ProductionPlan } from '../../core/production';
import { type PrinterProfile } from '../../core/printing/printer-profile.schema';

export interface RecoveryValidationResult {
  canResume: boolean;
  error?: string;
}

/**
 * Service orchestrating crash recovery and startup reconciliation of active runs.
 */
export class CrashRecoveryService {
  private readonly persistence: ProductionPersistenceService;

  constructor(persistence?: ProductionPersistenceService) {
    this.persistence = persistence ?? new ProductionPersistenceService();
  }

  /**
   * Scans all persisted production runs on application startup.
   * Any runs found in 'running' or 'pausing' state are safely converted to 'interrupted'.
   * In-flight dispatching items are marked 'unknown' with duplicate warnings.
   * Non-dispatched items are reset to 'pending'.
   * Saves updated records back to disk.
   */
  public async reconcilePersistedRuns(): Promise<CrashReconciliationResult[]> {
    const records = await this.persistence.list();
    const results: CrashReconciliationResult[] = [];

    for (const record of records) {
      if (record.run.status === 'running' || record.run.status === 'pausing') {
        const res = reconcileInterruptedRun(record.run);
        if (res.recovered) {
          await this.persistence.save(record.plan, res.run);
          results.push(res);
        }
      }
    }

    return results;
  }

  /**
   * Validates whether an interrupted or paused run can safely resume with the given printer profile.
   */
  public validateResume(
    plan: ProductionPlan,
    run: ProductionRun,
    profile?: PrinterProfile | null
  ): RecoveryValidationResult {
    if (run.status !== 'interrupted' && run.status !== 'paused') {
      return {
        canResume: false,
        error: `Run cannot be resumed from status '${run.status}'. Must be 'interrupted' or 'paused'.`,
      };
    }

    if (!profile) {
      return {
        canResume: false,
        error: 'Target printer profile is missing or unavailable.',
      };
    }

    if (profile.id !== plan.printerProfileId) {
      return {
        canResume: false,
        error: `Printer profile mismatch: plan requires profile '${plan.printerProfileId}', received '${profile.id}'.`,
      };
    }

    return { canResume: true };
  }
}
