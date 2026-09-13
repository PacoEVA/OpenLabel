import type {
  PrintTransport,
  PrintTransportContext,
  PrintTransportResult,
  PrinterProfile,
  PrintArtifact,
  PrintError,
} from '../../src/core/printing';

export interface MockTransportOptions {
  type?: string;
  canHandleOverride?: (profile: PrinterProfile, artifact: PrintArtifact) => boolean;
  shouldFail?: boolean;
  failureError?: PrintError;
  delayMs?: number;
}

export class MockTransport implements PrintTransport {
  public readonly type: string;
  public dispatches: Array<{
    profile: PrinterProfile;
    artifact: PrintArtifact;
    context: PrintTransportContext;
  }> = [];

  public pauseGate?: Promise<void>;
  private canHandleOverride?: (profile: PrinterProfile, artifact: PrintArtifact) => boolean;
  private shouldFail: boolean;
  private failureError?: PrintError;
  private delayMs: number;

  constructor(options: MockTransportOptions = {}) {
    this.type = options.type ?? 'mock';
    this.canHandleOverride = options.canHandleOverride;
    this.shouldFail = options.shouldFail ?? false;
    this.failureError = options.failureError;
    this.delayMs = options.delayMs ?? 0;
  }

  public setShouldFail(shouldFail: boolean, error?: PrintError): void {
    this.shouldFail = shouldFail;
    this.failureError = error;
  }

  public setDelay(delayMs: number): void {
    this.delayMs = delayMs;
  }

  public canHandle(profile: PrinterProfile, artifact: PrintArtifact): boolean {
    if (this.canHandleOverride) {
      return this.canHandleOverride(profile, artifact);
    }
    return true;
  }

  public async send(
    profile: PrinterProfile,
    artifact: PrintArtifact,
    context: PrintTransportContext
  ): Promise<PrintTransportResult> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    if (this.pauseGate) {
      await this.pauseGate;
    }

    this.dispatches.push({ profile, artifact, context });

    if (context.signal?.aborted) {
      return {
        success: false,
        error: {
          code: 'CANCELLED',
          message: 'Transport operation aborted via cancellation signal',
          retryable: false,
        },
      };
    }

    if (this.shouldFail) {
      return {
        success: false,
        error: this.failureError ?? {
          code: 'CONNECTION_REFUSED',
          message: 'Mock transport simulated connection refused',
          retryable: true,
        },
      };
    }

    const byteCount =
      artifact.type === 'zpl'
        ? new TextEncoder().encode(artifact.data).byteLength
        : artifact.data.byteLength;

    return {
      success: true,
      bytesWritten: byteCount,
    };
  }

  public reset(): void {
    this.dispatches = [];
    this.shouldFail = false;
    this.failureError = undefined;
    this.delayMs = 0;
  }
}
