/**
 * System printer information returned to application callers.
 */
export interface SystemPrinterInfo {
  readonly name: string;
  readonly displayName: string;
  readonly description?: string;
  readonly isDefault: boolean;
  readonly status?: number;
}
