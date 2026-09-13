# ESPECIFICACIÓN TÉCNICA: FASE 2 - EDITOR VISUAL WYSIWYG, CANVAS Y EXPERIENCIA DE USUARIO

## 1. Contexto de la Fase

La Fase 1 establece el núcleo de dominio, las conversiones físicas, los esquemas Zod, la seguridad base de Electron, el preload y la frontera IPC.

La Fase 2 construye la primera capa visual utilizable del producto: un **editor WYSIWYG de etiquetas** capaz de representar un `LabelDocument` en pantalla y permitir la manipulación visual de sus elementos sin perder precisión física.

Esta fase debe respetar en todo momento las reglas globales definidas en:

```text
AGENTS.md
```

y debe asumir que la Fase 1 está terminada y validada.

---

# 2. Objetivo Principal

Construir un editor visual moderno y profesional que permita:

- crear y visualizar un documento de etiqueta;
- representar correctamente su tamaño físico;
- seleccionar elementos;
- mover elementos;
- redimensionar elementos;
- rotar elementos;
- eliminar y duplicar elementos;
- trabajar con zoom;
- trabajar con pan;
- visualizar grid;
- utilizar snapping;
- gestionar selección y propiedades;
- gestionar capas básicas;
- editar propiedades numéricas;
- mostrar una interfaz moderna mediante Tailwind CSS;
- utilizar animaciones controladas mediante Motion for React.

La UI debe sentirse como una herramienta de escritorio profesional.

---

# 3. Alcance Estricto de la Fase

La Fase 2 incluye:

1. Inicialización del renderer con React + TypeScript.
2. Integración de Tailwind CSS.
3. Integración de Konva mediante `konva` y `react-konva`.
4. Integración de Motion for React.
5. Arquitectura del editor visual.
6. Adaptadores de unidades físicas para canvas.
7. Estado del documento y selección.
8. Canvas principal.
9. Renderizado básico de elementos.
10. Selección, drag, resize y rotación.
11. Zoom y pan.
12. Grid y snapping.
13. Barra de herramientas.
14. Panel de propiedades.
15. Panel de capas.
16. Atajos de teclado básicos.
17. Historial básico undo/redo.
18. Pruebas unitarias de lógica crítica.
19. Validación de TypeScript y Vitest.

La Fase 2 **no incluye**:

- generación real de códigos de barras;
- generación de QR;
- compilador ZPL;
- PDF;
- impresión;
- sockets TCP;
- spooler del sistema operativo;
- importación CSV;
- Excel;
- SQL;
- REST;
- serialización masiva;
- plugins;
- descubrimiento de impresoras;
- trabajos reales de impresión.

Los tipos `barcode` y `qrcode` pueden representarse visualmente como placeholders hasta la Fase 3.

---

# 4. Decisión Arquitectónica del Canvas

Para esta fase se utilizará:

```text
Konva.js
react-konva
```

## 4.1. Motivos

Konva proporciona:

- sistema de escenas basado en nodos;
- soporte de layers;
- drag & drop;
- transformaciones;
- eventos;
- `Transformer`;
- zoom;
- pan;
- buen encaje con React mediante `react-konva`.

La integración debe evitar que Konva se convierta en la fuente de verdad del documento.

Konva es únicamente una representación visual del modelo.

La fuente de verdad continúa siendo:

```text
LabelDocument
```

---

# 5. Principio Fundamental de Coordenadas

El documento debe almacenar dimensiones físicas.

Ejemplo:

```ts
{
  x: 10,
  y: 15,
  width: 40,
  height: 20
}
```

Si la unidad del documento es:

```text
mm
```

todos esos valores representan milímetros.

El canvas no debe almacenar permanentemente las coordenadas de pantalla como datos del documento.

---

# 6. Sistema de Conversión Visual

La pantalla utiliza como referencia lógica:

```text
96 CSS DPI
```

Conversión base:

```text
1 inch = 25.4 mm
1 inch = 96 CSS px
```

Por tanto:

```text
pxPerMm = 96 / 25.4
```

A zoom `1`:

```text
canvasPx = mm × (96 / 25.4)
```

Con zoom:

```text
canvasPx = mm × (96 / 25.4) × zoom
```

Conversión inversa:

```text
mm = canvasPx / ((96 / 25.4) × zoom)
```

La lógica de impresión nunca utilizará estas conversiones visuales.

Para impresión se utilizarán posteriormente los conversores físicos de `src/core/units/converter.ts`.

---

# 7. Precisión Física

Las transformaciones visuales no deben introducir pérdida acumulativa.

