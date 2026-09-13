# ESPECIFICACIÓN TÉCNICA: FASE 6 - SISTEMA DE ARCHIVOS `.label`, PLANTILLAS, AUTOSAVE Y MIGRACIONES

## 1. Contexto de la Fase

La Fase 1 estableció el núcleo matemático, los esquemas de dominio, la seguridad de Electron y la frontera IPC.

La Fase 2 construyó el editor WYSIWYG.

La Fase 3 incorporó códigos de barras 1D/2D reales.

La Fase 4 creó los compiladores ZPL II y PDF.

La Fase 5 introdujo impresión real, perfiles de impresora, PrintJob, PrintQueue y transports.

La Fase 6 convierte el proyecto en una aplicación de escritorio capaz de **crear, guardar, abrir, recuperar, versionar y administrar documentos de etiquetas**.

El objetivo es que el usuario pueda trabajar con archivos persistentes de forma segura y confiable.

Esta fase debe respetar:

```text
AGENTS.md
PHASE_1_SPEC.md
PHASE_2_SPEC.md
PHASE_3_SPEC.md
PHASE_4_SPEC.md
PHASE_5_SPEC.md
```

---

# 2. Objetivo Principal

Construir el sistema documental de la aplicación.

Debe permitir:

- crear un documento nuevo;
- guardar;
- Guardar como;
- abrir;
- cerrar;
- detectar cambios sin guardar;
- mostrar archivos recientes;
- autosave;
- recuperación tras cierre inesperado;
- validar archivos `.label`;
- migrar documentos antiguos;
- administrar plantillas;
- evitar corrupción;
- evitar path traversal;
- realizar escrituras atómicas;
- mantener compatibilidad futura del formato.

---

# 3. Alcance Estricto

La Fase 6 incluye:

1. Formato de archivo `.label`.
2. Metadata del archivo.
3. Serialización.
4. Deserialización.
5. Validación Zod al abrir.
6. Migraciones de versión.
7. Apertura mediante diálogo nativo.
8. Guardado mediante diálogo nativo.
9. Escritura atómica.
10. Manejo de errores de filesystem.
11. Estado dirty/clean.
12. Recent files.
13. Autosave.
14. Crash recovery.
15. Templates.
16. Crear documento desde template.
17. Duplicar template.
18. IPC seguro para operaciones de archivo.
19. Preload tipado.
20. UI de File menu/document lifecycle.
21. Tests unitarios.
22. Tests de integración.
23. No-regresión completa.

La Fase 6 no incluye:

- CSV;
- Excel;
- SQL;
- REST;
- variables dinámicas;
- serialización por registros;
- impresión masiva;
- cloud sync;
- colaboración;
- control de versiones remoto;
- backups en nube;
- marketplace de plantillas.

---

# 4. Principio Arquitectónico Fundamental

El renderer nunca debe acceder directamente al filesystem.

Arquitectura:

```text
Renderer
   ↓
Preload API
   ↓
Main Process
   ↓
Document Service
   ↓
Filesystem
```

Prohibido:

```text
renderer -> fs
renderer -> path
renderer -> arbitrary file write
```

---

# 5. Formato `.label`

El archivo `.label` debe ser un documento JSON estructurado y versionado.

Ejemplo conceptual:

```json
{
  "format": "open-label",
  "formatVersion": 1,
  "document": {
    "version": "1.0.0",
    "meta": {
      "title": "Shipping Label",
      "author": "User",
      "created": "2026-09-12T00:00:00.000Z"
    },
    "dimensions": {
      "width": 100,
      "height": 50,
      "unit": "mm",
      "dpi": 203
    },
    "elements": []
  }
}
```

La estructura exacta puede evolucionar.

---

# 6. Diferencia entre `formatVersion` y `document.version`

Mantener dos conceptos separados.

## `formatVersion`

Representa la versión del contenedor `.label`.

Ejemplo:

```text
1
2
3
```

Se utiliza para migraciones estructurales.

## `document.version`

Representa la versión semántica del modelo de documento.

Ejemplo:

```text
1.0.0
```

No mezclar ambos significados.

---

# 7. Esquema raíz del archivo

Crear un esquema específico:

```text
LabelFileSchema
```

