# ESPECIFICACIÓN TÉCNICA: FASE 9 - IMPRESIÓN MASIVA, PRODUCCIÓN, LOTES Y CONTROL DE EJECUCIÓN

## 1. Contexto de la Fase

Las fases anteriores construyeron:

```text
Fase 1 -> núcleo, seguridad y unidades físicas
Fase 2 -> editor WYSIWYG
Fase 3 -> barcodes 1D/2D
Fase 4 -> PrintPlan, ZPL y PDF
Fase 5 -> PrintJob, PrintQueue y transports
Fase 6 -> archivos .label, autosave y templates
Fase 7 -> variables, counters y ResolvedRecord
Fase 8 -> CSV, Excel, SQL, REST, Dataset y FieldMapping
```

La Fase 9 convierte esos componentes en un sistema de producción.

Debe permitir tomar múltiples registros de datos y producir múltiples etiquetas de forma controlada, observable y recuperable.

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
```

---

# 2. Objetivo Principal

Construir un subsistema de producción capaz de:

- seleccionar registros;
- realizar preflight;
- materializar un plan de producción;
- resolver variables por registro;
- validar cada etiqueta;
- compilar cada salida;
- coordinar trabajos con `PrintQueue`;
- controlar progreso;
- pausar;
- reanudar;
- cancelar;
- manejar errores por registro;
- reintentar de forma segura;
- distinguir estados ambiguos;
- conservar trazabilidad;
- generar un resumen final de producción;
- evitar cargar miles de PrintJobs de golpe;
- evitar duplicaciones accidentales.

---

# 3. Flujo General

```text
Dataset
   ↓
Record Selection
   ↓
Field Mapping
   ↓
Production Preflight
   ↓
ProductionPlan
   ↓
ProductionRun
   ↓
bounded coordinator
   ↓
ResolvedRecord
   ↓
ResolvedDocument
   ↓
PrintPlan
   ↓
ZPL / PDF
   ↓
PrintJob
   ↓
PrintQueue
   ↓
Printer
```

---

# 4. Principio Arquitectónico Fundamental

`PrintQueue` de la Fase 5 continúa siendo responsable de despachar trabajos individuales.

La Fase 9 introduce un nivel superior:

```text
ProductionRun
```

No reemplaza `PrintQueue`.

Arquitectura:

```text
ProductionRun
      ↓
ProductionCoordinator
      ↓
PrintJob
      ↓
PrintQueue
      ↓
Transport
```

---

# 5. Diferencia entre ProductionRun y PrintJob

## PrintJob

Representa un trabajo individual enviado a una impresora.

## ProductionRun

Representa una operación de producción con múltiples registros y potencialmente múltiples PrintJobs.

Ejemplo:

```text
ProductionRun #A
  Record 1 -> PrintJob
  Record 2 -> PrintJob
  Record 3 -> PrintJob
  ...
```

---

# 6. Alcance Estricto

La Fase 9 incluye:

1. `ProductionPlan`.
2. `ProductionRun`.
3. `ProductionItem`.
4. máquina de estados.
5. selección de filas.
6. selección de cantidad.
7. preflight.
8. validación por registro.
9. materialización de registros.
10. ejecución por ventanas/batches internos.
11. integración con PrintQueue.
12. progreso.
13. pausa.
14. reanudación.
15. cancelación.
16. retry controlado.
17. estados ambiguos.
18. resumen de errores.
19. historial local de producción.
20. persistencia de estado de ejecución.
21. recuperación tras reinicio.
22. reportes de producción.
23. UI de producción.
24. pruebas unitarias.
25. pruebas de integración.
26. no-regresión.

La fase NO incluye:

- scheduler de trabajos futuros;
- impresión automática por cambios en BD;
- webhooks;
- cloud queues;
- multiusuario;
- servidor central de impresión;
- SNMP avanzado;
- ERP integration específica;
- SAP-specific workflows;
- aprobación multiusuario;
- ejecución distribuida;
- clustering.

---

# 7. Modelo ProductionPlan

Un `ProductionPlan` representa una ejecución preparada pero aún no iniciada.

Ejemplo conceptual:

```ts
interface ProductionPlan {
  id: string;
  documentSnapshot: LabelDocument;
  printerProfileId: string;
  records: ProductionRecord[];
  copiesPerRecord: number;
  createdAt: string;
  preflight: ProductionPreflightResult;
}
```

La implementación puede variar.

---

# 8. Snapshot del Documento

Al comenzar una producción debe utilizarse un snapshot inmutable de la etiqueta.

Si el usuario modifica el documento mientras la producción corre:

```text
la producción actual NO cambia
```

Los cambios afectan futuras ejecuciones.

---

# 9. Snapshot de Datos

La ejecución debe trabajar sobre registros estables.

No debe volver a consultar silenciosamente SQL/REST por cada etiqueta.

Antes de iniciar:

```text
source
  ↓
