# ESPECIFICACIÓN TÉCNICA: FASE 4 - COMPILADORES DE SALIDA ZPL II Y PDF VECTORIAL

## 1. Contexto de la Fase

La Fase 1 estableció el núcleo de dominio, conversiones físicas, esquemas, seguridad de Electron e IPC.

La Fase 2 construyó el editor WYSIWYG y su sistema de coordenadas físicas.

La Fase 3 incorporó códigos 1D/2D reales, validación de simbologías, Dimensión X y renderizado vectorial para preview.

La Fase 4 convierte el documento semántico del editor en **salidas de producción** sin enviar todavía trabajos a hardware.

Los objetivos son:

```text
LabelDocument -> ZPL II
LabelDocument -> PDF vectorial
```

Esta fase debe respetar:

```text
AGENTS.md
PHASE_1_SPEC.md
PHASE_2_SPEC.md
PHASE_3_SPEC.md
```

La fase no puede debilitar las garantías de seguridad ni modificar silenciosamente el formato persistido.

---

# 2. Objetivo Principal

Construir un pipeline determinista y testeable capaz de:

- validar un `LabelDocument`;
- normalizarlo a una representación de salida común;
- compilarlo a ZPL II nativo;
- renderizarlo a PDF con dimensiones físicas exactas;
- preservar geometría, rotación y orden de capas;
- producir códigos de barras mediante información semántica, no capturas del canvas;
- reportar warnings y errores de compilación;
- evitar inyección de comandos ZPL;
- preparar la salida para el subsistema de impresión de la Fase 5.

---

# 3. Alcance Estricto

La Fase 4 incluye:

1. Modelo intermedio de impresión/render.
2. Validación previa a compilación.
3. Normalización de geometría.
4. Compilador ZPL II.
5. Escapado seguro de datos ZPL.
6. Soporte ZPL para:
   - texto;
   - rectángulos;
   - líneas;
   - Code 128;
   - EAN-13;
   - QR Code;
   - Data Matrix.
7. Backend PDF vectorial.
8. Conversión mm -> puntos PDF.
9. Texto, líneas y rectángulos en PDF.
10. Códigos de barras vectoriales en PDF.
11. Manejo de rotaciones.
12. Orden de capas.
13. Resultado de compilación tipado.
14. Warnings y errores.
15. Pruebas golden/semánticas para ZPL.
16. Pruebas estructurales para PDF.
17. Preview/export de desarrollo cuando sea útil.
18. Integración mínima con la UI para generar/visualizar salida.

La Fase 4 no incluye:

- envío TCP 9100;
- spooler;
- USB;
- descubrimiento de impresoras;
- configuración de puertos;
- cola persistente de impresión;
- reintentos;
- estados de hardware;
- impresión masiva;
- CSV/Excel/SQL/REST;
- templates dinámicos;
- drivers específicos;
- administración de impresoras.

Todo envío real a hardware corresponde a la Fase 5.

---

# 4. Principio Arquitectónico

`LabelDocument` sigue siendo la fuente de verdad.

No añadir al documento:

```text
zpl
pdf bytes
svg generado
printer commands
spooler data
```

Las salidas son artefactos derivados.

Flujo:

```text
LabelDocument
      ↓
Schema validation
      ↓
Compile validation
      ↓
PrintPlan
      ├───────────────┐
      ↓               ↓
ZPL Compiler      PDF Renderer
      ↓               ↓
string ZPL       PDF bytes
```

---

# 5. Modelo Intermedio: PrintPlan

Introducir una representación intermedia independiente de:

- React;
- Konva;
- Electron;
- Zebra;
- PDFKit;
- sistema operativo.

Ubicación sugerida:

```text
src/core/compilers/print-plan/
```

Objetivo:

- centralizar geometría;
- evitar duplicar reglas entre ZPL y PDF;
- normalizar elementos;
- conservar unidades físicas;
- producir warnings antes de entrar a backends.

---

# 6. Estructura Conceptual del PrintPlan

Ejemplo conceptual:

```ts
interface PrintPlan {
  version: 1;

  page: {
    widthMm: number;
    heightMm: number;
    dpi: 203 | 300 | 600;
  };

  elements: PrintElement[];

  warnings: CompileWarning[];
}
```