No reutilizar ciegamente `LabelDocumentSchema` como archivo completo.

Ejemplo conceptual:

```ts
const LabelFileSchema = z.object({
  format: z.literal('open-label'),
  formatVersion: z.number().int().positive(),
  document: LabelDocumentSchema
});
```

---

# 8. Extensión

Extensión principal:

```text
.label
```

Mime conceptual:

```text
application/json
```

No registrar asociaciones del sistema operativo todavía si complica empaquetado.

Puede añadirse posteriormente.

---

# 9. Serialización

Crear un módulo puro.

Ubicación sugerida:

```text
src/core/documents/
```

Archivos:

```text
label-file.schema.ts
serialize-label.ts
deserialize-label.ts
migrations/
document.types.ts
```

---

# 10. API conceptual de serialización

```ts
serializeLabelFile(document)
```

Debe:

- validar;
- construir contenedor;
- producir JSON;
- mantener orden estable cuando sea razonable;
- no incluir estado del editor.

---

# 11. Estado que NO debe persistirse

No guardar:

```text
selectedElementIds
activeTool
zoom
viewport
open panels
hover states
Konva nodes
history past/future
cached SVG
cached PDF
PrintJob
PrintQueue
```

El archivo representa el documento, no la sesión completa.

---

# 12. Estado opcional de sesión

Si en el futuro se desea persistir preferencias de sesión, debe hacerse en almacenamiento separado.

No mezclarlo con `.label`.

---

# 13. Deserialización

Crear:

```ts
deserializeLabelFile(raw)
```

Debe:

1. parsear JSON;
2. validar estructura externa;
3. detectar `formatVersion`;
4. migrar si es necesario;
5. validar `LabelDocument`;
6. devolver resultado tipado.

---

# 14. Resultado de carga

Usar resultado discriminado.

Ejemplo:

```ts
type LoadLabelResult =
  | {
      success: true;
      document: LabelDocument;
      migrated: boolean;
      warnings: DocumentWarning[];
    }
  | {
      success: false;
      errors: DocumentError[];
    };
```

---

# 15. Errores de documento

Definir códigos.

Ejemplo:

```ts
type DocumentErrorCode =
  | 'FILE_NOT_FOUND'
  | 'FILE_READ_FAILED'
  | 'INVALID_JSON'
  | 'INVALID_FORMAT'
  | 'UNSUPPORTED_FORMAT_VERSION'
  | 'DOCUMENT_VALIDATION_FAILED'
  | 'MIGRATION_FAILED'
  | 'FILE_WRITE_FAILED'
  | 'ATOMIC_REPLACE_FAILED'
  | 'PERMISSION_DENIED';
```

---

# 16. Migraciones

Las migraciones deben ser explícitas y secuenciales.

Estructura sugerida:

```text
src/core/documents/migrations/
├── migrate-v1-to-v2.ts
├── migrate-v2-to-v3.ts
└── migrate.ts
```

---

# 17. Regla de migración

Nunca escribir:

```text
if old shape then guess new shape
```

de forma dispersa.

Centralizar migraciones.

Pipeline:

```text
v1
 ↓
v2
 ↓
v3
 ↓
current
```

---

# 18. Migración determinista

Una misma entrada antigua debe producir siempre el mismo resultado actualizado.

No utilizar:

```text
timestamps nuevos
UUID aleatorios
defaults variables
```

salvo que la migración lo requiera expresamente.

---

# 19. Migración y respaldo

Al abrir un archivo antiguo:

- migrar en memoria;
- no sobrescribir automáticamente el archivo original;
- marcar documento como migrated;
- guardar solo cuando el usuario confirme.

---

# 20. Compatibilidad hacia adelante

Si se abre:

```text
formatVersion > supportedVersion
```

no intentar interpretar parcialmente.

Mostrar error:

```text
This file was created by a newer version of the application.
```

No corromperlo.

---

# 21. Servicio de documentos

Crear en Main:

```text
src/main/documents/document.service.ts
```

Responsabilidades:

- open;
- save;
- saveAs;
- filesystem;
- dialogs;
- atomic writes;
- recent files integration;
- autosave storage.

---

# 22. Diálogos nativos

Utilizar APIs de Electron en Main:

```text
dialog.showOpenDialog()
dialog.showSaveDialog()
```

