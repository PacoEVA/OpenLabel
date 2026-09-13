import { EventEmitter } from 'node:events';
import {
  type ProductionPlan,
  type ProductionRun,
  type ProductionItem,
  type ProductionItemStatus,
  canTransitionProductionRun,
  canTransitionProductionItem,
  createProductionRun,
} from '../../core/production';
import { type PrinterProfile } from '../../core/printing/printer-profile.schema';
import { type PrintJob, type CreatePrintJobParams } from '../../core/printing/print-job.types';
import { type PrintArtifact, type ZplPrintArtifact, type PdfPrintArtifact } from '../../core/printing/print-artifact.types';
import { resolveDocument } from '../../core/data/document-resolver';
import { compileLabelToZpl } from '../../core/compilers/zpl/zpl-compiler';
import { renderLabelToPdf } from '../export/pdf/pdf-renderer';

export interface IPrintQueue {
  enqueue(params: CreatePrintJobParams, artifact: PrintArtifact, profile: PrinterProfile): PrintJob;
  cancel(jobId: string): boolean;
  getJob(jobId: string): PrintJob | undefined;
  on(event: 'statusChange', listener: (job: PrintJob) => void): this;
  removeListener(event: 'statusChange', listener: (job: PrintJob) => void): this;
}

export interface ProductionCoordinatorOptions {
  maxInFlight?: number;
  pdfRendererOverride?: (doc: import('../../core/schemas/label.schema').LabelDocument) => Promise<import('../../core/compilers/compile.types').CompileResult<Uint8Array>>;
  existingRun?: ProductionRun;
  onCheckpoint?: (plan: ProductionPlan, run: ProductionRun) => Promise<void> | void;
}

export interface ProductionCoordinatorEvents {
  runStatusChange: (run: ProductionRun) => void;
  itemStatusChange: (item: ProductionItem, run: ProductionRun) => void;
  completed: (run: ProductionRun) => void;
  error: (err: Error, run: ProductionRun) => void;
}

/**
 * Orchestrates a ProductionPlan batch execution against a bounded PrintQueue pipeline.
 *
 * Enforces backpressure: Never creates or enqueues thousands of PrintJobs at once.
 * Generates artifacts Just-In-Time as slots in maxInFlight become available.
 */
export class ProductionCoordinator extends EventEmitter {
  private readonly plan: ProductionPlan;
  private readonly run: ProductionRun;
  private readonly profile: PrinterProfile;
  private readonly queue: IPrintQueue;
  private readonly maxInFlight: number;
  private readonly options: ProductionCoordinatorOptions;
  private readonly pdfRenderer: (
    doc: import('../../core/schemas/label.schema').LabelDocument
  ) => Promise<import('../../core/compilers/compile.types').CompileResult<Uint8Array>>;

  private inFlightCount = 0;
  private peakInFlightObserved = 0;
  private nextItemIndex = 0;
  private isProcessing = false;
  private readonly activeJobs = new Map<string, string>(); // printJobId -> itemId

  constructor(
    plan: ProductionPlan,
    profile: PrinterProfile,
    queue: IPrintQueue,
    options: ProductionCoordinatorOptions = {}
  ) {
    super();
    this.plan = plan;
    this.profile = profile;
    this.queue = queue;
    this.options = options;
    this.maxInFlight = Math.max(1, options.maxInFlight ?? 5);
    this.pdfRenderer = options.pdfRendererOverride ?? renderLabelToPdf;

    this.run = options.existingRun
      ? { ...options.existingRun, items: options.existingRun.items.map((it) => ({ ...it })) }
      : createProductionRun(plan);

    // Bind queue status listener
    this.handleQueueStatusChange = this.handleQueueStatusChange.bind(this);
    this.queue.on('statusChange', this.handleQueueStatusChange);
  }

  private checkpointPromise: Promise<void> = Promise.resolve();

  private triggerCheckpoint(): void {
    if (this.options.onCheckpoint) {
      this.checkpointPromise = this.checkpointPromise
        .then(async () => {
          const runSnapshot = this.getRun();
          await this.options.onCheckpoint!(this.plan, runSnapshot);
        })
        .catch(() => {});
    }
  }

  public async flushCheckpoints(): Promise<void> {
    await this.checkpointPromise;
  }

  private notifyRunChange(): void {
    this.syncRunCounters();
    const run = this.getRun();
    this.emit('runStatusChange', run);
    this.triggerCheckpoint();
  }

  private notifyItemChange(item: ProductionItem): void {
    this.syncRunCounters();
    const run = this.getRun();
    this.emit('itemStatusChange', item, run);
    this.triggerCheckpoint();
  }

  public getRun(): ProductionRun {
    // Return shallow copy with recalculated counters
    this.syncRunCounters();
    return { ...this.run, items: [...this.run.items] };
  }

