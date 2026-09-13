# ESPECIFICACIÓN TÉCNICA: FASE 7 - DATOS VARIABLES, CAMPOS DINÁMICOS, SERIALIZACIÓN Y RESOLUCIÓN DE REGISTROS

## 1. Contexto de la Fase

La Fase 1 estableció el núcleo matemático, los esquemas de dominio, la seguridad de Electron y la frontera IPC.

La Fase 2 construyó el editor WYSIWYG.

La Fase 3 incorporó códigos de barras 1D/2D reales.

La Fase 4 creó los compiladores ZPL II y PDF vectorial.

La Fase 5 introdujo impresión real, perfiles de impresora, PrintJob, PrintQueue y transports.

La Fase 6 añadió persistencia documental mediante archivos `.label`, serialización, migraciones, autosave, recovery, recent files y templates.

La Fase 7 incorpora el **motor de datos variables**.

A partir de esta fase, una etiqueta deja de contener únicamente valores estáticos y puede representar campos dinámicos como:

```text
{product_name}
{lot}
{serial}
{today}
{expiration_date}
```

Esta fase debe respetar completamente:

```text
AGENTS.md
PHASE_1_SPEC.md
PHASE_2_SPEC.md
PHASE_3_SPEC.md
PHASE_4_SPEC.md
PHASE_5_SPEC.md
PHASE_6_SPEC.md
```

---

# 2. Objetivo Principal

Construir un motor de datos variables capaz de:

- definir variables en un documento;
- enlazar variables con texto, barcodes y QR;
- resolver valores dinámicos;
- soportar valores manuales;
- soportar fechas dinámicas;
- soportar fechas calculadas;
- soportar contadores;
- soportar serialización;
- generar secuencias;
- previsualizar registros;
- validar bindings;
- mantener resultados deterministas;
- preparar el sistema para CSV, Excel, SQL y REST en la Fase 8;
- preparar impresión por lotes para la Fase 9.

---

# 3. Alcance Estricto

La Fase 7 incluye:

1. Modelo de `DataField`.
2. Modelo de `DataSource`.
3. Modelo de `DataBinding`.
4. Variables estáticas/manuales.
5. Variables de fecha/hora.
6. Fechas calculadas.
7. Contadores numéricos.
8. Contadores alfanuméricos básicos.
9. Serialización incremental.
10. Padding.
11. Prefix/suffix.
12. Step.
13. Start value.
14. Reset policies básicas.
15. Resolución de placeholders.
16. Binding a elementos.
17. Preview de datos.
18. Generación de múltiples registros.
19. Validación de variables faltantes.
20. Validación de tipos.
21. Integración con LabelDocument.
22. Integración con PrintPlan.
23. Integración con ZPL/PDF sin duplicar lógica.
24. UI para variables.
25. UI de preview.
26. Tests unitarios.
27. Tests de integración.
28. No-regresión completa.

La Fase 7 no incluye:

- CSV;
- Excel;
- SQL;
- REST;
- Google Sheets;
- impresión masiva;
- datasets externos;
- joins;
- consultas SQL;
- expresiones arbitrarias JavaScript;
- scripting;
- macros;
- ejecución de código;
- plugins;
- scripting de usuario.

---

# 4. Principio Arquitectónico Fundamental

Los elementos visuales no deben almacenar directamente lógica de generación de datos.

Arquitectura esperada:

```text
LabelDocument
   ├── elements
   └── dataModel
         ├── fields
         └── sources
               ↓
        Data Resolver
               ↓
         ResolvedRecord
               ↓
       ResolvedDocument
               ↓
          PrintPlan
               ↓
        ZPL / PDF / Print
```

El editor diseña una plantilla.

El motor de datos produce instancias concretas de esa plantilla.

---

# 5. Separación Plantilla vs Documento Resuelto

Debe existir una diferencia explícita entre:

```text
Template Document
```

y:

```text
Resolved Document
```

Ejemplo:

```text
Template:

"LOT: {lot}"
```

Registro:

```json
{
  "lot": "A-2026-001"
}
```

Resultado:

```text
"LOT: A-2026-001"
```