El renderer no debe elegir rutas arbitrarias mediante inputs libres.

---

# 23. Open Dialog

Filtrar:

```text
.label
```

Opcionalmente:

```text
.json
```

solo para debugging/import explícito, no por defecto.

---

# 24. Save Dialog

Default extension:

```text
.label
```

Si el usuario omite extensión, añadirla de forma controlada.

---

# 25. Rutas

Main debe normalizar rutas.

No aceptar:

```text
../../
```

desde renderer para operaciones arbitrarias.

El renderer debe trabajar con un `documentId`/sesión y acciones de alto nivel.

---

# 26. Escritura atómica

Guardar directamente sobre el archivo final puede corromperlo si la app se cierra durante la escritura.

Utilizar estrategia:

```text
target.label
      ↓
write target.label.tmp
      ↓
flush/close
      ↓
atomic rename/replace
```

según capacidades de plataforma.

---

# 27. Archivo temporal

El temp debe:

- estar en mismo filesystem cuando sea posible;
- usar nombre controlado;
- no exponerse al renderer;
- limpiarse en caso de éxito;
- manejar residuos tras crash.

---

# 28. Safe Replace

Antes de reemplazar el archivo original:

1. serializar;
2. validar nuevamente;
3. escribir temp;
4. cerrar;
5. reemplazar.

No escribir contenido parcialmente validado.

---

# 29. Backup opcional

Puede implementarse:

```text
file.label.bak
```

solo si existe una política clara.

No obligatorio para primera entrega.

---

# 30. Dirty State

El editor debe conocer si existen cambios no guardados.

Estado conceptual:

```ts
isDirty: boolean
```

---

# 31. Dirty State correcto

No activar dirty por:

```text
zoom
pan
selection
hover
panel state
```

Sí activar por:

```text
create element
delete element
move element
resize
rotate
change properties
change label dimensions
change barcode data
```

---

# 32. Hash o revision

Preferencia:

mantener una revisión del documento.

Ejemplo:

```text
savedRevision
currentRevision
```

o comparar snapshot/hash estable.

No basarse únicamente en eventos manuales si puede perder sincronización.

---

# 33. Window Title

Mostrar:

```text
Shipping Label.label
```

y si está dirty:

```text
Shipping Label.label *
```

o convención equivalente.

---

# 34. Nuevo documento

Acción:

```text
New
```

Debe:

1. detectar dirty;
2. preguntar guardar/descartar/cancelar;
3. crear documento válido;
4. limpiar path actual;
5. resetear historial;
6. mantener preferencias de aplicación.

---

# 35. Abrir documento

Antes de abrir otro archivo:

si actual está dirty:

```text
Save
Don't Save
Cancel
```

No perder cambios silenciosamente.

---

# 36. Cerrar aplicación

Interceptar cierre si:

```text
isDirty === true
```

Mostrar flujo seguro.

No usar eventos que permitan loops infinitos de cierre.

---

# 37. Save

Si existe path actual:

```text
Save -> write same path
```

Si no existe:

```text
Save -> Save As
```

---

# 38. Save As

Siempre abre diálogo.

Después de éxito:

- actualizar path;
- marcar clean;
- añadir recent;
- actualizar title.

---

# 39. Recent Files

Mantener lista local.

Ejemplo:

```text
últimos 10
```

Campos:

```text
path
displayName
lastOpenedAt
```

---

# 40. Privacidad Recent Files

Guardar únicamente rutas necesarias.

No registrar contenidos.

---

# 41. Archivo reciente inexistente

Si ya no existe:

- mostrar error;
- remover o marcar inválido;
- no bloquear aplicación.

---

# 42. Almacenamiento de preferencias

Recent files, autosave config y preferencias no deben guardarse dentro del `.label`.

Usar almacenamiento separado.

---

# 43. Autosave

El autosave no debe sobrescribir automáticamente el archivo principal en cada cambio.

Preferir:

```text
recovery snapshot
```

separado.

---

# 44. Autosave Directory

Usar directorio administrado por la aplicación.

Ejemplo conceptual:

```text
app.getPath('userData')/autosave/
```

No escribir autosaves junto al archivo original si no es necesario.

---

# 45. Autosave Frequency

Estrategia inicial:

