import { ipcMain } from 'electron';
import { z } from 'zod';
import { LabelDocumentSchema } from '../../core/schemas/label.schema';
import { PrinterProfileSchema } from '../../core/printing/printer-profile.schema';
import {
  ProductionRecordSchema,
  runProductionPreflight,
  buildProductionReport,
  exportProductionReportToJson,
  exportProductionReportToCsv,
} from '../../core/production';
import { ProductionService } from '../production/production.service';
import { getPrintingService } from './printing.ipc';

const PreflightPayloadSchema = z.object({
  document: LabelDocumentSchema,
  printerProfile: PrinterProfileSchema,
  records: z.array(ProductionRecordSchema),
  copiesPerRecord: z.number().int().min(1).default(1),
  skipInvalidRows: z.boolean().default(false),
});

const CreatePlanAndRunPayloadSchema = z.object({
  document: LabelDocumentSchema,
  printerProfile: PrinterProfileSchema,
  records: z.array(ProductionRecordSchema),
  copiesPerRecord: z.number().int().min(1).default(1),
  skipInvalidRows: z.boolean().default(false),
  preflightFingerprint: z.string().optional(),
});

const RunIdSchema = z.string().uuid({ message: 'Invalid run UUID' });

const ResolveUnknownPayloadSchema = z.object({
  runId: z.string().uuid(),
  itemId: z.string().uuid(),
  resolution: z.enum(['mark_completed', 'skip', 'retry']),
  forceRetry: z.boolean().default(false),
});

const ItemActionPayloadSchema = z.object({
  runId: z.string().uuid(),
  itemId: z.string().uuid(),
});

const ExportReportPayloadSchema = z.object({
  runId: z.string().uuid(),
  format: z.enum(['json', 'csv']).default('json'),
});

let sharedProductionService: ProductionService | null = null;

export function getProductionService(): ProductionService {
  if (!sharedProductionService) {
    const printingService = getPrintingService();
    sharedProductionService = new ProductionService({
      queue: printingService.queue,
      profileStore: printingService.profileStore,
    });
  }
  return sharedProductionService;
}

/**
 * Registers strictly typed IPC handlers for the massive batch production subsystem.
 * Every incoming payload is treated as untrusted and validated with Zod before processing.
 */
