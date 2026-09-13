# ESPECIFICACIÓN TÉCNICA: FASE 3 - MOTOR DE CÓDIGOS DE BARRAS 1D/2D Y RENDERIZADO VECTORIAL

## 1. Contexto de la Fase

La Fase 1 estableció el núcleo matemático, los esquemas de dominio, la seguridad de Electron y la frontera IPC.

La Fase 2 construyó el editor WYSIWYG con representación física, canvas, selección, transformaciones, zoom, grid, snapping, paneles, capas e historial.

La Fase 3 incorpora el **motor real de simbologías** al editor.

El objetivo no es imprimir todavía.

El objetivo es que un elemento del documento pueda representar un código de barras o código 2D real, validarlo, previsualizarlo con precisión y mantener una arquitectura compatible con los futuros compiladores ZPL/PDF.

Esta fase debe respetar:

```text
AGENTS.md
PHASE_1_SPEC.md
PHASE_2_SPEC.md
```

La Fase 3 no puede debilitar ninguna regla establecida anteriormente.

---

# 2. Objetivo Principal

Implementar un subsistema de códigos de barras capaz de:

- soportar Code 128;
- soportar EAN-13;
- soportar QR Code;
- soportar Data Matrix;
- validar datos por simbología;
- generar una representación vectorial reutilizable;
- integrarse con el editor WYSIWYG;
- mantener dimensiones físicas;
- respetar DPI y Dimensión X cuando corresponda;
- mostrar errores de configuración sin romper el editor;
- mantener la lógica desacoplada de React, Electron y Konva cuando sea posible;
- preparar el modelo para futuros compiladores ZPL y PDF.

La librería principal será:

```text
bwip-js
```

---

# 3. Alcance Estricto

Esta fase incluye:

1. Arquitectura del módulo de códigos de barras.
2. Integración de `bwip-js`.
3. Validación específica por simbología.
4. Normalización de opciones.
5. Motor de generación SVG/vectorial.
6. Integración de Barcode y QR en el canvas.
7. Panel de propiedades específico.
8. Dimensión X y cuantización física.
9. Quiet zones.
10. Texto legible para códigos lineales.
11. Manejo de errores.
12. Cache de renderizado.
13. Pruebas unitarias.
14. Pruebas de integración del editor.
15. Validación de regresiones.
16. Preparación de contratos para Fase 4.

No incluye:

- ZPL;
- EPL;
- TSPL;
- PDF final;
- impresión;
- spooler;
- TCP 9100;
- descubrimiento de impresoras;
- lectura desde escáner;
- Excel;
- CSV;
- SQL;
- REST;
- GS1 avanzado;
- generación de etiquetas masivas;
- plantillas dinámicas.

---

# 4. Principio Arquitectónico Fundamental

El código de barras no debe almacenarse como imagen raster en `LabelDocument`.

El documento debe almacenar únicamente la configuración semántica.

Ejemplo conceptual:

```ts
{
  id: "...",
  type: "barcode",
  x: 10,
  y: 15,
  width: 50,
  height: 20,
  rotation: 0,
  locked: false,

  symbology: "code128",
  data: "ABC-123",
  displayValue: true,
  xDimensionMm: 0.33
}
```

La representación visual debe derivarse de esos datos.

Flujo esperado:

```text
LabelDocument
     ↓
Barcode configuration
     ↓
Validation
     ↓
Normalized Barcode Model
     ↓
Vector Renderer
     ↓
SVG / vector representation
     ↓
Konva / UI preview
```

En la Fase 4:

```text
Normalized Barcode Model
     ↓
ZPL Compiler / PDF Renderer
```

---

# 5. Separación de Responsabilidades

Crear tres niveles.

## 5.1. Dominio

Ubicación:

```text
src/core/barcodes/
```

Responsabilidades:

- tipos;
- validación;
- normalización;
- reglas físicas;
- Dimension X;
- quiet zones;
- opciones permitidas;
- errores de dominio.

No debe importar:

```text
React
Konva
Electron
DOM
Node.js
```

---

## 5.2. Renderizado vectorial

Ubicación sugerida:

```text
src/renderer/barcodes/
```

Responsabilidades:

- integración específica con `bwip-js`;
- transformación de configuración validada a SVG;
- cache;
- sanitización/uso seguro de salida;
- adaptación del resultado al renderer.

