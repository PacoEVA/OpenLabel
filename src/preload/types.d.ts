export interface HardwareProfiles {
  supportedDpis: number[];
}

export interface LabelValidationResult {
  success: boolean;
  errors?: string[];
  data?: unknown;
}

export interface LabelAPI {
  validateDocument(doc: unknown): Promise<LabelValidationResult>;
  getHardwareProfiles(): Promise<HardwareProfiles>;
}

declare global {
  interface Window {
    labelAPI: LabelAPI;
  }
}
