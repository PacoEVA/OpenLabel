# ESPECIFICACIÓN TÉCNICA: FASE 5 - SUBSISTEMA DE IMPRESIÓN, HARDWARE Y DESPACHO DE TRABAJOS

## 1. Contexto de la Fase

La Fase 1 estableció el núcleo matemático, los esquemas, la seguridad de Electron y la frontera IPC.

La Fase 2 construyó el editor WYSIWYG.

La Fase 3 incorporó códigos de barras 1D/2D reales.

La Fase 4 creó los compiladores de salida:

```text
LabelDocument -> PrintPlan -> ZPL II
LabelDocument -> PrintPlan -> PDF
```

La Fase 5 conecta por primera vez esos artefactos con dispositivos de impresión reales.

Esta fase introduce:

- perfiles de impresora;
- descubrimiento controlado de impresoras;
- impresión por TCP RAW;
- impresión mediante spooler del sistema operativo;
- cola de trabajos;
- estados;
- reintentos;
- cancelación lógica;
- validación;
- seguridad;
- observabilidad;
- IPC explícito para impresión.

Esta fase debe respetar completamente:

```text
AGENTS.md
PHASE_1_SPEC.md
PHASE_2_SPEC.md
PHASE_3_SPEC.md
PHASE_4_SPEC.md
```

No se permite debilitar ninguna garantía de seguridad existente.

---

# 2. Objetivo Principal

Construir un subsistema de impresión capaz de tomar un artefacto ya compilado y enviarlo de forma segura a una impresora compatible.

Flujo general:

```text
LabelDocument
      ↓
PrintPlan
      ↓
Compiler
      ↓
PrintArtifact
      ↓
PrintJob
      ↓
PrintQueue
      ↓
Transport Adapter
      ├── TCP RAW 9100
      └── OS Spooler
      ↓
Printer
```

La Fase 5 debe separar estrictamente:

```text
compilar
```

de:

```text
transportar
```

y de:

```text
administrar trabajos
```

---

# 3. Alcance Estricto

La fase incluye:

1. Modelo `PrinterProfile`.
2. Modelo `PrintJob`.
3. Modelo de estados de trabajo.
4. Cola local de impresión.
5. Adaptador TCP RAW.
6. Adaptador de spooler del sistema operativo.
7. Selección de transporte.
8. Reintentos.
9. Timeouts.
10. Cancelación lógica.
11. Validación de jobs.
12. Descubrimiento/listado de impresoras del sistema.
13. Impresión ZPL directa.
14. Impresión PDF mediante mecanismo adecuado del sistema.
15. IPC seguro para:
    - listar impresoras;
    - crear trabajo;
    - consultar estado;
    - cancelar trabajo;
    - reintentar trabajo.
16. Logging seguro.
17. Pruebas unitarias.
18. Pruebas de integración con transports simulados.
19. Pruebas de seguridad.
20. UI mínima de impresión.

La fase no incluye:

- impresión masiva desde CSV/Excel;
- diseñador de variables;
- conectores SQL;
- REST;
- plantillas dinámicas;
- multiusuario;
- sincronización cloud;
- administración remota de impresoras;
- telemetría cloud;
- SNMP avanzado;
- actualizaciones de firmware;
- configuración de red de impresoras;
- modificación de parámetros permanentes del hardware.

---

# 4. Principio Arquitectónico Fundamental

La impresión debe tratarse como un subsistema independiente.

No permitir:

```text
React component -> socket
```

ni:

```text
renderer -> filesystem/spooler
```

ni:

```text
renderer -> TCP 9100
```

El flujo correcto es:

```text
Renderer
   ↓
Preload API
   ↓
Main Process
   ↓
Print Service
   ↓
Print Queue
   ↓
Transport Adapter
   ↓
Printer
```

---

# 5. Separación de Responsabilidades

## 5.1. Core

Ubicación:

```text
src/core/printing/
```

Debe contener:

- tipos;
- estados;
- validación de trabajos;
- reglas de transición;
- políticas de retry;
- contratos abstractos.

No debe importar:

```text
Electron
React
Node.js
net
fs
child_process
```

---

## 5.2. Main Process

Ubicación sugerida:

```text
src/main/printing/
```