Elementos conceptuales:

```ts
type PrintElement =
  | PrintText
  | PrintRectangle
  | PrintLine
  | PrintBarcode
  | PrintImage;
```

No es obligatorio usar exactamente estas interfaces.

El modelo debe ser:

- serializable;
- determinista;
- independiente del backend;
- validado;
- ordenado por capa.

---

# 7. Coordenadas del PrintPlan

Las coordenadas continúan expresándose en:

```text
mm
```

El PrintPlan no debe utilizar:

```text
CSS pixels
Konva coordinates
PDF points
ZPL dots
```

Los backends realizan la conversión final.

---

# 8. Pipeline de Compilación

Implementar conceptualmente:

```text
LabelDocument
      ↓
validateDocument()
      ↓
buildPrintPlan()
      ↓
validatePrintPlan()
      ↓
backend
```

Cada etapa debe devolver errores tipados.

No lanzar excepciones arbitrarias como contrato de dominio.

---

# 9. Resultado de Compilación

Utilizar un resultado discriminado.

Ejemplo:

```ts
type CompileResult<T> =
  | {
      success: true;
      data: T;
      warnings: CompileWarning[];
    }
  | {
      success: false;
      errors: CompileError[];
      warnings: CompileWarning[];
    };
```

Errores y warnings deben contener códigos estables.

---

# 10. Errores de Compilación

Ejemplo conceptual:

```ts
type CompileErrorCode =
  | 'INVALID_DOCUMENT'
  | 'ELEMENT_OUT_OF_BOUNDS'
  | 'UNSUPPORTED_ELEMENT'
  | 'UNSUPPORTED_CHARACTER'
  | 'BARCODE_INVALID'
  | 'BARCODE_TOO_LARGE'
  | 'FONT_UNAVAILABLE'
  | 'IMAGE_SOURCE_UNAVAILABLE'
  | 'PDF_RENDER_FAILED'
  | 'ZPL_COMPILE_FAILED';
```

No depender únicamente de mensajes humanos.

---

# 11. Warnings

Ejemplos:

```text
BARCODE_X_DIMENSION_ADJUSTED
FONT_FALLBACK
UNSUPPORTED_UNICODE_FOR_ZPL_FONT
ELEMENT_CLIPPED
IMAGE_RASTERIZED
```

Un warning no debe invalidar siempre la compilación.

La severidad debe estar clara.

---

# 12. Estructura de Archivos Recomendada

```text
src/
├── core/
│   ├── compilers/
│   │   ├── compile.types.ts
│   │   │
│   │   ├── print-plan/
│   │   │   ├── print-plan.types.ts
│   │   │   ├── build-print-plan.ts
│   │   │   ├── validate-print-plan.ts
│   │   │   └── index.ts
│   │   │
│   │   └── zpl/
│   │       ├── zpl-compiler.ts
│   │       ├── zpl-context.ts
│   │       ├── zpl-escape.ts
│   │       ├── zpl-units.ts
│   │       ├── zpl-orientation.ts
│   │       ├── elements/
│   │       │   ├── text.zpl.ts
│   │       │   ├── rectangle.zpl.ts
│   │       │   ├── line.zpl.ts
│   │       │   ├── code128.zpl.ts
│   │       │   ├── ean13.zpl.ts
│   │       │   ├── qrcode.zpl.ts
│   │       │   └── datamatrix.zpl.ts
│   │       └── index.ts
│   │
│   └── units/
│       └── converter.ts
│
├── main/
│   └── export/
│       └── pdf/
│           ├── pdf-renderer.ts
│           ├── pdf-context.ts
│           ├── pdf-units.ts
│           ├── pdf-fonts.ts
│           ├── pdf-barcode.ts
│           └── elements/
│               ├── text.pdf.ts
│               ├── rectangle.pdf.ts
│               ├── line.pdf.ts
│               └── barcode.pdf.ts
│
└── renderer/
    └── components/
        └── export/
            ├── ExportPreviewDialog.tsx
            └── CompileIssues.tsx

tests/
├── core/
│   └── compilers/
│       ├── print-plan.test.ts
│       └── zpl/
│           ├── zpl-escape.test.ts
│           ├── text.zpl.test.ts
│           ├── shapes.zpl.test.ts
│           ├── barcodes.zpl.test.ts
│           └── zpl-compiler.test.ts
│
└── main/
    └── export/
        └── pdf/
            ├── pdf-units.test.ts
            ├── pdf-renderer.test.ts
            └── pdf-barcode.test.ts
```