El `LabelDocument` original no debe modificarse destructivamente durante la resolución.

---

# 6. Modelo de Datos

Agregar al documento una sección conceptual:

```ts
interface LabelDataModel {
  fields: DataField[];
}
```

La estructura final debe adaptarse al schema actual.

No introducir datos externos todavía.

---

# 7. DataField

Modelo conceptual:

```ts
type DataField =
  | StaticField
  | DateField
  | CounterField;
```

En futuras fases podrán añadirse:

```text
CSVField
ExcelField
SqlField
RestField
```

sin romper el contrato base.

---

# 8. Identidad de Campo

Cada campo debe tener:

```text
id
name
type
```

`id`:

```text
UUID v4
```

`name`:

identificador humano y estable.

Ejemplo:

```text
lot
serial_number
expiration_date
product_name
```

---

# 9. Reglas de Nombre

Los nombres deben ser compatibles con placeholders.

Regla recomendada:

```regex
^[A-Za-z_][A-Za-z0-9_]*$
```

Ejemplos válidos:

```text
lot
serial
product_name
date_1
```

Inválidos:

```text
product name
123value
{lot}
lot-number
```

---

# 10. Unicidad

No permitir nombres duplicados dentro del mismo documento.

La comparación debe ser explícita.

Recomendación inicial:

```text
case-sensitive
```

o documentar si se decide case-insensitive.

No permitir ambigüedad.

---

# 11. Placeholder Syntax

Sintaxis principal:

```text
{field_name}
```

Ejemplos:

```text
LOT: {lot}
SN: {serial}
EXP: {expiration_date}
```

No introducir un lenguaje complejo todavía.

---

# 12. Escape de Placeholders

Definir mecanismo para texto literal.

Ejemplo recomendado:

```text
{{ -> {
}} -> }
```

Así:

```text
{{serial}}
```

puede producir:

```text
{serial}
```

La sintaxis final debe documentarse y probarse.

---

# 13. Resolver de Template

Crear:

```text
resolveTemplate(...)
```

Debe ser función pura.

Entrada:

```text
template string
record
```

Salida:

```text
resolved string
warnings/errors
```

---

# 14. Missing Variables

No sustituir silenciosamente por string vacío.

Si:

```text
{lot}
```

no existe:

debe producir:

```text
MISSING_FIELD
```

o warning/error según contexto.

Para compilación/impresión:

preferencia inicial:

```text
error
```

---

# 15. Unknown Placeholders

Distinguir entre:

```text
field definido sin valor
```

y:

```text
placeholder desconocido
```

Ambos deben ser diagnosticables.

---

# 16. StaticField

Modelo conceptual:

```ts
interface StaticField {
  id: string;
  name: string;
  type: 'static';
  value: string;
}
```

Permite centralizar valores utilizados en varios elementos.

---

# 17. Manual Input Field

Puede existir un tipo:

```text
input
```

para solicitar valor al usuario antes de imprimir.

Ejemplo:

```text
lot
operator
batch
```

Modelo conceptual:

```ts
interface InputField {
  type: 'input';
  defaultValue?: string;
  required: boolean;
}
```

---

# 18. DateField

Debe soportar fecha actual y cálculo relativo.

Ejemplo:

```ts
interface DateField {
  type: 'date';
  mode: 'now' | 'relative';
  offset?: DateOffset;
  format: string;
}
```

---

# 19. DateOffset

Soportar inicialmente:

```text
days
months
years
```

Ejemplo:

```text
today + 30 days
```

No implementar parser de lenguaje natural.

Usar estructura tipada.

---

# 20. Formato de Fecha

No permitir código arbitrario.

Utilizar un conjunto definido de tokens.

Ejemplos:

```text
YYYY-MM-DD
DD/MM/YYYY
MM/DD/YYYY
YYYYMMDD
DD-MM-YYYY
```

Puede utilizarse una librería de fechas si está justificada.

No introducir una dependencia pesada sin necesidad.

---

# 21. Zona Horaria

La resolución de fecha debe recibir contexto explícito.

No asumir siempre UTC.

Modelo conceptual:

```ts
interface ResolutionContext {
  now: Date;
  timezone?: string;
}
```

