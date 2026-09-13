# ESPECIFICACIÓN TÉCNICA: FASE 8 - FUENTES EXTERNAS DE DATOS, IMPORTACIÓN Y MAPEADO

## 1. Contexto de la Fase

La Fase 7 introdujo el motor de datos variables mediante:

```text
LabelDataModel
DataField
Template Parser
Template Resolver
Counter Engine
Date Engine
ResolvedRecord
ResolvedDocument
```

La Fase 8 conecta ese motor a fuentes externas reales.

El objetivo es que una etiqueta pueda consumir datos desde:

```text
CSV
Excel
SQL
REST
```

sin introducir lógica específica de cada origen dentro del editor, de los compiladores ZPL/PDF o del subsistema de impresión.

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
```

---

# 2. Objetivo Principal

Construir una arquitectura de fuentes de datos capaz de:

- importar CSV;
- importar Excel;
- conectar a bases de datos SQL;
- consumir APIs REST;
- descubrir columnas/campos;
- previsualizar registros;
- mapear columnas externas a DataFields;
- validar tipos;
- limitar volumen;
- manejar errores de conexión;
- proteger credenciales;
- reutilizar el motor de resolución de Fase 7;
- preparar la impresión masiva de Fase 9.

El flujo general debe ser:

```text
External Source
      ↓
DataSource Adapter
      ↓
Dataset
      ↓
Field Mapping
      ↓
ResolvedRecord
      ↓
ResolvedDocument
      ↓
PrintPlan
      ↓
ZPL / PDF
```

---

# 3. Alcance Estricto

La Fase 8 incluye:

1. Contrato común `DataSourceAdapter`.
2. Modelo `ExternalDataSource`.
3. Modelo `Dataset`.
4. Modelo de columnas.
5. Mapeo de columnas a DataFields.
6. Importación CSV.
7. Importación Excel.
8. Fuente SQL.
9. Fuente REST.
10. Preview de registros.
11. Paginación/limitación.
12. Validación de tipos.
13. Normalización a strings/valores de dominio.
14. Manejo de nulls.
15. Seguridad de credenciales.
16. Timeouts.
17. Cancelación.
18. IPC seguro.
19. Preload tipado.
20. UI de configuración de fuentes.
21. UI de mapeo.
22. Pruebas unitarias.
23. Pruebas de integración.
24. No-regresión completa.

La fase NO incluye:

- impresión masiva completa;
- scheduler;
- polling automático;
- sincronización en background;
- ETL avanzado;
- joins visuales;
- consultas arbitrarias desde renderer;
- edición de bases de datos;
- INSERT;
- UPDATE;
- DELETE;
- stored procedures arbitrarios;
- ejecución de scripts;
- macros;
- cloud sync;
- Google Sheets;
- autenticación OAuth compleja;
- conexión directa del renderer a DB/network.

---

# 4. Principio Arquitectónico Fundamental

Todas las fuentes externas deben traducirse al mismo contrato intermedio.

```text
CSV
Excel
SQL
REST
 ↓
DataSourceAdapter
 ↓
Dataset
```

A partir de `Dataset`, el resto de la aplicación no debe conocer el origen.

Esto evita crear lógica como:

```text
if csv ...
if excel ...
if sql ...
if rest ...
```

dentro del editor o del motor de impresión.

---

# 5. Separación de Responsabilidades

## 5.1. Core

Ubicación sugerida:

```text
src/core/data-sources/
```

Debe contener:

- tipos;
- schemas;
- dataset model;
- mapping;
- normalización;
- validaciones;
- contratos abstractos.

No debe importar:

```text
Electron
React
Node filesystem
network sockets
database drivers
DOM
```

---

## 5.2. Main Process

Ubicación sugerida:

```text
src/main/data-sources/
```

Debe contener:

- lectura de archivos;
- conexiones SQL;
- HTTP/REST;
- credenciales;
- timeouts;
- cancelación;
- adapters concretos;
- IPC handlers.

---

## 5.3. Renderer

Debe contener únicamente:

- configuración visual;
- selector de fuente;
- mapping;
- preview;
- mensajes de error;
- selección de hojas/tablas/columnas.

El renderer nunca debe abrir:

```text
filesystem
database connection
HTTP request
```

directamente para esta feature.

---

# 6. Modelo ExternalDataSource

Modelo conceptual:

```ts
type ExternalDataSource =
  | CsvDataSource
  | ExcelDataSource
  | SqlDataSource
  | RestDataSource;
