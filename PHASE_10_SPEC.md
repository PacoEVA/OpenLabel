# ESPECIFICACIÓN TÉCNICA: FASE 10 - PRODUCTO FINAL, EMPAQUETADO, HARDENING, DOCUMENTACIÓN Y RELEASE

## 1. Contexto de la Fase

Las fases anteriores construyeron el ciclo funcional completo:

```text
Fase 1  -> núcleo, seguridad y unidades físicas
Fase 2  -> editor WYSIWYG
Fase 3  -> códigos de barras 1D/2D
Fase 4  -> PrintPlan, ZPL II y PDF
Fase 5  -> impresión real, PrintQueue y transports
Fase 6  -> archivos .label, autosave, recovery y templates
Fase 7  -> variables, counters y ResolvedRecord
Fase 8  -> CSV, Excel, SQL, REST, Dataset y FieldMapping
Fase 9  -> producción masiva, preflight, ProductionRun y recuperación
```

La Fase 10 no busca añadir una nueva gran capacidad funcional.

Su propósito es transformar el proyecto en una aplicación de escritorio distribuible, instalable, actualizable, diagnosticable, documentada y preparada para una primera versión estable open source.

Esta fase debe respetar completamente:

```text
AGENTS.md
PHASE_1_SPEC.md
PHASE_2_SPEC.md
PHASE_3_SPEC.md
PHASE_4_SPEC.md
PHASE_5_SPEC.md
PHASE_6_SPEC.md
PHASE_7_SPEC.md
PHASE_8_SPEC.md
PHASE_9_SPEC.md
```

## 2. Objetivo Principal

Preparar una versión `v1.0.0` o equivalente que pueda:

- compilarse de forma reproducible;
- empaquetarse;
- instalarse;
- desinstalarse;
- ejecutarse sin entorno de desarrollo;
- almacenar configuración correctamente;
- actualizarse de forma segura;
- proteger sus fronteras Electron;
- sobrevivir a errores comunes;
- producir logs útiles;
- respetar privacidad;
- documentarse;
- publicarse como proyecto open source;
- generar releases repetibles.

## 3. Alcance

Incluye:

1. auditoría final de arquitectura;
2. identidad del producto;
3. versionado de aplicación;
4. configuración global;
5. persistencia de preferencias;
6. empaquetado Electron;
7. instalador;
8. build Windows prioritario;
9. estrategia cross-platform;
10. recursos/iconos;
11. actualización de aplicación;
12. canales de release;
13. hardening Electron;
14. CSP final;
15. navegación/ventanas/permisos;
16. logging y diagnóstico;
17. crash/error handling;
18. backup/recovery final;
19. privacidad;
20. auditoría de dependencias;
21. licencias de terceros;
22. licencia open source;
23. documentación de usuario;
24. documentación técnica;
25. CONTRIBUTING/SECURITY/CHANGELOG;
26. CI;
27. build de release;
28. artefactos de release;
29. checksums;
30. smoke tests del instalador;
31. no-regresión completa.

No incluye nuevas features grandes de producto.

## 4. Principio de la Fase

Prioridad:

```text
estabilidad
seguridad
distribución
mantenibilidad
documentación
```

No introducir nuevas features grandes salvo necesidad real de release.

## 5. Release Candidate Gate

Antes de empaquetar:

```bash
npx tsc --noEmit
npx vitest run
```

deben estar en verde.

Además:

- no `skip`;
- no `only`;
- no `any` como parche;
- no warnings críticos ignorados;
- no credenciales de desarrollo;
- no paths locales hardcoded;
- no APIs inseguras temporales.

## 6. Auditoría del Repositorio

Antes de tocar packaging revisar:

```text
package.json
lockfile
electron entry
preload
renderer
Vite config
TypeScript configs
test config
current build scripts
current packaging dependencies
assets
icons
environment variables
```

No instalar otra solución de empaquetado sin revisar lo que ya existe.

## 7. Identidad del Producto

Definir consistentemente:

```text
productName
appId
version
executable name
author/company metadata
repository
homepage
issue tracker
```

No duplicar valores si pueden centralizarse.

## 8. Versionado

Usar Semantic Versioning:

```text
MAJOR.MINOR.PATCH
```

No confundir:

```text
application version
LabelFile formatVersion
LabelDocument version
recoveryVersion
```

La versión de aplicación debe tener una fuente única de verdad, preferiblemente `package.json` o equivalente.

## 9. AppSettings

Crear o consolidar:

```text
AppSettings
```

separado del `.label`.

Puede incluir:

```text
theme
language
default unit
default DPI
autosave enabled
autosave interval
recent files limit
default printer profile
update channel
check updates automatically
```

Debe validarse con Zod y tener estrategia de migración.

## 10. Settings Storage

Guardar en ubicación apropiada del sistema, por ejemplo:

```text
app.getPath('userData')
```

No usar la carpeta del ejecutable.

Preferir escritura segura/atómica.

Las credenciales de Fase 8 siguen separadas.

## 11. Settings API

Exponer acciones específicas:

```text
window.settingsAPI.get()
window.settingsAPI.update(...)
window.settingsAPI.reset()
```

No exponer filesystem genérico.

## 12. Packaging

Auditar qué herramienta utiliza actualmente el proyecto.

Opciones habituales:

```text
Electron Forge
electron-builder
```

No instalar ambas.

Antes de cambiar herramienta documentar:

```text
Estado actual
Opciones
Decisión
Motivo
Impacto
Migration cost
```

## 13. Target Prioritario

Primera plataforma prioritaria:

```text
Windows 10/11 x64
```

Evitar bloquear soporte futuro de macOS/Linux.

## 14. Instalador

Generar un instalador adecuado.

Si se usa electron-builder, NSIS puede ser una opción razonable, pero no debe imponerse si la arquitectura actual utiliza otra solución.

La desinstalación no debe borrar silenciosamente documentos `.label` del usuario.

## 15. Recursos del Build

No empaquetar innecesariamente:

```text
tests
fixtures no necesarios
.env
secrets
dev scripts
large unused assets
```

## 16. Variables de Entorno

Auditar y clasificar:

```text
build-time
runtime
development-only
secret
```

No empaquetar secretos.

No depender de `.env` en producción sin estrategia explícita.

## 17. Iconos

Preparar recursos adecuados para cada plataforma soportada.

Windows:

```text
.ico
```

con tamaños apropiados.

## 18. Asociación `.label`

Opcional para v1.

Si se implementa:

```text
double-click .label
↓
open app
↓
validate file
↓
safe open flow
```

Nunca saltarse validaciones de Fase 6.

## 19. Single Instance

Evaluar `app.requestSingleInstanceLock()` si la UX es de instancia única.

Una segunda apertura de `.label` debe respetar el flujo de cambios sin guardar.

## 20. Auto Update

Definir estrategia segura:

```text
check
download
install
```

Para open source puede utilizarse el proveedor real de releases del proyecto, por ejemplo GitHub Releases si corresponde.

No hardcodear una solución sin revisar el hosting actual.

## 21. Seguridad de Updates

Las actualizaciones deben:

- usar HTTPS;
- provenir de fuente controlada;
- verificar metadata/firma cuando aplique;
- no aceptar URL arbitraria desde renderer.

Renderer solo expone operaciones de dominio:

```text
checkForUpdates()
downloadUpdate()
installUpdate()
```

## 22. Update Guards

No reiniciar/actualizar mientras exista:

```text
active ProductionRun
dirty document
critical PrintJob
```

sin resolver.

## 23. Code Signing

Evaluar firma para distribución pública.

No guardar en Git:

```text
.pfx
private key
certificate password
```

Usar secretos seguros de CI/release.

## 24. Hardening Electron

Auditar:

```text
BrowserWindow
preload
contextBridge
IPC
navigation
permissions
new windows
CSP
external URLs
webContents
```

Debe permanecer:

```text
contextIsolation: true
nodeIntegration: false
sandbox: true
webSecurity: true
```

## 25. WebView / Navegación

Preferir `webviewTag` desactivado.

Bloquear navegación inesperada y nuevas ventanas arbitrarias.

URLs externas deben pasar por función explícita y validada.

## 26. Permisos

Política deny-by-default.

La app no debería necesitar cámara, micrófono o geolocalización para su función principal.