El mismo `now` debe reutilizarse durante toda la generación del batch.

---

# 22. Determinismo de Fecha

Si se generan 100 etiquetas:

```text
{today}
```

debe usar el mismo tiempo de referencia para las 100 salvo que exista configuración contraria.

No llamar `new Date()` independientemente en cada elemento.

---

# 23. CounterField

Modelo conceptual:

```ts
interface CounterField {
  id: string;
  name: string;
  type: 'counter';

  start: number;
  step: number;
  padding: number;

  prefix?: string;
  suffix?: string;
}
```

---

# 24. Ejemplo de Contador

Config:

```text
start = 1
step = 1
padding = 5
prefix = "SN-"
```

Debe generar:

```text
SN-00001
SN-00002
SN-00003
```

---

# 25. Step

Debe permitir inicialmente:

```text
entero positivo
```

Puede permitirse negativo si existe caso real.

Preferencia inicial:

```text
step >= 1
```

para evitar ambigüedad.

---

# 26. Padding

Debe ser entero:

```text
>= 0
```

Ejemplo:

```text
padding = 4
value = 27
=> 0027
```

---

# 27. Prefix/Suffix

Aplicar después de formatear el contador.

Ejemplo:

```text
prefix: "LOT-"
value: 12
padding: 4
suffix: "-A"
```

Resultado:

```text
LOT-0012-A
```

---

# 28. Serialización

La serialización consiste en producir valores diferentes para múltiples registros.

Ejemplo:

```text
Record 1 -> SN-0001
Record 2 -> SN-0002
Record 3 -> SN-0003
```

No confundir con serialización JSON de la Fase 6.

Usar terminología clara:

```text
document serialization
```

vs:

```text
sequence generation
```

Preferir llamar a esta feature:

```text
sequence / counter
```

internamente si evita confusión.

---

# 29. BatchRecord

Definir estructura:

```ts
interface ResolvedRecord {
  index: number;
  values: Record<string, string>;
}
```

No usar necesariamente exactamente esa interfaz.

---

# 30. Record Index

Definir:

```text
0-based internamente
```

o:

```text
1-based
```

y mantenerlo consistente.

Recomendación:

```text
0-based internal
1-based UI
```

---

# 31. Data Resolver

Crear módulo:

```text
src/core/data/
```

Estructura sugerida:

```text
src/core/data/
├── data.types.ts
├── data.schema.ts
├── field-validator.ts
├── template-parser.ts
├── template-resolver.ts
├── record-resolver.ts
├── batch-generator.ts
├── date/
│   ├── date-resolver.ts
│   └── date-format.ts
├── counter/
│   ├── counter-resolver.ts
│   └── counter.types.ts
└── index.ts
```

---

# 32. Core Puro

`src/core/data/` no debe importar:

```text
Electron
React
Konva
Node filesystem
network
DOM
```

Debe ser completamente testeable.

---

# 33. Parser de Placeholders

No utilizar regex complejas dispersas por componentes.

Centralizar parser.

Debe poder distinguir:

```text
literal text
placeholder
escaped braces
```

---

# 34. Parsing

Ejemplo:

```text
"LOT {lot} / SN {serial}"
```

Tokens conceptuales:

```text
Text("LOT ")
Field("lot")
Text(" / SN ")
Field("serial")
```

Esto permite mejor validación que `string.replace()` ingenuo.

---

# 35. AST Ligero

Puede crearse una estructura simple:

```ts
type TemplateToken =
  | { type: 'text'; value: string }
  | { type: 'field'; name: string };
```

No crear un parser excesivamente complejo.

---

# 36. Cache de Parsing

Un template no necesita parsearse en cada render si no cambió.

Puede cachearse por string.

No optimizar prematuramente si no existe problema real.

---

# 37. DataBinding

Los elementos deben poder declarar qué propiedades contienen templates.

Ejemplo para texto:

```text
content
```

Barcode:

```text
data
```

QR:

```text
data
```

No permitir bindings arbitrarios a cualquier propiedad numérica todavía.

---

# 38. Binding de Texto

Ejemplo:

```text
Product: {product_name}
Lot: {lot}
```

Debe resolverse a un string final.

---

# 39. Binding de Barcode

Ejemplo:

```text
{serial}
```

Después de resolver:

```text
SN-000123
```

ese resultado debe pasar nuevamente por validación de la simbología.

---

# 40. Validación después de Resolver

Este punto es obligatorio.

Ejemplo:

```text
EAN13 data = {ean}
```

El template es válido estructuralmente.

Pero el valor resuelto:

```text
ABC123
```

no es EAN-13 válido.

Pipeline:

```text
resolve
↓
barcode validation
↓
compile
```

---

# 41. ResolvedDocument

Crear función conceptual:

```ts
resolveDocument(
  document,
  record,
  context
): ResolveDocumentResult
```

Debe crear una representación derivada.

No modificar el documento original.

---

# 42. Integración con PrintPlan

El flujo de Fase 4 debe evolucionar a:

```text
LabelDocument
      ↓
Data Resolution
      ↓
ResolvedDocument
      ↓
PrintPlan
      ↓
ZPL / PDF
```

No introducir lógica de placeholders dentro del compilador ZPL.

---

# 43. Regla de Compiladores

ZPL/PDF deben recibir valores ya resueltos.

Está prohibido:

```text
ZPL compiler parses {serial}
PDF renderer parses {serial}
```

La resolución ocurre una sola vez antes de compilar.

---

# 44. Input Values

Para campos manuales:

```text
InputField
```

la UI debe permitir crear un:

```text
ResolutionInput
```

Ejemplo:

```json
{
  "lot": "A15",
  "operator": "John"
}
```

---

# 45. Validación de Inputs

Debe existir:

```text
required
maxLength
```

y opcionalmente patrones seguros.

No permitir regex arbitrarias no controladas si pueden causar problemas de rendimiento.

---

# 46. Default Values

Input fields pueden definir:

```text
defaultValue
```

La UI debe mostrarlo.

---

# 47. Batch Generator

Crear:

```ts
generateRecords(...)
```

Entrada conceptual:

```text
fields
count
context
inputs
```

Salida:

```text
ResolvedRecord[]
```

---

# 48. Count

Validar:

```text
count >= 1
```

Definir máximo razonable para preview/generación.

Ejemplo inicial:

```text
10000
```

No generar millones de registros en memoria sin estrategia.

---

# 49. Preview Limit

La UI no necesita renderizar 10,000 filas simultáneamente.

Preview inicial:

```text
first 100
```

o virtualización.

---

# 50. Batch Determinism

Dadas:

```text
same fields
same count
same inputs
same context.now
```

la salida debe ser idéntica.

---

# 51. Counter State

Distinguir entre:

```text
counter definition
```

y:

```text
persistent next value
```

La Fase 7 debe definir esta semántica cuidadosamente.

---

# 52. Estrategia Recomendada de Contadores

El archivo `.label` debe almacenar la definición:

```text
start
step
padding
prefix
suffix
```

No incrementar automáticamente `start` durante preview.

---

# 53. Counter Commit

No actualizar estado persistente del contador durante:

```text
preview
export
```

La actualización persistente futura debe ocurrir en un punto de commit explícito.

Para esta fase, preferencia:

```text
counters are deterministic from start + record index
```

---

# 54. Ejemplo

```text
start = 100
step = 5
```

Records:

```text
0 -> 100
1 -> 105
2 -> 110
```

No mutar el field.

---

# 55. Reset Policies

Soportar inicialmente:

```text
never
per_batch
```

Si no es necesaria aún:

dejar preparada la estructura, pero no sobreimplementar.

---

# 56. Alphanumeric Counter

Soporte básico opcional dentro de esta fase.

Ejemplo:

```text
A001
A002
A003
```

No implementar algoritmos complejos tipo:

```text
A-Z -> AA-ZZ
```

sin especificación explícita.

La primera versión puede resolverse con:

```text
prefix + numeric counter
```

---

# 57. Date Formatting

Crear tests para:

```text
YYYY-MM-DD
DD/MM/YYYY
MM/DD/YYYY
YYYYMMDD
```