fetch/materialize selected records
  ↓
ProductionPlan
```

Esto evita que un origen cambie a mitad del batch.

---

# 10. Materialización

Para la primera versión, materializar los registros seleccionados dentro de límites razonables.

Límite inicial recomendado:

```text
10,000 records por ProductionRun
```

Debe estar centralizado y ser configurable.

Escalado a datasets mayores puede añadirse posteriormente mediante streaming/checkpoints.

---

# 11. ProductionRecord

Modelo conceptual:

```ts
interface ProductionRecord {
  index: number;
  sourceRowIndex?: number;
  values: Record<string, string>;
}
```

Debe contener valores ya normalizados/mapeados.

No debe depender de que la fuente externa siga disponible durante la ejecución.

---

# 12. ProductionItem

Cada registro de producción necesita estado independiente.

Ejemplo:

```ts
interface ProductionItem {
  id: string;
  recordIndex: number;
  status: ProductionItemStatus;
  attempts: number;
  printJobId?: string;
  error?: ProductionError;
}
```

---

# 13. Estados del ProductionItem

Estados recomendados:

```text
pending
validating
compiling
queued
dispatching
completed
failed
unknown
skipped
cancelled
```

No permitir transiciones arbitrarias.

---

# 14. Estados de ProductionRun

Estados recomendados:

```text
draft
preflighting
ready
running
pausing
paused
cancelling
cancelled
completed
completed_with_errors
failed
interrupted
```

---

# 15. Máquina de Estados

Implementar helpers puros:

```ts
canTransitionProductionRun(...)
canTransitionProductionItem(...)
```

y pruebas exhaustivas.

---

# 16. Preflight

Antes de imprimir, validar todos los registros seleccionados.

El preflight debe comprobar:

```text
document valid
printer profile valid
source/mapping valid
required inputs present
resolved variables
barcode validity
bounds
compiler compatibility
printer language compatibility
DPI
record count
copies
```

---

# 17. Preflight no imprime

El preflight nunca crea efectos físicos.

No debe:

```text
enviar TCP
crear spool jobs
consumir counters persistentes
```

---

# 18. Resultado de Preflight

Modelo conceptual:

```ts
type ProductionPreflightResult =
  | {
      success: true;
      validItems: number;
      warnings: ProductionIssue[];
    }
  | {
      success: false;
      validItems: number;
      invalidItems: number;
      issues: ProductionIssue[];
    };