Responsabilidades:

- cola;
- transports;
- spooler;
- sockets;
- timeouts;
- ejecución;
- persistencia temporal si aplica;
- logging;
- integración con IPC.

---

## 5.3. Renderer

Responsabilidades:

- seleccionar impresora;
- configurar copias;
- mostrar estado;
- mostrar errores;
- cancelar/reintentar;
- nunca ejecutar impresión directamente.

---

# 6. Modelo PrinterProfile

Crear un modelo explícito.

Ejemplo conceptual:

```ts
interface PrinterProfile {
  id: string;
  name: string;

  connection:
    | {
        type: 'tcp';
        host: string;
        port: number;
      }
    | {
        type: 'system';
        printerName: string;
      };

  language:
    | 'zpl'
    | 'pdf';

  dpi?: 203 | 300 | 600;

  enabled: boolean;
}
```

La estructura final puede variar.

Debe evitar configuraciones ambiguas.

---

# 7. Identificador de Perfil

Cada perfil debe tener UUID válido.

No utilizar:

```text
printer-1
zebra-office
```

como ID interno persistido si el esquema exige UUID.

El nombre visible puede ser libre.

---

# 8. Tipo de Conexión

Inicialmente soportar:

```text
tcp
system
```

No introducir todavía:

```text
serial
usb-direct
bluetooth
```

salvo que el sistema operativo los exponga indirectamente mediante spooler.

---

# 9. Lenguaje de Impresión

El perfil debe declarar qué artefacto acepta:

```text
zpl
pdf
```

Ejemplos:

```text
Zebra ZD421 Ethernet -> zpl
HP LaserJet -> pdf
```

El sistema debe impedir:

```text
PDF -> raw ZPL printer
```

o:

```text
ZPL -> PDF-only system printer
```

sin un adaptador explícito.

---

# 10. Modelo PrintArtifact

La salida de Fase 4 debe convertirse en un artefacto tipado.

Ejemplo:

```ts
type PrintArtifact =
  | {
      type: 'zpl';
      data: string;
    }
  | {
      type: 'pdf';
      data: Uint8Array;
    };
```

No mezclar ambos formatos.

---

# 11. Modelo PrintJob

Ejemplo conceptual:

```ts
interface PrintJob {
  id: string;

  printerProfileId: string;

  artifactType:
    | 'zpl'
    | 'pdf';

  copies: number;

  status: PrintJobStatus;

  createdAt: string;
  startedAt?: string;
  completedAt?: string;

  attempt: number;
  maxAttempts: number;

  error?: PrintJobError;
}
```

No es obligatorio usar exactamente esa interfaz.

---

# 12. Estados de Trabajo

Definir estados explícitos.

Recomendación:

```text
queued
validating
dispatching
completed
failed
cancelled
retry_wait
```

Opcional:

```text
unknown
```

si se necesita representar incertidumbre externa.

---

# 13. Máquina de Estados

Las transiciones deben ser controladas.

Ejemplo:

```text
queued
  ↓
validating
  ↓
dispatching
  ↓
completed
```

Errores:

```text
dispatching
  ↓
failed
```

Con retry:

```text
failed
  ↓
retry_wait
  ↓
queued
```

Cancelación:

```text
queued -> cancelled
retry_wait -> cancelled
```

No permitir transiciones arbitrarias.

---

# 14. Función de Transición

Implementar una función pura equivalente a:

```ts
canTransitionPrintJob(
  from: PrintJobStatus,
  to: PrintJobStatus
): boolean
```

y pruebas exhaustivas.

---

# 15. Print Queue

La cola debe ejecutarse en Main Process.

No guardar la cola en React.

Debe existir un servicio como:

```text
PrintQueue
```

Responsabilidades:

- enqueue;
- dequeue;
- ejecutar;
- actualizar estado;
- aplicar retries;
- emitir eventos de estado;
- cancelar trabajos pendientes.

---

# 16. Concurrencia

Versión inicial recomendada:

```text
1 trabajo activo por impresora
```

Puede existir concurrencia entre impresoras diferentes.

Evitar enviar varios trabajos simultáneos al mismo dispositivo sin control.

---

# 17. Copies

El job debe admitir:

