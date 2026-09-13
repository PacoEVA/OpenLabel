import { BrowserWindow } from 'electron';
import {
  type ProductionPlan,
  type ProductionRun,
  type CreateProductionPlanInput,
  createProductionPlan,
  createProductionRun,
} from '../../core/production';
import { type PrinterProfile } from '../../core/printing/printer-profile.schema';
import { ProductionCoordinator, type IPrintQueue } from './production-coordinator';
import { ProductionPersistenceService, type PersistedProductionRecord } from './production-persistence.service';
import { CrashRecoveryService } from './crash-recovery.service';
import { type PrinterProfileStore } from '../printing/printer-profile.store';

export interface ProductionServiceOptions {
  queue: IPrintQueue;
  profileStore: PrinterProfileStore;
  persistence?: ProductionPersistenceService;
  recovery?: CrashRecoveryService;
  maxInFlight?: number;
  pdfRendererOverride?: (
    doc: import('../../core/schemas/label.schema').LabelDocument
  ) => Promise<import('../../core/compilers/compile.types').CompileResult<Uint8Array>>;
}

/**
 * Main-Process domain service orchestrating massive production batches.
 *
 * Enforces:
 * - Backpressure via bounded in-flight ProductionCoordinators.
 * - Idempotent start operations (double-click / double-IPC start protection).
 * - Automatic checkpoint persistence on all status/item changes.
 * - Startup crash recovery reconciliation.
 * - Isolated Main-to-Renderer IPC broadcasts.
 */
export class ProductionService {
  private readonly queue: IPrintQueue;
  private readonly profileStore: PrinterProfileStore;
  private readonly persistence: ProductionPersistenceService;
  private readonly recovery: CrashRecoveryService;
  private readonly maxInFlight: number;
  private readonly pdfRendererOverride?: (
    doc: import('../../core/schemas/label.schema').LabelDocument
  ) => Promise<import('../../core/compilers/compile.types').CompileResult<Uint8Array>>;

  private readonly coordinators = new Map<string, ProductionCoordinator>();
  private readonly plans = new Map<string, ProductionPlan>();

  constructor(options: ProductionServiceOptions) {
    this.queue = options.queue;
    this.profileStore = options.profileStore;
    this.persistence = options.persistence ?? new ProductionPersistenceService();
    this.recovery = options.recovery ?? new CrashRecoveryService(this.persistence);
    this.maxInFlight = Math.max(1, options.maxInFlight ?? 5);
    this.pdfRendererOverride = options.pdfRendererOverride;
  }

  /**
   * Initializes the service, performing crash reconciliation for any active runs from previous app sessions.
   */
  public async initialize(): Promise<void> {
    await this.recovery.reconcilePersistedRuns();
  }

  /**
   * Prepares and creates an immutable snapshot-frozen ProductionPlan.
   */
  public createPlan(input: CreateProductionPlanInput): ProductionPlan {
    const plan = createProductionPlan(input);
    this.plans.set(plan.id, plan);
    return plan;
  }

  /**
   * Instantiates a new ProductionRun in 'ready' state from a ProductionPlan and persists it.
   */
  public async createRun(plan: ProductionPlan): Promise<ProductionRun> {
    this.plans.set(plan.id, plan);
    const run = createProductionRun(plan);
    await this.persistence.save(plan, run);
    return run;
  }

  /**
   * Starts a ProductionRun.
   * Idempotent: If run is already active, returns current run without creating duplicate coordinators.
   */
  public async startRun(runId: string): Promise<ProductionRun> {
    let coordinator = this.coordinators.get(runId);

    if (coordinator) {
      const currentRun = coordinator.getRun();
      if (currentRun.status === 'running') {
        return currentRun; // Double-start protection: already running
      }
      if (currentRun.status === 'paused' || currentRun.status === 'interrupted') {
        await coordinator.resume();
        return coordinator.getRun();
      }
      if (currentRun.status === 'ready') {
        await coordinator.start();
        return coordinator.getRun();
      }
      throw new Error(`Cannot start production run with status '${currentRun.status}'`);
    }

    // Load from persistence or cache
    const persisted = await this.persistence.load(runId);
    if (!persisted) {
      throw new Error(`Production run '${runId}' not found`);
    }

    const { plan, run } = persisted;
    this.plans.set(plan.id, plan);

    const profile = this.profileStore.get(plan.printerProfileId);
    if (!profile) {
      throw new Error(`Printer profile '${plan.printerProfileId}' not found or unavailable`);
    }

    coordinator = new ProductionCoordinator(plan, profile, this.queue, {
      existingRun: run,
      maxInFlight: this.maxInFlight,
      pdfRendererOverride: this.pdfRendererOverride,
      onCheckpoint: async (p, r) => {
        await this.persistence.save(p, r);
      },
    });

    this.coordinators.set(runId, coordinator);
    this.attachCoordinatorListeners(coordinator);

    await coordinator.start();
    return coordinator.getRun();
  }