```

---

# 19. Preflight por Registro

Los errores deben identificar:

```text
record index
field
element id
error code
```

cuando sea posible.

Ejemplo:

```text
Row 37
Element: EAN barcode
INVALID_EAN13
Value: 12345
```

---

# 20. Política Inicial de Preflight

Recomendación:

```text
No iniciar si existe cualquier registro inválido
```

La UI puede permitir una opción explícita futura:

```text
Skip invalid rows
```

Si se implementa en esta fase, debe ser opt-in y visible.

---

# 21. Selección de Registros

La UI debe permitir:

```text
all rows
selected rows
row range
```

Ejemplos:

```text
1-100
50-75
specific selection
```

---

# 22. Filtros

Puede reutilizar filtros ya realizados en la fuente/dataset.

No construir todavía un motor avanzado de filtros.

---

# 23. Copies

Soportar:

```text
copiesPerRecord
```

Ejemplo:

```text
100 rows × 2 copies = 200 labels
```

Mostrar claramente el total antes de iniciar.

---

# 24. Total Labels

Calcular:

```text
totalLabels = recordCount × copiesPerRecord
```

Validar overflow/límites.

---

# 25. Confirmación

Antes de comenzar mostrar resumen:

```text
Printer
Records
Copies per record
Total labels
Warnings
```

---

# 26. ProductionCoordinator

Crear servicio en Main:

```text
ProductionCoordinator
```

Responsabilidades:

- ejecutar ProductionRun;
- materializar items;
- resolver;
- compilar;
- crear PrintJobs;
- esperar resultados;
- actualizar estados;
- aplicar backpressure;
- pausar;
- cancelar;
- persistir checkpoints.

---

# 27. No Enqueue Masivo

Está prohibido crear 10,000 `PrintJobs` simultáneamente.

Utilizar una ventana controlada.

Ejemplo:

```text
maxInFlight = 5
```

o valor adecuado.

---

# 28. Backpressure

El coordinator debe observar capacidad de la PrintQueue.

Conceptualmente:

```text
while capacity available:
    prepare next item
    enqueue
```

Esto evita:

- alto uso de memoria;
- miles de eventos;
- imposibilidad de pausar rápido.

---

# 29. Concurrencia por Impresora

Respetar la Fase 5:

```text
1 active PrintJob por impresora
```

aunque el coordinator pueda preparar algunos trabajos por adelantado.

---

# 30. Resolución por Item

Pipeline:

```text
ProductionRecord
    ↓
resolveDocument()
    ↓
barcode revalidation
    ↓
buildPrintPlan()
    ↓
compile for selected printer
    ↓
PrintArtifact
    ↓