No redondear coordenadas físicas a enteros.

Preferir una normalización decimal controlada, por ejemplo:

```text
4 decimales en mm
```

cuando sea necesario.

Ejemplo:

```text
12.3457 mm
```

El zoom no debe modificar las propiedades reales del documento.

---

# 8. Stack de la Fase 2

Dependencias principales:

```text
react
react-dom
konva
react-konva
tailwindcss
motion
```

Para pruebas del renderer:

```text
@testing-library/react
@testing-library/user-event
jsdom
```

No introducir una segunda librería de canvas.

No introducir múltiples librerías de animación para la misma responsabilidad.

---

# 9. Gestión de Estado

La gestión de estado debe mantenerse explícita y testeable.

Para esta fase se permite una store pequeña dedicada al editor.

Opción recomendada:

```text
Zustand
```

La incorporación de Zustand está justificada porque el editor necesita compartir estado entre:

- canvas;
- toolbar;
- panel de propiedades;
- panel de capas;
- historial;
- selección;
- zoom;
- herramientas activas.

No almacenar nodos Konva dentro de la store.

La store debe contener únicamente datos serializables o referencias estrictamente controladas.

---

# 10. Modelo de Estado del Editor

Definir conceptualmente:

```ts
interface EditorState {
  document: LabelDocument;

  selectedElementIds: string[];

  activeTool:
    | 'select'
    | 'text'
    | 'rectangle'
    | 'line'
    | 'pan';

  zoom: number;

  viewport: {
    x: number;
    y: number;
  };

  grid: {
    enabled: boolean;
    sizeMm: number;
  };

  snap: {
    enabled: boolean;
    thresholdPx: number;
  };

  history: {
    past: LabelDocument[];
    future: LabelDocument[];
  };
}
```

No es obligatorio usar exactamente esta interfaz, pero la separación conceptual debe mantenerse.

---

# 11. Arquitectura de Archivos

Crear o adaptar una estructura similar a:

```text
src/
├── renderer/
│   ├── app/
│   │   ├── App.tsx
│   │   └── providers.tsx
│   │
│   ├── editor/
│   │   ├── EditorShell.tsx
│   │   ├── EditorCanvas.tsx
│   │   ├── EditorStage.tsx
│   │   └── EditorWorkspace.tsx
│   │
│   ├── canvas/
│   │   ├── constants.ts
│   │   ├── coordinates.ts
│   │   ├── snapping.ts
│   │   ├── grid.ts
│   │   ├── selection.ts
│   │   └── elements/
│   │       ├── ElementRenderer.tsx
│   │       ├── TextElement.tsx
│   │       ├── RectangleElement.tsx
│   │       ├── LineElement.tsx
│   │       ├── ImagePlaceholderElement.tsx
│   │       └── BarcodePlaceholderElement.tsx
│   │
│   ├── components/
│   │   ├── toolbar/
│   │   ├── properties/
│   │   ├── layers/
│   │   ├── statusbar/
│   │   ├── dialogs/
│   │   └── ui/
│   │
│   ├── store/
│   │   ├── editor.store.ts
│   │   ├── history.ts
│   │   └── selectors.ts
│   │
│   ├── hooks/
│   │   ├── use-editor-hotkeys.ts
│   │   ├── use-selection.ts
│   │   └── use-viewport.ts
│   │
│   ├── styles/
│   │   └── globals.css
│   │
│   ├── main.tsx
│   └── vite-env.d.ts
│
tests/
└── renderer/
    ├── coordinates.test.ts
    ├── snapping.test.ts
    ├── history.test.ts
    ├── editor-store.test.ts
    └── properties-panel.test.tsx
```

El agente puede ajustar nombres menores si mantiene las responsabilidades.

---

# 12. Diseño General de la Interfaz

La interfaz debe tener una composición de aplicación de escritorio.

Estructura recomendada:

```text
┌───────────────────────────────────────────────────────────────┐
│ Top Bar / Document / Undo / Redo / Zoom                     │
├───────────────┬───────────────────────────────┬───────────────┤
│               │                               │               │
│ Toolbar       │                               │ Properties    │
│               │        Canvas / Workspace     │               │
│ Select        │                               │ Position      │
│ Text          │          Label                │ Size          │
│ Rectangle     │                               │ Rotation      │
│ Line          │                               │ Locked        │
│ Pan           │                               │               │
│               │                               │               │
├───────────────┴───────────────────────────────┴───────────────┤
│ Layers / Status / Coordinates / Zoom                         │
└───────────────────────────────────────────────────────────────┘
```

