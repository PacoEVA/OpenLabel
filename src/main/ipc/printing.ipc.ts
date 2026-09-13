import { ipcMain } from 'electron';
import { z } from 'zod';
import {
  PrintingService,
  CreatePrintJobRequestSchema,
} from '../printing/printing.service';

const UuidSchema = z.string().uuid('Expected a valid UUID identifier');

let sharedPrintingService: PrintingService | null = null;

export function getPrintingService(): PrintingService {
  if (!sharedPrintingService) {
    sharedPrintingService = new PrintingService();
  }
  return sharedPrintingService;
}

/**
 * Registers discrete, strongly-typed IPC handlers for hardware printing.
 * All inputs are treated as untrusted (`unknown`) and validated with Zod.
 */
export function registerPrintingIpcHandlers(
  service: PrintingService = getPrintingService()
): void {
  // 1. List installed OS printers
  ipcMain.handle('printing:list-printers', async () => {
    try {
      return await service.getAvailableSystemPrinters();
    } catch {
      return [];
    }
  });

  // 2. List configured printer profiles
  ipcMain.handle('printing:list-profiles', async () => {
    try {
      return service.listProfiles();
    } catch {
      return [];
    }
  });

  // 3. Save / update printer profile
  ipcMain.handle('printing:save-profile', async (_event, payload: unknown) => {
    return service.saveProfile(payload);
  });

  // 4. Delete printer profile
  ipcMain.handle('printing:delete-profile', async (_event, payload: unknown) => {
    const parseRes = UuidSchema.safeParse(payload);
    if (!parseRes.success) {
      return { success: false, errors: ['Invalid profile UUID'] };
    }
    const deleted = service.deleteProfile(parseRes.data);
    return { success: deleted };
  });

  // 5. Test profile connection
  ipcMain.handle('printing:test-connection', async (_event, payload: unknown) => {
    const parseRes = UuidSchema.safeParse(payload);
    if (!parseRes.success) {
      return { success: false, message: 'Invalid profile UUID' };
    }
    return await service.testProfileConnection(parseRes.data);
  });

  // 6. Create & enqueue a print job
  ipcMain.handle('printing:create-job', async (_event, payload: unknown) => {
    try {
      const parseRes = CreatePrintJobRequestSchema.safeParse(payload);
      if (!parseRes.success) {
        return {
          success: false,
          errors: parseRes.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return await service.createJob(parseRes.data);
    } catch {
      return {
        success: false,
        errors: ['An unexpected error occurred while creating the print job'],
      };
    }
  });

  // 7. Get specific job
  ipcMain.handle('printing:get-job', async (_event, payload: unknown) => {
    if (typeof payload !== 'string' || payload.trim().length === 0) {
      return undefined;
    }
    return service.getJob(payload);
  });

  // 8. List all active/recent jobs
  ipcMain.handle('printing:list-jobs', async () => {
    return service.getAllJobs();
  });

  // 9. Cancel a job
  ipcMain.handle('printing:cancel-job', async (_event, payload: unknown) => {
    if (typeof payload !== 'string' || payload.trim().length === 0) {
      return { success: false };
    }
    const cancelled = service.cancelJob(payload);
    return { success: cancelled };
  });

  // 10. Retry a failed job
  ipcMain.handle('printing:retry-job', async (_event, payload: unknown) => {
    if (typeof payload !== 'string' || payload.trim().length === 0) {
      return { success: false };
    }
    const retried = service.retryJob(payload);
    return { success: retried };
  });
}