PrintJob
```

No duplicar lógica existente.

---

# 31. Compilación por Perfil

Compilar utilizando:

```text
printer language
printer DPI
```

del perfil seleccionado.

---

# 32. Counters

La Fase 7 definió counters deterministas por índice.

La Fase 9 debe establecer el punto de commit de producción.

Preview/preflight no debe consumir secuencias.

---

# 33. Counter Commit

Para la primera versión, preferir:

```text
counter value = start + production record index × step
```

El plan debe congelar esos valores antes de imprimir.

No recalcularlos tras restart usando un dataset potencialmente diferente.

---

# 34. Counters y Retry

Reintentar un `ProductionItem` debe reutilizar el mismo valor serial.

Nunca generar un serial nuevo por retry.

---

# 35. Counters y Cancelación

Un item ya `completed` conserva su serial.

Items no despachados pueden permanecer sin commit persistente según la política implementada.

Documentar la estrategia.

---

# 36. Idempotencia

La impresión física no es idempotente.

```text
retry != guaranteed safe
```

Un timeout puede ocurrir después de que la impresora ya haya recibido datos.

Por ello existe:

```text
unknown
```

---

# 37. Estado Unknown

Si no puede determinarse si un job fue recibido:

```text
ProductionItem -> unknown
```

No reintentar automáticamente.

La UI debe pedir decisión manual.

---

# 38. Resolver Unknown

Opciones:

```text
Mark as completed
Retry anyway
Skip
```

Debe mostrar advertencia de posible duplicación.

---

# 39. Retry Seguro

Auto-retry solo cuando el error sea conocido como ocurrido antes de entrega ambigua.

Ejemplos:

```text
invalid config -> no retry
compile error -> no retry
connection refused before send -> retryable
ambiguous socket failure after write -> unknown
```

---

# 40. Pausa

`Pause` significa:

```text
no iniciar nuevos ProductionItems
```

Los PrintJobs ya en `dispatching` pueden terminar.

Estado:

```text
running -> pausing -> paused
```

---

# 41. Resume

`Resume` continúa desde items:

```text
pending
```

No repite automáticamente items:

```text
completed
unknown
```

---

# 42. Cancelación

Al cancelar:

- dejar de crear nuevos jobs;
- cancelar queued/retry_wait cuando sea posible;
- no asumir que jobs dispatching pueden detenerse físicamente;
- registrar estados finales.

---

# 43. Cancelled vs Completed

Un run cancelado puede contener:

```text
completed items
cancelled items
unknown items
```

No borrar historial.

---

# 44. Persistencia

A diferencia de la cola simple de Fase 5, ProductionRun debe tener persistencia durable mínima.

Debe sobrevivir al reinicio de la app.

---

# 45. Production Store

Crear almacenamiento local estructurado.

Opciones aceptables:

```text
JSON journal
SQLite
otra solución local ya existente
```

Antes de elegir dependencia, documentar decisión.

---

# 46. Recomendación

Si el proyecto ya dispone de almacenamiento local estructurado, reutilizarlo.

Si no, una solución sencilla y atómica puede ser suficiente para el MVP.

No introducir una base de datos pesada sin necesidad.

---

# 47. Qué Persistir

Persistir:

```text
run id
document snapshot or stable reference/snapshot
printer profile snapshot
production records
item statuses
serial values
timestamps
error codes
print job references
progress
```

---

# 48. Qué NO Persistir

No persistir innecesariamente:

```text
PDF bytes
huge ZPL outputs
temporary SVG
credentials
full secret source configs
```

Artefactos pueden regenerarse desde snapshots si el estado lo permite.

---

# 49. Recovery

Al iniciar la aplicación detectar runs no terminales.

Ejemplos:

```text
running
pausing
```

deben pasar a:

```text
interrupted
```

No reanudar automáticamente.

---

# 50. Reanudación Tras Reinicio

El usuario debe elegir:

```text
Resume
Cancel
Inspect
```

Antes de resume, validar nuevamente:

```text
printer profile availability
credentials if needed
printer configuration
```

---

# 51. Items Dispatching al Crash

Si la aplicación cerró mientras un item estaba `dispatching`:

marcar:

```text
unknown
```

No volver a imprimir automáticamente.

---

# 52. Snapshot del PrinterProfile

Guardar suficiente configuración no secreta para detectar cambios.

Si el perfil actual difiere:

mostrar warning.

---

# 53. Source Independence

Una vez materializado el ProductionPlan, SQL/REST/CSV/Excel no debe ser necesario para terminar el run.

Esto mejora recuperación y reproducibilidad.

---

# 54. Progress

Calcular:

```text
pending
active
completed
failed
unknown
skipped
cancelled
total
```

---

# 55. Progress Percentage

No utilizar únicamente:

```text
completed / total
```

sin considerar estados terminales.

Mostrar cifras además del porcentaje.

---

# 56. UI Production

Crear pantalla/dialog de producción.

Debe mostrar:

```text
Printer
Source
Records
Copies
Total labels
Preflight
Progress
Current record
Errors
```

---

# 57. Acciones UI

Según estado:

```text
ready -> Start
running -> Pause / Cancel
paused -> Resume / Cancel
interrupted -> Inspect / Resume / Cancel
unknown items -> Resolve
completed -> View Report
```

---

# 58. Progress Bar

La barra debe representar avance real.

No utilizar animación artificial.

Motion puede utilizarse únicamente para transiciones visuales.

---

# 59. Tabla de Items

Para ejecuciones grandes usar:

```text
virtualization
```

o paginación.

No renderizar 10,000 filas DOM simultáneamente.

---

# 60. Issues Panel

Permitir filtrar:

```text
All
Failed
Unknown
Skipped
```

---

# 61. Preflight UI

Antes de Start:

```text
Preflight passed
9,950 valid
50 invalid
```

Si existen errores, mostrar detalles navegables.

---

# 62. Row Preview

Seleccionar un issue debe poder mostrar:

```text
record values
resolved label preview
element error
```

sin modificar la plantilla.

---

# 63. Reporte Final

Al finalizar crear un `ProductionReport`.

Debe incluir:

```text
runId
startedAt
completedAt
printer
records
copies
total labels
completed
failed
unknown
skipped
cancelled
duration
issues summary
```

---

# 64. Exportar Reporte

Permitir exportar resumen a:

```text
JSON
CSV
```

sin incluir secretos.

No confundir con importación CSV de Fase 8.

---

# 65. Reporte por Item

Opcionalmente incluir:

```text
record index
status
attempts
error code
timestamps
serial values
```

Evitar almacenar todo el documento repetidamente.

---

# 66. Auditabilidad

Debe poder responder:

```text
qué se intentó imprimir
cuándo
en qué impresora
qué registros completaron
qué registros fallaron
qué serial usó cada registro
```

---

# 67. Privacidad

No registrar en reportes más datos de los necesarios.

Si los registros contienen información sensible, permitir configuración futura de redacción.

En esta fase evitar duplicar payloads completos en logs.

---

# 68. Logs

Registrar:

```text
runId
itemId
printJobId
status transition
attempt
duration
error code
```

No registrar:

```text
credentials
full ZPL
PDF bytes
Authorization headers
```

---

# 69. Correlation IDs

Utilizar:

```text
runId
itemId
printJobId
```

para correlacionar capas.

---

# 70. Event Model

El coordinator puede emitir eventos tipados:

```text
run-updated
item-updated
progress-updated
```

No crear un bus genérico expuesto al renderer.

---

# 71. IPC

Exponer APIs de dominio.

Ejemplo:

```ts
window.productionAPI.preflight(request)
window.productionAPI.createRun(request)
window.productionAPI.startRun(runId)
window.productionAPI.pauseRun(runId)
window.productionAPI.resumeRun(runId)
window.productionAPI.cancelRun(runId)
window.productionAPI.getRun(runId)
window.productionAPI.listRuns()
window.productionAPI.resolveUnknownItem(...)
window.productionAPI.exportReport(runId, format)
```

---

# 72. No IPC Genérico

Prohibido:

```text
invoke(channel, payload)
sendRawPrintJob
enqueueArbitraryArtifact
```

---

# 73. Validación IPC

Todo payload:

```text
unknown
```

y pasa por Zod.

Validar:

```text
runId
record selection
copies
printer profile
options
unknown resolution action
```

---

# 74. Seguridad de Dataset

No confiar en datos externos materializados.

Cada registro sigue pasando por:

```text
normalization
mapping validation
resolution
barcode validation
PrintPlan validation
compiler escaping
```

---

# 75. No Bypass

La producción masiva NO puede saltarse validaciones para ganar velocidad.

Optimizar solo después de tener resultados correctos.

---

# 76. Chunking

Procesar internamente en chunks.

Ejemplo inicial:

```text
25-100 items
```

según necesidades.

No confundir chunk con concurrencia física.

---

# 77. Bounded Pipeline

Mantener un número limitado de items en estados:

```text
compiling
queued
```

para controlar memoria y pausabilidad.

---

# 78. Compile Cache

Si varios registros producen elementos estáticos idénticos, se puede reutilizar trabajo derivado cuando sea seguro.

No introducir cache que mezcle datos variables.

---

# 79. Performance

Objetivo:

la UI debe mantenerse responsiva durante producción.

Operaciones pesadas deben vivir fuera del renderer.

---

# 80. Renderer

El renderer no debe:

```text
resolver 10,000 documentos
compilar 10,000 ZPL
administrar PrintQueue
```

El Main/service layer coordina producción.

---

# 81. Worker Threads

No introducir Workers automáticamente.

Si profiling demuestra CPU blocking considerable en compilación masiva, evaluar `worker_threads` como optimización posterior dentro de esta fase.

Documentar antes de añadir.

---

# 82. Memory Limits

No mantener simultáneamente:

```text
10,000 PDFs
10,000 ZPL strings
```

en memoria.

Generar artefactos cerca del momento de dispatch.

---

# 83. PDF Production

Para impresoras PDF/system:

cada record puede requerir:

- un PDF por item;
- o un PDF multipágina si el backend lo soporta.

Primera versión recomendada:

```text
un PrintJob controlado por registro o unidad lógica
```

No introducir batching PDF que cambie semántica sin análisis.

---

# 84. ZPL Production

Puede ser posible concatenar múltiples labels ZPL.

Sin embargo, la primera implementación debe priorizar trazabilidad y control.

No combinar miles de etiquetas en un solo socket write si elimina capacidad de retry/item status.

---

# 85. Optimización Futura

Posteriormente puede existir:

```text
transport batching
```

como optimización, manteniendo item-level tracking.

No es requisito inicial.

---

# 86. Reporte de Tiempo

Medir:

```text
preflight duration
production duration
average item duration
```

No usar estas métricas para claims de impresión física si solo miden dispatch.

---

# 87. Start Guard

No permitir Start cuando:

```text
preflight stale
document changed
printer changed
record selection changed
mapping changed
```

En esos casos recalcular preflight.

---

# 88. Preflight Fingerprint

Crear fingerprint/hash estable de inputs relevantes.

Ejemplo:

```text
document snapshot
records
mapping
printer profile
copies
```

Si cambia, preflight se invalida.

---

# 89. Hash

Utilizar hashing determinista si ya existe utilidad adecuada.

No incluir timestamps en fingerprint.

---

# 90. Duplicación Accidental

Evitar doble click en Start.

La creación/inicio debe tener protección de estado/idempotency key local.

---

# 91. Start Idempotency

Dos llamadas con el mismo `runId` no deben iniciar dos coordinators.

---

# 92. UI Close

Cerrar la ventana/panel no cancela automáticamente ProductionRun.

La ejecución pertenece al Main Process.

---

# 93. App Close

Si existen runs activos:

mostrar advertencia.

Opciones posibles:

```text
Keep app open
Cancel production
Exit anyway
```

Si se permite Exit, persistir estado e introducir `unknown` donde corresponda.

---

# 94. System Sleep

No asumir que timers continúan correctamente durante sleep.

Al reanudarse:

revalidar estado temporal.

No repetir jobs automáticamente.

---

# 95. Network Loss

Si impresora TCP pierde conexión:

aplicar reglas retry/unknown de Fase 5.

ProductionCoordinator consume el resultado; no inventa una política paralela incompatible.

---

# 96. Printer Removed

Si impresora system deja de existir durante run:

pausar/fallar nuevos items de forma controlada.

No reasignar automáticamente a otra impresora.

---

# 97. Printer Change During Run

No permitir cambiar printer profile de un run iniciado.

Crear un nuevo ProductionRun si se desea otra impresora.

---

# 98. Tests de ProductionPlan

Cubrir:

```text
valid plan
snapshot
selection
copies
total labels
limits
fingerprint
```

---

# 99. Tests Preflight

Cubrir:

```text
all valid
missing input
invalid EAN
out of bounds
unsupported printer language
wrong DPI
invalid mapping
```

---

# 100. Tests Run State Machine

Cubrir todas las transiciones válidas e inválidas.

---

# 101. Tests Item State Machine

Cubrir:

```text
pending -> validating
validating -> compiling
compiling -> queued
queued -> dispatching
dispatching -> completed
dispatching -> unknown
failed
skipped
cancelled
```

---

# 102. Tests Coordinator

Utilizar fake PrintQueue/transport.

Cubrir:

```text
100 records
bounded in-flight
order
pause
resume
cancel
failure
retry
unknown
```

---

# 103. Test No Massive Enqueue

Verificar que con 10,000 records no se creen 10,000 PrintJobs simultáneamente.

---

# 104. Tests Pause

Verificar:

```text
active items finish
no new items start
run becomes paused
```

---

# 105. Tests Resume

Verificar que no repite completed items.

---

# 106. Tests Cancel

Verificar estado final por item.

---

# 107. Tests Crash Recovery

Simular:

```text
running
dispatching item
app restart
```

Esperado:

```text
run -> interrupted
dispatching item -> unknown
```

---

# 108. Tests Counter Stability

Retry debe mantener el mismo serial.

Pause/resume debe mantener seriales.

Restart/resume debe mantener seriales.

---

# 109. Tests Snapshot

Modificar LabelDocument original después de Start no debe cambiar run existente.

---

# 110. Tests Source Independence

Después de materializar plan, eliminar/desconectar source externo.

Run debe seguir teniendo records necesarios.

---

# 111. Tests IPC

Cubrir:

```text
invalid UUID
invalid selection
invalid copies
stale preflight
duplicate start
pause invalid state
resume invalid state
cancel
resolve unknown
```

---

# 112. Tests Report

Verificar totales y statuses.

---

# 113. Estructura Recomendada

```text
src/
├── core/
│   └── production/
│       ├── production.types.ts
│       ├── production.schema.ts
│       ├── production-state.ts
│       ├── production-item-state.ts
│       ├── production-plan.ts
│       ├── production-preflight.ts
│       ├── production-fingerprint.ts
│       └── production-report.ts
│
├── main/
│   └── production/
│       ├── production.service.ts
│       ├── production-coordinator.ts
│       ├── production-store.ts
│       ├── production-recovery.ts
│       └── production.ipc.ts
│
└── renderer/
    └── components/
        └── production/
            ├── ProductionDialog.tsx
            ├── PreflightSummary.tsx
            ├── ProductionProgress.tsx
            ├── ProductionItemsTable.tsx
            ├── ProductionIssues.tsx
            └── ProductionHistory.tsx
