import type { PrintJobStatus } from './print-job.types';

/**
 * Valid forward transitions between PrintJob states.
 */
export const VALID_JOB_TRANSITIONS: Record<PrintJobStatus, readonly PrintJobStatus[]> = {
  queued: ['validating', 'cancelled'],
  validating: ['dispatching', 'failed', 'cancelled'],
  dispatching: ['completed', 'failed', 'unknown'],
  retry_wait: ['queued', 'cancelled'],
  failed: ['retry_wait'], // Can move to retry_wait if attempts < maxAttempts, else remains terminal
  unknown: ['failed'], // Ambiguous dispatch can be resolved to failed manually or upon timeout
  completed: [], // Terminal
  cancelled: [], // Terminal
};

/**
 * Pure function to determine whether a state transition is legal according to the state machine.
 */
export function canTransitionPrintJob(from: PrintJobStatus, to: PrintJobStatus): boolean {
  if (from === to) {
    return false;
  }
  const allowed = VALID_JOB_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}