```text
copies >= 1
```

Definir máximo razonable.

Ejemplo inicial:

```text
1 - 999
```

El límite debe estar documentado.

---

# 18. Estrategia de Copias

Preferencia:

```text
copies
```

como metadata del job.

El transport puede:

- utilizar comando nativo si es seguro;
- repetir envío;
- delegar al spooler.

No duplicar contenido arbitrariamente si el backend dispone de una estrategia mejor.

---

# 19. Adaptador de Transporte

Definir una interfaz.

Ejemplo conceptual:

```ts
interface PrintTransport {
  readonly type: string;

  canHandle(
    profile: PrinterProfile,
    artifact: PrintArtifact
  ): boolean;

  send(
    profile: PrinterProfile,
    artifact: PrintArtifact,
    context: PrintTransportContext
  ): Promise<PrintTransportResult>;
}
```

Esto desacopla la cola del mecanismo físico.

---

# 20. TCP RAW

Crear adaptador:

```text
TcpRawTransport
```

Ubicación:

```text
src/main/printing/transports/tcp-raw.transport.ts
```

Usar:

```text
node:net
```

en Main Process.

Nunca en renderer.

---

# 21. Puerto TCP

Valor por defecto:

```text
9100
```

Pero debe ser configurable.

Validación:

```text
1 <= port <= 65535
```

No asumir siempre 9100.

---

# 22. Validación del Host

Validar:

- hostname;
- IPv4;
- IPv6 cuando se soporte.

No aceptar strings arbitrarios como:

```text
host: "anything\n..."
```

Usar esquema Zod.

---

# 23. Socket Timeout

Definir timeout explícito.

Ejemplo inicial:

```text
5000 ms
```

Puede variar según configuración.

No dejar sockets abiertos indefinidamente.

---

# 24. Flujo TCP

Conceptualmente:

```text
create socket
      ↓
connect
      ↓
write artifact
      ↓
flush/end
      ↓
close
```

Capturar:

- timeout;
- connection refused;
- reset;
- DNS failure;
- socket error.

---

# 25. Resultado TCP

No tratar:

```text
socket.write()
```

como garantía de impresión física.

Solo significa:

```text
datos entregados al stack/socket
```

El estado `completed` debe significar inicialmente:

```text
dispatch successfully completed
```

No:

```text
paper physically printed
```

Documentar esta distinción.

---

# 26. Impresión ZPL vía TCP

Solo permitir:

```text
artifact.type === 'zpl'
```

para `TcpRawTransport` en esta fase.

No enviar PDF directo al puerto 9100 salvo que exista compatibilidad explícita del perfil.

---

# 27. Spooler del Sistema Operativo

Crear adaptador:

```text
SystemPrinterTransport
```

Objetivo:

- utilizar impresoras instaladas;
- aprovechar drivers existentes;
- soportar PDF/printing convencional;
- permitir eventualmente RAW cuando sea viable.

---

# 28. Estrategia Cross-Platform

La arquitectura debe ser cross-platform aunque la primera implementación pueda priorizar Windows.

Separar:

```text
src/main/printing/platform/
├── windows/
├── linux/
└── macos/
```

si se necesitan implementaciones específicas.

No introducir condicionales de plataforma dispersos por todo el código.

---

# 29. Windows

El entorno objetivo principal inicial puede priorizar:

```text
Windows 10/11
```

por la naturaleza del proyecto.

Pero mantener interfaces portables.

---

# 30. Spooler Windows

Antes de añadir una dependencia nativa:

1. evaluar APIs disponibles;
2. evaluar compatibilidad Electron;
3. evaluar arquitectura x64/x86;
4. evaluar mantenimiento;
5. evaluar firma/distribución;
6. evaluar licencia.

No elegir automáticamente un paquete antiguo sin revisión.

---

# 31. PDF y Spooler

Para impresión PDF en impresoras convencionales se puede utilizar:

- mecanismo nativo de Electron/Chromium;
- o una integración de spooler específica.

La implementación final debe elegirse documentando:

```text
Problema
Opciones
Decisión
Compatibilidad
Riesgos
```

---

# 32. webContents.print

Si se utiliza:

```ts
webContents.print(...)
```

debe hacerse desde Main.