```

Cada fuente debe poseer:

```text
id
name
type
enabled
```

y configuración específica.

---

# 7. Identidad

Cada fuente debe tener:

```text
UUID v4
```

No usar nombres como identificador técnico.

---

# 8. Contrato DataSourceAdapter

Definir una interfaz común.

Ejemplo conceptual:

```ts
interface DataSourceAdapter<TConfig> {
  readonly type: DataSourceType;

  testConnection(
    config: TConfig,
    context: DataSourceContext
  ): Promise<DataSourceTestResult>;

  getSchema(
    config: TConfig,
    context: DataSourceContext
  ): Promise<DatasetSchemaResult>;

  fetchPreview(
    config: TConfig,
    options: PreviewOptions,
    context: DataSourceContext
  ): Promise<DatasetResult>;

  fetchRows(
    config: TConfig,
    options: FetchOptions,
    context: DataSourceContext
  ): Promise<DatasetResult>;
}
```

La firma puede variar.

La arquitectura debe mantener una interfaz común.

---

# 9. Dataset

Definir una representación normalizada.

Ejemplo conceptual:

```ts
interface Dataset {
  columns: DatasetColumn[];
  rows: DatasetRow[];
  totalRows?: number;
  truncated: boolean;
}
```

---

# 10. DatasetColumn

Ejemplo:

```ts
interface DatasetColumn {
  key: string;
  label: string;

  inferredType:
    | 'string'
    | 'number'
    | 'boolean'
    | 'date'
    | 'null'
    | 'mixed';
}
```

---

# 11. DatasetRow

Preferir:

```ts
type DatasetRow = Record<string, unknown>;
```

en la frontera.

Después normalizar explícitamente.

No asumir que todos los valores externos son strings.

---

# 12. Row Identity

No exigir inicialmente una primary key.

Para preview puede utilizarse:

```text
rowIndex
```

En fases futuras puede soportarse una clave externa.

---

# 13. Field Mapping

Crear modelo:

```ts
interface FieldMapping {
  dataFieldId: string;
  sourceColumn: string;
}
```

o equivalente.

Esto conecta:

```text
external column
```

con:

```text
DataField
```

---

# 14. Flujo de Mapeo

Ejemplo:

```text
CSV column "Product"
      ↓
product_name

CSV column "LotNo"
      ↓
lot

CSV column "EAN"
      ↓
ean
```

El motor de Fase 7 continúa resolviendo:

```text
{product_name}
{lot}
{ean}
```

---

# 15. External Field Type

La Fase 7 debe extenderse con un field conceptual:

```text
external
```

o un binding equivalente.

No duplicar toda la definición de columna dentro de cada elemento.

---

# 16. Decisión de Persistencia

El archivo `.label` puede guardar:

```text
source definition
field mapping
non-secret configuration
```

pero NO debe guardar secretos en texto plano.

Ejemplos que NO deben persistirse directamente en `.label`:

```text
database password
API token
Authorization header
client secret
```

---

# 17. Referencia de Credenciales

Persistir una referencia lógica.

Ejemplo conceptual:

```text
credentialRef
```

La credencial real debe estar almacenada fuera del `.label`.

---

# 18. Almacenamiento Seguro de Credenciales

En Electron, utilizar almacenamiento seguro proporcionado por el sistema cuando esté disponible.

Arquitectura conceptual:

```text
Credential Store
      ↓
