import * as crypto from 'node:crypto';
import { BrowserWindow } from 'electron';
import {
  type PrinterProfile,
  type PrintJob,
  type PrintArtifact,
  type ZplPrintArtifact,
  type PdfPrintArtifact,
  PrinterProfileSchema,
} from '../../core/printing';
import { type LabelDocument, LabelDocumentSchema } from '../../core/schemas/label.schema';
import { compileLabelToZpl } from '../../core/compilers/zpl/zpl-compiler';
import { renderLabelToPdf } from '../export/pdf/pdf-renderer';
import { PrintQueue } from './print-queue';
import { PrinterProfileStore } from './printer-profile.store';
import { TcpRawTransport } from './transports/tcp-raw.transport';
import { SystemPrinterTransport } from './transports/system-printer.transport';
import { getSystemPrinters } from './discovery/system-printers';
import type { SystemPrinterInfo } from './discovery/system-printers.types';
import { z } from 'zod';

export const CreatePrintJobRequestSchema = z.object({
  document: LabelDocumentSchema,
  printerProfileId: z.string().uuid(),
  copies: z.number().int().min(1).max(999).default(1),
});
export type CreatePrintJobRequest = z.infer<typeof CreatePrintJobRequestSchema>;

export interface CreatePrintJobResult {
  success: boolean;
  job?: PrintJob;
  errors?: string[];
}

export class PrintingService {
  public readonly queue: PrintQueue;
  public readonly profileStore: PrinterProfileStore;
  public readonly tcpTransport: TcpRawTransport;
  public readonly systemTransport: SystemPrinterTransport;

  constructor() {
    this.tcpTransport = new TcpRawTransport();
    this.systemTransport = new SystemPrinterTransport();
    this.queue = new PrintQueue([this.tcpTransport, this.systemTransport]);
    this.profileStore = new PrinterProfileStore();

    this.seedDefaultProfiles();

    // Broadcast status change events to all active renderer windows
    this.queue.on('statusChange', (job: PrintJob) => {
      this.broadcastJobStatus(job);
    });
  }

  private seedDefaultProfiles(): void {
    if (this.profileStore.list().length === 0) {
      this.profileStore.save({
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Warehouse Zebra (203 DPI)',
        connection: {
          type: 'tcp',
          host: '192.168.1.100',
          port: 9100,
          timeoutMs: 5000,
        },
        language: 'zpl',
        dpi: 203,
        enabled: true,
      });

      this.profileStore.save({
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Office Laser Printer (PDF)',
        connection: {
          type: 'system',
          printerName: 'Default-PDF-Printer',
        },
        language: 'pdf',
        enabled: true,
      });
    }
  }

  public listProfiles(): PrinterProfile[] {
    return this.profileStore.list();
  }

  public getProfile(id: string): PrinterProfile | undefined {
    return this.profileStore.get(id);
  }

  public saveProfile(raw: unknown): { success: boolean; profile?: PrinterProfile; errors?: string[] } {
    try {
      const profile = this.profileStore.save(raw);
      return { success: true, profile };
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return {
          success: false,
          errors: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return { success: false, errors: ['Failed to save printer profile'] };
    }
  }

  public deleteProfile(id: string): boolean {
    return this.profileStore.delete(id);
  }

  public async getAvailableSystemPrinters(): Promise<SystemPrinterInfo[]> {
    return await getSystemPrinters();
  }

  public async testProfileConnection(profileId: string): Promise<{ success: boolean; message: string }> {
    const profile = this.profileStore.get(profileId);
    if (!profile) {
      return { success: false, message: `Profile with ID "${profileId}" not found` };
    }

    if (profile.connection.type === 'tcp') {
      const { host, port, timeoutMs } = profile.connection;
      return await this.tcpTransport.testConnection(host, port, timeoutMs);
    }

    if (profile.connection.type === 'system') {
      const conn = profile.connection;
      const systemPrinters = await getSystemPrinters();
      const exists = systemPrinters.some((p) => p.name === conn.printerName);
      if (exists) {
        return {
          success: true,
          message: `System printer "${conn.printerName}" found in operating system`,
        };
      }
      return {
        success: false,
        message: `System printer "${conn.printerName}" not found in installed printers`,
      };
    }

    return { success: false, message: 'Unknown connection type' };
  }

  public async createJob(request: CreatePrintJobRequest): Promise<CreatePrintJobResult> {
    const profile = this.profileStore.get(request.printerProfileId);
    if (!profile) {
      return {
        success: false,
        errors: [`Printer profile "${request.printerProfileId}" was not found`],
      };
    }

    if (!profile.enabled) {
      return {
        success: false,
        errors: [`Printer profile "${profile.name}" is disabled`],
      };
    }

    let artifact: PrintArtifact;

    if (profile.language === 'zpl') {
      const compileRes = compileLabelToZpl(request.document, { dpi: profile.dpi ?? 203 });
      if (!compileRes.success) {
        return {
          success: false,
          errors: compileRes.errors.map((e) => `[${e.code}] ${e.message}`),
        };
      }
      artifact = {
        type: 'zpl',
        data: compileRes.data,
        dpi: profile.dpi ?? 203,
      };
    } else if (profile.language === 'pdf') {
      const pdfRes = await renderLabelToPdf(request.document);
      if (!pdfRes.success) {
        return {
          success: false,
          errors: pdfRes.errors.map((e) => `[${e.code}] ${e.message}`),
        };
      }
      artifact = {
        type: 'pdf',
        data: pdfRes.data,
      };
    } else {
      return {
        success: false,
        errors: [`Unsupported profile language "${profile.language}"`],
      };
    }

    const jobId = crypto.randomUUID();
    const job = this.queue.enqueue(
      {
        id: jobId,
        printerProfileId: profile.id,
        artifactType: profile.language,
        copies: request.copies,
      },
      artifact,
      profile
    );

    return {
      success: true,
      job,
    };
  }

  public getJob(jobId: string): PrintJob | undefined {
    return this.queue.getJob(jobId);
  }

  public getAllJobs(): PrintJob[] {
    return this.queue.getAllJobs();
  }

  public cancelJob(jobId: string): boolean {
    return this.queue.cancelJob(jobId);
  }

  public retryJob(jobId: string): boolean {
    return this.queue.retryJob(jobId);
  }

  private broadcastJobStatus(job: PrintJob): void {
    try {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('printing:job-status-changed', job);
        }
      }
    } catch {
      // Ignored if in headless/test environment
    }
  }
}
