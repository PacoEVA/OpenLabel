import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Logger } from '../../../src/main/logging/logger';
import { sanitizeLogData, sanitizeLogString } from '../../../src/main/logging/log-sanitizer';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Structured Logging & Rotation (Fase 10 - Bloque 3)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openlabels-log-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe('Sanitizer', () => {
    it('redacts sensitive keys in object properties', () => {
      const data = {
        username: 'admin',
        password: 'super_secret_123',
        apiToken: 'tok_abc123',
        normalConfig: 'active',
      };

      const clean = sanitizeLogData(data) as Record<string, unknown>;
      expect(clean.username).toBe('admin');
      expect(clean.normalConfig).toBe('active');
      expect(clean.password).toBe('***REDACTED***');
      expect(clean.apiToken).toBe('***REDACTED***');
    });

    it('redacts Bearer tokens and passwords in text strings', () => {
      const text = 'Failed auth: Bearer eyJhbGciOi... with password=my_db_pass';
      const clean = sanitizeLogString(text);
      expect(clean).not.toContain('eyJhbGciOi');
      expect(clean).not.toContain('my_db_pass');
      expect(clean).toContain('Bearer ***REDACTED***');
      expect(clean).toContain('password=***REDACTED***');
    });
  });

  describe('Logger Writing & Levels', () => {
    it('writes formatted JSON log entries to file', async () => {
      const logger = new Logger({
        logDir: tmpDir,
        fileName: 'test.log',
        minLevel: 'debug',
      });

      logger.info('PrintingService', 'DISPATCH', 'Dispatched job to printer', {
        correlationId: 'job-123',
        durationMs: 45,
        details: { copies: 2 },
      });

      const logPath = path.join(tmpDir, 'test.log');
      expect(fs.existsSync(logPath)).toBe(true);

      const content = fs.readFileSync(logPath, 'utf8').trim();
      const parsed = JSON.parse(content);
      expect(parsed.level).toBe('info');
      expect(parsed.component).toBe('PrintingService');
      expect(parsed.operation).toBe('DISPATCH');
      expect(parsed.message).toBe('Dispatched job to printer');
      expect(parsed.correlationId).toBe('job-123');
      expect(parsed.durationMs).toBe(45);
      expect(parsed.details.copies).toBe(2);
    });

    it('filters out messages below minLevel', async () => {
      const logger = new Logger({
        logDir: tmpDir,
        fileName: 'test.log',
        minLevel: 'warn',
      });

      logger.debug('Core', 'CALC', 'Ignored debug');
      logger.info('Core', 'INIT', 'Ignored info');
      logger.warn('Core', 'TIMEOUT', 'Recorded warning');

      const logPath = path.join(tmpDir, 'test.log');
      const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
      expect(lines.length).toBe(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.level).toBe('warn');
      expect(parsed.message).toBe('Recorded warning');
    });
  });

  describe('Log Rotation', () => {
    it('rotates log files when exceeding maxFileSizeBytes and respects maxFiles cap', () => {
      const logger = new Logger({
        logDir: tmpDir,
        fileName: 'rotated.log',
        maxFileSizeBytes: 500, // Small size to force rotation quickly
        maxFiles: 3, // Keeps at most rotated.log, rotated.log.1, rotated.log.2
      });

      // Write enough entries to cause multiple rotations
      for (let i = 0; i < 20; i++) {
        logger.info('Test', 'ENTRY', `Message entry #${i} with some padding content to fill up bytes`);
      }

      const files = fs.readdirSync(tmpDir);
      expect(files).toContain('rotated.log');
      expect(files).toContain('rotated.log.1');
      expect(files).toContain('rotated.log.2');
      // Should not exceed maxFiles
      expect(files).not.toContain('rotated.log.3');
    });
  });

  describe('Recent Logs Retrieval', () => {
    it('retrieves recent logs in reverse chronological order', async () => {
      const logger = new Logger({
        logDir: tmpDir,
        fileName: 'history.log',
      });

      logger.info('App', 'START', 'First message');
      logger.info('App', 'STEP', 'Second message');
      logger.info('App', 'END', 'Third message');

      const recent = await logger.getRecentLogs(2);
      expect(recent.length).toBe(2);
      expect(recent[0].message).toBe('Third message');
      expect(recent[1].message).toBe('Second message');
    });
  });
});