OS-backed encryption
```

Si se utiliza `safeStorage`, hacerlo desde Main Process.

No exponer la clave o secreto descifrado al renderer.

---

# 19. Portabilidad del `.label`

Si un `.label` se mueve a otro equipo:

- la definición de source puede existir;
- las credenciales no deben viajar automáticamente;
- la app debe pedir reconfigurar/autenticar la fuente.

Esto es preferible a incrustar secretos.

---

# 20. CSV

Implementar un adapter:

```text
CsvDataSourceAdapter
```

El usuario selecciona un archivo mediante diálogo seguro.

No introducir path libre desde renderer.

---

# 21. Librería CSV

Preferir una librería pequeña y mantenida, por ejemplo:

```text
csv-parse
```

o una solución equivalente.

Antes de instalar, revisar si ya existe parser en el proyecto.

No utilizar parsing manual ingenuo por:

```text
line.split(',')
```

porque no maneja:

- quotes;
- commas internas;
- escapes;
- multiline values.

---

# 22. CSV Config

Modelo conceptual:

```ts
interface CsvSourceConfig {
  delimiter: ',' | ';' | '\t' | '|';
  hasHeader: boolean;
  encoding: 'utf-8';
}
```

Permitir detección básica si es confiable.

---

# 23. CSV Header

Si:

```text
hasHeader = true
```

usar primera fila como nombres.

Si:

```text
false
```

crear:

```text
column_1
column_2
...
```

---

# 24. CSV Encoding

Soportar inicialmente:

```text
UTF-8
```

Si se requiere soporte Windows-1252 u otros encodings, documentarlo antes de ampliar.

No adivinar encodings complejos silenciosamente.

---

# 25. CSV Limits

No cargar archivos gigantes enteros sin límite.

Implementar:

```text
previewRowLimit
maxFileSize
```

y, si es necesario, parsing streaming.

---

# 26. Excel

Implementar:

```text
ExcelDataSourceAdapter
```

Soportar inicialmente:

```text
.xlsx
```

No es obligatorio soportar `.xls` legacy.

---

# 27. Librería Excel

Opción recomendada:

```text
exceljs
```

si encaja con el proyecto y licencia actual.

Antes de instalar:

- revisar si ya existe dependencia;
- licencia;
- mantenimiento;
- tamaño;
- necesidad.

No introducir múltiples librerías Excel.

---

# 28. Excel Sheets

Debe poder:

```text
list sheets
select sheet
preview rows
```

---

# 29. Excel Header Row

Permitir configurar:

```text
header row
```

Valor default:

```text
1
```

---

# 30. Excel Formulas

No ejecutar macros.

Para celdas con fórmula:

usar valor calculado disponible si existe.

No ejecutar VBA.

---

# 31. Excel Security

No habilitar:

```text
macros
embedded scripts
external links execution
```

El adapter extrae datos únicamente.

---

# 32. SQL

Implementar una arquitectura SQL segura.

Soporte inicial recomendado:

```text
SQL Server
PostgreSQL
MySQL
```

pero no instalar todos los drivers si no son necesarios.

---

# 33. SQL Driver Adapters

Estructura:

```text
src/main/data-sources/sql/
├── sql.types.ts
├── sql.adapter.ts
├── sqlserver.adapter.ts
├── postgres.adapter.ts
└── mysql.adapter.ts
```

Puede implementarse primero SQL Server si es el target prioritario.

Los demás adapters pueden seguir el mismo contrato.

---

# 34. SQL Credentials

No guardar:

```text
password
```

en `.label`.

Usar `credentialRef`.

---

# 35. SQL Connection Config

Puede persistirse:

```text
driver
host
port
database
username
ssl options
credentialRef
```

según sensibilidad.

Evaluar si `username` también debe mantenerse fuera del documento.

---

# 36. SQL Read-Only

La feature está orientada exclusivamente a lectura.

No permitir desde UI:

```text
INSERT
UPDATE
DELETE
DROP
ALTER
CREATE
EXEC
MERGE
TRUNCATE
```

---

# 37. SQL Query Strategy

Evitar permitir un editor SQL totalmente arbitrario en esta primera versión.

Preferencia inicial:

```text
table/view selection
column selection
optional filters
```

o una consulta `SELECT` validada estrictamente.

---

# 38. Si se permite SELECT personalizado

Debe existir una política clara.

Como mínimo:

- una sola statement;
- solo `SELECT`;
- bloquear comentarios peligrosos si el parser lo requiere;
- timeout;
- row limit;
- read-only DB credentials;
- parameterization.

No confiar únicamente en buscar palabras con regex.

---

# 39. SQL Parameters

Nunca concatenar valores del usuario.

Utilizar:

```text
parameterized queries
```

---

# 40. SQL Row Limit

Preview:

```text
100 rows
```

Fetch configurable con límite.

No ejecutar:

```text
SELECT * FROM huge_table
```

sin límite desde preview.

---

# 41. SQL Timeout

Definir:

```text
connection timeout
query timeout
```

No permitir queries indefinidas.

---

# 42. SQL Cancellation

Cuando el driver lo soporte:

permitir cancelación.

No mantener consultas activas si el usuario cierra el diálogo.

---

# 43. REST

Implementar:

```text
RestDataSourceAdapter
```

Las peticiones deben realizarse desde Main.

No desde renderer.

---

# 44. HTTP Client

Preferir:

```text
fetch
```

disponible en el runtime actual cuando sea suficiente.

No añadir Axios sin necesidad.

---

# 45. REST Methods

Soportar inicialmente:

```text
GET
POST
```

POST únicamente cuando se necesite enviar un body para consulta.

No convertir esta feature en un cliente HTTP genérico.

---

# 46. Base URL

El source debe definir:

```text
baseUrl
```

y endpoint controlado.

No permitir que cada registro cambie host arbitrariamente.

---

# 47. Protocolos

Aceptar únicamente:

```text
http
https
```

Rechazar:

```text
file:
ftp:
javascript:
data:
```

y protocolos no previstos.

---

# 48. SSRF y Red Interna

La app es de escritorio y puede necesitar APIs locales, por lo que no se debe bloquear automáticamente toda red privada.

Pero debe existir consentimiento/configuración explícita.

No permitir una API genérica:

```text
fetch arbitrary URL
```

desde renderer.

---

# 49. Headers

Permitir headers configurados de forma controlada.

Separar:

```text
non-secret headers
```

de:

```text
secret headers
```

como Authorization/API key.

---

# 50. REST Credentials

Secretos deben almacenarse fuera del `.label`.

Ejemplos:

```text
Bearer token
API key
Basic password
```

---

# 51. REST Body

Si se permite POST:

usar JSON estructurado.

No permitir scripts o templates ejecutables.

---

# 52. REST Response

Soportar inicialmente:

```text
JSON
```

No es necesario soportar XML.

---

# 53. REST Data Path

Permitir seleccionar una ruta simple dentro del JSON.

Ejemplo:

```text
data.items
```

para obtener el array.

No introducir JSONPath completo si no es necesario.

---

# 54. REST Schema Discovery

Analizar primeros registros para inferir columnas.

Ejemplo:

```json
[
  {
    "name": "Product A",
    "lot": "L1"
  }
]
```

=> columns:

```text
name
lot
```

---

# 55. Nested Objects

Primera versión:

permitir flattening controlado.

Ejemplo:

```text
customer.name
customer.code
```

No flatten arrays arbitrariamente.

---

# 56. Arrays

La fuente debe resolver finalmente a:

```text
array of records
```

Si la respuesta no contiene una colección usable:

mostrar error.

---

# 57. REST Timeout

Definir timeout explícito.

Ejemplo:

```text
10 seconds
```

Configurable dentro de límites.

---

# 58. REST Retry

No implementar retries automáticos complejos en esta fase.

Puede existir un retry manual.

No repetir POST automáticamente sin conocer idempotencia.

---

# 59. Dataset Normalization

Todos los adapters producen:

```text
Dataset
```

con valores normalizados.

---

# 60. Null Handling

Definir opciones:

```text
null -> empty
null -> error
null -> default value
```

La política inicial puede configurarse por field mapping.

---

# 61. Type Normalization

Los datos externos pueden ser:

```text
string
number
boolean
date
null
```

El motor de Fase 7 finalmente necesita valores apropiados para resolución.

Crear una capa:

```text
normalizeExternalValue(...)
```

---

# 62. Dates Externas

No interpretar automáticamente strings ambiguos como fechas.

Solo convertir a date cuando:

- el source proporciona tipo;
- o el mapping lo define explícitamente.

---

# 63. Numeric Formatting

No depender del locale implícito.

Si un número debe convertirse a string:

usar política explícita.

---

# 64. Mapping Transform

En esta fase permitir transformaciones mínimas:

```text
toString
trim
defaultValue
```

No crear un lenguaje de expresiones.

---

# 65. No Eval

Está prohibido:

```text
eval
new Function
user JavaScript
```

para transformar datos.

---

# 66. Mapping Validation

Un mapping debe validar:

- field existente;
- column existente;
- compatibilidad;
- duplicados;
- required fields.

---

# 67. Preview

La UI debe permitir:

```text
Connect / Load
Preview
Map Fields
```

---

# 68. Preview Limit

Default:

```text
100 rows
```

Mostrar:

```text
Previewing first 100 rows
```

si el dataset está truncado.

---

# 69. Data Source Panel

Agregar una sección:

```text
Data Sources
```

Debe mostrar:

```text
name
type
status
last test
mapped fields
```

---

# 70. New Source Wizard

Flujo:

```text
Choose Source Type
      ↓