La disposición puede evolucionar, pero debe mantener:

- canvas como foco principal;
- herramientas visibles;
- propiedades contextuales;
- capas accesibles;
- información de zoom y coordenadas.

---

# 13. Tailwind CSS

Tailwind CSS es el sistema principal de estilos.

Debe utilizarse para:

- layout;
- spacing;
- tipografía;
- colores;
- borders;
- sombras;
- estados;
- paneles;
- controles;
- dark/light readiness.

No duplicar estilos comunes.

Crear abstracciones reutilizables para:

- botones;
- icon buttons;
- inputs;
- select;
- tabs;
- toolbar item;
- panel;
- field row;
- tooltip;
- separator;
- dialog.

---

# 14. Dirección Visual

El producto debe transmitir:

```text
professional
industrial
modern
clean
precise
technical
```

Evitar una estética de landing page.

Preferir una apariencia cercana a:

- editores gráficos;
- IDEs;
- herramientas CAD ligeras;
- aplicaciones profesionales de diseño.

La UI debe priorizar densidad de información y claridad.

---

# 15. Motion for React

Utilizar:

```text
motion
```

para animaciones discretas.

Aplicaciones permitidas:

- apertura/cierre de paneles;
- dropdowns;
- dialogs;
- tooltips;
- notificaciones;
- transición de estado activo;
- aparición contextual del panel de propiedades.

No utilizar Motion para:

- drag principal de elementos del canvas;
- resize del Transformer;
- pan;
- zoom del Stage;
- lógica de coordenadas.

Estas operaciones deben mantenerse en Konva por rendimiento y precisión.

---

# 16. Accesibilidad de Animaciones

Todas las animaciones deben respetar:

```text
prefers-reduced-motion
```

Los efectos visuales no deben ser necesarios para comprender el estado de la aplicación.

---

# 17. Canvas y Workspace

Crear un workspace que:

- ocupe la mayor parte del espacio disponible;
- permita scroll o pan;
- tenga fondo diferenciado;
- centre inicialmente la etiqueta;
- permita zoom;
- muestre claramente los límites físicos de la etiqueta.

La etiqueta debe dibujarse como una superficie independiente.

Ejemplo:

```text
Workspace
   └── Stage
        └── Layer
             └── Label Surface
                  ├── Element
                  ├── Element
                  └── Element
```

---

# 18. Representación del Tamaño de Etiqueta

Si el documento define:

```ts
width: 100
height: 50
unit: 'mm'
```

el canvas debe calcular su tamaño visual mediante el adaptador de unidades.

No fijar tamaños arbitrarios como:

```text
800 × 400 px
```

si no corresponden al tamaño físico.

---

# 19. Zoom

Valores recomendados:

```text
minZoom = 0.25
maxZoom = 4
```

Ejemplos:

```text
25%
50%
75%
100%
125%
150%
200%
300%
400%
```

Debe ser posible:

- zoom mediante controles;
- zoom mediante rueda + modificador;
- fit-to-screen;
- reset a 100%.

El zoom nunca debe modificar el `LabelDocument`.

---

# 20. Pan

Permitir desplazamiento del workspace mediante:

- herramienta Pan;
- Space + drag;
- middle mouse drag, si resulta viable.

El pan afecta únicamente al viewport.

No modificar coordenadas de elementos durante el pan.

---

# 21. Grid

Implementar un grid visual configurable.

Valor inicial recomendado:

```text
1 mm
```

Opciones futuras:

```text
0.5 mm
1 mm
2 mm
5 mm
10 mm
```

El grid debe escalar visualmente con el zoom.

---

# 22. Snapping

Implementar snapping mínimo a:

- grid;
- bordes de la etiqueta.

Opcional dentro de la fase si el tiempo permite:

- centros;
- bordes de otros elementos.

Funciones puras recomendadas:

```ts
snapValue(...)
snapPoint(...)
getSnapGuides(...)
```

La lógica de snapping debe poder probarse sin Konva.

---

# 23. Selección

Debe existir:

- selección simple;
- deselección al pulsar espacio vacío;
- selección visual;
- selección desde panel de capas.

Preparar la arquitectura para selección múltiple.

La selección múltiple puede implementarse si no compromete la estabilidad de la fase.

---

# 24. Transformer

Utilizar `Konva.Transformer` para:

- resize;
- rotación;
- handles visuales.

Restricciones:

- evitar dimensiones negativas;
- impedir width/height <= 0;
- normalizar escala tras transformaciones;
- persistir width/height reales en el modelo;
- resetear `scaleX` y `scaleY` después de aplicar el resize.