No utilizar una ventana arbitraria insegura.

Preferir una ventana oculta o pipeline controlado si el PDF/render lo requiere.

---

# 33. Descubrimiento de Impresoras

Implementar una API para listar impresoras del sistema.

Ejemplo conceptual:

```ts
getSystemPrinters(): Promise<SystemPrinterInfo[]>
```

Información mínima:

```text
name
displayName
isDefault
status cuando esté disponible
```

No prometer estado avanzado si la API no lo ofrece.

---

# 34. Printer Discovery y TCP

No hacer network scanning automático.

Para impresoras TCP, el usuario debe introducir:

```text
host
port
```

o importar un perfil explícitamente.

Escaneo de red automático queda fuera de alcance inicial por seguridad y complejidad.

---

# 35. Test de Conexión

Puede implementarse:

```text
Test Connection
```

para perfiles TCP.

Debe:

- abrir socket;
- verificar conexión;
- cerrar;
- no enviar comandos destructivos.

No usar comandos de configuración de impresora.

---

# 36. Perfil de Impresora

La UI debe permitir:

```text
Name
Connection Type
Host
Port
System Printer
Language
DPI
Enabled
```

No mezclar propiedades irrelevantes.

---

# 37. DPI del Perfil

Para ZPL:

```text
203
300
600
```

Debe coincidir con la impresora real.

Si el documento fue compilado a otro DPI:

- recompilar;
- o rechazar.

No enviar ZPL compilado para 203 DPI a una impresora configurada como 300 DPI sin advertencia.

---

# 38. Compilación Tardía

Arquitectura recomendada:

```text
LabelDocument
      ↓
selected printer profile
      ↓
compile using printer DPI/language
      ↓
artifact
      ↓
print job
```

Esto evita compilar demasiado pronto con DPI equivocado.

---

# 39. PrintRequest

Definir una entrada segura desde renderer.

Ejemplo conceptual:

```ts
interface CreatePrintJobRequest {
  document: LabelDocument;
  printerProfileId: string;
  copies: number;
}
```

Main debe volver a validar:

- documento;
- profile ID;
- copies;
- existencia del perfil.

---

# 40. IPC Público

Exponer métodos explícitos.

Ejemplo:

```ts
window.printAPI.listPrinters()
window.printAPI.listProfiles()
window.printAPI.createJob(request)
window.printAPI.getJob(jobId)
window.printAPI.cancelJob(jobId)
window.printAPI.retryJob(jobId)
window.printAPI.testConnection(profileId)
```

No exponer IPC genérico.

---

# 41. Validación IPC

Todos los payloads deben ser:

```text
unknown
```

en frontera.

Después:

```text
Zod safeParse
```

No confiar en TypeScript del renderer.

---

# 42. IDs

Validar todos los:

```text
jobId
profileId
```

como UUID cuando corresponda.

---

# 43. Seguridad de Red

El renderer nunca debe poder indicar:

```text
host arbitrario + payload arbitrario
```

directamente al socket.

Eso sería equivalente a una primitiva de red genérica.

El flujo debe ser:

```text
profileId
      ↓
Main loads validated profile
      ↓
compiler generates controlled artifact
      ↓
transport sends
```

---

# 44. Prohibición de Socket Genérico

No exponer:

```ts
window.network.send(host, port, data)
```

ni equivalente.

Solo acciones de dominio.

---

# 45. ZPL Seguro

El ZPL debe provenir exclusivamente del compilador de Fase 4.

No permitir que el renderer envíe:

```text
rawZpl
```

arbitrario al Main para impresión.

Si se desea una función "Print raw ZPL" en el futuro, debe ser una feature avanzada separada y explícita.

No pertenece a esta fase.

---

# 46. PDF Seguro

El PDF debe provenir del renderer/backend controlado.

No imprimir archivos arbitrarios sin validación.

---

# 47. Retry Policy

Definir política explícita.

Ejemplo:

```text
maxAttempts = 3
```

Backoff inicial:

```text
attempt 1 -> immediate
attempt 2 -> +2 s
attempt 3 -> +5 s
```

La estrategia puede mejorarse.

No crear loops infinitos.

---

# 48. Retryable Errors