Configure
      ↓
Test / Load
      ↓
Inspect Columns
      ↓
Map Fields
      ↓
Save
```

---

# 71. CSV Wizard

Debe permitir:

```text
Choose File
Delimiter
Header
Preview
Mapping
```

---

# 72. Excel Wizard

Debe permitir:

```text
Choose File
Sheet
Header Row
Preview
Mapping
```

---

# 73. SQL Wizard

Debe permitir:

```text
Engine
Host
Port
Database
Username
Credential
Table/View or approved SELECT
Preview
Mapping
```

---

# 74. REST Wizard

Debe permitir:

```text
Base URL
Method
Endpoint
Authentication reference
Response path
Preview
Mapping
```

---

# 75. Test Connection

Debe devolver información limitada.

Ejemplo:

```text
success
latency
error code
```

No devolver secretos.

---

# 76. Connection Errors

Definir códigos.

Ejemplos:

```text
SOURCE_FILE_NOT_FOUND
CSV_PARSE_FAILED
EXCEL_READ_FAILED
SHEET_NOT_FOUND
SQL_CONNECTION_FAILED
SQL_QUERY_FAILED
SQL_TIMEOUT
REST_CONNECTION_FAILED
REST_HTTP_ERROR
REST_TIMEOUT
INVALID_RESPONSE
CREDENTIAL_MISSING
MAPPING_INVALID
```

---

# 77. Sensitive Error Messages

No mostrar:

```text
password
token
connection string completa
Authorization header
```

en errores/logs.

---

# 78. Persistence

El `.label` debe poder almacenar definiciones de fuentes y mappings.

Pero nunca secretos en claro.

---

# 79. File Sources Portability

Para CSV/Excel, guardar un path absoluto puede romper portabilidad.

La Fase 8 debe documentar la estrategia.

Opciones:

```text
absolute path
relative path
embedded dataset
```

Preferencia inicial:

```text
external file reference
```

con warning de portabilidad.

No embeber automáticamente archivos grandes dentro del `.label`.

---

# 80. Re-link Missing File

Si CSV/Excel ya no existe:

mostrar:

```text
Source missing
Relink
```

La operación debe actualizar la referencia del source.

---

# 81. Recent Source Data

No almacenar todo el dataset dentro del documento por defecto.

Puede mantenerse preview temporal.

---

# 82. Autosave

Autosave debe incluir:

```text
source definitions
mappings
```

pero no secretos.

---

# 83. Templates

Las templates pueden contener:

```text
source definitions
mappings
```

sin credenciales.

Al crear desde template puede ser necesario re-link/re-authenticate.

---

# 84. Print Flow

Para una fuente externa:

```text
Source
  ↓