export function registerProductionIpcHandlers(
  service: ProductionService = getProductionService()
): void {
  // 1. Run Preflight Inspection
  ipcMain.handle('production:preflight', async (_event, rawPayload: unknown) => {
    const parse = PreflightPayloadSchema.safeParse(rawPayload);
    if (!parse.success) {
      return {
        success: false,
        errors: parse.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }

    try {
      const result = runProductionPreflight({
        document: parse.data.document,
        printerProfile: parse.data.printerProfile,
        records: parse.data.records,
        copiesPerRecord: parse.data.copiesPerRecord,
        skipInvalidRows: parse.data.skipInvalidRows,
      });
      return { success: true, result };
    } catch (err) {
      return {
        success: false,
        errors: [(err as Error).message || 'Preflight inspection failed'],
      };
    }
  });

  // 2. Create Plan and Run
  ipcMain.handle('production:create-plan-and-run', async (_event, rawPayload: unknown) => {
    const parse = CreatePlanAndRunPayloadSchema.safeParse(rawPayload);
    if (!parse.success) {
      return {
        success: false,
        errors: parse.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }

    try {
      const preflight = runProductionPreflight({
        document: parse.data.document,
        printerProfile: parse.data.printerProfile,
        records: parse.data.records,
        copiesPerRecord: parse.data.copiesPerRecord,
        skipInvalidRows: parse.data.skipInvalidRows,
      });

      if (!preflight.success && !parse.data.skipInvalidRows) {
        return {
          success: false,
          errors: preflight.issues
            .filter((i) => i.level === 'error')
            .map((e) => e.message),
        };
      }

      let recordsToPlan = parse.data.records;
      if (parse.data.skipInvalidRows && preflight.issues.length > 0) {
        const invalidIndices = new Set(
          preflight.issues
            .filter((i) => i.level === 'error' && i.recordIndex !== undefined)
            .map((i) => i.recordIndex!)
        );
        recordsToPlan = parse.data.records.filter((_, idx) => !invalidIndices.has(idx));
      }

      const plan = service.createPlan({
        document: parse.data.document,
        printerProfile: parse.data.printerProfile,
        records: recordsToPlan,
        copiesPerRecord: parse.data.copiesPerRecord,
        preflight,
      });

      const run = await service.createRun(plan);
      return { success: true, plan, run };
    } catch (err) {
      return {
        success: false,
        errors: [(err as Error).message || 'Failed to create production plan and run'],
      };
    }
  });

  // 3. Start Run
  ipcMain.handle('production:start-run', async (_event, rawPayload: unknown) => {
    const parse = RunIdSchema.safeParse(rawPayload);
    if (!parse.success) {
      return { success: false, error: 'Invalid run UUID' };
    }

    try {
      const run = await service.startRun(parse.data);
      return { success: true, run };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 4. Pause Run
  ipcMain.handle('production:pause-run', async (_event, rawPayload: unknown) => {
    const parse = RunIdSchema.safeParse(rawPayload);
    if (!parse.success) {
      return { success: false, error: 'Invalid run UUID' };
    }

    try {
      const run = service.pauseRun(parse.data);
      return { success: true, run };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 5. Resume Run
  ipcMain.handle('production:resume-run', async (_event, rawPayload: unknown) => {
    const parse = RunIdSchema.safeParse(rawPayload);
    if (!parse.success) {
      return { success: false, error: 'Invalid run UUID' };
    }

    try {
      const run = await service.resumeRun(parse.data);
      return { success: true, run };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 6. Cancel Run
  ipcMain.handle('production:cancel-run', async (_event, rawPayload: unknown) => {
    const parse = RunIdSchema.safeParse(rawPayload);
    if (!parse.success) {
      return { success: false, error: 'Invalid run UUID' };
    }

    try {
      const run = service.cancelRun(parse.data);
      return { success: true, run };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 7. Get Run
  ipcMain.handle('production:get-run', async (_event, rawPayload: unknown) => {
    const parse = RunIdSchema.safeParse(rawPayload);
    if (!parse.success) {
      return { success: false, error: 'Invalid run UUID' };
    }

    try {
      const run = await service.getRun(parse.data);
      return { success: true, run };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 8. List Persisted Runs
  ipcMain.handle('production:list-runs', async () => {
    try {
      const runs = await service.listRuns();
      return { success: true, runs };
    } catch (err) {
      return { success: false, error: (err as Error).message, runs: [] };
    }
  });

  // 9. Resolve Unknown Item
  ipcMain.handle('production:resolve-unknown', async (_event, rawPayload: unknown) => {
    const parse = ResolveUnknownPayloadSchema.safeParse(rawPayload);
    if (!parse.success) {
      return {
        success: false,
        error: parse.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      };
    }

    try {
      const run = service.resolveUnknownItem(
        parse.data.runId,
        parse.data.itemId,
        parse.data.resolution,
        parse.data.forceRetry
      );
      const item = run.items.find((it) => it.id === parse.data.itemId);
      return { success: true, item, run };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 10. Retry Failed Item
  ipcMain.handle('production:retry-failed', async (_event, rawPayload: unknown) => {
    const parse = ItemActionPayloadSchema.safeParse(rawPayload);
    if (!parse.success) {
      return { success: false, error: 'Invalid input parameters' };
    }

    try {
      const run = service.retryFailedItem(parse.data.runId, parse.data.itemId);
      const item = run.items.find((it) => it.id === parse.data.itemId);
      return { success: true, item, run };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 11. Skip Item
  ipcMain.handle('production:skip-item', async (_event, rawPayload: unknown) => {
    const parse = ItemActionPayloadSchema.safeParse(rawPayload);
    if (!parse.success) {
      return { success: false, error: 'Invalid input parameters' };
    }

    try {
      const run = service.skipItem(parse.data.runId, parse.data.itemId);
      const item = run.items.find((it) => it.id === parse.data.itemId);
      return { success: true, item, run };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 12. Export Report (JSON / CSV)
  ipcMain.handle('production:export-report', async (_event, rawPayload: unknown) => {
    const parse = ExportReportPayloadSchema.safeParse(rawPayload);
    if (!parse.success) {
      return { success: false, error: 'Invalid input parameters' };
    }

    try {
      const run = await service.getRun(parse.data.runId);
      if (!run) {
        return { success: false, error: `Run '${parse.data.runId}' not found` };
      }

      const plan = await service.getPlan(run.planId);
      if (!plan) {
        return { success: false, error: `Plan '${run.planId}' not found` };
      }

      const report = buildProductionReport(plan, run);
      const content =
        parse.data.format === 'csv'
          ? exportProductionReportToCsv(report)
          : exportProductionReportToJson(report);

      return {
        success: true,
        format: parse.data.format,
        content,
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