Ejemplos:

```text
ECONNREFUSED
ETIMEDOUT
ECONNRESET
temporary spooler failure
```

No todos los errores deben reintentarse.

---

# 49. Non-Retryable Errors

Ejemplos:

```text
invalid profile
unsupported artifact
schema validation error
invalid host
invalid printer name
compile failure
```

Debe fallar inmediatamente.

---

# 50. Clasificación de Errores

Crear códigos tipados.

Ejemplo:

```ts
type PrintErrorCode =
  | 'INVALID_REQUEST'
  | 'PRINTER_PROFILE_NOT_FOUND'
  | 'PRINTER_DISABLED'
  | 'UNSUPPORTED_ARTIFACT'
  | 'COMPILE_FAILED'
  | 'CONNECTION_REFUSED'
  | 'CONNECTION_TIMEOUT'
  | 'CONNECTION_RESET'
  | 'SPOOLER_ERROR'
  | 'SYSTEM_PRINTER_NOT_FOUND'
  | 'CANCELLED'
  | 'UNKNOWN_PRINT_ERROR';
```

---

# 51. Cancelación

La cancelación debe tener semántica clara.

## queued

Puede cancelarse completamente.

## retry_wait

Puede cancelarse completamente.

## dispatching

Puede intentar abortarse, pero no existe garantía universal de detener datos ya enviados.

## completed

No puede cancelarse.

Documentar la diferencia entre:

```text
cancel job
```

y:

```text
physically stop printer
```

---

# 52. Persistencia de Cola

Versión inicial:

```text
in-memory
```

es aceptable si se documenta que se pierden trabajos al cerrar la aplicación.

Si se decide persistir:

- usar almacenamiento estructurado;
- validar al restaurar;
- no serializar bytes gigantes innecesariamente;
- no reimprimir automáticamente trabajos ambiguos al reiniciar.

Persistencia durable no es obligatoria en primera versión.

---

# 53. Recuperación tras Reinicio

Si existe persistencia, trabajos en:

```text
dispatching
```

al reiniciar deben pasar a:

```text
failed
```

o:

```text
unknown
```

Nunca repetirlos automáticamente sin política explícita.

Esto evita duplicar etiquetas accidentalmente.

---

# 54. Idempotencia

La impresión física no es inherentemente idempotente.

Enviar dos veces puede imprimir dos etiquetas.

Por eso:

- no reintentar después de estados ambiguos sin cuidado;
- distinguir fallo antes de enviar vs fallo después de enviar;
- documentar incertidumbre.

---

# 55. Estado `unknown`

Puede utilizarse si el sistema no sabe si el dispositivo recibió completamente un job.

Esto es preferible a marcar:

```text
failed
```

y reintentar automáticamente generando duplicados.

---

# 56. Logging

Registrar:

```text
job id
printer profile id
transport
status changes
attempt
duration
error code
```

No registrar por defecto:

```text
full ZPL
PDF bytes
barcode payloads
user document contents
personal data
```

---

# 57. Correlation ID

El `job.id` debe utilizarse como correlation ID de logs.

Esto simplifica diagnóstico.

---

# 58. Métricas Locales

Puede calcularse localmente:

```text
jobs queued
completed
failed
average dispatch duration
```

No enviar telemetría externa en esta fase.

---

# 59. UI de Impresión

Crear panel/dialog mínimo.

Debe permitir:

```text
Printer Profile
Copies
Print
```

y mostrar:

```text
queued
dispatching
completed
failed
retrying
cancelled
```

---

# 60. Historial de Jobs

Mostrar trabajos de la sesión actual.

Campos:

```text
Time
Printer
Copies
Status
Attempts
Error
```

No confundir con historial del documento/undo.

---

# 61. Botones

Según estado:

```text
queued -> Cancel
retry_wait -> Cancel
failed -> Retry
completed -> none
```

No mostrar acciones imposibles.

---

# 62. Feedback

Al imprimir:

```text
Job queued
```

No mostrar inmediatamente:

```text
Printed successfully
```

hasta terminar dispatch.

Incluso entonces, la UI puede decir:

```text
Sent successfully
```

si no existe confirmación física del dispositivo.

---

# 63. Print Preview