Fetch rows
  ↓
Normalize
  ↓
Map
  ↓
ResolvedRecord
  ↓
ResolvedDocument
  ↓
PrintPlan
```

---

# 85. Fase 9 Boundary

La Fase 8 puede cargar y previsualizar múltiples filas.

NO debe implementar aún el ciclo completo:

```text
10000 rows -> 10000 PrintJobs
```

Eso corresponde a Fase 9.

---

# 86. Cancelación

Operaciones largas deben poder cancelarse cuando sea viable.

Especialmente:

```text
SQL query
REST fetch
large CSV/Excel parse
```

---

# 87. AbortSignal

Para operaciones que lo soporten, usar concepto equivalente a:

```text
AbortSignal
```

desde Main.

No exponer el objeto nativo al renderer.

---

# 88. Concurrencia

Evitar múltiples fetch simultáneos innecesarios del mismo source.

Puede existir un request activo por source para preview.

---

# 89. Caching

Preview puede cachearse temporalmente.

Invalidar cuando cambie:

```text
source config
credentials
file
query
endpoint
mapping
```

No persistir cache pesado dentro del `.label`.

---

# 90. Seguridad IPC

Exponer APIs de dominio.

Ejemplo:

```ts
window.dataSourceAPI.listSources()
window.dataSourceAPI.testSource(sourceId)
window.dataSourceAPI.previewSource(sourceId, options)
window.dataSourceAPI.createSource(config)
window.dataSourceAPI.updateSource(id, config)
window.dataSourceAPI.deleteSource(id)
window.dataSourceAPI.relinkFileSource(id)
```

---

# 91. Prohibición de APIs Genéricas

No exponer:

```ts
window.db.query(sql)
window.http.fetch(url, options)
window.fs.read(path)
```

El renderer no obtiene primitivas genéricas.

---

# 92. SQL Security Boundary

Especialmente prohibido:

```text
renderer -> arbitrary SQL string -> DB
```

La consulta debe derivarse de una configuración validada.

---

# 93. REST Security Boundary

Prohibido:

```text
renderer -> arbitrary URL + headers + body
```

Debe operar mediante una fuente guardada/validada.

---

# 94. Credential API

El renderer puede pedir:

```text
configure credential
```

pero no debe recibir el secreto guardado en texto claro posteriormente.

Puede recibir:

```text
configured: true
```

---

# 95. Logging

Registrar:

```text
source id
type
operation
duration
row count
success/error code
```

No registrar:

```text
credentials
full rows
full query results
Authorization headers
full connection strings
```

---

# 96. Limits

Definir límites.

Ejemplo inicial:

```text
preview rows: 100
fetch rows per operation: 10,000
CSV/Excel file size: 50 MB
REST response: 20 MB
SQL query timeout: 30 s
REST timeout: 10 s
```

Los valores deben centralizarse y ser ajustables.

---

# 97. Pruebas Dataset

Cubrir:

```text
columns
rows
inferred types
nulls
mixed data
truncated
```

---

# 98. Pruebas Mapping

Cubrir:

```text
valid mapping
missing field
missing column
duplicate mapping
default value
trim
null policy
```

---

# 99. Pruebas CSV

Usar fixtures locales.

Cubrir:

```text
comma
semicolon
tab
quoted comma
multiline
header
no header
malformed row
UTF-8
row limit
```

---

# 100. Pruebas Excel

Usar fixture `.xlsx`.

Cubrir:

```text
sheet listing
sheet selection
header row
empty cells
numbers
dates
formulas with cached value
row limit
```

---

# 101. Pruebas SQL

No depender de DB externa en suite principal.

Usar:

```text
mock adapter
```

y tests específicos del driver mediante infraestructura controlada cuando sea apropiado.

Cubrir:

```text
connection success
timeout
read-only behavior
row limit
parameterization
error sanitization
```

---

# 102. Pruebas REST

Usar servidor HTTP local de test.

Cubrir:

```text
GET
POST JSON
200
400
500
timeout
invalid JSON
response path
nested object
row limit
secret header redaction
```

---

# 103. Pruebas Credentials

Cubrir:

```text
save credential
credential reference
missing credential
secret not serialized into .label
secret not returned to renderer
```

---

# 104. Tests IPC

Cubrir:

```text
invalid source id
invalid source config
preview limit
missing credential
missing file
internal error
cancel operation
```

---

# 105. Tests Persistence

`.label` round-trip debe preservar:

```text
source definitions
mappings
credentialRef
```

y NO preservar:

```text
secret values
cached rows
temporary preview
```

---

# 106. Tests Migration

Documentos Fase 7 sin external sources deben migrar con:

```text
sources = []
```

o equivalente.

---

# 107. Tests Integration

Ejemplo:

```text
CSV
 ↓