  /**
   * Pauses an active ProductionRun gracefully.
   */
  public pauseRun(runId: string): ProductionRun {
    const coordinator = this.getRequiredCoordinator(runId);
    coordinator.pause();
    return coordinator.getRun();
  }

  /**
   * Resumes a paused or interrupted ProductionRun.
   */
  public async resumeRun(runId: string): Promise<ProductionRun> {
    let coordinator = this.coordinators.get(runId);

    if (!coordinator) {
      // Restore from persistence if not currently in memory
      const persisted = await this.persistence.load(runId);
      if (!persisted) {
        throw new Error(`Production run '${runId}' not found`);
      }

      const { plan, run } = persisted;
      const profile = this.profileStore.get(plan.printerProfileId);

      const validation = this.recovery.validateResume(plan, run, profile);
      if (!validation.canResume || !profile) {
        throw new Error(validation.error || 'Cannot resume run: printer profile unavailable');
      }

      coordinator = new ProductionCoordinator(plan, profile, this.queue, {
        existingRun: run,
        maxInFlight: this.maxInFlight,
        pdfRendererOverride: this.pdfRendererOverride,
        onCheckpoint: async (p, r) => {
          await this.persistence.save(p, r);
        },
      });

      this.coordinators.set(runId, coordinator);
      this.attachCoordinatorListeners(coordinator);
    }

    await coordinator.resume();
    return coordinator.getRun();
  }

  /**
   * Cancels a ProductionRun.
   */
  public cancelRun(runId: string): ProductionRun {
    const coordinator = this.getRequiredCoordinator(runId);
    coordinator.cancel();
    return coordinator.getRun();
  }

  /**
   * Resolves an ambiguous unknown item.
   */
  public resolveUnknownItem(
    runId: string,
    itemId: string,
    resolution: 'mark_completed' | 'skip' | 'retry',
    forceRetry = false
  ): ProductionRun {
    const coordinator = this.getRequiredCoordinator(runId);
    coordinator.resolveUnknownItem(itemId, resolution, forceRetry);
    return coordinator.getRun();
  }

  /**
   * Retries a failed item using its frozen record values and serial.
   */
  public retryFailedItem(runId: string, itemId: string): ProductionRun {
    const coordinator = this.getRequiredCoordinator(runId);
    coordinator.retryFailedItem(itemId);
    return coordinator.getRun();
  }

  /**
   * Skips an item explicitly.
   */
  public skipItem(runId: string, itemId: string): ProductionRun {
    const coordinator = this.getRequiredCoordinator(runId);
    coordinator.skipItem(itemId);
    return coordinator.getRun();
  }

  /**
   * Gets current state of a run from active memory or persistence.
   */
  public async getRun(runId: string): Promise<ProductionRun | null> {
    const coordinator = this.coordinators.get(runId);
    if (coordinator) {
      return coordinator.getRun();
    }

    const persisted = await this.persistence.load(runId);
    return persisted ? persisted.run : null;
  }

  /**
   * Gets plan from active memory or persistence.
   */
  public async getPlan(planId: string): Promise<ProductionPlan | null> {
    const cached = this.plans.get(planId);
    if (cached) return cached;

    // Search persisted runs for plan
    const runs = await this.persistence.list();
    const found = runs.find((r) => r.plan.id === planId);
    return found ? found.plan : null;
  }

  /**
   * Lists all persisted production runs sorted newest first.
   */
  public async listRuns(): Promise<PersistedProductionRecord[]> {
    return this.persistence.list();
  }

  private getRequiredCoordinator(runId: string): ProductionCoordinator {
    const coordinator = this.coordinators.get(runId);
    if (!coordinator) {
      throw new Error(`Production run '${runId}' is not actively loaded in memory`);
    }
    return coordinator;
  }

  private attachCoordinatorListeners(coordinator: ProductionCoordinator): void {
    coordinator.on('runStatusChange', (run) => {
      this.broadcastEvent('production:run-status-change', run);
    });

    coordinator.on('itemStatusChange', (item, run) => {
      this.broadcastEvent('production:item-status-change', { item, run });
    });

    coordinator.on('completed', (run) => {
      this.broadcastEvent('production:completed', run);
    });
  }

  private broadcastEvent(channel: string, payload: unknown): void {
    try {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send(channel, payload);
        }
      }
    } catch {
      // Ignore if called in non-electron test context
    }
  }
}