```text
debounce 2-5 segundos después de cambios
```

o intervalo razonable.

No escribir en cada keystroke.

---

# 46. Autosave Scope

Guardar:

```text
LabelDocument
source file path if known
timestamp
session id/document id
```

No guardar secretos ni artefactos derivados.

---

# 47. Recovery Snapshot

Modelo conceptual:

```json
{
  "recoveryVersion": 1,
  "documentId": "...",
  "sourcePath": "...",
  "savedAt": "...",
  "document": {}
}
```

Validar con Zod.

---

# 48. Crash Recovery

Al iniciar:

1. buscar recovery snapshots válidos;
2. comparar con estado guardado;
3. ofrecer recuperar;
4. no abrir automáticamente sin informar al usuario;
5. permitir descartar.

---

# 49. Recovery después de guardado

Después de Save exitoso:

- actualizar/eliminar recovery correspondiente.

No mantener snapshots obsoletos indefinidamente.

---

# 50. Recovery después de cierre limpio

Si documento está clean:

eliminar autosave.

Si usuario descarta cambios:

eliminar recovery asociado.

---

# 51. Templates

Crear concepto:

```text
LabelTemplate
```

Puede reutilizar la estructura de `LabelDocument`, pero debe existir una distinción clara de UX.

---

# 52. Template no es una sesión editable original

Al abrir un template:

```text
Template
   ↓
New Document
```

El usuario no debe sobrescribir accidentalmente el template al presionar Save.

---

# 53. Template Storage

Inicialmente soportar:

```text
built-in templates
user templates
```

---

# 54. Built-in Templates

Deben ser read-only.

Ejemplos:

```text
100x50 mm Shipping
50x30 mm Product
100x150 mm Logistics
```

No es obligatorio incluir muchos.

---

# 55. User Templates

Permitir:

```text
Save as Template
```

Guardar en directorio administrado o ubicación elegida según diseño final.

---

# 56. Crear desde Template

Flujo:

```text
select template
      ↓
clone document
      ↓
new document identity
      ↓
no current file path
      ↓
dirty/unsaved document
```

---

# 57. UUID al clonar template

Evaluar si IDs de elementos deben regenerarse.

Recomendación:

sí, para evitar identidad duplicada entre documentos si esos IDs se usan externamente.

La operación debe ser determinista salvo IDs.

---

# 58. Template Schema

Puede utilizar el mismo `LabelFileSchema` con metadata adicional o un schema específico.

No crear formatos innecesariamente duplicados.

---

# 59. UI File Menu

Debe incluir:

```text
New
Open
Save
Save As
Recent Files
Save as Template
New from Template
Close Document
```

---

# 60. Atajos

Recomendados:

```text
Ctrl/Cmd + N -> New
Ctrl/Cmd + O -> Open
Ctrl/Cmd + S -> Save
Ctrl/Cmd + Shift + S -> Save As
```

Respetar inputs y sistema operativo.

---

# 61. Unsaved Changes Dialog

Debe ofrecer:

```text
Save
Don't Save
Cancel
```

Aplicar a:

- New;
- Open;
- Close document;
- Close application.

---

# 62. Integración con Undo/Redo

Después de Save:

- historial puede mantenerse;
- saved revision debe actualizarse.

Undo después de Save puede volver a dejar documento dirty.

Ejemplo:

```text
edit
save
undo
=> dirty
```

---

# 63. Historial y Open/New

Al abrir o crear nuevo:

```text
history reset
```

No mezclar historial entre documentos.

---

# 64. Current Document Session

Crear un estado explícito.

Ejemplo conceptual:

```ts
interface DocumentSession {
  filePath: string | null;
  displayName: string;
  isDirty: boolean;
  isMigrated: boolean;
  lastSavedAt: string | null;
}
```

No colocar filesystem logic en esta store.

---

# 65. IPC Público

Exponer una API específica.

Ejemplo:

```ts
window.documentAPI.newDocument()
window.documentAPI.openDocument()
window.documentAPI.saveDocument(document)
window.documentAPI.saveDocumentAs(document)
window.documentAPI.getRecentFiles()
window.documentAPI.openRecent(id)
window.documentAPI.saveAsTemplate(document)
window.documentAPI.listTemplates()
window.documentAPI.createFromTemplate(templateId)
window.documentAPI.getRecoveryItems()
window.documentAPI.recover(itemId)
window.documentAPI.discardRecovery(itemId)
```