map Product -> product_name
 ↓
ResolvedRecord
 ↓
ResolvedDocument
```

y verificar salida.

---

# 108. Estructura Recomendada

```text
src/
├── core/
│   └── data-sources/
│       ├── data-source.types.ts
│       ├── data-source.schema.ts
│       ├── dataset.types.ts
│       ├── mapping.types.ts
│       ├── mapping.schema.ts
│       ├── normalize-value.ts
│       ├── map-record.ts
│       └── index.ts
│
├── main/
│   └── data-sources/
│       ├── data-source.service.ts
│       ├── credential.service.ts
│       ├── adapters/
│       │   ├── csv.adapter.ts
│       │   ├── excel.adapter.ts
│       │   ├── rest.adapter.ts
│       │   └── sql/
│       │       ├── sql.adapter.ts
│       │       ├── sqlserver.adapter.ts
│       │       ├── postgres.adapter.ts
│       │       └── mysql.adapter.ts
│       └── ipc/
│           └── data-source.ipc.ts
│
└── renderer/
    └── components/
        └── data-sources/
            ├── DataSourcesPanel.tsx
            ├── SourceWizard.tsx
            ├── CsvSourceForm.tsx
            ├── ExcelSourceForm.tsx
            ├── SqlSourceForm.tsx
            ├── RestSourceForm.tsx
            ├── DatasetPreview.tsx
            └── FieldMappingEditor.tsx