La Fase 4 ya puede generar preview.

Antes de imprimir, la UI puede permitir revisar:

```text
ZPL / PDF preview
warnings
```

No es obligatorio bloquear cada impresión con preview.

---

# 64. Printer Profiles UI

Crear configuración básica.

Operaciones:

```text
create
edit
delete
enable/disable
test connection
```

Validar antes de guardar.

---

# 65. Secretos

Los perfiles de esta fase no deben requerir credenciales.

Si en el futuro existe autenticación:

- no guardar secretos en texto plano;
- diseñar almacenamiento seguro.

Fuera de alcance actual.

---

# 66. Archivos PDF Temporales

Si el mecanismo de impresión requiere un archivo temporal:

- crear en directorio temporal seguro;
- usar nombre no predecible;
- limpiar al finalizar;
- no exponer ruta al renderer salvo necesidad;
- evitar path traversal.

---

# 67. Path Traversal

No aceptar rutas arbitrarias desde el renderer.

Main controla cualquier path temporal.

---

# 68. Child Process

Evitar:

```text
child_process.exec
```

con strings construidos desde datos de usuario.

Si una integración del spooler obliga a usar proceso externo:

- usar `spawn`/`execFile`;
- argumentos separados;
- no shell;
- validación estricta;
- documentar necesidad.

---

# 69. Dependencias Nativas

Toda dependencia nativa debe evaluarse por:

```text
Electron compatibility
ABI
x64/arm64
maintenance
license
security
packaging
code signing
```

No introducir módulos nativos a la ligera.

---

# 70. Tests del Modelo

Crear pruebas para:

```text
PrinterProfile schema
PrintJob schema
status transitions
retry policy
artifact/profile compatibility
copies validation
```

---

# 71. Tests TCP

No depender de una impresora real.

Crear servidor TCP local de prueba.

Casos:

```text
connect success
payload received
timeout
connection refused
connection reset
multiple copies
socket close
```

No requerir Internet.

---

# 72. Test de Payload

Verificar que:

```text
ZPL generado
```

llega exactamente al servidor local.

No modificar bytes silenciosamente.

---

# 73. Tests Spooler

Abstraer el backend.

Crear:

```text
MockSystemPrinterBackend
```

para tests.

No hacer que la suite dependa de una impresora instalada.

---

# 74. Tests Queue

Cubrir:

```text
enqueue
processing order
one active job per printer
status transitions
retry
cancel queued
cancel retry_wait
failed
completed
```

---

# 75. Tests Retry

Verificar:

```text
retryable error -> retry
non-retryable -> fail
max attempts -> fail
cancel during wait -> cancelled
```

Usar timers controlados si es necesario.

---

# 76. Tests IPC

Probar:

- payload válido;
- profile inexistente;
- copies inválidas;
- UUID inválido;
- documento inválido;
- acción no autorizada;
- error interno controlado.

---

# 77. Tests de Seguridad

Comprobar que renderer no puede:

```text
send raw socket data
set arbitrary host per job
send raw ZPL
invoke generic IPC
```

La API pública debe permanecer discreta.

---

# 78. Pruebas Manuales TCP

Con una impresora Zebra/TSC compatible y solo después de tests:

1. configurar IP;
2. puerto 9100;
3. DPI correcto;
4. imprimir etiqueta mínima;
5. verificar posición;
6. barcode;
7. QR;
8. rotación.

No utilizar comandos de configuración permanente.

---

# 79. Pruebas Manuales System Printer

Con impresora estándar:

1. seleccionar printer instalada;
2. generar PDF;
3. enviar;
4. verificar tamaño físico;
5. verificar orientación;
6. verificar barcode.

Desactivar:

```text
fit to page
scale to fit
```

si altera tamaño físico.

---

# 80. Escalado del Driver

La impresión debe preservar:

```text
100%
actual size
```

cuando sea posible.

El driver no debe escalar automáticamente una etiqueta de:

```text
100 × 50 mm
```

a otra medida.

---

# 81. Media Size

Si el sistema/driver requiere tamaño de papel, usar las dimensiones físicas del documento cuando la API lo permita.

Documentar limitaciones de drivers.

---

# 82. Diferencia entre Envío y Confirmación Física