No almacenar escalas acumulativas como sustituto de dimensiones reales.

---

# 25. Rotación

La versión inicial debe respetar las rotaciones definidas por el modelo:

```text
0
90
180
270
```

Durante interacción puede mostrarse una rotación libre temporal únicamente si finalmente se cuantiza al cuadrante permitido.

Preferencia:

```text
snap de rotación a 90°
```

La propiedad persistida debe ser siempre válida según Zod.

---

# 26. Movimiento

Al mover un elemento:

```text
Konva position
      ↓
canvasPxToPhysicalUnit(...)
      ↓
snap
      ↓
normalización
      ↓
updateElement(...)
```

No guardar coordenadas visuales directamente.

---

# 27. Elementos Iniciales

## 27.1. Text

Debe mostrar:

- texto;
- posición;
- width;
- height;
- rotación.

Propiedades editables básicas:

- contenido;
- font size;
- alineación;
- negrita, si el modelo lo permite.

Si las propiedades todavía no existen en el esquema de Fase 1, el agente debe:

1. revisar el esquema;
2. proponer la extensión mínima;
3. añadir validación;
4. añadir tests;
5. evitar cambios incompatibles.

---

## 27.2. Rectangle

Debe permitir:

- posición;
- tamaño;
- borde;
- fill opcional;
- rotación.

---

## 27.3. Line

Debe permitir:

- posición;
- longitud;
- grosor;
- rotación.

---

## 27.4. Barcode / QR

Durante esta fase:

```text
placeholder only
```

Ejemplo visual:

```text
┌─────────────────┐
│ || ||| || |||   │
│ BARCODE         │
└─────────────────┘
```

La generación real corresponde a la Fase 3.

---

## 27.5. Image

Si el modelo aún no define una fuente de imagen segura y serializable, utilizar placeholder.

No diseñar todavía un sistema completo de archivos.

---

# 28. Toolbar

Debe contener inicialmente:

- Select;
- Text;
- Rectangle;
- Line;
- Pan.

Opcional:

- Image placeholder;
- Barcode placeholder.

Cada herramienta debe tener:

- icono;
- tooltip;
- estado active;
- acceso mediante teclado cuando aplique.

---

# 29. Creación de Elementos

Flujo inicial recomendado:

```text
Seleccionar herramienta
        ↓
Click en canvas
        ↓
Crear elemento con tamaño default
        ↓
Seleccionarlo
        ↓
Cambiar automáticamente a Select
```

Valores predeterminados deben estar centralizados.

Ejemplo:

```ts
DEFAULT_TEXT_SIZE_MM
DEFAULT_RECTANGLE_WIDTH_MM
DEFAULT_RECTANGLE_HEIGHT_MM
```

No dispersar magic numbers.

---

# 30. Panel de Propiedades

Cuando exista selección, mostrar propiedades del elemento.

Campos mínimos:

```text
X
Y
Width
Height
Rotation
Locked
```

Además mostrar propiedades específicas según tipo.

Los inputs deben trabajar con unidades físicas.

Ejemplo:

```text
X: 10.000 mm
```

No mostrar coordenadas de Konva.

---

# 31. Edición Numérica

Los inputs del panel deben:

- validar valores;
- evitar NaN;
- evitar negativos donde no estén permitidos;
- aplicar cambios al documento;
- sincronizar canvas inmediatamente.

La validación final debe pasar por los esquemas de dominio.

---

# 32. Panel de Capas

Mostrar todos los elementos del documento.

Cada fila debe incluir:

- tipo;
- nombre/id abreviado;
- estado seleccionado;
- locked;
- orden visual.

Operaciones mínimas:

- seleccionar;
- bloquear/desbloquear;
- mover adelante;
- mover atrás.

Opcional:

- drag reorder.

---

# 33. Orden de Capas

El orden de:

```ts
document.elements
```

representará inicialmente el orden de renderizado.

Regla:

```text
primer elemento -> fondo
último elemento -> frente
```

Las operaciones:

```text
bringForward
sendBackward
bringToFront
sendToBack
```

deben implementarse como funciones puras cuando sea posible.

---

# 34. Elementos Bloqueados

Si:

```ts
locked === true
```

el elemento:

- puede seleccionarse desde layers;
- no puede arrastrarse;
- no puede redimensionarse;
- no puede rotarse.

Debe existir feedback visual.

---

# 35. Atajos de Teclado

Implementar como mínimo:

```text
Delete / Backspace -> eliminar selección
Ctrl/Cmd + Z       -> undo
Ctrl/Cmd + Shift+Z -> redo
Ctrl/Cmd + Y       -> redo alternativo
Ctrl/Cmd + D       -> duplicar
Escape             -> volver a Select / deseleccionar
Space + drag       -> pan temporal
```

Los atajos no deben interferir con inputs de texto.

---

# 36. Duplicación

Duplicar un elemento debe:

- crear nuevo UUID;
- desplazarlo ligeramente;
- conservar propiedades;
- seleccionar el duplicado.

Ejemplo de offset:

```text
+2 mm x
+2 mm y
```

si permanece dentro del documento.

---

# 37. Eliminación

Eliminar debe ser una operación reversible mediante undo.

No permitir operaciones que dejen referencias inválidas.

---

# 38. Undo / Redo

Implementar historial a nivel de `LabelDocument`.

Modelo conceptual:

```text
past
present
future
```

Registrar acciones significativas.

No registrar cada pixel intermedio durante drag.

Ejemplo:

```text
pointerdown
   ↓
drag...
drag...
drag...
   ↓
dragend
   ↓
1 entrada de historial
```

Esto es crítico para no saturar memoria.

---

# 39. Selección de Historial

Debe generarse snapshot al finalizar:

- mover;
- resize;
- rotate;
- crear;
- eliminar;
- duplicar;
- modificar propiedades;
- reordenar capas.

---

# 40. Restricción a los Límites de la Etiqueta

Por defecto, los elementos deben permanecer dentro de:

```text
0 <= x
0 <= y
x + width <= label.width
y + height <= label.height
```

Si se decide permitir desbordamiento en el futuro, deberá ser una opción explícita.

La Fase 2 debe limitar los elementos al área imprimible definida por el documento.

---

# 41. Status Bar

Mostrar información útil:

```text
Zoom
Unidad
DPI
X/Y del cursor
Tamaño de etiqueta
Número de elementos
```

Ejemplo:

```text
100% | mm | 203 DPI | 100 × 50 mm | 6 elements
```

---

# 42. Diseño Responsivo

La aplicación está orientada a escritorio.

No es necesario optimizar para teléfonos.

Debe funcionar correctamente en resoluciones desktop habituales.

Prioridad:

```text
1366 × 768
1920 × 1080
2560 × 1440
```

Los paneles deben poder colapsarse si el espacio resulta limitado.

---

# 43. Tema

Preparar la arquitectura visual para:

```text
light
dark
```

No es obligatorio finalizar ambos temas si retrasa la fase.

Pero evitar decisiones que hagan imposible agregar dark mode posteriormente.

---

# 44. Iconografía

Usar una librería consistente y ligera.

Opción recomendada:

```text
lucide-react
```

No mezclar múltiples librerías de iconos.

---

# 45. Seguridad del Renderer

La Fase 2 no puede debilitar la seguridad de la Fase 1.

Prohibido en renderer:

```ts
import { ipcRenderer } from 'electron'
```

Prohibido:

```ts
require('fs')
```

Prohibido:

```ts
require('child_process')
```

No habilitar:

```text
nodeIntegration
```

para solucionar problemas de frontend.

---

# 46. Comunicación con Main

El renderer debe utilizar únicamente APIs expuestas previamente mediante:

```text
window.labelAPI
```

u otras APIs explícitas aprobadas.

Esta fase debería necesitar poca comunicación con Main.

El canvas y el estado del editor deben funcionar casi totalmente dentro del renderer.

---

# 47. Pruebas Unitarias Obligatorias

## 47.1. Coordinates

Archivo sugerido:

```text
tests/renderer/coordinates.test.ts
```

Probar:

- mm -> canvas px;
- canvas px -> mm;
- distintos zooms;
- round-trip;
- valores decimales.

Ejemplo:

```text
25.4 mm @ 100% ≈ 96 px
```

---

## 47.2. Snapping

Probar:

- snap a grid;
- valores cercanos;
- valores fuera del threshold;
- borde izquierdo;
- borde superior;
- borde derecho;
- borde inferior.

---

## 47.3. History

Probar:

- push;
- undo;
- redo;
- limpiar future después de nueva acción;
- no generar historial redundante.

---

## 47.4. Store

Probar:

- selección;
- actualización de elemento;
- creación;
- eliminación;
- duplicado;
- lock;
- reorder;
- zoom.

---

## 47.5. Properties

Probar al menos:

- render de propiedades;
- cambio X;
- cambio Y;
- cambio Width;
- invalidación de valores no permitidos.