```

---

# 114. Orden Secuencial de Implementación

## Paso 1 — Verificación

Leer:

```text
AGENTS.md
PHASE_1_SPEC.md
...
PHASE_9_SPEC.md
```

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

---

## Paso 2 — Auditar contratos existentes

Revisar:

```text
ResolvedRecord
ResolvedDocument
PrintPlan
CompileResult
PrinterProfile
PrintJob
PrintQueue
Dataset
FieldMapping
```

No duplicar conceptos.

---

## Paso 3 — Dominio Production

Implementar:

```text
ProductionPlan
ProductionRun
ProductionItem
statuses
transition rules
schemas
```

con tests.

---

## Paso 4 — Preflight

Implementar validación pura/servicio controlado.

No imprimir todavía.

---

## Paso 5 — Snapshot + Fingerprint

Congelar:

```text
document
records
printer
copies
serial values
```

---

## Paso 6 — ProductionCoordinator con Fake Queue

Implementar bounded pipeline sin hardware.

---

## Paso 7 — Pause/Resume/Cancel

Añadir estados y tests.

---

## Paso 8 — Retry/Unknown

Integrar semántica de Fase 5.

---

## Paso 9 — Production Store

Persistir runs/checkpoints.

---

## Paso 10 — Recovery

Detectar/interrumpir/reanudar.

---

## Paso 11 — Integración PrintQueue real

Conectar coordinator a Fase 5.

---

## Paso 12 — UI

Agregar preflight/progress/items/history.

---

## Paso 13 — Reports

Generar/exportar resumen.

---

## Paso 14 — IPC + Preload

Exponer APIs explícitas.

---

## Paso 15 — Security/Correctness Review

Verificar:

```text
no bypass validation
no mass enqueue
no auto retry unknown
no duplicate start
no secrets persisted
```

---

## Paso 16 — Full Regression

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

---

# 115. Guía de Enseñanza para el Agente

Antes de cada bloque explicar brevemente:

## ProductionRun vs PrintJob

- diferencia de nivel de abstracción.

## Preflight

- por qué validar antes de producir.

## Snapshot

- por qué congelar documento y datos.

## Backpressure

- por qué no crear miles de jobs simultáneos.

## Idempotencia

- por qué retry puede duplicar etiquetas.

## Unknown

- por qué a veces es más correcto admitir incertidumbre.

## Checkpoint/Recovery

- cómo continuar sin repetir trabajos ambiguos.

Las explicaciones deben ser concisas.

---

# 116. Reglas para Antigravity

No implementar toda la Fase 9 de una sola vez.

Flujo:

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

# 117. Decisiones que Requieren Documentación

Documentar antes de:

- elegir almacenamiento durable;
- cambiar límites máximos;
- agrupar múltiples etiquetas en un PrintJob;
- cambiar política de counters;
- auto-retry de errores ambiguos;
- introducir worker_threads;
- introducir batching de transporte.

Formato:

```text
Problema
Opciones
Decisión
Motivo
Riesgo de duplicación
Compatibilidad
```

---

# 118. Criterios de Aceptación Funcionales

La Fase 9 termina funcionalmente cuando:

1. Se puede seleccionar un dataset.
2. Se pueden seleccionar registros.
3. Se puede elegir copias.
4. Existe preflight.
5. Se detectan filas inválidas.
6. Se genera ProductionPlan.
7. Se inicia ProductionRun.
8. Los registros se procesan progresivamente.
9. No se encolan miles de jobs simultáneamente.
10. Se puede pausar.
11. Se puede reanudar.
12. Se puede cancelar.
13. Retry funciona cuando es seguro.
14. Unknown se maneja manualmente.
15. Seriales son estables.
16. Runs sobreviven reinicio.
17. Crash no provoca auto-reprint.
18. Existe progreso.
19. Existe historial.
20. Existe reporte final.
21. PrintQueue sigue siendo la capa de dispatch.
22. Fases anteriores no sufren regresiones.

---

# 119. Criterios de Aceptación Técnicos

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
10,000 simultaneous PrintJobs
automatic retry of unknown
mutable ProductionPlan after start
renderer-side production engine
validation bypass
```

