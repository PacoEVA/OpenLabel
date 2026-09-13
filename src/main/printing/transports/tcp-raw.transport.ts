import * as net from 'node:net';
import type {
  PrintTransport,
  PrintTransportContext,
  PrintTransportResult,
  PrinterProfile,
  PrintArtifact,
  PrintError,
} from '../../../core/printing';

export interface TcpRawTransportOptions {
  defaultTimeoutMs?: number;
}

export class TcpRawTransport implements PrintTransport {
  public readonly type = 'tcp-raw';
  private readonly defaultTimeoutMs: number;

  constructor(options: TcpRawTransportOptions = {}) {
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 5000;
  }

  public canHandle(profile: PrinterProfile, artifact: PrintArtifact): boolean {
    return profile.connection.type === 'tcp' && artifact.type === 'zpl';
  }

  public async send(
    profile: PrinterProfile,
    artifact: PrintArtifact,
    context: PrintTransportContext
  ): Promise<PrintTransportResult> {
    if (profile.connection.type !== 'tcp') {
      return {
        success: false,
        error: {
          code: 'UNSUPPORTED_ARTIFACT',
          message: `TcpRawTransport cannot handle profile connection type "${profile.connection.type}"`,
          retryable: false,
        },
      };
    }

    if (artifact.type !== 'zpl') {
      return {
        success: false,
        error: {
          code: 'UNSUPPORTED_ARTIFACT',
          message: `TcpRawTransport only supports ZPL artifacts, received "${artifact.type}"`,
          retryable: false,
        },
      };
    }

    if (context.signal?.aborted) {
      return {
        success: false,
        error: {
          code: 'CANCELLED',
          message: 'Print dispatch cancelled before connection',
          retryable: false,
        },
      };
    }

    const { host, port } = profile.connection;
    const timeoutMs = profile.connection.timeoutMs ?? this.defaultTimeoutMs;

    return new Promise<PrintTransportResult>((resolve) => {
      let settled = false;
      let bytesWritten = 0;

      const socket = new net.Socket();

      let connectTimer: NodeJS.Timeout | undefined = setTimeout(() => {
        finish({
          success: false,
          error: {
            code: 'CONNECTION_TIMEOUT',
            message: `Connection timed out after ${timeoutMs}ms connecting to ${host}:${port}`,
            retryable: true,
          },
        });
      }, timeoutMs);

      const finish = (result: PrintTransportResult): void => {
        if (settled) return;
        settled = true;

        if (connectTimer) {
          clearTimeout(connectTimer);
          connectTimer = undefined;
        }

        socket.removeAllListeners();
        socket.destroy();

        if (context.signal) {
          context.signal.removeEventListener('abort', onAbort);
        }

        resolve(result);
      };

      const onAbort = (): void => {
        finish({
          success: false,
          error: {
            code: 'CANCELLED',
            message: 'Dispatch aborted via cancellation signal during TCP transmission',
            retryable: false,
          },
        });
      };

      if (context.signal) {
        context.signal.addEventListener('abort', onAbort, { once: true });
      }

      socket.setTimeout(timeoutMs);

      socket.on('timeout', () => {
        finish({
          success: false,
          error: {
            code: 'CONNECTION_TIMEOUT',
            message: `Socket timed out after ${timeoutMs}ms connecting to ${host}:${port}`,
            retryable: true,
          },
        });
      });

      socket.on('error', (err: NodeJS.ErrnoException) => {
        let code: PrintError['code'] = 'UNKNOWN_PRINT_ERROR';
        let retryable = false;

        if (err.code === 'ECONNREFUSED') {
          code = 'CONNECTION_REFUSED';
          retryable = true;
        } else if (err.code === 'ETIMEDOUT') {
          code = 'CONNECTION_TIMEOUT';
          retryable = true;
        } else if (err.code === 'ECONNRESET') {
          code = 'CONNECTION_RESET';
          retryable = true;
        }

        finish({
          success: false,
          error: {
            code,
            message: `TCP socket error (${err.code ?? 'UNKNOWN'}): ${err.message}`,
            retryable,
            details: err.code,
          },
        });
      });

      socket.connect(port, host, () => {
        if (connectTimer) {
          clearTimeout(connectTimer);
          connectTimer = undefined;
        }
        if (context.signal?.aborted) {
          onAbort();
          return;
        }

        const payloadBuffer = Buffer.from(artifact.data, 'utf8');
        bytesWritten = payloadBuffer.byteLength;

        socket.write(payloadBuffer, (writeErr) => {
          if (writeErr) {
            finish({
              success: false,
              error: {
                code: 'CONNECTION_RESET',
                message: `Failed writing data to ${host}:${port}: ${writeErr.message}`,
                retryable: true,
              },
            });
            return;
          }

          socket.end(() => {
            finish({
              success: true,
              bytesWritten,
            });
          });
        });
      });
    });
  }

  /**
   * Safe test connection check that only verifies TCP handshake and disconnects
   * without sending destructive commands.
   */
  public async testConnection(
    host: string,
    port: number,
    timeoutMs: number = 3000
  ): Promise<{ success: boolean; message: string }> {
    return new Promise<{ success: boolean; message: string }>((resolve) => {
      let settled = false;
      const socket = new net.Socket();

      const finish = (success: boolean, message: string): void => {
        if (settled) return;
        settled = true;
        socket.removeAllListeners();
        socket.destroy();
        resolve({ success, message });
      };

      socket.setTimeout(timeoutMs);

      socket.on('timeout', () => {
        finish(false, `Connection timed out after ${timeoutMs}ms connecting to ${host}:${port}`);
      });

      socket.on('error', (err: NodeJS.ErrnoException) => {
        finish(false, `Connection failed (${err.code ?? 'ERROR'}): ${err.message}`);
      });

      socket.connect(port, host, () => {
        finish(true, `Successfully established TCP connection to ${host}:${port}`);
      });
    });
  }
}
