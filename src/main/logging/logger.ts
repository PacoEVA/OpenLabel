import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { sanitizeLogData, sanitizeLogString } from './log-sanitizer';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  operation: string;
  message: string;
  correlationId?: string;
  errorCode?: string;
  durationMs?: number;
  details?: Record<string, unknown>;
}

export interface LoggerOptions {
  logDir?: string;
  fileName?: string;
  maxFileSizeBytes?: number;
  maxFiles?: number;
  minLevel?: LogLevel;
}

/**
 * High-performance structured logger with automated log rotation and secret redaction.
 */
export class Logger {
  private readonly logDir: string;
  private readonly fileName: string;
  private readonly maxFileSizeBytes: number;
  private readonly maxFiles: number;
  private minLevel: LogLevel;
  private currentFilePath: string;

  constructor(options: LoggerOptions = {}) {
    if (options.logDir) {
      this.logDir = options.logDir;
    } else {
      try {
        const userData = app.getPath('userData');
        this.logDir = path.join(userData, 'logs');
      } catch {
        this.logDir = path.join(process.cwd(), '.logs');
      }
    }

    this.fileName = options.fileName || 'openlabels.log';
    this.maxFileSizeBytes = options.maxFileSizeBytes || 5 * 1024 * 1024; // 5 Megabytes default
    this.maxFiles = Math.max(1, options.maxFiles || 5);
    this.minLevel = options.minLevel || 'info';
    this.currentFilePath = path.join(this.logDir, this.fileName);

    this.ensureDirSync();
  }

  private ensureDirSync(): void {
    if (!fs.existsSync(this.logDir)) {
      try {
        fs.mkdirSync(this.logDir, { recursive: true });
      } catch {
        // Ignore directory creation race
      }
    }
  }

  public setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  public getLogDir(): string {
    return this.logDir;
  }

  public getCurrentFilePath(): string {
    return this.currentFilePath;
  }

  public debug(
    component: string,
    operation: string,
    message: string,
    meta?: { correlationId?: string; durationMs?: number; details?: Record<string, unknown> }
  ): void {
    this.log('debug', component, operation, message, meta);
  }

  public info(
    component: string,
    operation: string,
    message: string,
    meta?: { correlationId?: string; durationMs?: number; details?: Record<string, unknown> }
  ): void {
    this.log('info', component, operation, message, meta);
  }

  public warn(
    component: string,
    operation: string,
    message: string,
    meta?: { correlationId?: string; errorCode?: string; durationMs?: number; details?: Record<string, unknown> }
  ): void {
    this.log('warn', component, operation, message, meta);
  }

  public error(
    component: string,
    operation: string,
    message: string,
    meta?: { correlationId?: string; errorCode?: string; durationMs?: number; details?: Record<string, unknown> }
  ): void {
    this.log('error', component, operation, message, meta);
  }

  private log(
    level: LogLevel,
    component: string,
    operation: string,
    message: string,
    meta?: { correlationId?: string; errorCode?: string; durationMs?: number; details?: Record<string, unknown> }
  ): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const cleanDetails = meta?.details ? (sanitizeLogData(meta.details) as Record<string, unknown>) : undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: sanitizeLogString(component),
      operation: sanitizeLogString(operation),
      message: sanitizeLogString(message),
      correlationId: meta?.correlationId,
      errorCode: meta?.errorCode,
      durationMs: meta?.durationMs,
      details: cleanDetails,
    };

    this.writeEntry(entry);
  }

  private writeEntry(entry: LogEntry): void {
    try {
      this.ensureDirSync();
      const line = JSON.stringify(entry) + '\n';
      const lineBytes = Buffer.byteLength(line, 'utf8');

      // Check for rotation requirement
      if (fs.existsSync(this.currentFilePath)) {
        try {
          const stats = fs.statSync(this.currentFilePath);
          if (stats.size + lineBytes > this.maxFileSizeBytes) {
            this.rotateSync();
          }
        } catch {
          // Ignore stat failure
        }
      }

      fs.appendFileSync(this.currentFilePath, line, 'utf8');
    } catch {
      // Fallback: avoid crashing application on logging I/O issues
    }
  }

  /**
   * Synchronously rotates log files:
   * openlabels.log.4 -> deleted (if maxFiles = 5)
   * openlabels.log.3 -> openlabels.log.4
   * ...
   * openlabels.log -> openlabels.log.1
   */
  public rotateSync(): void {
    try {
      // 1. Delete oldest file if it exceeds maxFiles
      const oldestIndex = this.maxFiles - 1;
      const oldestFile = path.join(this.logDir, `${this.fileName}.${oldestIndex}`);
      if (fs.existsSync(oldestFile)) {
        try {
          fs.unlinkSync(oldestFile);
        } catch {
          // Ignore unlink error
        }
      }

      // 2. Shift older rotated files down
      for (let i = oldestIndex - 1; i >= 1; i--) {
        const src = path.join(this.logDir, `${this.fileName}.${i}`);
        const dest = path.join(this.logDir, `${this.fileName}.${i + 1}`);
        if (fs.existsSync(src)) {
          try {
            fs.renameSync(src, dest);
          } catch {
            // Ignore rename error
          }
        }
      }

      // 3. Move current log to .1
      if (fs.existsSync(this.currentFilePath)) {
        const dest1 = path.join(this.logDir, `${this.fileName}.1`);
        try {
          fs.renameSync(this.currentFilePath, dest1);
        } catch {
          // Ignore rename error
        }
      }
    } catch {
      // Ignore rotation failure
    }
  }

  /**
   * Reads recent log entries in reverse-chronological order (newest first).
   * Useful for diagnostics bundle generation.
   */
  public async getRecentLogs(limit = 100): Promise<LogEntry[]> {
    if (!fs.existsSync(this.currentFilePath)) {
      return [];
    }

    try {
      const content = await fs.promises.readFile(this.currentFilePath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      const entries: LogEntry[] = [];

      for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
        try {
          const parsed = JSON.parse(lines[i]);
          entries.push(parsed);
        } catch {
          // Skip corrupt line
        }
      }

      return entries;
    } catch {
      return [];
    }
  }
}

let sharedLogger: Logger | null = null;

export function getLogger(): Logger {
  if (!sharedLogger) {
    sharedLogger = new Logger();
  }
  return sharedLogger;
}
