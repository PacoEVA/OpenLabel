# Contributing to OpenLabels

Thank you for your interest in contributing to OpenLabels! We welcome contributions to improve label design capabilities, barcode handling, printer integrations, and application reliability.

---

## Architectural Principles

Before contributing code, please review [`AGENTS.md`](./AGENTS.md). All contributions must strictly adhere to the following principles:

1. **Separation of Concerns:**
   - `src/core/`: Pure TypeScript domain logic. No Electron, DOM, or Node.js imports.
   - `src/main/`: Electron main process, secure IPC handlers, system operations, and printing transports.
   - `src/preload/`: Strictly typed, narrow context bridge APIs. No generic IPC primitives.
   - `src/renderer/`: User interface and visual canvas editing.

2. **Security is Inviolable:**
   - Never disable `contextIsolation`, `sandbox`, or `webSecurity`.
   - Never enable `nodeIntegration`.
   - Never expose generic filesystem or shell execution APIs to the renderer.
   - All IPC endpoints must validate payloads with Zod schemas.

3. **Vendor Independence:**
   - The internal label representation (`LabelDocument`) must never be coupled to a specific printer manufacturer.
   - Device-specific commands belong strictly in compiler backends (e.g. ZPL II compiler).

---

## Development Workflow

1. Fork the repository and create a feature branch:
   ```bash
   git checkout -b feature/my-enhancement
   ```

2. Install dependencies:
   ```bash
   npm ci
   ```

3. Make your changes adhering to TypeScript strict mode.

4. Run the quality assurance pipeline:
   ```bash
   npm run typecheck
   npm test
   npm run build
   ```

5. Ensure all tests pass with zero warnings or suppressed errors before opening a Pull Request.
