import { contextBridge, ipcRenderer } from 'electron';
import type { LabelAPI, LabelValidationResult, HardwareProfiles, PrintAPI, CreatePrintJobPayload } from './types';
import type { PrintJob, PrinterProfile } from '../core/printing';
import type { SystemPrinterInfo } from '../main/printing/discovery/system-printers.types';

/**
 * OpenLabels - Preload Script
 * Acts as a secure, isolated bridge between Main and Renderer processes.
 * Exposes strictly typed, discrete methods without leaking generic IPC primitives.
 */

const labelAPI: LabelAPI = {
  validateDocument: async (doc: unknown): Promise<LabelValidationResult> => {
    return ipcRenderer.invoke('label:validate-document', doc);
  },

  getHardwareProfiles: async (): Promise<HardwareProfiles> => {
    return ipcRenderer.invoke('label:get-hardware-profiles');
  },

  generatePdf: async (doc: unknown) => {
    return ipcRenderer.invoke('label:generate-pdf', doc);
  },
};

const printAPI: PrintAPI = {
  listPrinters: async (): Promise<SystemPrinterInfo[]> => {
    return ipcRenderer.invoke('printing:list-printers');
  },

  listProfiles: async (): Promise<PrinterProfile[]> => {
    return ipcRenderer.invoke('printing:list-profiles');
  },

  saveProfile: async (profile: unknown): Promise<{ success: boolean; profile?: PrinterProfile; errors?: string[] }> => {
    return ipcRenderer.invoke('printing:save-profile', profile);
  },

  deleteProfile: async (profileId: string): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('printing:delete-profile', profileId);
  },

  createJob: async (request: CreatePrintJobPayload): Promise<{ success: boolean; job?: PrintJob; errors?: string[] }> => {
    return ipcRenderer.invoke('printing:create-job', request);
  },

  getJob: async (jobId: string): Promise<PrintJob | undefined> => {
    return ipcRenderer.invoke('printing:get-job', jobId);
  },

  listJobs: async (): Promise<PrintJob[]> => {
    return ipcRenderer.invoke('printing:list-jobs');
  },

  cancelJob: async (jobId: string): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('printing:cancel-job', jobId);
  },

  retryJob: async (jobId: string): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('printing:retry-job', jobId);
  },

  testConnection: async (profileId: string): Promise<{ success: boolean; message: string }> => {
    return ipcRenderer.invoke('printing:test-connection', profileId);
  },

  onJobStatusChanged: (callback: (job: PrintJob) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, job: PrintJob) => {
      callback(job);
    };
    ipcRenderer.on('printing:job-status-changed', listener);
    return () => {
      ipcRenderer.removeListener('printing:job-status-changed', listener);
    };
  },
};

const documentAPI = {
  openDocument: async () => {
    return ipcRenderer.invoke('document:open');
  },
  saveDocument: async (filePath: string, document: unknown) => {
    return ipcRenderer.invoke('document:save', { filePath, document });
  },
  saveDocumentAs: async (document: unknown, defaultTitle?: string) => {
    return ipcRenderer.invoke('document:save-as', { document, defaultTitle });
  },
  readDocumentFile: async (filePath: string) => {
    return ipcRenderer.invoke('document:read-file', { filePath });
  },
  getRecentFiles: async () => {
    return ipcRenderer.invoke('document:get-recent-files');
  },
  clearRecentFiles: async () => {
    return ipcRenderer.invoke('document:clear-recent-files');
  },
  autosaveSnapshot: async (snapshot: unknown) => {
    return ipcRenderer.invoke('document:save-recovery-snapshot', snapshot);
  },
  getRecoveryItems: async () => {
    return ipcRenderer.invoke('document:get-recovery-items');
  },
  removeRecoveryItem: async (documentId: string) => {
    return ipcRenderer.invoke('document:remove-recovery-item', { documentId });
  },
  listTemplates: async () => {
    return ipcRenderer.invoke('document:list-templates');
  },
  getTemplate: async (templateId: string, isBuiltIn: boolean) => {
    return ipcRenderer.invoke('document:get-template', { templateId, isBuiltIn });
  },
  saveAsTemplate: async (templateName: string, document: unknown) => {
    return ipcRenderer.invoke('document:save-user-template', { templateName, document });
  },
};

const dataSourceAPI = {
  selectFile: async (type: 'csv' | 'excel') => {
    return ipcRenderer.invoke('datasource:select-file', type);
  },
  testSource: async (source: unknown) => {
    return ipcRenderer.invoke('datasource:test', source);
  },
  previewSource: async (source: unknown, limit?: number) => {
    return ipcRenderer.invoke('datasource:preview', { source, limit });
  },
  listCredentials: async () => {
    return ipcRenderer.invoke('datasource:list-credentials');
  },
  setCredential: async (payload: unknown) => {
    return ipcRenderer.invoke('datasource:set-credential', payload);
  },
  deleteCredential: async (id: string) => {
    return ipcRenderer.invoke('datasource:delete-credential', id);
  },
};

// Expose safe APIs to the main world under explicit identifiers
contextBridge.exposeInMainWorld('labelAPI', labelAPI);
contextBridge.exposeInMainWorld('printAPI', printAPI);
contextBridge.exposeInMainWorld('documentAPI', documentAPI);
contextBridge.exposeInMainWorld('dataSourceAPI', dataSourceAPI);

