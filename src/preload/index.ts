import { contextBridge, ipcRenderer } from 'electron';
import type { LabelAPI, LabelValidationResult, HardwareProfiles } from './types';

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

// Expose the API to the main world under the identifier 'labelAPI'
contextBridge.exposeInMainWorld('labelAPI', labelAPI);