Los nombres pueden adaptarse al repositorio actual sin mezclar responsabilidades.

---

# 13. Dependencias

## ZPL

El compilador ZPL debe ser código TypeScript propio.

No introducir una dependencia externa que oculte la generación de ZPL sin una justificación arquitectónica fuerte.

---

## PDF

Backend recomendado:

```text
pdfkit
```

para generación de documentos vectoriales en el Main Process.

Si para incorporar SVG vectorial se necesita un adaptador adicional, analizarlo antes de instalarlo.

Una opción posible es:

```text
svg-to-pdfkit
```

pero su incorporación debe evaluarse según:

- mantenimiento;
- licencia;
- compatibilidad;
- seguridad;
- necesidad real.

No instalarlo automáticamente sin revisión.

Si el repositorio ya tomó otra decisión técnicamente sólida para PDF, respetarla.

---

# 14. Razón para ubicar PDF fuera de core

`src/core/` debe permanecer libre de APIs Node/Electron.

Si la librería PDF elegida depende de Node.js:

```text
core -> genera PrintPlan
main -> genera PDF
```

No importar PDFKit dentro de `src/core/`.

---

# 15. Conversión PDF

PDF utiliza puntos físicos:

```text
72 pt = 1 inch
25.4 mm = 1 inch
```

Función:

```text
mmToPoints(mm) = mm × 72 / 25.4
```

Crear helper puro y tests.

No confundir estos puntos con:

```text
printer dots
CSS px
```

---

# 16. Sistema de Coordenadas PDF

El documento del editor utiliza origen superior izquierdo.

PDF suele utilizar origen inferior izquierdo.

Por tanto:

```text
documentY
      ↓
PDF Y conversion
```

Para un elemento:

```text
pdfY = pageHeightPt - elementYpt - elementHeightPt
```

cuando aplique.

Centralizar esta conversión.

No dispersar fórmulas de inversión Y por todos los renderers.

---

# 17. Tamaño de Página PDF

La página debe coincidir físicamente con:

```text
LabelDocument.dimensions
```

Ejemplo:

```text
100 mm × 50 mm
```

debe producir exactamente una página:

```text
100 mm × 50 mm
```

No usar A4, Letter u otro tamaño por defecto.

---

# 18. ZPL: Conversión de Unidades

Utilizar exclusivamente el conversor de Fase 1.

```ts
mmToDots(mm, dpi)
```

No duplicar fórmulas.

Ejemplo conceptual:

```text
xMm -> dots
yMm -> dots
widthMm -> dots
heightMm -> dots
```

---

# 19. Estructura Base ZPL

El resultado debe contener un documento autocontenido.

Estructura conceptual:

```zpl
^XA
^PW...
^LL...
^LH0,0
...
^XZ
```

No añadir configuraciones permanentes de impresora innecesarias.

Evitar modificar:

- velocidad;
- darkness;
- calibración;
- media tracking;

en esta fase.

Esas propiedades pertenecen al perfil de impresora o trabajo de impresión futuro.

---

# 20. Determinismo ZPL

El mismo:

```text
LabelDocument + DPI + CompilerOptions
```

debe producir exactamente el mismo ZPL.

No incluir:

- timestamps;
- IDs aleatorios;
- comentarios variables;

salvo que el usuario lo solicite explícitamente.

---

# 21. Seguridad: Inyección ZPL

Los datos del usuario no pueden concatenarse directamente dentro de comandos ZPL.

Ejemplo peligroso:

```ts
`^FD${userData}^FS`
```

si `userData` contiene:

```text
^
~
```

Debe existir:

```text
escapeZplFieldData(...)
```

o estrategia equivalente.

---

# 22. Escapado ZPL

Centralizar el tratamiento de:

```text
^
~
caracteres de control
encoding
```

Utilizar una estrategia segura y compatible con el comando ZPL seleccionado.

Añadir tests específicos de inyección.