No confiar en locale del sistema para formatos explícitos.

---

# 58. Relative Dates

Casos:

```text
today
today + 30 days
today - 7 days
today + 1 month
today + 1 year
```

Usar aritmética segura de calendario.

---

# 59. Meses

Sumar un mes a:

```text
January 31
```

requiere política explícita.

Documentar comportamiento.

Preferir una librería madura si la lógica se vuelve compleja.

---

# 60. Zona Horaria y DST

No sobrediseñar.

Pero el resolver debe recibir un contexto temporal consistente.

No crear timestamps diferentes por elemento.

---

# 61. UI: Data Panel

Agregar un panel:

```text
Data
```

o:

```text
Variables
```

Debe permitir:

```text
Create Field
Edit Field
Delete Field
Preview Values
```

---

# 62. Field Types UI

Inicialmente:

```text
Static
Input
Date
Counter
```

---

# 63. Field List

Mostrar:

```text
name
type
preview
usage count
```

Ejemplo:

```text
serial | Counter | SN-0001 | Used by 2 elements
```

---

# 64. Field Usage

Debe poder calcular qué elementos referencian un field.

Crear helper puro:

```ts
findFieldUsages(...)
```

---

# 65. Delete Field

Si field está en uso:

no eliminar silenciosamente.

Mostrar:

```text
Field is used by 3 elements
```

Opciones:

```text
Cancel
Delete anyway
```

si la UX lo permite.

Preferencia inicial:

```text
block until references removed
```

---

# 66. Rename Field

Renombrar un field debe actualizar referencias de forma segura.

No hacer string replace global ingenuo.

Utilizar parser de templates.

---

# 67. Rename Atomicity

Si una referencia no puede actualizarse:

fallar operación completa.

No dejar documento parcialmente migrado.

---

# 68. Element Properties UI

Para campos text/data:

permitir insertar variables.

Ejemplo botón:

```text
Insert Variable
```

Lista:

```text
product_name
lot
serial
today
```

---

# 69. Preview del Elemento

El canvas debe mostrar valores resueltos de preview.

No mostrar necesariamente:

```text
{serial}
```

si existe un registro de preview activo.

Debe poder alternar:

```text
Template View
Preview View
```

si es útil.

---

# 70. Preview Record Selector

UI:

```text
Record 1 of 100
< Previous | Next >
```

No necesita tabla compleja todavía.

---

# 71. Preview Context

Debe generar un conjunto temporal.

No comprometer contadores persistentes.

---

# 72. Data Validation Panel

Mostrar errores como:

```text
Missing field
Invalid EAN after resolution
Empty required input
Invalid date format
Duplicate field name
```

---

# 73. Integración con Undo/Redo

Crear/editar/eliminar variables debe participar en el historial documental.

No crear historial separado.

---

# 74. Dirty State

Cambiar data fields debe marcar documento dirty.

Cambiar únicamente:

```text
preview record index
```

no debe marcar dirty.

---

# 75. Persistencia `.label`

Los fields deben formar parte del archivo `.label`.

Esto requiere actualizar:

```text
LabelDocumentSchema
LabelFile round-trip
migrations
tests
```

---

# 76. Migración

Documentos de Fase 6 sin `dataModel` deben migrar de forma segura.

Ejemplo:

```ts
dataModel: {
  fields: []
}
```

La estrategia debe respetar `formatVersion` y/o document schema version según la arquitectura existente.

No cambiar versión sin documentar.

---

# 77. Compatibilidad

Un documento sin variables debe seguir funcionando exactamente igual.

---

# 78. Templates

Las variables forman parte de templates.

Ejemplo:

```text
Product Label
Fields:
- product_name
- price
- barcode
```

Al crear desde template:

se conservan definiciones de fields.

---

# 79. Autosave

Autosave debe incluir el nuevo data model.

No guardar preview records derivados si pueden regenerarse.

---

# 80. Print Flow

Para un único registro:

```text
LabelDocument
↓
collect inputs
↓
resolve record
↓
ResolvedDocument
↓
PrintPlan
↓
compile
↓
PrintJob
```

---

# 81. Multi-record Printing

