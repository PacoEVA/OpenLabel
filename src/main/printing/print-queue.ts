import { EventEmitter } from 'node:events';
import {
  type PrintJob,
  type PrintJobStatus,
  type PrintArtifact,
  type PrinterProfile,
  type PrintTransport,
  type CreatePrintJobParams,
  canTransitionPrintJob,
  isArtifactCompatibleWithProfile,
  isErrorRetryable,
  calculateRetryDelayMs,
  DEFAULT_MAX_ATTEMPTS,
  validateCopies,
} from '../../core/printing';

interface QueueItem {
  job: PrintJob;
  artifact: PrintArtifact;
  profile: PrinterProfile;
  abortController?: AbortController;
  retryTimeoutId?: ReturnType<typeof setTimeout>;
}

export interface PrintQueueEvents {
  statusChange: (job: PrintJob) => void;
}

export class PrintQueue extends EventEmitter {
  private readonly items = new Map<string, QueueItem>();
  private readonly transports: PrintTransport[] = [];
  /** Tracks active job ID per printer profile: printerProfileId -> jobId */
  private readonly activePrinters = new Map<string, string>();

  constructor(transports: PrintTransport[] = []) {
    super();
    this.transports = [...transports];
  }

  public registerTransport(transport: PrintTransport): void {
    this.transports.push(transport);
  }

  /**
   * Enqueues a new print job.
   */
  public enqueue(
    params: CreatePrintJobParams,
    artifact: PrintArtifact,
    profile: PrinterProfile
  ): PrintJob {
    const now = new Date().toISOString();
    const copies = validateCopies(params.copies) ? params.copies : 1;
    const maxAttempts = params.maxAttempts && params.maxAttempts >= 1 ? params.maxAttempts : DEFAULT_MAX_ATTEMPTS;

    const initialJob: PrintJob = {
      id: params.id,
      printerProfileId: params.printerProfileId,
      artifactType: params.artifactType,
      copies,
      status: 'queued',
      attempt: 0,
      maxAttempts,
      createdAt: now,
    };

    const item: QueueItem = {
      job: initialJob,
      artifact,
      profile,
    };

    this.items.set(params.id, item);
    this.emitStatusChange(initialJob);

    // Schedule processing for this printer
    queueMicrotask(() => {
      this.processNext(profile.id);
    });

    return initialJob;
  }

  /**
   * Retrieves a job by ID.
   */
  public getJob(jobId: string): PrintJob | undefined {
    return this.items.get(jobId)?.job;
  }

  /**
   * Retrieves all jobs in chronological order.
   */
  public getAllJobs(): PrintJob[] {
    return Array.from(this.items.values()).map((item) => item.job);
  }

  /**
   * Cancels a job if it is in a cancellable state.
   */
  public cancelJob(jobId: string): boolean {
    const item = this.items.get(jobId);
    if (!item) return false;

    const currentStatus = item.job.status;

    if (currentStatus === 'queued' || currentStatus === 'validating' || currentStatus === 'retry_wait') {
      if (item.retryTimeoutId) {
        clearTimeout(item.retryTimeoutId);
        item.retryTimeoutId = undefined;
      }

      if (canTransitionPrintJob(currentStatus, 'cancelled')) {
        this.updateJobStatus(item, 'cancelled', {
          error: {
            code: 'CANCELLED',
            message: 'Job cancelled by user request',
            retryable: false,
          },
          completedAt: new Date().toISOString(),
        });

        if (this.activePrinters.get(item.profile.id) === jobId) {
          this.activePrinters.delete(item.profile.id);
          this.processNext(item.profile.id);
        }
        return true;
      }
    }

    if (currentStatus === 'dispatching') {
      // Abort in-flight transport
      item.abortController?.abort();
      this.updateJobStatus(item, 'cancelled', {
        error: {
          code: 'CANCELLED',
          message: 'Job dispatch aborted by user request',
          retryable: false,
        },
        completedAt: new Date().toISOString(),
      });

      if (this.activePrinters.get(item.profile.id) === jobId) {
        this.activePrinters.delete(item.profile.id);
        this.processNext(item.profile.id);
      }
      return true;
    }

    return false;
  }

  /**
   * Alias for cancelJob to satisfy standard queue interfaces.
   */
  public cancel(jobId: string): boolean {
    return this.cancelJob(jobId);
  }

  /**
   * Manually retries a failed job.
   */
  public retryJob(jobId: string): boolean {
    const item = this.items.get(jobId);
    if (!item) return false;

    if (item.job.status !== 'failed') {
      return false;
    }

    // Reset attempt counter and requeue
    item.job = {
      ...item.job,
      status: 'queued',
      attempt: 0,
      error: undefined,
    };

    this.emitStatusChange(item.job);
    queueMicrotask(() => {
      this.processNext(item.profile.id);
    });
    return true;
  }