Ejemplos de payloads:

```text
ABC^XZ
~JA
^XA^JUS^XZ
```

Deben imprimirse como datos o rechazarse, nunca interpretarse como comandos arbitrarios.

---

# 23. Encoding de Texto

No asumir que todos los caracteres Unicode estarán disponibles en cualquier impresora Zebra.

Distinguir:

```text
encoding del ZPL
```

de:

```text
glyph disponible en la fuente instalada
```

Para la primera implementación:

- definir un comportamiento explícito;
- utilizar fuente nativa segura/default;
- producir warning o error cuando un carácter no sea representable.

No prometer soporte Unicode completo sin fuentes instaladas en hardware.

---

# 24. Fuentes ZPL

La Fase 4 no debe implementar todavía administración de fuentes descargadas a impresora.

Usar una fuente ZPL nativa por defecto.

Mapeo inicial recomendado:

```text
internal app font -> ZPL built-in fallback
```

Emitir warning si existe pérdida de fidelidad.

---

# 25. Texto ZPL

Debe soportar como mínimo:

- posición;
- tamaño aproximado;
- rotación 0/90/180/270;
- contenido;
- alineación si el modelo actual la define.

No utilizar coordenadas del canvas.

---

# 26. Rotaciones ZPL

Mapear las rotaciones del dominio a orientaciones ZPL de forma centralizada.

Crear helper:

```ts
toZplOrientation(rotation)
```

Debe aceptar únicamente:

```text
0
90
180
270
```

Cualquier otro valor debe fallar antes de generar ZPL.

---

# 27. Rectángulos ZPL

Generar rectángulos mediante primitivas nativas ZPL.

No rasterizar.

Respetar:

- x;
- y;
- width;
- height;
- stroke width;
- color soportado.

Si el modelo permite fills no representables directamente, documentar limitación.

---

# 28. Líneas ZPL

Utilizar primitivas nativas.

Convertir grosor físico a dots.

Impedir grosor:

```text
<= 0
```

---

# 29. Code 128 ZPL

Generar Code 128 usando comando nativo ZPL.

No insertar SVG ni bitmap.

Reutilizar:

- data validada;
- X Dimension;
- altura;
- displayValue;
- rotación.

La Dimensión X debe convertirse a dots.

---

# 30. EAN-13 ZPL

Utilizar el valor normalizado de Fase 3.

No recalcular checksum de una forma diferente dentro del compilador.

El dominio es responsable de:

```text
validation + normalization
```

El compilador solo traduce.

---

# 31. QR ZPL

Utilizar comando QR nativo ZPL.

Mapear:

- data;
- error correction cuando sea compatible;
- tamaño/magnificación;
- rotación.

Si una opción del modelo no puede expresarse de forma equivalente en ZPL, generar warning o error explícito.

No ignorarla silenciosamente.

---

# 32. Data Matrix ZPL

Utilizar comando Data Matrix nativo.

Reutilizar datos normalizados.

Mantener la implementación aislada en su encoder.

---

# 33. Barcode X Dimension en ZPL

No volver a cuantizar con una fórmula diferente.

Usar:

```text
quantizeBarcodeX()
```

y el DPI del PrintPlan.

El compilador debe poder emitir warning si:

```text
requestedMm != physicalMm
```

más allá de una tolerancia definida.

---

# 34. PDF: Texto

El PDF debe renderizar texto como texto/vector cuando sea posible.

No convertir todo el documento a imagen.

Soportar inicialmente:

- contenido;
- posición;
- tamaño;
- rotación;
- alineación básica;
- fallback de fuente.

---

# 35. Fuentes PDF

Usar inicialmente una estrategia simple y legalmente segura.

Preferir fuentes estándar o fuentes que el proyecto pueda distribuir legalmente.

No incluir archivos de fuentes propietarios.

No asumir que una fuente del sistema estará disponible en todos los equipos.

---

# 36. Rectángulos y Líneas PDF

Deben permanecer vectoriales.

Usar primitives del backend PDF.

No rasterizar el canvas de Konva.

---

# 37. Códigos de Barras en PDF

Deben mantenerse vectoriales cuando sea técnicamente viable.

Flujo preferido:

```text
Normalized Barcode
      ↓
Vector barcode representation
      ↓
PDF vector primitives / SVG adapter
```

No usar screenshots del canvas.

---

# 38. Regla de No-Rasterización Global

Está prohibido implementar:

```text
Konva Stage -> screenshot -> PDF
```

como salida principal.

Esto destruiría:

- precisión;
- nitidez;
- escalabilidad;
- calidad de códigos de barras.

---

# 39. Imágenes en PDF

Los elementos `image` son naturalmente raster si su fuente lo es.

Esto es aceptable.

Pero:

- texto;
- líneas;
- rectángulos;
- códigos;

deben permanecer vectoriales.

---

# 40. Imágenes en ZPL

No implementar conversión completa de imágenes a `^GF` si el modelo de assets todavía no está definido y validado.

Si un `image` no puede compilarse correctamente:

```text
UNSUPPORTED_ELEMENT
```

o:

```text
IMAGE_SOURCE_UNAVAILABLE
```

debe ser explícito.

No generar una etiqueta parcialmente incorrecta sin warning/error.

---

# 41. Orden de Capas

El orden de:

```text
PrintPlan.elements
```

debe corresponder al orden visual del documento.

El compilador debe procesar secuencialmente ese orden.

---

# 42. Bounds

Antes de compilar verificar:

```text
x >= 0
y >= 0
x + width <= page.width
y + height <= page.height
```

según las reglas actuales del editor.

No depender de que la UI haya validado correctamente.

---

# 43. Clipping

Evitar clipping silencioso.

Si un elemento excede límites:

- error;
- o warning documentado si existe una política explícita.

La política inicial recomendada es:

```text
error
```

---

# 44. Compiler Options

Definir opciones explícitas.

Ejemplo:

```ts
interface ZplCompilerOptions {
  dpi: 203 | 300 | 600;
  strict: boolean;
}
```

El DPI debe coincidir normalmente con el documento/perfil.

No introducir configuraciones de hardware no relacionadas.

---

# 45. API Pública ZPL

Ejemplo conceptual:

```ts
compileLabelToZpl(
  document: LabelDocument,
  options?: ZplCompilerOptions
): CompileResult<string>
```

La firma final puede variar.

Debe ser:

- pura;
- determinista;
- sin Electron;
- sin filesystem;
- sin red.

---

# 46. API Pública PDF

Ejemplo conceptual:

```ts
renderLabelToPdf(
  plan: PrintPlan,
  options?: PdfRenderOptions
): Promise<CompileResult<Uint8Array>>
```

Puede vivir fuera de core si depende de Node.

No debe:

- abrir Save Dialog;
- escribir archivos por sí misma;
- enviar a impresora.

Esas operaciones son otras responsabilidades.

---

# 47. Preview ZPL

Puede añadirse un panel de texto para inspeccionar el ZPL generado.

Debe ser de solo lectura.

Opcional:

```text
copy to clipboard
```

si se hace mediante una API segura.

---

# 48. Labelary

No hacer de Labelary una dependencia de producción.

Si se utiliza durante desarrollo para comparar ZPL:

- debe ser opcional;
- no enviar datos de usuarios sin acción explícita;
- no formar parte del pipeline principal;
- los tests no deben depender de Internet.

---

# 49. Preview PDF

La UI puede ofrecer preview del PDF generado mediante mecanismos locales seguros.

No ampliar permisos de Electron innecesariamente.

No cargar contenido remoto.

---

# 50. Integración IPC

Si el renderer necesita solicitar generación PDF en Main:

crear un método explícito.

Ejemplo conceptual:

```ts
window.labelAPI.generatePdf(document)
```

No exponer:

```ts
ipcRenderer.invoke(channel, payload)
```

El Main debe validar nuevamente el documento con Zod.

---

# 51. Validación Doble en IPC

Aunque el renderer ya posea un documento válido:

```text
Renderer
   ↓
IPC
   ↓
Main
```

Main debe volver a validar.

Nunca confiar en el renderer.

---

# 52. Límites de Recursos

Definir límites razonables para evitar trabajos patológicos.

Ejemplos:

- número máximo de elementos;
- longitud máxima de texto;
- longitud máxima de barcode data;
- tamaño máximo de imágenes;
- tamaño máximo de output.