## 27. CSP

Definir CSP estricta de producción.

Objetivo conceptual:

```text
default-src 'self'
script-src 'self'
```

Ajustar únicamente a necesidades reales.

No usar `unsafe-eval` en producción.

## 28. Dev vs Production

Excepciones del dev server no deben copiarse automáticamente al build final.

## 29. IPC Audit

Inventariar APIs como:

```text
labelAPI
documentAPI
printAPI
dataSourceAPI
productionAPI
settingsAPI
updateAPI
```

Para cada método documentar:

```text
input schema
output schema
side effects
security assumptions
```

Eliminar canales obsoletos/genéricos.

## 30. Preload Audit

No exponer directamente:

```text
ipcRenderer
fs
path
net
child_process
shell
process.env
```

## 31. Dependencias

Auditar:

```text
production dependencies
dev dependencies
native modules
unused packages
abandoned packages
duplicate packages
licenses
```

Eliminar dependencias no utilizadas.

## 32. Vulnerabilities

Ejecutar auditorías disponibles, por ejemplo:

```bash
npm audit
```

No usar `--force` de forma automática si introduce breaking changes.

## 33. Supply Chain

Mantener lockfile versionado.

CI debe usar instalación reproducible, por ejemplo:

```bash
npm ci
```

## 34. Licencias

Generar inventario de licencias runtime.

Antes de v1 debe existir una licencia explícita del proyecto.

Opciones típicas:

```text
MIT
Apache-2.0
GPL-3.0
```

La decisión final pertenece al propietario del proyecto; el agente no debe cambiarla unilateralmente.

Crear `THIRD_PARTY_NOTICES` si las obligaciones lo requieren.

## 35. Logging

Consolidar niveles:

```text
debug
info
warn
error
```

Evitar registrar:

```text
passwords
tokens
Authorization headers
full connection strings
full label contents
full ZPL
PDF bytes
personal data
```

Agregar rotación/retención razonable.

## 36. Diagnóstico

Agregar una acción equivalente a:

```text
Export Diagnostics
```

Puede incluir:

```text
app version
OS
architecture
Electron version
Node version
recent sanitized error codes
sanitized configuration
printer metadata without secrets
```

No incluir documentos o datasets sin acción explícita.

## 37. Error Handling

Validar:

- Error Boundary en renderer;
- manejo controlado de errores en Main;
- recovery de documentos;
- recovery de producción.

Un error de UI no debe provocar pérdida silenciosa de un documento dirty.

## 38. Graceful Shutdown

Antes de cerrar revisar:

```text
dirty document?
active production?
active jobs?
pending writes?
```

## 39. Startup

Secuencia segura:

```text
load settings
↓
validate/migrate
↓
document recovery
↓
production recovery
↓
UI
```

Settings corruptos deben poder recuperarse con defaults seguros.

## 40. README

Debe explicar:

```text
qué es
features
screenshots
supported printers/formats
installation
development
security model
roadmap/status
license
```

No prometer soporte inexistente.

## 41. User Guide

Documentar:

```text
Create label
Editor
Barcodes
Save/Open
Variables
CSV/Excel
SQL/REST
Print
Batch production
Recovery
Troubleshooting
```

## 42. Printer Guide

Documentar:

```text
ZPL TCP
port 9100
DPI
PDF/system printer
sent vs physically printed
```

## 43. Developer Docs

Documentar arquitectura:

```text
core
main
preload
renderer
LabelDocument
ResolvedDocument
PrintPlan
PrintQueue
ProductionRun
DataSourceAdapter
```

## 44. CONTRIBUTING.md

Incluir:

```text
setup
workflow
tests
coding rules
security rules
how to add barcode
how to add datasource
how to add transport
```

## 45. SECURITY.md

Definir proceso para reportar vulnerabilidades y versiones soportadas.

## 46. CHANGELOG

Usar una convención consistente.

Puede basarse en Keep a Changelog o equivalente.

## 47. CI

Pipeline mínimo:

```text
install
typecheck
tests
build
```

Con lockfile y `npm ci` cuando aplique.

## 48. Release Workflow

Flujo:

