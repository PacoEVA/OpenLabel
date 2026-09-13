# Security Policy

OpenLabels takes software security seriously, especially given its role in industrial printing and hardware integration.

---

## Supported Versions

| Version | Supported          |
| :--- | :--- |
| `0.1.x` | :white_check_mark: |
| `< 0.1.0` | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability in OpenLabels, please do NOT create a public GitHub issue.

Instead, please report vulnerabilities by email or via GitHub Private Vulnerability Reporting:
- **Project Maintainers:** `security@openlabels.local` (or via private repository advisories)

Please provide:
1. A description of the issue.
2. Step-by-step reproduction instructions or proof-of-concept.
3. Potential impact on the host system or printer hardware.

We will acknowledge receipt of your report within 48 hours and work with you to remediate the vulnerability promptly.

---

## Security Guarantees & Non-Negotiables

OpenLabels enforces strict technical controls:
- **Sandbox:** All renderer processes run in Chromium sandboxes without Node.js integration.
- **Context Isolation:** Active on all browser windows.
- **Content Security Policy:** Production builds enforce strict CSP blocking remote scripts and inline evaluation.
- **Credential Protection:** External database credentials and API tokens are encrypted in an AES-256-GCM local vault and are never serialized into document files or logs.
- **No Command Execution:** No shell commands (`exec`, `spawn`, `cmd.exe`, `powershell.exe`) are invoked on user inputs.