  /**
   * Clears terminal completed or cancelled jobs from memory.
   */
  public clearCompleted(): void {
    for (const [id, item] of this.items.entries()) {
      if (item.job.status === 'completed' || item.job.status === 'cancelled') {
        this.items.delete(id);
      }
    }
  }

  /**
   * Internal queue runner: processes the next pending job for a specific printer.
   */
  private async processNext(printerProfileId: string): Promise<void> {
    // Enforce strictly 1 active job per printer profile
    if (this.activePrinters.has(printerProfileId)) {
      return;
    }

    // Find the oldest queued job for this printer
    const pendingItem = Array.from(this.items.values()).find(
      (item) => item.profile.id === printerProfileId && item.job.status === 'queued'
    );

    if (!pendingItem) {
      return;
    }

    // Mark printer as busy
    this.activePrinters.set(printerProfileId, pendingItem.job.id);

    try {
      await this.executeJob(pendingItem);
    } finally {
      this.activePrinters.delete(printerProfileId);
      // Check if more jobs are queued for this printer
      queueMicrotask(() => {
        this.processNext(printerProfileId);
      });
    }
  }

  private async executeJob(item: QueueItem): Promise<void> {
    // 1. Transition to 'validating'
    if (!canTransitionPrintJob(item.job.status, 'validating')) {
      return;
    }
    this.updateJobStatus(item, 'validating', { startedAt: new Date().toISOString() });

    // 2. Validate Profile/Artifact compatibility
    const compat = isArtifactCompatibleWithProfile(item.artifact, item.profile);
    if (!compat.compatible) {
      this.updateJobStatus(item, 'failed', {
        error: {
          code: 'UNSUPPORTED_ARTIFACT',
          message: compat.reason ?? 'Artifact is not compatible with selected printer profile',
          retryable: false,
        },
        completedAt: new Date().toISOString(),
      });
      return;
    }

    // 3. Find matching transport
    const transport = this.transports.find((t) => t.canHandle(item.profile, item.artifact));
    if (!transport) {
      this.updateJobStatus(item, 'failed', {
        error: {
          code: 'UNSUPPORTED_ARTIFACT',
          message: `No registered transport can handle connection type "${item.profile.connection.type}" for artifact "${item.artifact.type}"`,
          retryable: false,
        },
        completedAt: new Date().toISOString(),
      });
      return;
    }

    // 4. Transition to 'dispatching'
    if (!canTransitionPrintJob(item.job.status, 'dispatching')) {
      return;
    }
    const currentAttempt = item.job.attempt + 1;
    item.abortController = new AbortController();
    this.updateJobStatus(item, 'dispatching', { attempt: currentAttempt });

    // 5. Send copies
    for (let c = 1; c <= item.job.copies; c++) {
      if (item.abortController.signal.aborted) {
        return; // Already marked cancelled by cancelJob()
      }

      const result = await transport.send(item.profile, item.artifact, {
        jobId: item.job.id,
        attempt: currentAttempt,
        signal: item.abortController.signal,
      });

      if (!result.success) {
        const error = result.error ?? {
          code: 'UNKNOWN_PRINT_ERROR',
          message: 'Transport failed without specific error details',
          retryable: false,
        };

        const canRetry = error.retryable && currentAttempt < item.job.maxAttempts;

        if (canRetry) {
          // Transition: dispatching -> failed -> retry_wait
          this.updateJobStatus(item, 'failed', { error });

          if (canTransitionPrintJob('failed', 'retry_wait')) {
            this.updateJobStatus(item, 'retry_wait', { error });

            const delayMs = calculateRetryDelayMs(currentAttempt + 1);
            item.retryTimeoutId = setTimeout(() => {
              if (item.job.status === 'retry_wait') {
                this.updateJobStatus(item, 'queued');
                this.processNext(item.profile.id);
              }
            }, delayMs);
          }
        } else {
          // Terminal failure
          this.updateJobStatus(item, 'failed', {
            error,
            completedAt: new Date().toISOString(),
          });
        }
        return;
      }
    }

    // 6. Transition to 'completed'
    if (canTransitionPrintJob(item.job.status, 'completed')) {
      this.updateJobStatus(item, 'completed', { completedAt: new Date().toISOString() });
    }
  }

  private updateJobStatus(
    item: QueueItem,
    newStatus: PrintJobStatus,
    patch: Partial<PrintJob> = {}
  ): void {
    item.job = {
      ...item.job,
      ...patch,
      status: newStatus,
    };
    this.emitStatusChange(item.job);
  }

  private emitStatusChange(job: PrintJob): void {
    this.emit('statusChange', job);
  }
}