```text
tag
↓
CI
↓
typecheck
↓
tests
↓
build
↓
package
↓
checksums
↓
release artifacts
```

Usar tags semánticos como:

```text
v1.0.0
```

## 49. Artefactos

Nombres claros, por ejemplo:

```text
ProductName-Setup-1.0.0-x64.exe
```

Generar SHA-256 para artefactos publicados.

## 50. SBOM

Evaluar generación de SBOM:

```text
CycloneDX
SPDX
```

si no añade complejidad desproporcionada.

## 51. Smoke Test del Instalador

En una VM/máquina limpia probar:

```text
install
launch
create label
save
open
export PDF
generate ZPL
system printers
TCP profile
close
reopen
uninstall
```

## 52. No Dependencias de Desarrollo

El usuario final no debe necesitar:

```text
Node.js
npm
Vite dev server
Visual Studio
Python
```

salvo requerimientos externos reales.

## 53. Smoke Test Funcional

Desde build empaquetado probar:

```text
ZPL TCP
PDF/system printing
CSV
XLSX
SQL engine prioritario
REST
production batch
recovery
```

## 54. Paths Empaquetados

Verificar:

```text
preload
assets
templates
icons
```

tanto en dev como en producción.

## 55. Native Dependencies

Si existen módulos nativos validar:

```text
Electron ABI
architecture
rebuild
packaging
installer
```

## 56. Offline Operation

Debe funcionar offline:

```text
design
save/open
barcode
PDF
ZPL
local printing
CSV/Excel
```

Las funciones remotas dependen de conectividad.

## 57. Settings UI

Consolidar panel:

```text
General
Editor
Printing
Autosave
Updates
Privacy/Diagnostics
About
```

## 58. About

Mostrar:

```text
product name
version
license
repository
check for updates
```

## 59. Accessibility

Revisar:

```text
keyboard
tab navigation
focus
dialogs
labels
contrast
prefers-reduced-motion
```

## 60. UI Consistency

Revisar:

```text
buttons
dialogs
forms
errors
warnings
empty states
loading states
toasts
```

No rediseñar todo sin necesidad.

## 61. Known Issues

Mantener lista realista de limitaciones conocidas.

No ocultar limitaciones de drivers, Unicode ZPL o plataformas no probadas.

## 62. Performance Final

Medir:

```text
startup
large label
many elements
barcode-heavy document
large preview
production batch
```

Optimizar con datos, no intuición.

## 63. Memory Leaks

Revisar:

```text
event listeners
IPC subscriptions
Konva nodes
timers
AbortControllers
PrintQueue listeners
ProductionRun listeners
```

## 64. Security Checklist Final

Debe cumplirse:

```text
no Node in renderer
context isolation on
sandbox on
webSecurity on
strict CSP
no unsafe eval
no generic IPC
no generic filesystem API
no generic HTTP API
no arbitrary SQL API
no raw socket API
no raw ZPL from renderer
secrets outside .label
sanitized logs
controlled update source
```

## 65. Release Blockers

No publicar si existe:

```text
data corruption
unsafe IPC
credential leak
arbitrary command execution
arbitrary filesystem access
destructive SQL path
automatic duplicate print risk
broken migrations
broken installer
critical test regression
```

## 66. Orden Secuencial

### Paso 1 — Auditoría

Leer:

```text
AGENTS.md
PHASE_1_SPEC.md
...
PHASE_10_SPEC.md
```

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

Auditar packaging actual.

### Paso 2 — AppSettings

Implementar/consolidar:

```text
AppSettingsSchema
defaults
migration
tests
```

### Paso 3 — Settings Service/UI

Persistencia segura y panel.

### Paso 4 — Packaging Strategy

Documentar herramienta actual/elegida.

### Paso 5 — Installer

Build Windows x64 e instalación/desinstalación.

### Paso 6 — Production Paths

Corregir preload/assets/templates/icons para packaged build.

### Paso 7 — Hardening

BrowserWindow, CSP, navigation, permissions, preload e IPC.

### Paso 8 — Logging/Diagnostics

Sanitización y export diagnostics.

### Paso 9 — Update Strategy

Solo después de packaging/provider.

### Paso 10 — Release Guards