No añadir valores arbitrarios sin documentarlos.

---

# 53. Pruebas de PrintPlan

Cubrir:

- documento vacío válido;
- geometría;
- orden de capas;
- rotaciones;
- bounds;
- barcode normalizado;
- warning de X Dimension;
- elemento inválido.

---

# 54. Pruebas de Unidades PDF

Cubrir:

```text
25.4 mm = 72 pt
```

y valores comunes.

Probar round-trip cuando exista conversión inversa.

---

# 55. Pruebas ZPL Base

Para un documento simple comprobar:

```text
^XA
^PW
^LL
^LH
^XZ
```

y que el orden sea determinista.

---

# 56. Golden Tests ZPL

Utilizar fixtures pequeñas y legibles.

Ejemplo:

```text
text-only.label.json
shapes.label.json
barcodes.label.json
rotations.label.json
```

Comparar ZPL esperado cuando sea estable.

Los golden tests son apropiados aquí porque el compilador debe ser determinista.

---

# 57. Test de Escapado ZPL

Casos obligatorios:

```text
HELLO
ABC^XZ
~JA
^XA^JUS^XZ
line break
caracteres de control
```

Verificar que ningún contenido pueda cerrar/iniciar comandos arbitrarios.

---

# 58. Pruebas Code 128 ZPL

Verificar:

- comando correcto;
- posición;
- altura;
- module width;
- display value;
- orientación;
- escaped data.

---

# 59. Pruebas EAN-13 ZPL

Verificar:

- datos normalizados;
- checksum no duplicado;
- posición;
- orientación;
- display value.

---

# 60. Pruebas QR ZPL

Verificar:

- data;
- magnificación;
- orientación;
- contenido escapado/encapsulado correctamente.

---

# 61. Pruebas Data Matrix ZPL

Verificar:

- payload;
- tamaño;
- orientación;
- salida válida.

---

# 62. Pruebas PDF

No comparar el binario completo byte por byte si contiene metadatos variables.

Probar semánticamente:

- comienza como PDF válido;
- número de páginas;
- tamaño físico;
- elementos esperados;
- generación de texto;
- generación de shapes;
- generación de barcode;
- errores controlados.

Evitar timestamps automáticos si afectan determinismo innecesariamente.

---

# 63. Fixture Canónica

Crear una etiqueta de prueba que incluya:

```text
Text
Rectangle
Line
Code128
EAN13
QR
Data Matrix
```

Dimensiones sugeridas:

```text
100 × 75 mm
```

Usarla para validar ambos backends.

---

# 64. Equivalencia entre Backends

ZPL y PDF deben derivar del mismo PrintPlan.

No crear dos interpretaciones diferentes del documento.

Ambos deben coincidir conceptualmente en:

- posiciones;
- tamaños;
- rotaciones;
- orden;
- contenido.

---

# 65. Tolerancia Física

Las diferencias por cuantización ZPL son esperables.

PDF puede representar dimensiones continuas.

ZPL debe ajustarse a dots enteros.

Documentar este comportamiento.

---

# 66. UI de Exportación

Agregar una interfaz mínima:

```text
Export / Preview
```

que permita:

- generar ZPL;
- inspeccionar warnings;
- generar PDF;
- inspeccionar errores.

No añadir todavía:

```text
Print
Printer selection
Port
IP
Copies
```

Eso pertenece a Fase 5.

---

# 67. Issues Panel

Los errores/warnings deben indicar el elemento.

Ejemplo:

```text
Warning
Element: 8a2...
BARCODE_X_DIMENSION_ADJUSTED
Requested 0.33 mm; physical 0.3754 mm @ 203 DPI.
```

---

# 68. Seguridad Electron

Mantener:

```text
contextIsolation: true
nodeIntegration: false
sandbox: true
webSecurity: true
```

No deshabilitar CSP para preview PDF.

---

# 69. No implementar todavía

Prohibido adelantar:

```text
TCP 9100
raw socket
printer discovery
Windows spooler
CUPS
USB direct
serial
print queue
retry logic
printer status
copies dispatch
```

El compilador produce artefactos.

No los envía.

---

# 70. Orden Secuencial de Implementación

## Paso 1 — Verificación

Leer:

```text
AGENTS.md
PHASE_1_SPEC.md
PHASE_2_SPEC.md
PHASE_3_SPEC.md
PHASE_4_SPEC.md
```

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

No avanzar con regresiones.

---

## Paso 2 — Auditar el modelo

Revisar:

- LabelDocument;
- elementos;
- barcode model;
- text properties;
- shape properties;
- image model.

Documentar cualquier dato que no sea suficiente para exportación.

No inventar propiedades silenciosamente.

---

## Paso 3 — PrintPlan

Implementar:

```text
buildPrintPlan
validatePrintPlan
CompileResult
```

con tests.

No implementar ZPL todavía.

---

## Paso 4 — ZPL units y orientation

Implementar:

```text
mm -> dots
rotation -> ZPL orientation
```

con tests.

Reutilizar converter.

---

## Paso 5 — ZPL escape

Implementar escapado seguro.

Añadir pruebas de inyección antes de generar textos/barcodes.

---

## Paso 6 — ZPL base

Implementar:

```text
^XA
page setup
elements
^XZ
```

---

## Paso 7 — Text / shapes

Implementar:

- text;
- rectangle;
- line.

Validar golden tests.

---

## Paso 8 — Barcodes ZPL

En orden:

1. Code128;
2. EAN13;
3. QR;
4. Data Matrix.

Reutilizar dominio de Fase 3.

---

## Paso 9 — PDF units/context

Implementar:

```text
mm -> pt
page size
coordinate inversion
```

con tests.

---

## Paso 10 — PDF text/shapes

Implementar vectorialmente.

---

## Paso 11 — PDF barcodes

Integrar representación vectorial.

No rasterizar la etiqueta completa.

---

## Paso 12 — UI mínima de export

Añadir preview/compile issues.

No añadir impresión.

---

## Paso 13 — IPC PDF si es necesario

Exponer únicamente un método explícito.

Validar Zod en Main.

---

## Paso 14 — Regresión completa

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

y casos manuales.

---

# 71. Casos Manuales de Validación

## Caso A — Texto

Etiqueta:

```text
100 × 50 mm
203 DPI
```

Texto:

```text
HELLO WORLD
x = 10 mm
y = 10 mm
rotation = 0
```

Validar ZPL y PDF.

---

## Caso B — Rotación

Probar:

```text
0
90
180
270
```

en texto y barcode.

---

## Caso C — ZPL Injection

Texto:

```text
ABC^XZ^XA~JA
```

Debe permanecer como contenido seguro o fallar de forma controlada.

Nunca debe ejecutar comandos adicionales.

---

## Caso D — EAN13

Usar un EAN válido.

Verificar:

- dominio normalizado;
- ZPL;
- PDF.

---

## Caso E — QR

Payload:

```text
https://example.com
```

Verificar:

- preview Fase 3;
- ZPL;
- PDF.

---

## Caso F — DPI

Compilar la misma etiqueta para:

```text
203
300
600
```

Las posiciones físicas deben conservarse.

Los dots deben variar.

---

# 72. Guía de Enseñanza para el Agente

Antes de cada bloque relevante explicar brevemente:

## PrintPlan

- por qué existe;
- por qué evita acoplar dominio a ZPL/PDF;
- por qué trabaja en mm.

## ZPL

- qué son `^XA` y `^XZ`;
- field origin;
- dots;
- comandos nativos;
- por qué no conviene rasterizar.

## ZPL Injection

- por qué concatenar datos es peligroso;
- cómo funciona el escaping.

## PDF

- diferencia entre mm y puntos;
- sistema de coordenadas PDF;
- vector vs raster.

## Determinismo

- por qué un compilador debe producir la misma salida para la misma entrada.

Las explicaciones deben ser concisas y directamente relacionadas con la implementación.

---

# 73. Reglas para Antigravity

No desarrollar toda la fase de una sola vez.

Proceso obligatorio:

```text
explicación
↓
plan del bloque
↓
implementación
↓
tests
↓
resultado
↓
siguiente bloque
```

No continuar con tests fallidos.

---

# 74. Decisiones que Requieren Documentación

Documentar antes de introducir:

