# OpenLabels Technical & Developer Architecture

This document describes the technical architecture, internal data structures, IPC contracts, and security model of OpenLabels.

---

## 1. System Architecture Overview

OpenLabels follows strict modular separation into four distinct layers:

```text
┌─────────────────────────────────────────────────────────────┐
│                      Renderer Layer                         │
│   (React 19, Konva canvas, Tailwind CSS, Motion, Zustand)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Strict Context Bridge (Preload)
┌──────────────────────────────▼──────────────────────────────┐
│                    Preload & IPC Boundary                   │
│   (Zod Validation, No window.ipcRenderer, Explicit APIs)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Typed IPC Handlers
┌──────────────────────────────▼──────────────────────────────┐
│                      Main Process                           │
│   (Electron Lifecycle, Printing Queue, Credential Vault,    │
│    Production Coordinator, Settings Service, File I/O)      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Pure Domain Logic
┌──────────────────────────────▼──────────────────────────────┐
│                       Core Domain                           │
│   (Pure TypeScript, Metric Converters, Schemas,             │
│    ZPL & PDF Compilers, Variable Engines, Barcode Logic)    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Core Domain Isolation

The `src/core/` directory contains **pure TypeScript logic** with zero external platform dependencies:
- **No imports from Electron, Node.js (`fs`, `net`, `child_process`), or the browser DOM.**
- All coordinate transformations work in physical millimeters (`mm`). Conversions to dots or screen pixels are pure functions (`convertMmToDots(mm, dpi)`).
- Zoom levels on the canvas are purely visual transformations and never mutate document models.

---

## 3. Label Document Model (`LabelDocument`)

The `.label` file format is versioned (`version: "1.0.0"`) and serialized as validated JSON.

```ts
interface LabelDocument {
  id: string;
  version: string;
  name: string;
  dimensions: {
    widthMm: number;
    heightMm: number;
    dpi: 203 | 300 | 600;
    orientation: 'portrait' | 'landscape';
  };
  elements: LabelElement[];
  dataModel?: DataModel;
}
```

Elements are modeled as discriminated unions:
- `text`: typography, alignment, formatting, and data bindings.
- `barcode`: symbology (`code128`, `ean13`, `qrcode`, `datamatrix`), X-dimension quantization, and error correction.
- `line` & `rectangle`: coordinates, stroke widths, fills, and corner radii.

---

## 4. Printing & Compilers

- **ZPL Compiler (`src/core/compilers/zpl/`):** Translates pure `LabelDocument` structures into standard ZPL II commands (`^XA`, `^FO`, `^FD`, `^BC`, `^BQ`, `^XZ`).
- **PDF Renderer (`src/main/export/pdf/`):** Generates vector PDF files using PDFKit with exact physical point calculations (72 points/inch).
- **Print Queue & Bounded Concurrency:** The main process production coordinator streams jobs in bounded batches (e.g. 5 concurrent connections max), ensuring the printer spooler or network buffer is never overwhelmed.

---

## 5. Security & Isolation Architecture

1. **Chromium Sandboxing:**
   ```ts
   webPreferences: {
     contextIsolation: true,
     sandbox: true,
     webSecurity: true,
     nodeIntegration: false
   }
   ```
2. **Restricted Navigation & Popups:**
   `win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))`
   All navigation attempts outside of local application bundles are canceled.
3. **No Shell Execution:**
   No child processes (`child_process.exec`, `child_process.spawn`) are ever invoked.
4. **Credential Vault:**
   External database credentials and API headers are encrypted in an AES-256-GCM vault located in the OS user data directory. The vault key is protected by OS-level encryption or salted machine hashes.

---

## 6. Build & Packaging Pipeline

- **Vite:** Compiles and bundles renderer React code to `dist/renderer/`.
- **TypeScript:** Compiles main and preload processes using `tsconfig.build.json` to `dist/src/`.
- **electron-builder:** Packages the output into a signed or unsigned per-user Windows x64 NSIS installer (`release/OpenLabels Setup 0.1.0.exe`).
