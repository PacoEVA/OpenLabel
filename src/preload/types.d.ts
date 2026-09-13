import type { PrinterProfile, PrintJob } from '../core/printing';
import type { SystemPrinterInfo } from '../main/printing/discovery/system-printers.types';

export interface HardwareProfiles {
  supportedDpis: number[];
}

export interface LabelValidationResult {
  success: boolean;
  errors?: string[];
  data?: unknown;
}

export interface GeneratePdfResult {
  success: boolean;
  pdfBase64?: string;
  errors?: string[];
  warnings?: Array<{ code: string; message: string; elementId?: string }>;
}

export interface LabelAPI {
  validateDocument(doc: unknown): Promise<LabelValidationResult>;
  getHardwareProfiles(): Promise<HardwareProfiles>;
  generatePdf(doc: unknown): Promise<GeneratePdfResult>;
}

export interface CreatePrintJobPayload {
  document: unknown;
  printerProfileId: string;
  copies: number;
}

export interface PrintAPI {
  listPrinters(): Promise<SystemPrinterInfo[]>;
  listProfiles(): Promise<PrinterProfile[]>;
  saveProfile(profile: unknown): Promise<{ success: boolean; profile?: PrinterProfile; errors?: string[] }>;
  deleteProfile(profileId: string): Promise<{ success: boolean }>;
  createJob(request: CreatePrintJobPayload): Promise<{ success: boolean; job?: PrintJob; errors?: string[] }>;
  getJob(jobId: string): Promise<PrintJob | undefined>;
  listJobs(): Promise<PrintJob[]>;
  cancelJob(jobId: string): Promise<{ success: boolean }>;
  retryJob(jobId: string): Promise<{ success: boolean }>;
  testConnection(profileId: string): Promise<{ success: boolean; message: string }>;
  onJobStatusChanged(callback: (job: PrintJob) => void): () => void;
}

declare global {
  interface Window {
    labelAPI: LabelAPI;
    printAPI: PrintAPI;
  }
}