La API final puede simplificarse.

---

# 66. No exponer filesystem genérico

Prohibido:

```ts
window.fs.readFile(path)
window.fs.writeFile(path, data)
window.documentAPI.readAnyFile(path)
```

Todas las operaciones deben ser de dominio.

---

# 67. Validación IPC

Todo documento recibido:

```text
unknown
```

y debe pasar:

```text
LabelDocumentSchema.safeParse
```

antes de escribir.

---

# 68. Validación de archivo al abrir

No confiar en extensión.

Un `.label` puede contener datos maliciosos o corruptos.

Validar contenido.

---

# 69. Tamaño máximo de archivo

Definir un límite razonable.

Ejemplo inicial:

```text
10 MB
```

Debe ajustarse si imágenes embebidas forman parte del modelo.

No cargar archivos arbitrariamente enormes.

---

# 70. JSON Parsing

Capturar errores.

No propagar stack traces al renderer.

---

# 71. Imágenes

Si las imágenes se almacenan como:

```text
base64/data URL
```

evaluar impacto en tamaño.

Si se almacenan como referencias externas, documentar portabilidad.

La Fase 6 debe auditar el modelo actual antes de decidir.

---

# 72. Estrategia recomendada de assets

Preferir un documento portable.

Si el proyecto ya usa imágenes embebidas de forma segura, mantenerlo.

Si utiliza paths externos, no migrar silenciosamente sin plan.

---

# 73. Path externo en documentos

No permitir que abrir un `.label` provoque lectura automática de paths arbitrarios sin validación.

Este punto es crítico para open source y archivos no confiables.

---

# 74. Atomic Save Tests

Simular:

```text
successful write
temp write fail
rename fail
permission denied
existing destination
```

No depender del filesystem real del usuario.

---

# 75. Tests Serialización

Cubrir:

```text
valid document -> serialize -> deserialize
```

Round-trip debe preservar significado.

---

# 76. Tests Invalid JSON

Cubrir:

```text
empty
truncated
random text
malformed JSON
```

---

# 77. Tests Invalid Schema

Cubrir:

```text
negative dimensions
invalid rotation
unsupported dpi
invalid barcode
missing document
wrong format marker
```

---

# 78. Tests Versioning

Cubrir:

```text
current version
older supported version
future unsupported version
broken migration
```

---

# 79. Tests Dirty State

Cubrir:

```text
new document
edit
save
undo after save
zoom
selection
pan
```

Zoom/selection/pan no deben marcar dirty.

---

# 80. Tests Recent Files

Cubrir:

```text
add
dedupe
reorder
limit
missing file
remove
```

---

# 81. Tests Autosave

Cubrir:

```text
dirty document creates recovery
clean document doesn't
debounce
save clears recovery
discard clears recovery
invalid recovery ignored/reported
```

---

# 82. Tests Templates

Cubrir:

```text
list
create from template
clone
save as template
built-in read-only
new document has no original template path
```

---

# 83. Tests IPC

Cubrir:

```text
invalid document
save success
save fail
open cancel
save cancel
migration warning
future version
permission error
```

---

# 84. No hardware dependency

Los tests de Fase 6 no deben requerir impresoras.

No mezclar sistema documental con impresión.

---

# 85. Seguridad

Mantener:

```text
contextIsolation = true
nodeIntegration = false
sandbox = true
webSecurity = true
```

No usar:

```text
remote module
```

No exponer paths arbitrarios cuando no sean necesarios.

---

# 86. File URLs

No cargar automáticamente:

```text
file://
```

arbitrario en renderer.

Las imágenes o previews deben seguir rutas seguras.

---

# 87. Symlinks

Si se manipulan paths del usuario, evitar asumir que una ruta normalizada elimina todos los riesgos.

Para el caso estándar de Open/Save Dialog del usuario, respetar la selección explícita.

No crear exploradores de filesystem generales.

---

# 88. Logging

Registrar:

```text
operation
success/failure
document session id
error code
duration
```

Evitar registrar:

```text
full document
full file contents
personal data
barcode payloads
```

