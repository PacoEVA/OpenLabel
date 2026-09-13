import { ProductionRunStatus, ProductionItemStatus } from './production.schema';

/**
 * Transition rules for ProductionRun.
 * Maps each valid source status to its allowed destination statuses.
 */
const VALID_RUN_TRANSITIONS: Record<ProductionRunStatus, readonly ProductionRunStatus[]> = {
  draft: ['preflighting'],
  preflighting: ['ready', 'draft', 'failed'],
  ready: ['running', 'cancelled'],
  running: [
    'pausing',
    'cancelling',
    'completed',
    'completed_with_errors',
    'failed',
    'interrupted',
  ],
  pausing: ['paused', 'cancelling', 'interrupted'],
  paused: ['running', 'cancelling'],
  cancelling: ['cancelled'],
  interrupted: ['running', 'cancelled'],
  completed_with_errors: ['running'],
  // Terminal states (cannot transition further)
  completed: [],
  cancelled: [],
  failed: [],
};

/**
 * Checks whether a ProductionRun can transition from its current status to a target status.
 */
export function canTransitionProductionRun(
  from: ProductionRunStatus,
  to: ProductionRunStatus
): boolean {
  if (from === to) {
    return false;
  }
  const allowed = VALID_RUN_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Returns true if the ProductionRun status is terminal (execution is finished and permanent).
 */
export function isTerminalRunStatus(status: ProductionRunStatus): boolean {
  return (
    status === 'completed' ||
    status === 'cancelled' ||
    status === 'failed'
  );
}

/**
 * Transition rules for individual ProductionItems.
 */
const VALID_ITEM_TRANSITIONS: Record<ProductionItemStatus, readonly ProductionItemStatus[]> = {
  pending: ['validating', 'compiling', 'queued', 'skipped', 'cancelled'],
  validating: ['compiling', 'failed', 'cancelled', 'pending'],
  compiling: ['queued', 'failed', 'cancelled', 'pending'],
  queued: ['dispatching', 'cancelled', 'pending'],
  dispatching: ['completed', 'failed', 'unknown'],
  // Ambiguous state resolved manually
  unknown: ['pending', 'completed', 'skipped'],
  // Failed item can be retried or skipped
  failed: ['pending', 'skipped'],
  // Terminal item states
  completed: [],
  skipped: [],
  cancelled: [],
};

/**
 * Checks whether a ProductionItem can transition from its current status to a target status.
 */
export function canTransitionProductionItem(
  from: ProductionItemStatus,
  to: ProductionItemStatus
): boolean {
  if (from === to) {
    return false;
  }
  const allowed = VALID_ITEM_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Returns true if the ProductionItem status is terminal.
 */
export function isTerminalItemStatus(status: ProductionItemStatus): boolean {
  return status === 'completed' || status === 'skipped' || status === 'cancelled';
}