El adaptador de `bwip-js` debe estar encapsulado.

No distribuir llamadas directas a `bwip-js` por toda la aplicación.

---

## 5.3. UI

Ubicación:

```text
src/renderer/components/
src/renderer/canvas/elements/
```

Responsabilidades:

- propiedades;
- feedback;
- preview;
- eventos del usuario;
- selección;
- integración con store.

La UI no debe contener reglas de simbología complejas.

---

# 6. Estructura de Archivos Recomendada

```text
src/
├── core/
│   ├── barcodes/
│   │   ├── barcode.types.ts
│   │   ├── barcode.schema.ts
│   │   ├── barcode-validator.ts
│   │   ├── barcode-normalizer.ts
│   │   ├── x-dimension.ts
│   │   ├── quiet-zone.ts
│   │   ├── symbologies/
│   │   │   ├── code128.ts
│   │   │   ├── ean13.ts
│   │   │   ├── qrcode.ts
│   │   │   └── datamatrix.ts
│   │   └── index.ts
│   │
│   └── schemas/
│       └── label.schema.ts
│
├── renderer/
│   ├── barcodes/
│   │   ├── bwip-adapter.ts
│   │   ├── barcode-svg-renderer.ts
│   │   ├── barcode-cache.ts
│   │   └── barcode-render.types.ts
│   │
│   ├── canvas/
│   │   └── elements/
│   │       ├── BarcodeElement.tsx
│   │       └── QrCodeElement.tsx
│   │
│   └── components/
│       └── properties/
│           ├── BarcodeProperties.tsx
│           └── QrCodeProperties.tsx
│
tests/
├── core/
│   └── barcodes/
│       ├── barcode-validator.test.ts
│       ├── barcode-normalizer.test.ts
│       ├── x-dimension.test.ts
│       ├── code128.test.ts
│       ├── ean13.test.ts
│       ├── qrcode.test.ts
│       └── datamatrix.test.ts
│
└── renderer/
    └── barcodes/
        ├── barcode-svg-renderer.test.ts
        └── barcode-integration.test.tsx
```

El agente puede ajustar nombres menores sin mezclar responsabilidades.

---

# 7. Simbologías Iniciales

La Fase 3 debe soportar:

```text
code128
ean13
qrcode
datamatrix
```

No añadir más simbologías hasta terminar correctamente estas cuatro.

---

# 8. Modelo de Dominio

El esquema de Fase 1 deberá revisarse.

Si actualmente existe:

```ts
symbology:
  | 'code128'
  | 'ean13'
  | 'datamatrix'
  | 'qrcode'
```

debe analizarse si `qrcode` continúa modelado como:

- `type: "barcode"` + `symbology: "qrcode"`;

o como:

- `type: "qrcode"`.

La implementación debe evitar dos representaciones equivalentes que puedan generar estados ambiguos.

---

# 9. Decisión Recomendada de Modelo

Preferencia:

```text
type: "barcode"
```

para todas las simbologías 1D/2D y:

```text
symbology
```

como discriminador real.

Ejemplo:

```ts
type BarcodeSymbology =
  | 'code128'
  | 'ean13'
  | 'qrcode'
  | 'datamatrix';
```

Sin embargo, si la Fase 1/2 ya utiliza `type: "qrcode"` de forma pública, no romper el formato silenciosamente.

En ese caso el agente debe:

1. inspeccionar el modelo actual;
2. documentar el conflicto;
3. proponer una migración mínima;
4. mantener compatibilidad;
5. añadir pruebas.

No cambiar el formato persistido sin analizar consecuencias.

---

# 10. Tipos del Motor

Definir un modelo normalizado que no dependa directamente de la API pública de `bwip-js`.

Ejemplo conceptual:

```ts
interface NormalizedBarcode {
  symbology: BarcodeSymbology;
  data: string;

  widthMm: number;
  heightMm: number;

  rotation: 0 | 90 | 180 | 270;

  displayValue: boolean;

  xDimensionMm?: number;

  quietZone?: {
    topMm: number;
    rightMm: number;
    bottomMm: number;
    leftMm: number;
  };
}
```

Este contrato podrá evolucionar.

El objetivo es evitar que el dominio quede acoplado a opciones específicas de una librería.

---

# 11. Validación General

Antes de renderizar:

```text
raw element
    ↓
Zod
    ↓
symbology validator
    ↓
normalized barcode
```