---

# 48. Pruebas que NO deben depender de Canvas real

La lógica matemática debe extraerse del canvas.

Ejemplo incorrecto:

```text
test -> montar Konva -> simular 20 eventos -> verificar snapping
```

Preferir:

```text
test -> snapPoint(...) -> resultado
```

Konva debe ser adaptador visual.

---

# 49. Performance

Evitar rerender completo del editor ante cada movimiento.

Utilizar:

- selectores de store;
- componentes pequeños;
- memoización donde sea justificable;
- eventos Konva;
- actualizaciones agrupadas.

No utilizar `React.memo` indiscriminadamente.

Medir antes de optimizar.

---

# 50. Reglas de Drag

Durante drag:

- puede actualizarse posición visual en Konva;
- no generar historial por frame;
- evitar operaciones pesadas;
- aplicar snapping de manera eficiente.

Al finalizar:

```text
dragend
```

persistir en modelo y registrar historial.

---

# 51. Reglas de Resize

Durante transformación:

- mostrar feedback visual;
- impedir dimensiones inválidas.

En:

```text
transformend
```

calcular:

```text
newWidth
newHeight
```

persistir propiedades reales.

Después:

```ts
node.scaleX(1)
node.scaleY(1)
```

para evitar acumulación de escala.

---

# 52. Reglas de Rotación

Utilizar snapping:

```text
0
90
180
270
```

No persistir:

```text
89.7
91.2
45
```

si el esquema no lo permite.

---

# 53. Rulers

Las reglas horizontales y verticales son deseables, pero no bloqueantes para la primera entrega de la Fase 2.

Si se implementan:

- deben reflejar unidades físicas;
- deben responder al zoom;
- deben responder al pan.

No mezclar la lógica de rulers con el modelo.

---

# 54. Guidelines de Selección

Opcionalmente mostrar:

- bounding box;
- dimensiones;
- guías;
- coordenadas.

No saturar la interfaz.

---

# 55. Creación Inicial del Documento

Si no existe documento cargado, generar uno de desarrollo.

Ejemplo:

```json
{
  "version": "1.0.0",
  "meta": {
    "title": "Untitled Label",
    "author": "",
    "created": "..."
  },
  "dimensions": {
    "width": 100,
    "height": 50,
    "unit": "mm",
    "dpi": 203
  },
  "elements": []
}
```

Debe pasar `LabelDocumentSchema`.

---

# 56. Validación del Documento

Cuando el renderer cree o modifique documentos, los datos deben conservar compatibilidad con el esquema.

No confiar únicamente en los formularios.

Las validaciones de dominio deben permanecer centralizadas.

---

# 57. Manejo de UUID

Todo nuevo elemento debe utilizar UUID v4 válido.

No generar IDs como:

```text
element-1
txt-3
rect-7
```

si el esquema exige UUID v4.

---

# 58. Manejo de Errores Visuales

Los errores de edición deben comunicarse sin bloquear la app.

Utilizar:

- mensajes inline;
- toast;
- estado invalid;
- tooltip cuando sea adecuado.

No utilizar `alert()` del navegador para UX habitual.

---

# 59. Notificaciones

Puede utilizarse una solución ligera propia o una librería específica si está justificada.

No incorporar una suite UI completa solo para toasts.

---

# 60. Animaciones Permitidas

Ejemplos:

```text
Properties panel enter/exit
Layers collapse
Modal enter/exit
Tooltip fade
Toolbar active indicator
Toast enter/exit
```

Duraciones recomendadas:

```text
100 ms – 250 ms
```

Evitar animaciones largas.

---

# 61. Animaciones Prohibidas

No animar de forma decorativa:

- cada movimiento de selección;
- cada punto del grid;
- cada resize;
- cada drag;
- coordenadas numéricas;
- redibujado completo de canvas.

---

# 62. Criterios de Aceptación Funcionales

La Fase 2 se considera funcionalmente terminada cuando:

1. La aplicación muestra un editor de etiquetas.
2. La etiqueta se representa con proporciones físicas correctas.
3. Se puede crear texto.
4. Se puede crear rectángulo.
5. Se puede crear línea.
6. Se puede seleccionar un elemento.
7. Se puede mover.
8. Se puede redimensionar.
9. Se puede rotar en cuadrantes permitidos.
10. Se puede eliminar.
11. Se puede duplicar.
12. Se puede bloquear.
13. Se puede cambiar orden de capas.
14. Existe panel de propiedades.
15. Existe toolbar.
16. Existe panel de capas.
17. Existe zoom.
18. Existe pan.
19. Existe grid.
20. Existe snapping.
21. Existe undo.
22. Existe redo.
23. El estado interno permanece en unidades físicas.
24. No se utilizan coordenadas visuales como fuente de verdad.