La Fase 7 puede generar múltiples registros, pero no debe implementar todavía el dispatcher completo de impresión masiva.

Eso corresponde a Fase 9.

---

# 82. Export de Preview

Puede permitir generar ZPL/PDF para:

```text
current preview record
```

si la arquitectura actual lo facilita.

No implementar batch export completo todavía.

---

# 83. Security

Está prohibido implementar placeholders mediante:

```ts
eval(...)
new Function(...)
```

o ejecución de JavaScript.

---

# 84. No Scripting

No permitir:

```text
{javascript: ...}
${...}
eval expressions
```

La sintaxis es declarativa y controlada.

---

# 85. Expression Language

No crear lenguaje de expresiones completo en esta fase.

Si se requieren transformaciones simples:

usar funciones explícitas futuras.

---

# 86. Template Injection

Los placeholders son datos.

No deben convertirse en:

```text
HTML
ZPL commands
SQL
shell
```

sin pasar por las capas correspondientes de validación/escaping.

---

# 87. ZPL Security

Los valores resueltos continúan pasando por:

```text
ZPL escaping
```

de Fase 4.

La resolución de variables no reemplaza la seguridad del backend.

---

# 88. Barcode Security

Datos resueltos para barcode pasan por:

```text
barcode validator
```

de Fase 3.

---

# 89. Limits

Definir límites razonables.

Ejemplo:

```text
max fields: 500
max placeholder length: 128
max resolved string: 10,000 chars
max preview records: 100
max generated records per operation: 10,000
```

Los valores deben documentarse y ajustarse si es necesario.

---

# 90. Performance

Evitar resolver todo el documento ante cada tecla si no es necesario.

Puede utilizarse:

```text
debounce
memoization
incremental preview
```

sin complicar excesivamente.

---

# 91. Pruebas Parser

Cubrir:

```text
plain text
single placeholder
multiple placeholders
escaped braces
unknown field
malformed braces
empty placeholder
```

---

# 92. Pruebas Resolver

Cubrir:

```text
static
input
date
counter
multiple fields
missing value
```

---

# 93. Pruebas Counter

Cubrir:

```text
start
step
padding
prefix
suffix
multiple records
determinism
```

Ejemplo:

```text
start 1
step 1
padding 4
=> 0001, 0002, 0003
```

---

# 94. Pruebas Dates

Usar tiempo fijo.

No depender del reloj real.

Ejemplo:

```text
now = 2026-09-12T12:00:00
```

Probar offsets y formats.

---

# 95. Tests Field Validation

Cubrir:

```text
valid names
invalid names
duplicates
invalid type
invalid counter configuration
invalid date configuration
```

---

# 96. Tests Rename

Cubrir:

```text
field rename
multiple references
escaped text
unknown refs
atomic failure
```

---

# 97. Tests ResolvedDocument

Cubrir:

```text
text
barcode
QR
multiple bindings
original document unchanged
```

---

# 98. Tests Barcode after Resolve

Ejemplo:

```text
EAN template = {ean}
record ean = valid
=> success
```

y:

```text
record ean = ABC
=> barcode validation error
```

---

# 99. Tests Batch

Cubrir:

```text
1 record
10 records
counter progression
same now across batch
max limit
determinism
```

---

# 100. Tests Migration

Documento antiguo:

```text
without dataModel
```

debe abrir con:

```text
fields = []
```

sin romper contenido.

---

# 101. Tests Serialization `.label`

Round-trip debe preservar:

```text
dataModel
field definitions
bindings
```

---

# 102. Tests Dirty State

Cambiar field:

```text
dirty = true
```

Cambiar preview record:

```text
dirty = false
```

---

# 103. Tests Undo/Redo

Crear field:

```text
undo -> field gone
redo -> restored
```

Editar counter:

```text
undo -> previous config
```

---

# 104. Estructura de Archivos Recomendada