---

# 89. UI de Templates

Crear diálogo/panel simple:

```text
Built-in
User Templates
```

Cada template puede mostrar:

```text
name
size
unit
preview simple
```

No necesita marketplace.

---

# 90. Preview de Template

Puede reutilizar renderer existente en modo read-only.

No crear una segunda implementación de canvas.

---

# 91. UI de Recent Files

Mostrar:

```text
filename
folder
last opened
```

No saturar con path completo si no es necesario.

---

# 92. Empty State

Si no hay documento abierto:

mostrar una pantalla profesional con:

```text
New Label
Open Label
Recent Files
Templates
```

Esto convierte la aplicación en un producto más usable.

---

# 93. Startup Flow

Al iniciar:

```text
recovery check
      ↓
home/empty state
      ↓
recent/templates
```

No crear automáticamente un documento si eso oculta recovery.

---

# 94. Recuperación UI

Si existe recovery:

mostrar:

```text
Recover
Discard
```

con información:

```text
document name
source path if known
autosave time
```

---

# 95. Múltiples recoveries

Preparar arquitectura para más de uno.

No asumir siempre un único documento recuperable.

---

# 96. Multi-document

La Fase 6 no obliga a soportar múltiples documentos abiertos simultáneamente.

Versión inicial recomendada:

```text
1 active document
```

Diseñar contratos para no impedir multi-document futuro.

---

# 97. File Watcher

No implementar vigilancia externa del archivo por defecto.

Conflictos por modificación externa pueden añadirse posteriormente.

---

# 98. Export vs Save

Mantener diferencia:

```text
Save -> .label
Export -> PDF/ZPL
Print -> printer
```

No mezclar.

---

# 99. Nombre del documento

`meta.title` no tiene por qué ser idéntico al filename.

La UI puede mostrar ambos cuando sea relevante.

---

# 100. Criterios de Aceptación Funcionales

La Fase 6 está terminada cuando:

1. New funciona.
2. Open funciona.
3. Save funciona.
4. Save As funciona.
5. `.label` se valida.
6. archivos corruptos son rechazados.
7. future versions son rechazadas de forma segura.
8. migraciones funcionan.
9. dirty state funciona.
10. unsaved changes dialog funciona.
11. recent files funciona.
12. autosave funciona.
13. crash recovery funciona.
14. templates funcionan.
15. built-in templates son read-only.
16. user templates pueden crearse.
17. escritura es atómica.
18. renderer no accede al filesystem.
19. IPC permanece explícito.
20. Fases 1-5 no sufren regresiones.

---

# 101. Criterios de Aceptación Técnicos

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

Debe resultar:

```text
0 TypeScript errors
0 failed tests
```

No permitir:

```text
skip
only
any como parche
direct fs in renderer
generic file IPC
```

---

# 102. Orden Secuencial de Implementación

## Paso 1 — Verificación

Leer:

```text
AGENTS.md
PHASE_1_SPEC.md
PHASE_2_SPEC.md
PHASE_3_SPEC.md
PHASE_4_SPEC.md
PHASE_5_SPEC.md
PHASE_6_SPEC.md
```

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

---

## Paso 2 — Auditar modelo actual

Revisar:

```text
LabelDocument
images/assets
document metadata
editor state
history
```

Determinar qué pertenece al archivo y qué pertenece solo a sesión.

Documentar antes de cambiar schema.

---

## Paso 3 — LabelFileSchema

Implementar:

```text
format
formatVersion
document
```

con tests.

---

## Paso 4 — Serialize/Deserialize

Implementar funciones puras.

Añadir round-trip tests.

---

## Paso 5 — Migration Engine

Crear pipeline de migraciones.

Aunque solo exista v1, dejar estructura preparada.

---

## Paso 6 — DocumentSession

Implementar:

```text
path
dirty
saved revision
migration state
```

sin filesystem en renderer.

---

## Paso 7 — Main Document Service

Implementar:

```text
open
save
saveAs
atomic write
```

con abstracción testeable de filesystem.

---

## Paso 8 — IPC + Preload

Exponer métodos específicos.

Validar Zod.

---

## Paso 9 — New/Open/Save UI

Añadir menús, shortcuts y dialogs.

---