---

# 63. Criterios de Aceptación Visuales

La interfaz debe:

- usar Tailwind CSS;
- mantener jerarquía visual clara;
- utilizar espaciado consistente;
- mostrar estados hover;
- mostrar estados selected;
- mostrar estados disabled;
- tener tooltips;
- usar iconografía consistente;
- sentirse como una aplicación desktop profesional;
- incluir microinteracciones con Motion;
- respetar reduced motion.

---

# 64. Criterios de Aceptación Técnicos

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

No se permite finalizar la fase con:

- tests omitidos;
- `skip`;
- `only`;
- errores de tipos ignorados;
- `any` como parche;
- warnings relevantes no atendidos.

---

# 65. Criterios de Seguridad

Comprobar que:

```text
contextIsolation = true
nodeIntegration = false
sandbox = true
webSecurity = true
```

siguen activos.

El renderer no debe importar Electron.

No se debe ampliar innecesariamente `window.labelAPI`.

No se debe exponer IPC genérico.

---

# 66. Orden Secuencial de Implementación

El agente debe implementar la Fase 2 en este orden.

## Paso 1 — Revisar Fase 1

Antes de modificar código:

1. leer `AGENTS.md`;
2. leer `PHASE_1_SPEC.md`;
3. verificar estructura existente;
4. ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

La Fase 2 no debe comenzar si la Fase 1 está rota.

---

## Paso 2 — Preparar renderer

Configurar:

```text
React
ReactDOM
Tailwind CSS
Motion
Konva
react-konva
```

Si se adopta Zustand:

```text
zustand
```

Agregar únicamente dependencias necesarias.

---

## Paso 3 — Crear adaptadores de coordenadas

Implementar primero:

```text
src/renderer/canvas/coordinates.ts
```

junto con:

```text
tests/renderer/coordinates.test.ts
```

No continuar hasta pasar tests.

---

## Paso 4 — Crear store

Implementar:

```text
editor.store.ts
history.ts
selectors.ts
```

con pruebas.

---

## Paso 5 — Construir shell visual

Crear:

- top bar;
- toolbar;
- workspace;
- properties;
- layers;
- status bar.

Utilizar Tailwind.

Todavía sin interacción compleja.

---

## Paso 6 — Integrar Konva

Crear:

```text
EditorStage
EditorCanvas
ElementRenderer
```

Renderizar el documento.

---

## Paso 7 — Selección

Implementar:

- click;
- selected state;
- Transformer;
- properties synchronization.

---

## Paso 8 — Drag

Implementar movimiento físico y tests de conversión/snapping.

---

## Paso 9 — Resize y rotate

Persistir valores válidos en el documento.

---

## Paso 10 — Herramientas de creación

Agregar:

- text;
- rectangle;
- line.

---

## Paso 11 — Properties Panel

Permitir edición bidireccional.

---

## Paso 12 — Layers

Agregar:

- selección;
- orden;
- lock.

---

## Paso 13 — Zoom y pan

Añadir controles y atajos.

---

## Paso 14 — Grid y snapping

Implementar lógica pura y tests.

---

## Paso 15 — Undo / Redo

Agregar historial y atajos.

---

## Paso 16 — Animaciones y polish

Aplicar Motion únicamente después de que la funcionalidad principal esté estable.

No animar componentes críticos del canvas si afecta rendimiento.

---

## Paso 17 — Validación completa

Ejecutar:

```bash
npx tsc --noEmit
npx vitest run
```

Verificar manualmente:

- drag;
- resize;
- rotate;
- zoom;
- pan;
- grid;
- snapping;
- properties;
- layers;
- history.

---

# 67. Guía de Enseñanza para el Agente

El desarrollador desea aprender durante la implementación.

Antes de cada bloque importante, el agente debe explicar brevemente:

## Antes de Konva

Explicar:

- Scene Graph;
- Stage;
- Layer;
- Node;
- Transformer;
- diferencia entre estado React y estado Konva.

## Antes del sistema de coordenadas

Explicar:

- CSS DPI;
- DPI físico;
- zoom;
- viewport;
- coordenadas de documento;
- coordenadas de pantalla.

## Antes de Zustand

Explicar:

- estado global;
- selectores;
- rerenders;
- por qué no guardar nodos Konva.