Nunca enviar directamente valores arbitrarios del usuario a `bwip-js`.

---

# 12. Validación Code 128

Requisitos mínimos:

- `data` no vacío;
- limitar longitud a un valor razonable;
- rechazar caracteres/control no permitidos por la implementación;
- manejar correctamente texto Unicode no representable si `bwip-js` o la simbología no lo soportan.

No asumir que todo string es imprimible.

La validación debe producir errores de dominio claros.

Ejemplo:

```ts
{
  code: 'BARCODE_INVALID_DATA',
  message: 'Code 128 data cannot be empty.'
}
```

---

# 13. Validación EAN-13

EAN-13 requiere tratamiento específico.

Debe aceptar:

```text
12 dígitos
```

y calcular el dígito de control;

o aceptar:

```text
13 dígitos
```

y validar el dígito de control existente.

No aceptar:

- letras;
- espacios;
- longitudes arbitrarias;
- dígito de control incorrecto.

Crear funciones puras:

```ts
calculateEan13CheckDigit(...)
validateEan13(...)
normalizeEan13(...)
```

---

# 14. QR Code

Soportar inicialmente:

- texto;
- URLs;
- datos genéricos.

Configuraciones mínimas:

```text
error correction
```

Valores permitidos:

```text
L
M
Q
H
```

Valor default recomendado:

```text
M
```

No añadir configuración avanzada hasta que exista una necesidad.

---

# 15. Data Matrix

Soportar inicialmente payload de texto.

Mantener configuración mínima.

No exponer decenas de opciones de `bwip-js` en la UI.

La UI debe presentar únicamente controles útiles y entendibles.

---

# 16. Dimensión X

Para códigos lineales, la Dimensión X representa el ancho del módulo/barra más estrecha.

Debe expresarse en:

```text
mm
```

y posteriormente cuantizarse según el DPI.

Utilizar la lógica creada en Fase 1:

```ts
quantizeBarcodeX(...)
```

Resultado conceptual:

```ts
{
  requestedMm: 0.33,
  dots: 3,
  physicalMm: 0.3754
}
```

para un DPI determinado, dependiendo de la resolución real.

---

# 17. Dimensión X y Preview

El preview debe poder mostrar:

```text
Requested X: 0.33 mm
Actual @ 203 DPI: 0.3754 mm
Dots: 3
```

Esto ayuda a que el usuario comprenda que la impresora no puede representar cualquier valor físico arbitrario.

---

# 18. DPI

El DPI del documento continúa siendo:

```text
203
300
600
```

La UI debe utilizarlo para calcular cuantización física.

No utilizar DPI de pantalla para esta operación.

Diferenciar:

```text
96 CSS DPI -> preview/layout
203/300/600 DPI -> hardware
```

---

# 19. narrowBarRatio

Revisar la propiedad existente:

```ts
narrowBarRatio
```

La especificación de Fase 1 la definía como:

```text
entero >= 1
multiplicador de puntos de la Dimensión X
```

Antes de utilizarla, el agente debe verificar que su significado sea coherente con la simbología.

No confundir:

```text
X Dimension
```

con:

```text
wide-to-narrow ratio
```

Si el nombre actual es semánticamente incorrecto, documentar la corrección y aplicar una migración segura.

No cambiar silenciosamente el significado de una propiedad persistida.

---

# 20. Quiet Zones

Los códigos requieren espacios libres alrededor.

El motor debe representar quiet zones como reglas físicas.

No confiar únicamente en padding visual de CSS/Konva.

Definir helpers puros.

Ejemplo:

```ts
getMinimumQuietZone(...)
```

Cuando el usuario configure un tamaño insuficiente:

- mostrar warning;
- impedir configuraciones técnicamente inválidas cuando corresponda.

---

# 21. Restricción de Tamaño

El código debe caber en:

```text
element.width
element.height
```

Si la combinación de:

- data;
- symbology;
- X Dimension;
- quiet zone;
- display value;

no cabe, el sistema debe informar un error o warning.

No escalar arbitrariamente un código lineal para “hacerlo caber” si ello destruye la Dimensión X física.

---

# 22. Renderizado Vectorial

Preferir representación:

```text
SVG
```

cuando la API/version de `bwip-js` utilizada lo permita de forma segura.

El adaptador debe encapsular diferencias de API.

No dispersar código como:

```ts
bwipjs.someMethod(...)
```

por los componentes React.

---

# 23. Adaptador de bwip-js

Crear:

```text
src/renderer/barcodes/bwip-adapter.ts
```

API conceptual:

```ts
renderBarcodeSvg(
  barcode: NormalizedBarcode,
  options: RenderOptions
): Promise<BarcodeRenderResult>
```

No tiene que utilizar exactamente esa firma.

Debe:

1. recibir modelo validado;
2. traducirlo a opciones de bwip-js;
3. generar representación;
4. capturar errores;
5. devolver resultado tipado.

---

# 24. Resultado de Render

Usar un contrato explícito.

Ejemplo:

```ts
type BarcodeRenderResult =
  | {
      success: true;
      svg: string;
      intrinsicWidth: number;
      intrinsicHeight: number;
    }
  | {
      success: false;
      error: BarcodeRenderError;
    };
```

No lanzar errores no controlados hacia React.

---

# 25. Seguridad del SVG

Cualquier SVG generado debe tratarse cuidadosamente.

Aunque el origen principal sea una librería local, no introducir contenido arbitrario del usuario mediante `dangerouslySetInnerHTML` sin revisar la ruta completa.

Preferir:

- APIs de imagen seguras;
- parser controlado;
- sanitización si fuera necesaria.

No añadir una librería de sanitización si no es necesaria; analizar primero la salida real de `bwip-js`.

---

# 26. Integración con Konva

El elemento visual debe reutilizar:

```text
x
y
width
height
rotation
locked
```

del modelo existente.

El código generado debe renderizarse dentro del área del elemento.

No sustituir el modelo por un nodo Konva.

---

# 27. Cache de Renderizado

Los códigos no deben regenerarse innecesariamente en cada render de React.

Crear un cache basado en configuración estable.

Key conceptual:

```text
symbology
data
width
height
dpi
xDimension
displayValue
options
```

Puede utilizarse un hash estable o serialización determinista.

---

# 28. Invalidación del Cache

Regenerar únicamente cuando cambie una propiedad que afecte la representación.

No regenerar porque:

- cambia selección;
- cambia panel abierto;
- cambia hover;
- cambia viewport;
- cambia una animación.

---

# 29. Preview en Canvas

Cuando un código sea válido:

```text
render real
```

Cuando sea inválido:

mostrar placeholder/error visual.

Ejemplo:

```text
┌─────────────────────────┐
│ ⚠ Invalid EAN-13        │
│ Expected 12 or 13 digits│
└─────────────────────────┘
```

El error no debe romper el canvas.

---

# 30. Panel de Propiedades de Barcode

Mostrar:

```text
Symbology
Data
Display Value
X Dimension
Actual X Dimension
Dots
Rotation
Width
Height
```

Para opciones no aplicables, ocultarlas.

---

# 31. Panel de QR

Mostrar:

```text
Data
Error Correction
Width
Height
Rotation
```

El QR debe mantener proporción cuadrada cuando corresponda.

No permitir deformarlo visualmente de forma que altere su legibilidad.

---

# 32. Panel de Data Matrix

Mostrar:

```text
Data
Width
Height
Rotation
```

Mantener controles mínimos.

---

# 33. EAN-13 UI

Mostrar validación inmediata.

Ejemplo:

```text
123456789012
Check digit: 8
Encoded: 1234567890128
```

Si se introducen 13 dígitos:

```text
Check digit valid
```

o:

```text
Invalid check digit
```

---

# 34. Display Value

Para simbologías lineales:

```text
displayValue: true
```

muestra texto humano cuando sea compatible.

No aplicar a QR/Data Matrix si no corresponde.

---

# 35. Cambios de Simbología

Cambiar de:

```text
code128 -> ean13
```

puede hacer inválido el `data`.

El sistema no debe borrar automáticamente el valor sin advertencia.

Debe:

1. conservarlo;
2. validar;
3. mostrar error;
4. permitir corregirlo.

---

# 36. Defaults

Definir defaults centralizados.

Ejemplo conceptual:

```ts
BARCODE_DEFAULTS
```

Puede contener:

```text
symbology = code128
displayValue = true
xDimensionMm = 0.33
```

Los valores finales deben ser técnicamente razonables y consistentes con el modelo actual.

No dispersar magic numbers.

---

# 37. Creación desde Toolbar

