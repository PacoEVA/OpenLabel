# OpenLabels Release Checklist

This checklist defines the mandatory quality and security gates required before any public release of OpenLabels.

---

## 1. Pre-Release Verification

- [ ] **Version Alignment:** `package.json` reflects the target Semantic Version (e.g. `0.1.0`).
- [ ] **Changelog Updated:** `CHANGELOG.md` contains all additions, changes, fixes, and security improvements under the release heading.
- [ ] **Type Check:** `npm run typecheck` completes with 0 errors across the entire codebase.
- [ ] **Automated Test Suite:** `npm test` passes 100% green across all unit, integration, and IPC tests.
- [ ] **Settings & Document Migrations:** Verified backward compatibility with legacy settings fixtures and `.label` document fixtures.
- [ ] **Clean Build:** `npm run build` generates clean `dist/renderer/` and `dist/src/` artifacts without compiling test files.

---

## 2. Packaging & Security Audit

- [ ] **Electron Security Configuration:**
  - `contextIsolation: true`
  - `sandbox: true`
  - `webSecurity: true`
  - `nodeIntegration: false`
  - `setWindowOpenHandler` denies unauthorized popups.
  - Strict Content Security Policy (no `unsafe-eval` or unauthorized remote hosts).
- [ ] **IPC Boundary Review:** Zero generic IPC primitives (`window.ipcRenderer` is inaccessible).
- [ ] **Credential Audit:** Zero passwords, tokens, or private keys in repository, logs, or diagnostics bundles.
- [ ] **Dependency & License Audit:** All runtime dependencies are permissive (MIT/ISC) and free of known high/critical CVEs.
- [ ] **Packaging Verification:** `npm run package` successfully produces `release/win-unpacked/OpenLabels.exe`.
- [ ] **Installer Generation:** `npm run dist` produces `OpenLabels Setup <version>.exe` with per-user installation.
- [ ] **Installer Smoke Tests:**
  - Launch, create new label, add text/barcode, preview ZPL and PDF.
  - Test Settings dialog and diagnostics export.
  - Confirm uninstall does not delete user data or saved labels.

---

## 3. Checksums & Code Signing

- [ ] **Code Signing:** If production release keys are available, verify authenticode signature on the installer executable.
- [ ] **Checksum Generation:** Run `node scripts/generate-checksums.js` to create `release/SHA256SUMS.txt`.
- [ ] **Checksum Verification:** Validate that the SHA-256 hash matches the executable artifact.

---

## 4. Release Publishing

- [ ] **Git Tagging:** Create an annotated Git tag matching the version (e.g., `git tag -a v0.1.0 -m "Release v0.1.0"`).
- [ ] **Push Tag:** `git push origin v0.1.0`.
- [ ] **CI Release Pipeline:** Confirm that GitHub Actions workflow completes successfully.
- [ ] **Attach Artifacts:** Ensure installer `.exe`, `latest.yml`, and `SHA256SUMS.txt` are published in GitHub Releases.