---

# 120. Definition of Done

La Fase 9 termina únicamente cuando:

- existe `ProductionPlan`;
- existe `ProductionRun`;
- existe `ProductionItem`;
- existen máquinas de estado;
- existe preflight;
- existen snapshots;
- existe fingerprint;
- existe `ProductionCoordinator`;
- existe backpressure;
- pause funciona;
- resume funciona;
- cancel funciona;
- retry seguro funciona;
- unknown se maneja explícitamente;
- counters permanecen estables;
- existe persistencia;
- existe crash recovery;
- existe integración con PrintQueue;
- existe UI de progreso;
- existe historial;
- existe ProductionReport;
- IPC es específico;
- preload es tipado;
- no existe enqueue masivo;
- no existe auto-reprint tras estado ambiguo;
- TypeScript está limpio;
- Vitest está completamente en verde;
- no existen regresiones de Fases 1-8.

---

# 121. Resultado Esperado

Al terminar la Fase 9, el usuario podrá:

```text
Excel: 2,000 productos
      ↓
Select 1-2,000
      ↓
Map fields
      ↓
Preflight
      ↓
1,996 valid
4 invalid
      ↓
Correct / Skip according to policy
      ↓
Start Production
      ↓
Printing 417 / 1,996
      ↓
Pause / Resume / Cancel
      ↓
Completed with report
```