Sustituir placeholders de Fase 2 por creación real de:

```text
Barcode
QR Code
```

Al crear:

1. insertar elemento válido;
2. seleccionar;
3. renderizar;
4. mostrar propiedades.

---

# 38. Transformaciones

Drag, resize y rotation continúan utilizando la infraestructura de Fase 2.

No duplicar lógica.

Las restricciones adicionales son:

- QR no debe deformarse arbitrariamente;
- códigos lineales deben respetar dimensiones mínimas;
- resize debe recalcular advertencias físicas;
- rotation debe continuar en cuadrantes ortogonales.

---

# 39. Estado del Documento

El estado persistido debe contener únicamente configuración.

No guardar:

```text
SVG generado
PNG
Canvas
Image object
Konva Node
bwip-js internals
```

Estos datos son derivados.

---

# 40. Errores de Dominio

Definir errores tipados.

Ejemplo:

```ts
type BarcodeErrorCode =
  | 'INVALID_DATA'
  | 'INVALID_CHECK_DIGIT'
  | 'UNSUPPORTED_SYMBOLOGY'
  | 'INVALID_X_DIMENSION'
  | 'INSUFFICIENT_SIZE'
  | 'RENDER_FAILED';
```

Mensajes UI pueden mapearse aparte.

---

# 41. Testing del Motor

Las reglas de dominio deben probarse sin React.

Especialmente:

- EAN-13;
- Dimension X;
- normalization;
- quiet zone;
- validation.

---

# 42. Pruebas EAN-13

Cubrir:

```text
12 dígitos válidos
13 dígitos válidos
13 dígitos con checksum incorrecto
letras
vacío
longitud 11
longitud 14
```

Validar el algoritmo del check digit.

---

# 43. Pruebas Code 128

Cubrir:

```text
texto válido
número válido
payload vacío
payload demasiado largo
caracteres problemáticos
```

---

# 44. Pruebas QR

Cubrir:

```text
payload válido
payload vacío
error correction L
M
Q
H
valor inválido
```

---

# 45. Pruebas Data Matrix

Cubrir al menos:

```text
payload válido
payload vacío
configuración soportada
configuración inválida
```

---

# 46. Pruebas Dimension X

Reutilizar Fase 1.

Cubrir:

```text
203 DPI
300 DPI
600 DPI
```

y valores típicos.

Comprobar:

```text
requested -> dots -> physical
```

---

# 47. Pruebas del Adaptador

El adaptador `bwip-js` debe probar:

- mapping de Code128;
- mapping de EAN13;
- mapping de QR;
- mapping de Data Matrix;
- propagación controlada de errores.

Evitar tests frágiles basados en comparar SVG completo carácter por carácter si la librería puede variar detalles internos.

Preferir assertions semánticas.

---

# 48. Pruebas de Integración del Editor

Probar:

1. crear barcode;
2. cambiar data;
3. preview actualiza;
4. error aparece con EAN inválido;
5. corregir data elimina error;
6. cambiar symbology;
7. cambiar X Dimension;
8. undo;
9. redo.

---

# 49. Undo / Redo

Las modificaciones de configuración de código deben integrarse con el historial de Fase 2.

Ejemplo:

```text
code128
   ↓
cambiar data
   ↓
undo
   ↓
data anterior
```

No crear un historial separado.

---

# 50. Performance

El render de códigos puede ser costoso.

Aplicar:

- debounce para inputs donde convenga;
- cache;
- memoización selectiva;
- no regenerar durante cada frame de resize si genera problemas.

Puede mostrarse preview simplificado durante resize y render final en `transformend` si es necesario.

---

# 51. Debounce

Para `data`:

```text
100-250 ms
```

puede utilizarse para evitar regeneración excesiva.

El estado del input puede actualizarse inmediatamente mientras el render vectorial se difiere ligeramente.

---

# 52. Worker

No introducir Web Worker por defecto.

Solo hacerlo si profiling demuestra bloqueo perceptible.

No añadir complejidad preventiva.

---

# 53. Seguridad

No debilitar:

```text
contextIsolation
sandbox
nodeIntegration
CSP
```

La generación de códigos debe realizarse sin necesidad de ampliar privilegios del renderer.

No añadir IPC para una operación que puede ejecutarse localmente y de forma segura en el renderer/core.

---

# 54. Dependencias

Dependencia principal:

```text
bwip-js
```

