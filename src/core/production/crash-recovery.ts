import { ProductionRun, ProductionItem } from './production.schema';

export interface CrashReconciliationResult {
  recovered: boolean;
  run: ProductionRun;
  changedItemsCount: number;
}

/**
 * Reconciles a ProductionRun after an abnormal application shutdown or crash.
 *
 * Rules:
 * 1. If run was 'running' or 'pausing', transitions to 'interrupted' with timestamp.
 * 2. Does NOT auto-resume.
 * 3. Any item in 'dispatching' state is transitioned to 'unknown' with retryable: false (risk of duplicate label).
 * 4. Any item in 'validating', 'compiling', or 'queued' is safely reset to 'pending'.
 * 5. Completed, failed, skipped, and cancelled items remain unchanged.
 * 6. Synchronizes run counters.
 */
export function reconcileInterruptedRun(run: ProductionRun): CrashReconciliationResult {
  if (run.status !== 'running' && run.status !== 'pausing') {
    return {
      recovered: false,
      run,
      changedItemsCount: 0,
    };
  }

  const now = new Date().toISOString();
  let changedItemsCount = 0;

  const reconciledItems: ProductionItem[] = run.items.map((item) => {
    if (item.status === 'dispatching') {
      changedItemsCount++;
      return {
        ...item,
        status: 'unknown' as const,
        error: {
          code: 'DISPATCH_INTERRUPTED',
          message:
            'Application terminated while item was dispatching to printer. Physical output status unknown. Duplicate risk.',
          retryable: false,
        },
        updatedAt: now,
      };
    }

    if (
      item.status === 'validating' ||
      item.status === 'compiling' ||
      item.status === 'queued'
    ) {
      changedItemsCount++;
      return {
        ...item,
        status: 'pending' as const,
        updatedAt: now,
      };
    }

    return item;
  });

  const totalItems = reconciledItems.length;
  const successfulItems = reconciledItems.filter((it) => it.status === 'completed').length;
  const failedItems = reconciledItems.filter((it) => it.status === 'failed').length;
  const unknownItems = reconciledItems.filter((it) => it.status === 'unknown').length;
  const skippedItems = reconciledItems.filter((it) => it.status === 'skipped').length;
  const cancelledItems = reconciledItems.filter((it) => it.status === 'cancelled').length;
  const pendingItems = reconciledItems.filter((it) => it.status === 'pending').length;
  const processedItems = totalItems - pendingItems;

  const updatedRun: ProductionRun = {
    ...run,
    status: 'interrupted',
    interruptedAt: now,
    items: reconciledItems,
    totalItems,
    successfulItems,
    failedItems,
    unknownItems,
    skippedItems,
    cancelledItems,
    processedItems,
  };

  return {
    recovered: true,
    run: updatedRun,
    changedItemsCount,
  };
}