  public getPlan(): ProductionPlan {
    return this.plan;
  }

  public getPeakInFlight(): number {
    return this.peakInFlightObserved;
  }

  public getActiveInFlightCount(): number {
    return this.inFlightCount;
  }

  /**
   * Starts or resumes processing the batch.
   * Safe against double-invocation (idempotent).
   */
  public async start(): Promise<void> {
    if (this.run.status === 'running') {
      return; // Already running
    }

    if (!canTransitionProductionRun(this.run.status, 'running')) {
      throw new Error(`Cannot start production run from status '${this.run.status}'`);
    }

    this.run.status = 'running';
    if (!this.run.startedAt) {
      this.run.startedAt = new Date().toISOString();
    }
    this.notifyRunChange();

    this.pump();
  }

  /**
   * Graceful pause: Stops pumping new items while allowing in-flight jobs to conclude.
   */
  public pause(): void {
    if (this.run.status !== 'running') {
      return;
    }

    this.run.status = 'pausing';
    this.notifyRunChange();

    // If no items in flight, transition immediately to paused
    if (this.inFlightCount === 0) {
      this.run.status = 'paused';
      this.notifyRunChange();
    }
  }

  /**
   * Resumes a paused production run.
   */
  public async resume(): Promise<void> {
    if (this.run.status !== 'paused' && this.run.status !== 'interrupted') {
      throw new Error(
        `Cannot resume production run from status '${this.run.status}'. Must be 'paused' or 'interrupted'.`
      );
    }

    this.run.status = 'running';
    this.notifyRunChange();
    this.pump();
  }

  /**
   * Cancels the production run and marks uncompleted items as cancelled.
   */
  public cancel(): void {
    if (this.run.status === 'cancelled' || this.run.status === 'completed') {
      return;
    }

    this.run.status = 'cancelling';
    this.notifyRunChange();

    // Cancel any queued jobs in print queue
    for (const [jobId, itemId] of this.activeJobs.entries()) {
      this.queue.cancel(jobId);
    }

    // Mark pending or queued items as cancelled
    const now = new Date().toISOString();
    for (const item of this.run.items) {
      if (
        item.status === 'pending' ||
        item.status === 'validating' ||
        item.status === 'compiling' ||
        item.status === 'queued'
      ) {
        item.status = 'cancelled';
        item.updatedAt = now;
        this.notifyItemChange(item);
      }
    }

    this.run.status = 'cancelled';
    this.run.completedAt = now;
    this.notifyRunChange();
  }

  /**
   * Manually resolves an ambiguous unknown item.
   * Action 'retry' requires explicit forceRetry confirmation due to physical label duplication risk.
   */
  public resolveUnknownItem(
    itemId: string,
    resolution: 'mark_completed' | 'skip' | 'retry',
    forceRetry = false
  ): void {
    const item = this.run.items.find((it) => it.id === itemId);
    if (!item) {
      throw new Error(`Production item '${itemId}' not found`);
    }

    if (item.status !== 'unknown') {
      throw new Error(`Item '${itemId}' is not in 'unknown' status (current: '${item.status}')`);
    }

    const now = new Date().toISOString();
    item.updatedAt = now;

    if (resolution === 'mark_completed') {
      item.status = 'completed';
      item.error = undefined;
      this.notifyItemChange(item);
      this.checkCompletionOrPump();
    } else if (resolution === 'skip') {
      item.status = 'skipped';
      item.error = undefined;
      this.notifyItemChange(item);
      this.checkCompletionOrPump();
    } else if (resolution === 'retry') {
      if (!forceRetry) {
        throw new Error(
          'Retrying an unknown item requires explicit forceRetry confirmation. This may produce a duplicate label.'
        );
      }
      item.status = 'pending';
      item.error = undefined;
      this.notifyItemChange(item);

      if (this.run.status === 'completed_with_errors') {
        this.run.status = 'running';
        this.notifyRunChange();
      }

      if (this.run.status === 'running') {
        this.pump();
      }
    }
  }

  /**
   * Retries a failed production item using its exact frozen record data and serial.
   */
  public retryFailedItem(itemId: string): void {
    const item = this.run.items.find((it) => it.id === itemId);
    if (!item) {
      throw new Error(`Production item '${itemId}' not found`);
    }

    if (!canTransitionProductionItem(item.status, 'pending')) {
      throw new Error(`Cannot retry item '${itemId}' from status '${item.status}'`);
    }

    item.status = 'pending';
    item.error = undefined;
    item.updatedAt = new Date().toISOString();
    this.notifyItemChange(item);

    if (this.run.status === 'completed_with_errors') {
      this.run.status = 'running';
      this.notifyRunChange();
    }

    if (this.run.status === 'running') {
      this.pump();
    }
  }