Dirty document/active production/critical job.

### Paso 11 — Documentation

README, CONTRIBUTING, SECURITY, CHANGELOG y guías.

### Paso 12 — License Review

Confirmar licencia y third-party notices.

### Paso 13 — CI

`npm ci`, typecheck, tests, build.

### Paso 14 — Release Pipeline

Tag -> package -> checksum -> artifacts.

### Paso 15 — Smoke Test

Validar en entorno limpio.

### Paso 16 — Security Review

Checklist final.

### Paso 17 — Full Regression

```bash
npx tsc --noEmit
npx vitest run
```

más smoke tests.

### Paso 18 — Release Candidate

Generar `v1.0.0-rc.1` o equivalente.

### Paso 19 — Stable Release

Tras validar RC, generar `v1.0.0`.

## 67. Guía de Enseñanza para el Agente

Antes de cada bloque explicar brevemente:

- build vs package vs installer;
- appId;
- AppSettings vs `.label`;
- code signing;
- update security;
- CSP;
- supply chain;
- release candidate.

## 68. Reglas para Antigravity

No implementar toda la Fase 10 de una sola vez.

Flujo:

```text
explicación
↓
auditoría/plan
↓
implementación
↓
tests
↓
package/smoke test si aplica
↓
resultado
↓
siguiente bloque
```

## 69. Decisiones que Requieren Documentación

Antes de:

- cambiar packaging;
- elegir instalador;
- auto-update;
- proveedor de releases;
- file association;
- single-instance;
- dependencia nativa;
- cambiar CSP;
- cambiar licencia;
- telemetría;
- crash reporting remoto.

Documentar:

```text
Problema
Estado actual
Opciones
Decisión
Motivo
Seguridad
Compatibilidad
Impacto en release
```

## 70. Definition of Done

La Fase 10 termina únicamente cuando:

- identidad estable;
- versión centralizada;
- AppSettings con schema/migrations;
- packaging configurado;
- Windows x64 empaqueta;
- instalador funciona;
- paths de producción funcionan;
- CSP endurecida;
- security audit limpio;
- IPC/preload audit limpio;
- logs sanitizados;
- diagnostics disponible o documentado;
- update strategy segura;
- release guards;
- dependencias auditadas;
- licencias auditadas;
- licencia del proyecto decidida;
- README actualizado;
- CONTRIBUTING;
- SECURITY;
- CHANGELOG;
- CI en verde;
- release pipeline;
- checksums;
- smoke test instalado;
- TypeScript limpio;
- Vitest en verde;
- sin regresiones de Fases 1-9.

## 71. Resultado Esperado

Al finalizar:

```text
development repository
        ↓
installable desktop product
```

El usuario final podrá:

```text
Download installer
↓
Install
↓
Launch
↓
Create/Open .label
↓
Design
↓
Use variables/data sources
↓
Export / Print
↓
Run production batches
↓
Save and close
↓
Reopen safely
```

sin instalar herramientas de desarrollo.

## 72. Prompt Inicial para Antigravity

> Lee completamente `AGENTS.md` y todas las especificaciones desde `PHASE_1_SPEC.md` hasta `PHASE_10_SPEC.md`.
>
> Ejecuta primero `npx tsc --noEmit` y `npx vitest run`. No avances mientras exista una regresión.
>
> No implementes toda la Fase 10 de una sola vez.
>
> Primero audita el estado actual de `package.json`, scripts, Electron entry, preload, Vite, TypeScript, assets, iconos, variables de entorno y cualquier dependencia de packaging ya instalada.
>
> No cambies la herramienta de packaging todavía.
>
> Explícame brevemente:
>
> - la diferencia entre build, package e installer;
> - qué es `appId` y por qué debe ser estable;
> - por qué AppSettings no deben almacenarse dentro del `.label`;
> - qué partes de seguridad Electron deben volver a auditarse antes de release.
>
> Después implementa únicamente el primer bloque:
>
> - `AppSettingsSchema`
> - tipos de settings
> - defaults
> - estrategia de versionado/migración de settings
> - tests
>
> No implementes todavía installer, auto-update, CI, signing ni cambios de packaging hasta que este primer bloque esté completamente en verde.
