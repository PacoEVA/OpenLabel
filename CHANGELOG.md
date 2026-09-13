# Changelog

All notable changes to the OpenLabels project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-09-13 (Phase 10 Release Candidate)

### Added
- **Application Preferences & Migrations (Phase 10):**
  - Pure domain `AppSettingsSchema` with versioning and deterministic sequential migrations (`src/core/settings/`).
  - Atomic persistence service in main process (`userData/settings.json`) with `.corrupt` quarantine protection.
  - Multi-tab preferences UI dialog (General, Appearance, Editor, Printing, Data, Advanced, About).
- **Structured Logging & Rotation:**
  - High-performance NDJSON structured logger with automatic rotation (5 MB per file, max 5 files).
  - Recursive secret sanitizer redacting passwords, API tokens, and authorization headers.
- **Crash Handling & Diagnostics:**
  - React `ErrorBoundary` in renderer preventing white screens and preserving user work.
  - Main process `uncaughtException` and `unhandledRejection` logging and safe dialogs.
  - Exportable sanitized diagnostics bundle for troubleshooting.
- **Production Build & Packaging:**
  - Cross-platform unified build pipeline: `typecheck`, `test`, `build`, `package`, `dist`.
  - Windows x64 per-user NSIS installer (`OpenLabels Setup 0.1.0.exe`) with desktop and start menu shortcuts.
  - Automated SHA-256 checksum generation (`SHA256SUMS.txt`).
- **Batch Production & Preflight (Phase 9):**
  - Bounded concurrency print coordination (never dispatches 10,000 jobs simultaneously).
  - Preflight checks, batch progress tracking, pause/resume, and crash recovery.
- **External Data Sources (Phase 8):**
  - Adapters for CSV, Excel (.xlsx), Microsoft SQL Server (TDS), and REST endpoints.
  - AES-256-GCM local credential vault protecting database and API credentials.
- **Variable Data Engines (Phase 7):**
  - Alphanumeric serial counters with padding and step rules.
  - Real-time date/time engine with custom formatting tokens.
- **Document & Printing Subsystems (Phases 1-6):**
  - Dual ZPL II and vector PDF output generation.
  - Barcode symbologies: Code 128, EAN-13, QR Code, Data Matrix.
  - WYSIWYG 2D canvas editor with zooming, snapping, alignment, and physical millimeter conversion.

### Changed
- Refactored build tooling to strictly decouple production compilation (`tsconfig.build.json`) from test files.
- Upgraded Content Security Policy to enforce zero `'unsafe-eval'` and zero `'unsafe-inline'` script execution.

### Fixed
- Fixed race conditions during atomic file replacement in Windows filesystem.
- Hardened IPC channels to prevent arbitrary path traversal or unbounded memory consumption.

### Security
- Strict context isolation (`contextIsolation: true`, `sandbox: true`, `webSecurity: true`, `nodeIntegration: false`).
- Removed all generic IPC primitives (`window.ipcRenderer` is inaccessible).
- Verified zero usage of `child_process` (`exec`, `spawn`, `execFile`) across application source code.
- Credential vault sanitization: secrets are never serialized into `.label` files or returned to the renderer.
