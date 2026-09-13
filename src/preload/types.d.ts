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

export interface OpenDocumentIPCResult {
  canceled?: boolean;
  success: boolean;
  document?: import('../core/schemas/label.schema').LabelDocument;
  filePath?: string;
  migrated?: boolean;
  warnings?: Array<{ code: string; message: string }>;
  errors?: Array<{ code: string; message: string; details?: unknown }>;
}

export interface SaveDocumentIPCResult {
  canceled?: boolean;
  success: boolean;
  filePath?: string;
  savedAt?: string;
  errors?: Array<{ code: string; message: string; details?: unknown }>;
}

export interface RecentFileIPCItem {
  filePath: string;
  displayName: string;
  lastOpenedAt: string;
}

export interface TemplateSummaryIPC {
  id: string;
  name: string;
  category: string;
  description: string;
  isBuiltIn: boolean;
  dimensions: {
    width: number;
    height: number;
    unit: 'mm' | 'inch';
  };
}

export interface DocumentAPI {
  openDocument(): Promise<OpenDocumentIPCResult>;
  saveDocument(filePath: string, document: unknown): Promise<SaveDocumentIPCResult>;
  saveDocumentAs(document: unknown, defaultTitle?: string): Promise<SaveDocumentIPCResult>;
  readDocumentFile(filePath: string): Promise<OpenDocumentIPCResult>;
  getRecentFiles(): Promise<RecentFileIPCItem[]>;
  clearRecentFiles(): Promise<{ success: boolean }>;
  autosaveSnapshot(snapshot: unknown): Promise<{ success: boolean; errors?: string[] }>;
  getRecoveryItems(): Promise<import('../core/documents/recovery-snapshot.schema').RecoverySnapshot[]>;
  removeRecoveryItem(documentId: string): Promise<{ success: boolean }>;
  listTemplates(): Promise<{ builtIn: TemplateSummaryIPC[]; user: TemplateSummaryIPC[] }>;
  getTemplate(templateId: string, isBuiltIn: boolean): Promise<import('../core/schemas/label.schema').LabelDocument | null>;
  saveAsTemplate(templateName: string, document: unknown): Promise<{ success: boolean; templateId?: string; errors?: string[] }>;
}

export interface DataSourceAPI {
  selectFile(type: 'csv' | 'excel'): Promise<{ canceled: boolean; filePath?: string }>;
  testSource(source: unknown): Promise<{ success: boolean; message?: string }>;
  previewSource(source: unknown, limit?: number): Promise<{ success: boolean; dataset?: import('../core/data-sources').Dataset; error?: string }>;
  listCredentials(): Promise<import('../core/data-sources').CredentialMetadata[]>;
  setCredential(payload: import('../core/data-sources').SetCredentialPayload): Promise<{ success: boolean; credential?: import('../core/data-sources').CredentialMetadata; error?: string }>;
  deleteCredential(id: string): Promise<{ success: boolean }>;
}

export interface ProductionAPI {
  preflight(payload: unknown): Promise<{ success: boolean; result?: import('../core/production').ProductionPreflightResult; errors?: string[] }>;
  createPlanAndRun(payload: unknown): Promise<{ success: boolean; plan?: import('../core/production').ProductionPlan; run?: import('../core/production').ProductionRun; errors?: string[] }>;
  startRun(runId: string): Promise<{ success: boolean; run?: import('../core/production').ProductionRun; error?: string }>;
  pauseRun(runId: string): Promise<{ success: boolean; run?: import('../core/production').ProductionRun; error?: string }>;
  resumeRun(runId: string): Promise<{ success: boolean; run?: import('../core/production').ProductionRun; error?: string }>;
  cancelRun(runId: string): Promise<{ success: boolean; run?: import('../core/production').ProductionRun; error?: string }>;
  getRun(runId: string): Promise<{ success: boolean; run?: import('../core/production').ProductionRun; error?: string }>;
  listRuns(): Promise<{ success: boolean; runs: import('../main/production/production-persistence.service').PersistedProductionRecord[] }>;
  resolveUnknownItem(payload: { runId: string; itemId: string; resolution: 'mark_completed' | 'skip' | 'retry'; forceRetry?: boolean }): Promise<{ success: boolean; item?: import('../core/production').ProductionItem; error?: string }>;
  retryFailedItem(payload: { runId: string; itemId: string }): Promise<{ success: boolean; item?: import('../core/production').ProductionItem; error?: string }>;
  skipItem(payload: { runId: string; itemId: string }): Promise<{ success: boolean; item?: import('../core/production').ProductionItem; error?: string }>;
  exportReport(payload: { runId: string; format?: 'json' | 'csv' }): Promise<{ success: boolean; format: 'json' | 'csv'; content?: string; error?: string }>;
  onRunStatusChange(callback: (run: import('../core/production').ProductionRun) => void): () => void;
  onItemStatusChange(callback: (data: { item: import('../core/production').ProductionItem; run: import('../core/production').ProductionRun }) => void): () => void;
}

export interface SettingsAPI {
  getSettings(): Promise<import('../core/settings').AppSettings>;
  saveSettings(settings: unknown): Promise<{ success: boolean; settings?: import('../core/settings').AppSettings; error?: string }>;
  resetDefaults(): Promise<{ success: boolean; settings?: import('../core/settings').AppSettings; error?: string }>;
}

export interface DiagnosticsAPI {
  getDiagnosticsBundle(): Promise<{ success: boolean; bundle?: import('../main/diagnostics/diagnostics.service').DiagnosticsBundle; error?: string }>;
  exportDiagnosticsBundle(): Promise<{ success: boolean; filePath?: string; error?: string }>;
}

declare global {
  interface Window {
    labelAPI: LabelAPI;
    printAPI: PrintAPI;
    documentAPI: DocumentAPI;
    dataSourceAPI: DataSourceAPI;
    productionAPI: ProductionAPI;
    settingsAPI: SettingsAPI;
    diagnosticsAPI: DiagnosticsAPI;
  }
}