```text
src/
├── core/
│   ├── data/
│   │   ├── data.types.ts
│   │   ├── data.schema.ts
│   │   ├── field-validator.ts
│   │   ├── template-parser.ts
│   │   ├── template-resolver.ts
│   │   ├── record-resolver.ts
│   │   ├── resolve-document.ts
│   │   ├── batch-generator.ts
│   │   ├── field-usage.ts
│   │   ├── date/
│   │   │   ├── date.types.ts
│   │   │   ├── date-resolver.ts
│   │   │   └── date-format.ts
│   │   ├── counter/
│   │   │   ├── counter.types.ts
│   │   │   └── counter-resolver.ts
│   │   └── index.ts
│   │
│   └── schemas/
│       └── label.schema.ts
│
└── renderer/
    ├── components/
    │   └── data/
    │       ├── DataPanel.tsx
    │       ├── FieldList.tsx
    │       ├── FieldEditor.tsx
    │       ├── InsertVariableMenu.tsx
    │       ├── DataPreview.tsx
    │       └── DataIssues.tsx
    │
    └── store/
        └── editor.store.ts

tests/
├── core/
│   └── data/
│       ├── template-parser.test.ts
│       ├── template-resolver.test.ts
│       ├── field-validator.test.ts
│       ├── counter-resolver.test.ts
│       ├── date-resolver.test.ts
│       ├── batch-generator.test.ts
│       └── resolve-document.test.ts
│
└── renderer/
    └── data/
        └── data-panel.test.tsx
```

---

# 105. Orden Secuencial de Implementación

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
PHASE_7_SPEC.md
```

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

No avanzar con regresiones.

---

## Paso 2 — Auditar modelo actual

Revisar:

```text
LabelDocumentSchema
TextElement
BarcodeElement
QrCodeElement
file format
migrations
undo/redo
dirty state
```

Documentar cómo introducir data model sin romper compatibilidad.

---

## Paso 3 — Data Schema

Implementar:

```text
DataField
StaticField
InputField
DateField
CounterField
LabelDataModel
```

con Zod y tests.

---

## Paso 4 — Template Parser

Implementar parser puro.

No resolver todavía.

Añadir tests.

---

## Paso 5 — Template Resolver

Implementar resolución de:

```text
Static
Input
```

primero.

Añadir errores de missing field.

---

## Paso 6 — Counter Engine

Implementar:

```text
start
step
padding
prefix
suffix
```

y tests.

---

## Paso 7 — Date Engine

Implementar:

```text
now
relative
format
```

con tiempo inyectado.

---

## Paso 8 — Batch Generator

Generar `ResolvedRecord[]`.

Probar determinismo.

---

## Paso 9 — Resolve Document

Resolver:

```text
text content
barcode data
QR data
```

sin mutar original.

---

## Paso 10 — Barcode Revalidation

Después de resolver:

volver a validar barcode.

---

## Paso 11 — Schema/File Migration

Actualizar:

```text
LabelDocumentSchema
LabelFile
migration
round-trip tests
```

---

## Paso 12 — Editor Store

Integrar fields con:

```text
undo/redo
dirty
```

---

## Paso 13 — Data Panel

Crear UI:

```text
list
create
edit
delete
```

---

## Paso 14 — Insert Variable

Integrar en propiedades de:

```text
text
barcode
QR
```

---

## Paso 15 — Preview

Crear:

```text
record preview
next/previous
```

---

## Paso 16 — Print/Export Single Record

Integrar resolución antes de PrintPlan.

---

## Paso 17 — Security Review

Verificar:

```text
no eval
no scripting
no backend-specific placeholder parsing
```

---

## Paso 18 — Full Regression

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

---

# 106. Guía de Enseñanza para el Agente

Antes de cada bloque relevante explicar brevemente:

## Template vs Resolved Document

- por qué no modificar la plantilla;
- por qué generar instancias.

## Parser

- por qué tokenizar es mejor que reemplazos globales ingenuos.

## Counter

- determinismo;
- index;
- step;
- padding.

## Date Context

- por qué inyectar `now`;
- por qué no llamar `new Date()` en cada lugar.

## Revalidation

- por qué un template barcode válido puede producir un valor inválido.

## Security

- por qué nunca usar `eval`.

Las explicaciones deben ser concisas.

---

# 107. Reglas para Antigravity

No implementar toda la Fase 7 de una sola vez.

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

# 108. Decisiones que Requieren Documentación

Documentar antes de:

- modificar `LabelDocumentSchema`;
- cambiar `formatVersion`;
- elegir librería de fechas;
- añadir lenguaje de expresiones;
- cambiar sintaxis de placeholders;
- persistir estado mutable de counters;
- añadir nuevos tipos de fields.

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

# 109. Criterios de Aceptación Funcionales

La Fase 7 termina funcionalmente cuando:

1. Se pueden crear variables.
2. Se pueden crear fields estáticos.
3. Se pueden crear inputs.
4. Se pueden crear fechas.
5. Se pueden crear counters.
6. Placeholders funcionan.
7. Missing fields producen error.
8. Counters generan secuencia.
9. Dates generan valores deterministas.
10. Text puede usar variables.
11. Barcode puede usar variables.
12. QR puede usar variables.
13. Barcode se revalida después de resolver.
14. Preview funciona.
15. Se pueden generar múltiples registros.
16. Undo/redo funciona con variables.
17. Dirty state funciona.
18. `.label` persiste data model.
19. Templates conservan fields.
20. Fases anteriores no sufren regresiones.

---

# 110. Criterios de Aceptación Técnicos

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
eval
new Function
scripting arbitrario
placeholder parsing duplicado en backends
```