Antes de añadir otra librería para barcodes:

1. justificarla;
2. demostrar que `bwip-js` no resuelve el requisito;
3. revisar licencia;
4. evitar duplicación.

---

# 55. Compatibilidad futura con ZPL

El dominio no debe depender de SVG.

La Fase 4 necesitará:

```text
LabelDocument
      ↓
ZPL
```

sin pasar por:

```text
SVG -> raster -> ZPL
```

Por eso:

```text
barcode config
```

debe permanecer disponible en forma semántica.

---

# 56. Compatibilidad futura con PDF

PDF podrá:

- recrear el código vectorial;
- insertar SVG/vector;
- utilizar configuración semántica.

No guardar raster como fuente principal.

---

# 57. Criterios de Aceptación Funcionales

La Fase 3 se considera funcionalmente completada cuando:

1. Code128 funciona.
2. EAN13 funciona.
3. QR funciona.
4. Data Matrix funciona.
5. Los cuatro se visualizan en el editor.
6. Los errores de configuración se muestran correctamente.
7. EAN13 calcula/valida check digit.
8. X Dimension se cuantiza.
9. Se muestra valor real para DPI.
10. Barcode puede redimensionarse con restricciones.
11. QR mantiene geometría válida.
12. Barcode participa en layers.
13. Barcode participa en undo/redo.
14. Barcode puede duplicarse.
15. Barcode puede bloquearse.
16. Barcode puede rotarse.
17. El preview es vectorial cuando sea técnicamente posible.
18. No se almacena SVG en `LabelDocument`.

---

# 58. Criterios de Aceptación Técnicos

Ejecutar:

```bash
npx tsc --noEmit
```

Resultado:

```text
0 errores
```

Ejecutar:

```bash
npx vitest run
```

Resultado:

```text
todas las pruebas en verde
```

No finalizar con:

```text
skip
only
any como parche
errores ignorados
warnings críticos
```

---

# 59. Criterios de No-Regresión

Deben continuar funcionando:

```text
Fase 1:
- schemas
- converter
- security
- IPC
- preload

Fase 2:
- editor
- selection
- drag
- resize
- rotate
- zoom
- pan
- grid
- snapping
- properties
- layers
- undo/redo
```

---

# 60. Orden de Implementación

## Paso 1 — Validar estado actual

Leer:

```text
AGENTS.md
PHASE_1_SPEC.md
PHASE_2_SPEC.md
PHASE_3_SPEC.md
```

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

No avanzar si el repositorio está roto.

---

## Paso 2 — Inspeccionar modelo existente

Revisar:

```text
LabelDocument
BarcodeElement
QrCodeElement
narrowBarRatio
symbology
```

Documentar inconsistencias antes de cambiar esquemas.

---

## Paso 3 — Crear dominio barcode

Crear:

```text
src/core/barcodes/
```

con:

- tipos;
- validadores;
- errores;
- normalizadores.

Añadir tests.

---

## Paso 4 — EAN-13

Implementar primero:

```text
calculate check digit
validate
normalize
```

con pruebas exhaustivas.

---

## Paso 5 — Dimension X

Integrar:

```text
quantizeBarcodeX
```

con dominio barcode.

No duplicar fórmula.

---

## Paso 6 — QR y Data Matrix

Crear validadores mínimos.

---

## Paso 7 — Integrar bwip-js

Crear un único adaptador.

No modificar todavía el canvas.

Validar que puede generar las cuatro simbologías.

---

## Paso 8 — Vector renderer

Crear:

```text
barcode-svg-renderer
```

y manejo de errores.

Añadir cache.

---

## Paso 9 — Integrar canvas

Reemplazar placeholders.

No reescribir arquitectura de Fase 2.

---

## Paso 10 — Properties Panel

Agregar controles específicos.

---

## Paso 11 — Toolbar

Habilitar creación real.

---

## Paso 12 — Historial

Verificar undo/redo.

---

## Paso 13 — Performance

Verificar:

- input rápido;
- resize;
- zoom;
- múltiples barcodes.

Optimizar únicamente si es necesario.

---

## Paso 14 — Validación completa

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

Realizar pruebas manuales.

---

# 61. Casos Manuales de Prueba

## Code128

Crear:

```text
ABC-123456
```

Debe verse correctamente.

---

## EAN13

Introducir:

```text
400638133393
```

