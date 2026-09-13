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

declare global {
  interface Window {
    labelAPI: LabelAPI;
  }
}
