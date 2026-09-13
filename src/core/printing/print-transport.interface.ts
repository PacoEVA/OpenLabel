import type { PrintArtifact } from './print-artifact.types';
import type { PrinterProfile } from './printer-profile.schema';
import type { PrintError } from './print-job.types';

/**
 * Execution context provided to a transport when dispatching a job attempt.
 */
export interface PrintTransportContext {
  readonly jobId: string;
  readonly attempt: number;
  readonly signal?: AbortSignal;
}

/**
 * Result returned by a transport after attempting delivery to a physical printer or spooler.
 */
export interface PrintTransportResult {
  readonly success: boolean;
  readonly bytesWritten?: number;
  readonly error?: PrintError;
}

/**
 * Contract for all physical or virtual printing transports.
 * The PrintQueue depends exclusively on this abstraction, remaining decoupled from sockets or OS APIs.
 */
export interface PrintTransport {
  readonly type: string;

  /**
   * Evaluates if this transport is capable of handling the profile and compiled artifact.
   */
  canHandle(profile: PrinterProfile, artifact: PrintArtifact): boolean;

  /**
   * Executes the dispatch of the artifact to the printer.
   */
  send(
    profile: PrinterProfile,
    artifact: PrintArtifact,
    context: PrintTransportContext
  ): Promise<PrintTransportResult>;
}
