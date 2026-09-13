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

// Expose safe APIs to the main world under explicit identifiers
contextBridge.exposeInMainWorld('labelAPI', labelAPI);
contextBridge.exposeInMainWorld('printAPI', printAPI);