tests/
├── core/
│   └── data-sources/
├── main/
│   └── data-sources/
└── renderer/
    └── data-sources/
```

---

# 109. Orden Secuencial de Implementación

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
PHASE_8_SPEC.md
```

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

---

## Paso 2 — Auditar Fase 7

Revisar:

```text
LabelDataModel
DataField
ResolvedRecord
ResolvedDocument
migration
.label format
```

Definir cómo encajan external sources.

---

## Paso 3 — Dataset + Mapping Core

Implementar:

```text
Dataset
DatasetColumn
DatasetRow
FieldMapping
normalization
mapping validation
```

con tests.

---

## Paso 4 — ExternalDataSource schemas

Implementar:

```text
CSV
Excel
SQL
REST
```

como configuraciones tipadas.

No conectar aún.

---

## Paso 5 — Credential Model

Implementar:

```text
credentialRef
credential metadata
secure storage abstraction
```

sin secretos en schemas persistentes.

---

## Paso 6 — CSV Adapter

Implementar y probar.

---

## Paso 7 — Excel Adapter

Implementar y probar.

---

## Paso 8 — Data Source UI Base

Crear:

```text
DataSourcesPanel
SourceWizard
DatasetPreview
FieldMappingEditor
```

---

## Paso 9 — SQL Adapter Contract

Implementar adapter abstracto + primer engine prioritario.

Recomendación inicial:

```text
SQL Server
```

si el proyecto no establece otro.

Añadir otros engines sin romper contrato.

---

## Paso 10 — REST Adapter

Implementar:

```text
GET
POST JSON
response path
timeouts
```

---

## Paso 11 — Mapping Integration

Conectar:

```text
DatasetRow
↓
FieldMapping
↓
ResolvedRecord
```

---

## Paso 12 — Persistence + Migration

Actualizar `.label`.

Verificar que secretos no se serializan.

---

## Paso 13 — IPC + Preload

Exponer APIs explícitas.

---

## Paso 14 — Security Review

Verificar:

```text
no arbitrary fs
no arbitrary SQL
no arbitrary HTTP
no secrets in renderer
no secrets in .label
```

---

## Paso 15 — Full Regression

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

---

# 110. Guía de Enseñanza para el Agente

Antes de cada bloque relevante explicar brevemente:

## Adapter Pattern

- por qué CSV/Excel/SQL/REST comparten interfaz;
- por qué el editor no debe conocer el origen.

## Dataset

- por qué normalizar fuentes diferentes al mismo formato.

## Mapping

- diferencia entre columna externa y DataField interno.

## Credentials

- por qué no guardar secretos dentro del `.label`.

## SQL Security

- read-only;
- parameterization;
- query limits.

## REST Security

- por qué no exponer `fetch(url)` al renderer.

## Streaming/Limits