- nueva librería PDF;
- rasterización de algún elemento vectorizable;
- cambio del modelo de texto;
- cambio del modelo barcode;
- estrategia de fuentes;
- soporte Unicode ZPL;
- cambio de PrintPlan;
- dependencia para SVG/PDF.

Formato:

```text
Problema
Opciones
Decisión
Motivo
Impacto
Compatibilidad
```

---

# 75. Criterios de Aceptación Funcionales

La Fase 4 está funcionalmente terminada cuando:

1. Un `LabelDocument` válido genera ZPL.
2. Un `LabelDocument` válido genera PDF.
3. ZPL usa dimensiones físicas convertidas a dots.
4. PDF usa dimensiones físicas reales.
5. Texto funciona en ambos.
6. Rectángulos funcionan en ambos.
7. Líneas funcionan en ambos.
8. Code128 funciona en ambos.
9. EAN13 funciona en ambos.
10. QR funciona en ambos.
11. Data Matrix funciona en ambos.
12. Rotaciones funcionan.
13. Orden de capas se conserva.
14. ZPL está protegido contra inyección de field data.
15. X Dimension respeta cuantización.
16. PDF no es una captura raster del canvas.
17. Los errores son tipados.
18. Los warnings son visibles.
19. No se envía nada a una impresora.

---

# 76. Criterios de Aceptación Técnicos

Debe pasar:

```bash
npx tsc --noEmit
npx vitest run
```

Con:

```text
0 errores TypeScript
0 tests fallidos
0 tests skip
0 tests only
```

No usar:

```text
any
```

como parche de tipos.

---

# 77. No-Regresión

Debe continuar funcionando todo lo previo:

```text
Fase 1:
core
schemas
converter
security
IPC
preload

Fase 2:
editor
selection
drag
resize
rotate
zoom
pan
grid
snapping
layers
properties
history

Fase 3:
Code128
EAN13
QR
Data Matrix
validation
X Dimension
vector preview
cache
```

---

# 78. Definition of Done

La Fase 4 termina únicamente cuando:

- existe PrintPlan;
- existe compilador ZPL puro;
- existe backend PDF vectorial;
- ambos consumen la misma interpretación del documento;
- existe escaping ZPL;
- existen golden tests;
- existe validación de bounds;
- existe soporte para text/shapes/barcodes;
- existe rotación;
- existe cuantización física;
- PDF mantiene dimensiones exactas;
- no se rasteriza la etiqueta completa;
- los warnings/errors son tipados;
- existe una UI mínima para generar/inspeccionar salida;
- la seguridad Electron permanece intacta;
- no existe todavía envío a hardware;
- TypeScript está limpio;
- Vitest está completamente en verde;
- no existen regresiones de Fases 1-3.

---

# 79. Resultado Esperado

Al terminar, el usuario debe poder diseñar una etiqueta y ejecutar:

```text
Generate ZPL
```

obteniendo algo conceptualmente similar a:

```zpl
^XA
^PW...
^LL...
...
^XZ
```

También debe poder ejecutar:

```text
Generate PDF
```

y obtener un documento con tamaño físico exacto y contenido vectorial.

Ninguna de estas acciones debe imprimir todavía.

La Fase 5 será responsable de tomar estos artefactos y enviarlos al hardware mediante:

```text
TCP 9100
spooler
drivers
```

---

# 80. Prompt Inicial para Antigravity

> Revisa completamente `AGENTS.md`, `PHASE_1_SPEC.md`, `PHASE_2_SPEC.md`, `PHASE_3_SPEC.md` y `PHASE_4_SPEC.md`.
>
> Ejecuta primero `npx tsc --noEmit` y `npx vitest run`. No continúes mientras exista una regresión.
>
> No implementes toda la Fase 4 de una sola vez.
>
> Comienza auditando el modelo actual para determinar si contiene toda la información necesaria para exportar texto, shapes y códigos sin depender de Konva.
>
> Después explícame brevemente por qué introduciremos un `PrintPlan` intermedio y por qué debe permanecer en milímetros.
>
> Implementa únicamente `CompileResult`, `PrintPlan`, `buildPrintPlan()` y `validatePrintPlan()` junto con sus pruebas.
>
> No escribas todavía el compilador ZPL ni el backend PDF hasta que este primer bloque esté completamente en verde.