  /**
   * Explicitly skips a pending, failed, or unknown item.
   */
  public skipItem(itemId: string): void {
    const item = this.run.items.find((it) => it.id === itemId);
    if (!item) {
      throw new Error(`Production item '${itemId}' not found`);
    }

    if (!canTransitionProductionItem(item.status, 'skipped')) {
      throw new Error(`Cannot skip item '${itemId}' from status '${item.status}'`);
    }

    item.status = 'skipped';
    item.error = undefined;
    item.updatedAt = new Date().toISOString();
    this.notifyItemChange(item);
    this.checkCompletionOrPump();
  }

  /**
   * Main bounded scheduling pump loop.
   */
  private pump(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (
        this.run.status === 'running' &&
        this.inFlightCount < this.maxInFlight
      ) {
        const item = this.run.items.find((it) => it.status === 'pending');
        if (!item) {
          break;
        }

        this.inFlightCount++;
        this.peakInFlightObserved = Math.max(this.peakInFlightObserved, this.inFlightCount);
        this.processItem(item);
      }
    } finally {
      this.isProcessing = false;
    }

    const hasPending = this.run.items.some((it) => it.status === 'pending');
    if (this.run.status === 'running' && this.inFlightCount === 0 && !hasPending) {
      this.finalizeRun();
    }
  }

  private checkCompletionOrPump(): void {
    if (this.run.status === 'pausing' && this.inFlightCount === 0) {
      this.run.status = 'paused';
      this.notifyRunChange();
      return;
    }

    if (this.run.status === 'completed_with_errors') {
      const hasErrorsOrUnknown = this.run.items.some(
        (it) => it.status === 'failed' || it.status === 'unknown'
      );
      if (!hasErrorsOrUnknown) {
        this.run.status = 'completed';
        this.run.completedAt = new Date().toISOString();
        this.notifyRunChange();
        this.emit('completed', this.getRun());
      }
      return;
    }

    const hasPending = this.run.items.some((it) => it.status === 'pending');

    if (this.run.status === 'running') {
      if (this.inFlightCount < this.maxInFlight && hasPending) {
        this.pump();
        return;
      }

      if (this.inFlightCount === 0 && !hasPending) {
        this.finalizeRun();
      }
    }
  }

  private async finalizeRun(): Promise<void> {
    const hasFailures = this.run.items.some((it) => it.status === 'failed');
    const hasUnknowns = this.run.items.some((it) => it.status === 'unknown');

    if (hasFailures || hasUnknowns) {
      this.run.status = 'completed_with_errors';
    } else {
      this.run.status = 'completed';
    }

    this.run.completedAt = new Date().toISOString();
    this.notifyRunChange();
    await this.flushCheckpoints();
    this.emit('completed', this.getRun());
  }

  public destroy(): void {
    this.queue.removeListener('statusChange', this.handleQueueStatusChange);
    this.removeAllListeners();
  }

  /**
   * Processes a single item through:
   * validating -> compiling -> queued -> dispatching
   */
  private async processItem(item: ProductionItem): Promise<void> {
    const record = this.plan.records.find((r) => r.index === item.recordIndex);
    if (!record) {
      this.failItem(item, 'RECORD_NOT_FOUND', `Record index ${item.recordIndex} not found in plan`);
      this.inFlightCount--;
      this.checkCompletionOrPump();
      return;
    }

    const now = new Date().toISOString();
    item.attempts++;
    item.updatedAt = now;

    // 1. Validating phase
    item.status = 'validating';
    this.notifyItemChange(item);

    const resolveRes = resolveDocument(this.plan.documentSnapshot, record.values);
    if (!resolveRes.success) {
      this.failItem(
        item,
        resolveRes.errors[0]?.code || 'RESOLUTION_FAILED',
        resolveRes.errors[0]?.message || 'Failed to resolve document placeholders',
        false
      );
      this.inFlightCount--;
      this.checkCompletionOrPump();
      return;
    }

    const resolvedDoc = resolveRes.document;

    // 2. Compiling phase (Just-In-Time)
    item.status = 'compiling';
    item.updatedAt = new Date().toISOString();
    this.notifyItemChange(item);

    let artifact: PrintArtifact;
    try {
      if (this.profile.language === 'zpl') {
        const compileRes = compileLabelToZpl(resolvedDoc, { dpi: this.profile.dpi ?? 203 });
        if (!compileRes.success) {
          this.failItem(
            item,
            compileRes.errors[0]?.code || 'ZPL_COMPILE_ERROR',
            compileRes.errors[0]?.message || 'Failed to compile label to ZPL',
            false
          );
          this.inFlightCount--;
          this.checkCompletionOrPump();
          return;
        }
        artifact = {
          type: 'zpl',
          data: compileRes.data,
          dpi: this.profile.dpi ?? 203,
          copies: this.plan.copiesPerRecord,
        } as ZplPrintArtifact;
      } else {
        const pdfRes = await this.pdfRenderer(resolvedDoc);
        if (!pdfRes.success) {
          this.failItem(
            item,
            pdfRes.errors[0]?.code || 'PDF_COMPILE_ERROR',
            pdfRes.errors[0]?.message || 'Failed to compile label to PDF',
            false
          );
          this.inFlightCount--;
          this.checkCompletionOrPump();
          return;
        }
        artifact = {
          type: 'pdf',
          data: Buffer.from(pdfRes.data),
          copies: this.plan.copiesPerRecord,
        } as PdfPrintArtifact;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.failItem(item, 'COMPILE_EXCEPTION', msg, false);
      this.inFlightCount--;
      this.checkCompletionOrPump();
      return;
    }

    // If cancelled while compiling, do not enqueue
    if (this.run.status !== 'running' && this.run.status !== 'pausing') {
      this.inFlightCount--;
      return;
    }

    // 3. Enqueue to PrintQueue
    const printJobId = this.generateJobUuid();
    item.printJobId = printJobId;
    item.status = 'queued';
    item.updatedAt = new Date().toISOString();
    this.notifyItemChange(item);

    this.activeJobs.set(printJobId, item.id);

    try {
      this.queue.enqueue(
        {
          id: printJobId,
          printerProfileId: this.profile.id,
          artifactType: this.profile.language,
          copies: this.plan.copiesPerRecord,
          maxAttempts: 1, // ProductionCoordinator manages batch attempts
        },
        artifact,
        this.profile
      );
    } catch (err: unknown) {
      this.activeJobs.delete(printJobId);
      const msg = err instanceof Error ? err.message : String(err);
      this.failItem(item, 'ENQUEUE_FAILED', msg, true);
      this.inFlightCount--;
      this.checkCompletionOrPump();
    }
  }

  /**
   * Handles PrintJob status updates from PrintQueue.
   */
  private handleQueueStatusChange(job: PrintJob): void {
    const itemId = this.activeJobs.get(job.id);
    if (!itemId) return;

    const item = this.run.items.find((it) => it.id === itemId);
    if (!item) return;

    const now = new Date().toISOString();
    item.updatedAt = now;

    if (job.status === 'dispatching') {
      if (canTransitionProductionItem(item.status, 'dispatching')) {
        item.status = 'dispatching';
        this.notifyItemChange(item);
      }
    } else if (job.status === 'completed') {
      this.activeJobs.delete(job.id);
      if (canTransitionProductionItem(item.status, 'completed')) {
        item.status = 'completed';
        this.notifyItemChange(item);
      }
      this.inFlightCount--;
      this.checkCompletionOrPump();
    } else if (job.status === 'unknown') {
      this.activeJobs.delete(job.id);
      if (canTransitionProductionItem(item.status, 'unknown')) {
        item.status = 'unknown';
        item.error = {
          code: job.error?.code || 'AMBIGUOUS_DISPATCH',
          message: job.error?.message || 'Socket problem after write: physical printing status unknown',
          retryable: false, // Never auto-retry unknown
        };
        this.notifyItemChange(item);
      }
      this.inFlightCount--;
      this.checkCompletionOrPump();
    } else if (job.status === 'failed') {
      this.activeJobs.delete(job.id);
      if (canTransitionProductionItem(item.status, 'failed')) {
        item.status = 'failed';
        item.error = {
          code: job.error?.code || 'PRINT_JOB_FAILED',
          message: job.error?.message || 'Print job failed in queue',
          retryable: job.error?.retryable ?? false,
        };
        this.notifyItemChange(item);
      }
      this.inFlightCount--;
      this.checkCompletionOrPump();
    }
  }

  private failItem(item: ProductionItem, code: string, message: string, retryable = false): void {
    item.status = 'failed';
    item.updatedAt = new Date().toISOString();
    item.error = {
      code,
      message,
      retryable,
    };
    this.notifyItemChange(item);
  }

  private syncRunCounters(): void {
    let processed = 0;
    let successful = 0;
    let failed = 0;
    let unknownCount = 0;
    let skipped = 0;
    let cancelled = 0;

    for (const it of this.run.items) {
      if (it.status !== 'pending') {
        processed++;
      }
      if (it.status === 'completed') successful++;
      if (it.status === 'failed') failed++;
      if (it.status === 'unknown') unknownCount++;
      if (it.status === 'skipped') skipped++;
      if (it.status === 'cancelled') cancelled++;
    }

    this.run.processedItems = processed;
    this.run.successfulItems = successful;
    this.run.failedItems = failed;
    this.run.unknownItems = unknownCount;
    this.run.skippedItems = skipped;
    this.run.cancelledItems = cancelled;
  }

  private generateJobUuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