Es obligatorio documentar:

```text
dispatch success != physical print confirmation
```

TCP RAW normalmente no confirma:

- papel disponible;
- ribbon;
- head open;
- print completed.

Estas capacidades podrían añadirse con protocolos específicos/SNMP en fases futuras.

---

# 83. Health Check

El test de conexión TCP únicamente verifica:

```text
socket connectivity
```

No afirmar:

```text
printer ready
```

sin soporte real.

---

# 84. Criterios de Aceptación Funcionales

La Fase 5 está funcionalmente terminada cuando:

1. Se pueden crear perfiles TCP.
2. Se pueden crear perfiles de impresora del sistema.
3. Se pueden listar impresoras instaladas.
4. Se puede probar conexión TCP.
5. Se puede crear un PrintJob.
6. El job entra a queue.
7. La queue actualiza estados.
8. ZPL puede enviarse por TCP.
9. PDF puede enviarse por backend del sistema.
10. Copies funciona.
11. Retry funciona.
12. Cancel funciona en estados válidos.
13. Los errores son tipados.
14. La UI muestra el estado.
15. No se exponen sockets al renderer.
16. No se acepta raw ZPL del renderer.
17. Se mantiene seguridad Electron.

---

# 85. Criterios de Aceptación Técnicos

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

Resultado:

```text
0 errores
todas las pruebas en verde
```

No permitir:

```text
skip
only
any como parche
timeouts arbitrarios sin explicación
tests dependientes de hardware
```

---

# 86. No-Regresión

Debe continuar funcionando:

```text
Fase 1
- core
- schemas
- converter
- security
- IPC
- preload

Fase 2
- editor
- canvas
- layers
- properties
- history
- zoom/pan/grid/snapping

Fase 3
- barcodes
- QR
- Data Matrix
- X Dimension
- validation
- preview

Fase 4
- PrintPlan
- ZPL
- PDF
- escaping
- export
```

---

# 87. Orden Secuencial de Implementación

## Paso 1 — Verificación

Leer:

```text
AGENTS.md
PHASE_1_SPEC.md
PHASE_2_SPEC.md
PHASE_3_SPEC.md
PHASE_4_SPEC.md
PHASE_5_SPEC.md
```

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

---

## Paso 2 — Auditar Fase 4

Confirmar contratos actuales:

```text
PrintPlan
CompileResult
ZPL output
PDF output
```

No modificar compiladores sin necesidad.

---

## Paso 3 — Dominio de impresión

Implementar:

```text
PrinterProfile
PrintArtifact
PrintJob
PrintJobStatus
PrintError
transition rules
compatibility rules
```

con tests.

---

## Paso 4 — PrintTransport

Definir interfaz abstracta y resultado tipado.

Crear fake/mock transport.

---

## Paso 5 — PrintQueue

Implementar cola con mock transport.

No usar TCP todavía.

Probar:

```text
enqueue
states
retry
cancel
copies
```

---

## Paso 6 — TCP RAW

Implementar:

```text
TcpRawTransport
```

con servidor TCP local en tests.

---

## Paso 7 — Profiles

Implementar CRUD local validado.

Persistencia simple si ya existe infraestructura segura.

Si no existe, puede comenzar in-memory.

---

## Paso 8 — System Printer Discovery

Crear adapter para enumerar impresoras.

No mezclar con renderer.

---

## Paso 9 — System Printer Transport

Implementar PDF printing.

Documentar decisión técnica para Windows/cross-platform.

---

## Paso 10 — IPC

Exponer APIs explícitas:

```text
listPrinters
listProfiles
createJob
getJob
cancelJob
retryJob
testConnection
```

con Zod.

---

## Paso 11 — Preload

Actualizar tipos y contextBridge.

No exponer primitivas.

---

## Paso 12 — UI

Agregar:

```text
printer selection
copies
print button
job status
job history
profile management
```

---

## Paso 13 — Security Review

Verificar:

- sin socket genérico;
- sin raw ZPL;
- sin IPC dinámico;
- sin Node en renderer;
- validación completa.

---

## Paso 14 — Full Regression

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

y pruebas manuales controladas.

---

# 88. Guía de Enseñanza para el Agente

