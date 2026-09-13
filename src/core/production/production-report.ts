import {
  ProductionPlan,
  ProductionRun,
  ProductionRunStatus,
  ProductionItemStatus,
} from './production.schema';

/**
 * Summary metrics of a completed or terminated production run.
 */
export interface ProductionReportSummary {
  runId: string;
  planId: string;
  status: ProductionRunStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  printerProfileId: string;
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  unknownItems: number;
  skippedItems: number;
  cancelledItems: number;
  copiesPerRecord: number;
  totalLabels: number;
}

/**
 * Detailed error entry for an individual production item.
 */
export interface ProductionReportErrorEntry {
  itemId: string;
  recordIndex: number;
  status: ProductionItemStatus;
  code: string;
  message: string;
  elementId?: string;
  fieldName?: string;
}

/**
 * Detailed item row in the production report.
 */
export interface ProductionReportItemRow {
  itemId: string;
  recordIndex: number;
  status: ProductionItemStatus;
  attempts: number;
  printJobId?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Complete structured production report.
 */
export interface ProductionReport {
  version: '1.0.0';
  generatedAt: string;
  summary: ProductionReportSummary;
  errors: ProductionReportErrorEntry[];
  items: ProductionReportItemRow[];
}

/**
 * Sanitizes potentially sensitive credentials or tokens from error text.
 */
export function sanitizeReportString(text: string): string {
  if (!text) return '';
  return text
    .replace(/(password|passwd|pwd|secret|token|bearer|key)\s*[:=]\s*['"]?[^\s,;'"&]+['"]?/gi, '$1=***REDACTED***')
    .replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer ***REDACTED***');
}

/**
 * Pure generator creating an immutable ProductionReport from a plan and run.
 */
export function buildProductionReport(
  plan: ProductionPlan,
  run: ProductionRun,
  now: Date = new Date()
): ProductionReport {
  let durationMs: number | undefined;
  if (run.startedAt) {
    const start = new Date(run.startedAt).getTime();
    const end = run.completedAt
      ? new Date(run.completedAt).getTime()
      : run.interruptedAt
      ? new Date(run.interruptedAt).getTime()
      : now.getTime();
    durationMs = Math.max(0, end - start);
  }

  const errors: ProductionReportErrorEntry[] = [];
  const items: ProductionReportItemRow[] = [];

  for (const item of run.items) {
    const itemRow: ProductionReportItemRow = {
      itemId: item.id,
      recordIndex: item.recordIndex,
      status: item.status,
      attempts: item.attempts,
      printJobId: item.printJobId,
      errorCode: item.error?.code,
      errorMessage: item.error?.message ? sanitizeReportString(item.error.message) : undefined,
    };
    items.push(itemRow);

    if (item.error) {
      errors.push({
        itemId: item.id,
        recordIndex: item.recordIndex,
        status: item.status,
        code: item.error.code,
        message: sanitizeReportString(item.error.message),
        elementId: item.error.elementId,
        fieldName: item.error.fieldName,
      });
    } else if (item.status === 'unknown') {
      errors.push({
        itemId: item.id,
        recordIndex: item.recordIndex,
        status: 'unknown',
        code: 'AMBIGUOUS_DELIVERY',
        message: 'Physical transmission status is ambiguous. Verification required.',
      });
    }
  }

  const summary: ProductionReportSummary = {
    runId: run.id,
    planId: plan.id,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    durationMs,
    printerProfileId: plan.printerProfileId,
    totalItems: run.totalItems,
    successfulItems: run.successfulItems,
    failedItems: run.failedItems,
    unknownItems: run.unknownItems,
    skippedItems: run.skippedItems,
    cancelledItems: run.cancelledItems,
    copiesPerRecord: plan.copiesPerRecord,
    totalLabels: plan.totalLabels,
  };

  return {
    version: '1.0.0',
    generatedAt: now.toISOString(),
    summary,
    errors,
    items,
  };
}

/**
 * Serializes report to JSON format.
 */
export function exportProductionReportToJson(report: ProductionReport, pretty: boolean = true): string {
  return pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report);
}

/**
 * Escapes values for standard RFC 4180 CSV generation.
 */
function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports report to RFC 4180 compliant CSV string.
 * Includes header metadata followed by tabular item-by-item status.
 */
export function exportProductionReportToCsv(report: ProductionReport): string {
  const lines: string[] = [];

  // Summary section
  lines.push('--- PRODUCTION RUN SUMMARY ---');
  lines.push(['Run ID', escapeCsvCell(report.summary.runId)].join(','));
  lines.push(['Plan ID', escapeCsvCell(report.summary.planId)].join(','));
  lines.push(['Status', escapeCsvCell(report.summary.status)].join(','));
  lines.push(['Printer Profile ID', escapeCsvCell(report.summary.printerProfileId)].join(','));
  lines.push(['Started At', escapeCsvCell(report.summary.startedAt || '')].join(','));
  lines.push(['Completed At', escapeCsvCell(report.summary.completedAt || '')].join(','));
  lines.push(['Duration (ms)', escapeCsvCell(report.summary.durationMs ?? '')].join(','));
  lines.push(['Total Items', escapeCsvCell(report.summary.totalItems)].join(','));
  lines.push(['Successful Items', escapeCsvCell(report.summary.successfulItems)].join(','));
  lines.push(['Failed Items', escapeCsvCell(report.summary.failedItems)].join(','));
  lines.push(['Unknown Items', escapeCsvCell(report.summary.unknownItems)].join(','));
  lines.push(['Skipped Items', escapeCsvCell(report.summary.skippedItems)].join(','));
  lines.push(['Cancelled Items', escapeCsvCell(report.summary.cancelledItems)].join(','));
  lines.push(['Copies Per Record', escapeCsvCell(report.summary.copiesPerRecord)].join(','));
  lines.push(['Total Labels', escapeCsvCell(report.summary.totalLabels)].join(','));
  lines.push('');

  // Items table section
  lines.push('--- PRODUCTION ITEMS BREAKDOWN ---');
  const headers = ['Item ID', 'Record Index', 'Status', 'Attempts', 'Print Job ID', 'Error Code', 'Error Message'];
  lines.push(headers.map(escapeCsvCell).join(','));

  for (const it of report.items) {
    const row = [
      it.itemId,
      it.recordIndex + 1, // 1-indexed for human readability in CSV
      it.status,
      it.attempts,
      it.printJobId || '',
      it.errorCode || '',
      it.errorMessage || '',
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  }

  return lines.join('\r\n');
}