---

# 111. Definition of Done

La Fase 7 termina únicamente cuando:

- existe `LabelDataModel`;
- existen DataFields tipados;
- existe parser de templates;
- existe resolver;
- existe Counter engine;
- existe Date engine;
- existe Batch generator;
- existe ResolvedRecord;
- existe ResolvedDocument;
- resolución no muta la plantilla;
- barcode se revalida;
- data model se guarda en `.label`;
- migrations funcionan;
- UI de variables existe;
- Insert Variable existe;
- preview existe;
- undo/redo funciona;
- dirty state funciona;
- no existe eval;
- ZPL/PDF reciben datos ya resueltos;
- TypeScript está limpio;
- Vitest está completamente en verde;
- no existen regresiones de Fases 1-6.

---

# 112. Resultado Esperado

Al terminar la Fase 7, el usuario podrá diseñar:

```text
Product: {product_name}
Lot: {lot}
Serial: {serial}
EXP: {expiration_date}
```

Configurar:

```text
product_name -> Input
lot -> Input
serial -> Counter
expiration_date -> Today + 30 days
```

y generar:

```text
Record 1:
Product: Lens Solution
Lot: L-204
Serial: SN-00001
EXP: 2026-10-12

Record 2:
Product: Lens Solution
Lot: L-204
Serial: SN-00002
EXP: 2026-10-12
```

Estos registros podrán previsualizarse y resolverse hacia:

```text
PrintPlan
↓
ZPL / PDF
↓
PrintJob
```

La Fase 8 añadirá fuentes externas como:

```text
CSV
Excel
SQL
REST
```

sin cambiar el motor de resolución creado aquí.

---

# 113. Prompt Inicial para Antigravity

> Lee completamente `AGENTS.md` y todas las especificaciones desde `PHASE_1_SPEC.md` hasta `PHASE_7_SPEC.md`.
>
> Ejecuta primero `npx tsc --noEmit` y `npx vitest run`. No avances mientras exista una regresión.
>
> No implementes toda la Fase 7 de una sola vez.
>
> Primero audita el modelo actual, especialmente `LabelDocumentSchema`, elementos text/barcode/QR, formato `.label`, migraciones, undo/redo y dirty state.
>
> Después explícame brevemente la diferencia entre una plantilla, un `ResolvedRecord` y un `ResolvedDocument`.
>
> Implementa únicamente el modelo de datos puro:
>
> - `DataField`
> - `StaticField`
> - `InputField`
> - `DateField`
> - `CounterField`
> - `LabelDataModel`
>
> usando Zod y tipos inferidos.
>
> Añade pruebas de nombres válidos/inválidos, duplicados y configuraciones inválidas.
>
> No implementes todavía parser de placeholders, counters, dates, UI ni integración con PrintPlan hasta que este primer bloque esté completamente en verde.