## Antes de snapping

Explicar:

- cuantización visual;
- threshold;
- diferencia entre snapping y redondeo físico de impresión.

## Antes de history

Explicar:

- command/history pattern;
- snapshots;
- memoria;
- por qué no guardar cada frame de drag.

## Antes de Transformer

Explicar:

- scale;
- width/height;
- por qué normalizar `scaleX` y `scaleY`.

Las explicaciones deben ser breves y directamente relacionadas con el código que se va a implementar.

---

# 68. Reglas para Antigravity

El agente no debe escribir toda la Fase 2 en una sola operación.

Debe trabajar por bloques verificables.

Formato esperado:

```text
1. Explicación breve
2. Plan del bloque
3. Implementación
4. Tests
5. Resultado
6. Siguiente bloque
```

No avanzar si los tests del bloque actual fallan.

---

# 69. Reglas de No-Regresión

La Fase 2 no puede romper:

- schemas;
- converter;
- preload;
- IPC;
- seguridad;
- tests de Fase 1.

Después de cambios relevantes ejecutar la suite completa.

---

# 70. Decisiones que Requieren Documentación

Si durante la fase se decide:

- cambiar Konva;
- cambiar store;
- cambiar sistema de coordenadas;
- modificar `LabelDocument`;
- añadir propiedades incompatibles;
- incorporar una librería UI completa;
- introducir una dependencia grande;

documentar:

```text
Problema
Opciones
Decisión
Motivo
Consecuencias
```

---

# 71. Definition of Done de la Fase 2

La Fase 2 queda terminada únicamente cuando:

- existe un editor WYSIWYG operativo;
- las dimensiones físicas se conservan;
- el usuario puede crear elementos básicos;
- puede moverlos;
- puede redimensionarlos;
- puede rotarlos;
- puede editar propiedades;
- puede organizarlos por capas;
- puede bloquearlos;
- existe zoom;
- existe pan;
- existe grid;
- existe snapping;
- existe undo/redo;
- Tailwind está integrado correctamente;
- Motion está integrado sin afectar canvas;
- todos los tests pasan;
- TypeScript strict compila;
- la seguridad de Electron permanece intacta;
- no se ha implementado prematuramente código de impresión;
- no se ha implementado prematuramente el motor real de códigos de barras.

---

# 72. Resultado Esperado

Al finalizar esta fase, el usuario debe poder abrir la aplicación y utilizar una primera versión real del diseñador.

Debe poder observar algo conceptualmente equivalente a:

```text
┌─────────────────────────────────────────────────────────────┐
│ Untitled Label     Undo  Redo       Zoom: 100%             │
├──────┬────────────────────────────────────────┬─────────────┤
│      │                                        │             │
│  ↖   │        ┌──────────────────────┐        │ X: 10 mm    │
│  T   │        │                      │        │ Y: 10 mm    │
│  ▭   │        │    SAMPLE TEXT       │        │ W: 30 mm    │
│  ╱   │        │                      │        │ H: 8 mm     │
│  ✋  │        │        ▭             │        │ R: 0°       │
│      │        │                      │        │             │
│      │        └──────────────────────┘        │ Layers      │
│      │                                        │ Text        │
│      │                                        │ Rectangle   │
├──────┴────────────────────────────────────────┴─────────────┤
│ 100% | mm | 203 DPI | 100 × 50 mm | 2 elements            │
└─────────────────────────────────────────────────────────────┘
```

La aplicación todavía no necesita imprimir.

Pero el editor debe producir y mantener un `LabelDocument` válido que las siguientes fases puedan transformar en códigos de barras, ZPL, PDF y trabajos de impresión.

---

# 73. Instrucción Inicial para el Agente

Usar este mensaje al comenzar la fase:

> Revisa primero `AGENTS.md` y confirma que comprendes las reglas globales del proyecto.
>
> Después revisa `PHASE_1_SPEC.md` y verifica que la Fase 1 continúa pasando `npx tsc --noEmit` y `npx vitest run`.
>
> A continuación lee completamente `PHASE_2_SPEC.md`.
>
> No implementes toda la fase de una sola vez.
>
> Comienza por el Paso 2 y el Paso 3: prepara el renderer con las dependencias aprobadas y desarrolla el sistema puro de coordenadas físicas del canvas junto con sus pruebas.
>
> Antes de escribir código explícame brevemente la diferencia entre coordenadas físicas del documento, coordenadas visuales del canvas, DPI y zoom.
>
> No avances al siguiente bloque hasta que los tests del bloque actual estén en verde.