El sistema debe calcular el dígito de control correcto.

Probar también una cadena de 13 dígitos válida.

---

## QR

Crear:

```text
https://example.com
```

Cambiar:

```text
M -> H
```

Debe regenerarse.

---

## Data Matrix

Crear:

```text
LOT-2026-0001
```

Debe renderizarse.

---

## DPI

Cambiar:

```text
203 -> 300 -> 600
```

Debe actualizar:

```text
dots
physical X Dimension
```

sin modificar arbitrariamente las dimensiones del documento.

---

# 62. Guía de Enseñanza para el Agente

Antes de implementar cada tema nuevo, explicar brevemente.

## Barcode fundamentals

Explicar:

- módulo;
- barra;
- espacio;
- Dimension X;
- quiet zone;
- checksum.

## Code 128

Explicar por qué acepta un rango amplio de datos y por qué no necesita el mismo formato rígido de EAN13.

## EAN-13

Explicar:

- 12 dígitos de datos;
- dígito de control;
- algoritmo checksum.

## QR

Explicar:

- matriz;
- módulos;
- error correction;
- por qué no debe deformarse.

## Data Matrix

Explicar diferencia conceptual con QR.

## Vector rendering

Explicar por qué SVG es preferible a PNG en preview e impresión profesional.

## DPI

Explicar por qué:

```text
0.33 mm
```

no siempre puede representarse exactamente en una impresora.

---

# 63. Reglas para Antigravity

No implementar la fase completa de una sola vez.

Trabajar por bloques:

```text
explicación
plan
implementación
tests
resultado
siguiente bloque
```

No continuar si los tests fallan.

---

# 64. Decisiones que Deben Documentarse

Documentar antes de modificar:

- modelo Barcode vs QR separado;
- significado de `narrowBarRatio`;
- nuevas propiedades persistidas;
- estrategia SVG;
- dependencia extra;
- cambio incompatible del schema.

Usar formato:

```text
Problema
Opciones
Decisión
Motivo
Compatibilidad
Migración
```

---

# 65. Definition of Done

La Fase 3 termina únicamente cuando:

- Code128 es real;
- EAN13 es real;
- QR es real;
- Data Matrix es real;
- existe validación de dominio;
- existe checksum EAN13;
- existe X Dimension física;
- existe cuantización por DPI;
- existe preview vectorial;
- existe cache;
- el editor integra los códigos;
- properties funciona;
- undo/redo funciona;
- layers funciona;
- resize/rotate funciona;
- no se guarda SVG/raster en el documento;
- no se ha implementado ZPL;
- no se ha implementado PDF final;
- no se ha implementado impresión;
- TypeScript pasa;
- Vitest pasa;
- Fases 1 y 2 no sufren regresiones.

---

# 66. Resultado Esperado

Al terminar, un usuario debe poder:

1. seleccionar `Barcode`;
2. elegir `Code 128`;
3. escribir:

```text
ABC-123
```

4. observar el código real;
5. cambiar a EAN13;
6. recibir validación inmediata;
7. crear QR;
8. crear Data Matrix;
9. ajustar tamaño;
10. modificar X Dimension;
11. observar dots reales para 203/300/600 DPI;
12. utilizar undo/redo;
13. guardar el estado como configuración semántica.

El editor debe estar preparado para que la Fase 4 pueda tomar ese mismo documento y convertirlo directamente en:

```text
ZPL
PDF
```

sin depender de capturas del canvas.

---

# 67. Prompt Inicial para Antigravity

Usar:

> Revisa `AGENTS.md`, `PHASE_1_SPEC.md`, `PHASE_2_SPEC.md` y `PHASE_3_SPEC.md`.
>
> Verifica primero el estado actual con `npx tsc --noEmit` y `npx vitest run`.
>
> No escribas toda la Fase 3 de una sola vez.
>
> Comienza inspeccionando el modelo actual de `BarcodeElement`, `QrCodeElement`, `symbology` y `narrowBarRatio`.
>
> Antes de modificar el schema, explícame cualquier inconsistencia que encuentres y propón la migración mínima compatible.
>
> Después implementa únicamente el dominio puro de códigos de barras y sus pruebas, comenzando por EAN-13.
>
> Antes de escribir código explícame brevemente qué son Dimension X, quiet zone y check digit.
>
> No avances a la integración con `bwip-js` hasta que los tests del dominio estén en verde.