- por qué no cargar datasets gigantes sin límites.

Las explicaciones deben ser concisas.

---

# 111. Reglas para Antigravity

No implementar toda la Fase 8 de una sola vez.

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

# 112. Decisiones que Requieren Documentación

Documentar antes de:

- instalar parser CSV;
- instalar librería Excel;
- instalar driver SQL;
- cambiar formato `.label`;
- guardar paths absolutos;
- añadir nueva política de credenciales;
- permitir SELECT personalizado;
- permitir POST REST;
- aumentar límites importantes.

Formato:

```text
Problema
Opciones
Decisión
Motivo
Seguridad
Compatibilidad
Migración
```

---

# 113. Criterios de Aceptación Funcionales

La Fase 8 termina funcionalmente cuando:

1. CSV puede cargarse.
2. Excel puede cargarse.
3. SQL puede conectarse mediante al menos el engine prioritario.
4. REST puede cargar JSON.
5. Todas las fuentes producen `Dataset`.
6. Se pueden inspeccionar columnas.
7. Se puede previsualizar.
8. Se pueden mapear columnas a fields.
9. El mapping genera `ResolvedRecord`.
10. Nulls se manejan explícitamente.
11. Límites funcionan.
12. Timeouts funcionan.
13. Credenciales no se almacenan en `.label`.
14. CSV/Excel pueden relinkearse.
15. Sources se persisten.
16. Mappings se persisten.
17. Fase 7 continúa resolviendo datos.
18. Fases anteriores no sufren regresiones.

---

# 114. Criterios de Aceptación Técnicos

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
renderer filesystem
renderer arbitrary fetch
renderer arbitrary SQL
plain-text secrets in .label
unbounded fetch/query
```

---

# 115. Definition of Done

La Fase 8 termina únicamente cuando:

- existe `DataSourceAdapter`;
- existe `Dataset`;
- existe `FieldMapping`;
- existe normalización;
- existe CSV adapter;
- existe Excel adapter;
- existe SQL adapter funcional para el engine prioritario;
- existe REST adapter;
- existe preview;
- existe mapping UI;
- existen límites;
- existen timeouts;
- existe cancelación razonable;
- existen credenciales seguras;
- no existen secretos en `.label`;
- external rows se convierten en `ResolvedRecord`;
- migrations funcionan;
- IPC es explícito;
- preload es tipado;
- no existe API genérica de DB/HTTP/filesystem;
- TypeScript está limpio;
- Vitest está completamente en verde;
- no existen regresiones de Fases 1-7.

---

# 116. Resultado Esperado

Al finalizar, el usuario podrá:

```text
CSV / Excel / SQL / REST
        ↓
Preview
        ↓
Map Columns
        ↓
Data Fields
        ↓
Resolved Records
        ↓
Label Preview
```

Ejemplo:

```text
Excel column "Producto"
        ↓
{product_name}

Excel column "Lote"
        ↓
{lot}

Excel column "EAN"
        ↓
{ean}
```

El usuario podrá recorrer registros y observar cómo cambia la etiqueta.

La Fase 9 tomará estos datasets y añadirá:

```text
batch printing
production jobs
progress
resume/cancel
reports
```

---

# 117. Prompt Inicial para Antigravity

> Lee completamente `AGENTS.md` y todas las especificaciones desde `PHASE_1_SPEC.md` hasta `PHASE_8_SPEC.md`.
>
> Ejecuta primero `npx tsc --noEmit` y `npx vitest run`.
>
> No avances mientras exista una regresión.
>
> No implementes toda la Fase 8 de una sola vez.
>
> Primero audita la arquitectura de datos de Fase 7 y explícame cómo introducirás una capa `Dataset` y `FieldMapping` sin hacer que el motor de resolución conozca si los datos vienen de CSV, Excel, SQL o REST.
>
> Después implementa únicamente el núcleo puro:
>
> - `Dataset`
> - `DatasetColumn`
> - `DatasetRow`
> - `FieldMapping`
> - normalización de valores
> - validación de mappings
>
> junto con sus schemas y tests.
>
> No implementes todavía CSV, Excel, SQL, REST, IPC, credenciales ni UI hasta que este primer bloque esté completamente en verde.