## Paso 10 — Recent Files

Implementar almacenamiento y UI.

---

## Paso 11 — Autosave

Implementar recovery snapshots.

---

## Paso 12 — Crash Recovery

Agregar flujo de startup.

---

## Paso 13 — Templates

Agregar:

```text
built-in
user templates
create from template
save as template
```

---

## Paso 14 — Empty State

Crear home inicial moderna.

---

## Paso 15 — Security Review

Verificar:

- no fs renderer;
- no generic paths;
- no generic IPC;
- safe parsing;
- atomic writes;
- path handling.

---

## Paso 16 — Full Regression

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

---

# 103. Guía de Enseñanza para el Agente

Antes de cada bloque relevante, explicar brevemente:

## File format

- por qué versionar;
- diferencia entre schema y serialization.

## Atomic write

- por qué evita corrupción;
- temp + replace.

## Dirty state

- diferencia entre documento y viewport.

## Migration

- por qué no modificar archivos antiguos silenciosamente.

## Autosave

- diferencia entre autosave y Save.

## Recovery

- por qué no reabrir automáticamente sin informar.

## IPC filesystem security

- por qué no exponer `fs` al renderer.

Las explicaciones deben ser breves.

---

# 104. Reglas para Antigravity

No implementar toda la Fase 6 de una sola vez.

Flujo obligatorio:

```text
explicación
↓
plan
↓
implementación
↓
tests
↓
resultado
↓
siguiente bloque
```

No avanzar con tests fallidos.

---

# 105. Decisiones que Requieren Documentación

Documentar antes de introducir:

- nuevo formato de assets;
- imágenes externas vs embebidas;
- backup automático;
- persistencia distinta;
- librería de settings;
- librería de atomic write;
- cambio incompatible del schema;
- asociación OS de `.label`.

Formato:

```text
Problema
Opciones
Decisión
Motivo
Compatibilidad
Migración
```

---

# 106. Definition of Done

La Fase 6 termina únicamente cuando:

- existe `LabelFileSchema`;
- existe `formatVersion`;
- existe serialize/deserialize;
- existe migration pipeline;
- existe open/save/save as;
- existe atomic write;
- existe dirty state;
- existe unsaved changes flow;
- existe recent files;
- existe autosave;
- existe recovery;
- existen templates;
- existe empty state;
- existe IPC explícito;
- existe preload tipado;
- renderer no usa filesystem;
- archivos corruptos se rechazan;
- archivos future-version se rechazan con seguridad;
- TypeScript está limpio;
- Vitest está completamente en verde;
- no existen regresiones de Fases 1-5.

---

# 107. Resultado Esperado

Al finalizar, el usuario podrá:

1. abrir la aplicación;
2. crear una etiqueta nueva;
3. diseñarla;
4. guardar:

```text
shipping-label.label
```

5. cerrar;
6. volver a abrirla;
7. continuar editando;
8. recibir advertencia si existen cambios sin guardar;
9. recuperar un documento tras cierre inesperado;
10. crear un documento desde una plantilla.

El flujo general del producto quedará:

```text
NEW / OPEN
    ↓
DESIGN
    ↓
SAVE
    ↓
VALIDATE
    ↓
COMPILE
    ↓
PRINT
```

---

# 108. Prompt Inicial para Antigravity

> Lee completamente `AGENTS.md` y todas las especificaciones desde `PHASE_1_SPEC.md` hasta `PHASE_6_SPEC.md`.
>
> Ejecuta primero `npx tsc --noEmit` y `npx vitest run`. No avances mientras exista una regresión.
>
> No implementes toda la Fase 6 de una sola vez.
>
> Primero audita el modelo actual y separa claramente qué información pertenece al `LabelDocument` y qué información pertenece únicamente a la sesión del editor.
>
> Después explícame brevemente la diferencia entre `document.version`, `formatVersion`, serialización y migración.
>
> Implementa únicamente:
>
> - `LabelFileSchema`
> - tipos de documento de archivo
> - `serializeLabelFile()`
> - `deserializeLabelFile()`
>
> junto con sus pruebas de round-trip, JSON inválido, schema inválido y versión futura.
>
> No implementes todavía filesystem, diálogos, autosave ni templates hasta que este primer bloque esté completamente en verde.