Cada registro tendrá trazabilidad individual y el sistema evitará reimpresiones automáticas cuando exista incertidumbre.

---

# 122. Prompt Inicial para Antigravity

> Lee completamente `AGENTS.md` y todas las especificaciones desde `PHASE_1_SPEC.md` hasta `PHASE_9_SPEC.md`.
>
> Ejecuta primero `npx tsc --noEmit` y `npx vitest run`. No avances mientras exista una regresión.
>
> No implementes toda la Fase 9 de una sola vez.
>
> Primero audita los contratos existentes de `ResolvedRecord`, `ResolvedDocument`, `PrintPlan`, `PrinterProfile`, `PrintJob`, `PrintQueue`, `Dataset` y `FieldMapping`.
>
> Después explícame brevemente la diferencia entre `ProductionRun` y `PrintJob`, por qué necesitamos preflight, por qué debemos congelar snapshots y por qué no debemos encolar miles de trabajos simultáneamente.
>
> Implementa únicamente el dominio puro de producción:
>
> - `ProductionPlan`
> - `ProductionRun`
> - `ProductionItem`
> - `ProductionRunStatus`
> - `ProductionItemStatus`
> - schemas Zod
> - reglas de transición
>
> junto con sus pruebas.
>
> No implementes todavía `ProductionCoordinator`, persistencia, IPC, UI ni integración con PrintQueue hasta que este primer bloque esté completamente en verde.