Antes de cada bloque, explicar brevemente:

## Print Queue

- qué problema resuelve;
- por qué no imprimir directamente desde un click;
- estados;
- concurrencia.

## TCP 9100

- qué es RAW/JetDirect;
- por qué ZPL puede enviarse directamente;
- qué significa un socket successful write.

## Spooler

- diferencia entre driver/spooler y TCP RAW;
- por qué PDF usa normalmente el sistema operativo.

## Retry

- errores transitorios;
- riesgo de duplicar etiquetas;
- idempotencia.

## Dispatch vs Print Confirmation

- por qué enviar datos correctamente no confirma impresión física.

## IPC Security

- por qué no exponer sockets ni raw ZPL.

Las explicaciones deben ser concisas.

---

# 89. Reglas para Antigravity

No implementar toda la Fase 5 de una sola vez.

Trabajar por bloques:

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

No avanzar si existen tests fallidos.

---

# 90. Decisiones que Deben Documentarse

Antes de introducir:

- dependencia nativa de spooler;
- child process;
- persistencia durable de queue;
- estrategia Windows específica;
- backend PDF printing;
- nuevos transports;
- polling de estado;
- network discovery.

Documentar:

```text
Problema
Opciones
Decisión
Motivo
Riesgos
Compatibilidad
```

---

# 91. Definition of Done

La Fase 5 termina únicamente cuando:

- existe `PrinterProfile`;
- existe `PrintArtifact`;
- existe `PrintJob`;
- existe máquina de estados;
- existe `PrintQueue`;
- existe transport abstraction;
- existe TCP RAW;
- existe listado de system printers;
- existe backend de impresión PDF por sistema;
- existe retry controlado;
- existe cancelación;
- existe copies;
- existe validación Zod;
- existe IPC explícito;
- existe preload tipado;
- existe UI mínima;
- no existe socket genérico;
- no se acepta raw ZPL arbitrario desde renderer;
- no hay dependencia de hardware en tests automáticos;
- se distingue dispatch de confirmación física;
- TypeScript está limpio;
- Vitest está completamente en verde;
- no existen regresiones de Fases 1-4.

---

# 92. Resultado Esperado

Al finalizar la Fase 5, el usuario debe poder:

1. diseñar una etiqueta;
2. seleccionar una impresora;
3. elegir copias;
4. pulsar Print;
5. generar el artefacto correcto;
6. crear un `PrintJob`;
7. observar:

```text
Queued
Dispatching
Completed
```

o un error controlado;

8. reintentar si corresponde;
9. cancelar si todavía es posible.

Para una impresora Zebra de red:

```text
LabelDocument
      ↓
ZPL
      ↓
PrintJob
      ↓
TCP 9100
      ↓
Printer
```

Para una impresora estándar:

```text
LabelDocument
      ↓
PDF
      ↓
PrintJob
      ↓
OS Spooler
      ↓
Printer
```

Con esto el producto ya tendrá el ciclo esencial completo:

```text
DESIGN
  ↓
VALIDATE
  ↓
COMPILE
  ↓
DISPATCH
  ↓
PRINT
```

---

# 93. Prompt Inicial para Antigravity

> Lee completamente `AGENTS.md`, `PHASE_1_SPEC.md`, `PHASE_2_SPEC.md`, `PHASE_3_SPEC.md`, `PHASE_4_SPEC.md` y `PHASE_5_SPEC.md`.
>
> Ejecuta primero `npx tsc --noEmit` y `npx vitest run`. No avances mientras exista una regresión.
>
> No implementes toda la Fase 5 de una sola vez.
>
> Antes de tocar TCP o el spooler, audita los contratos de salida de la Fase 4 (`PrintPlan`, ZPL y PDF) y explícame cómo separarás compilación, PrintJob, PrintQueue y transporte.
>
> Después implementa únicamente el dominio puro de impresión:
>
> - `PrinterProfile`
> - `PrintArtifact`
> - `PrintJob`
> - `PrintJobStatus`
> - `PrintError`
> - reglas de transición
> - compatibilidad profile/artifact
>
> junto con sus pruebas.
>
> No implementes TCP RAW ni integración con impresoras del sistema hasta que este primer bloque esté completamente en verde.
