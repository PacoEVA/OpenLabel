import React, { useRef, useEffect, useMemo } from 'react';
import { Stage, Layer, Transformer } from 'react-konva';
import Konva from 'konva';
import { useEditorStore } from '../store/editor.store';
import {
  selectDocument,
  selectElements,
  selectSelectedElementIds,
  selectZoom,
  selectActiveTool,
  selectGrid,
  selectSnap,
} from '../store/selectors';
import { ElementRenderer } from './elements/ElementRenderer';
import { mmToCanvasPx, canvasPxToMm } from './coordinates';
import { snapPointToBoundsAndGrid } from './snapping';
import { LabelElement } from '../../core/schemas/label.schema';
import { generateRecords } from '../../core/data/batch-generator';
import { resolveDocument } from '../../core/data/document-resolver';

export const EditorStage: React.FC = () => {
  const document = useEditorStore(selectDocument);
  const elements = useEditorStore(selectElements);
  const selectedIds = useEditorStore(selectSelectedElementIds);
  const zoom = useEditorStore(selectZoom);
  const activeTool = useEditorStore(selectActiveTool);

  const isPreviewActive = useEditorStore((s) => s.isPreviewActive);
  const previewRecordIndex = useEditorStore((s) => s.previewRecordIndex);
  const previewInputs = useEditorStore((s) => s.previewInputs);

  const selectElement = useEditorStore((s) => s.selectElement);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const updateElement = useEditorStore((s) => s.updateElement);
  const addElement = useEditorStore((s) => s.addElement);

  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);

  const stageWidth = mmToCanvasPx(document.dimensions.width, zoom);
  const stageHeight = mmToCanvasPx(document.dimensions.height, zoom);

  // Compute rendered elements (resolving placeholders dynamically if preview mode is active)
  const renderedElements = useMemo(() => {
    if (!isPreviewActive || !document.dataModel || document.dataModel.fields.length === 0) {
      return elements;
    }

    const genResult = generateRecords({
      fields: document.dataModel.fields,
      count: previewRecordIndex + 1,
      context: { now: new Date() },
      userInputs: previewInputs,
    });

    if (!genResult.success || !genResult.records[previewRecordIndex]) {
      return elements;
    }

    const resolved = resolveDocument(document, genResult.records[previewRecordIndex]);
    return resolved.success ? resolved.document.elements : elements;
  }, [isPreviewActive, previewRecordIndex, previewInputs, document, elements]);

  // Synchronize Konva.Transformer with currently selected element
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;

    if (selectedIds.length === 1) {
      const selectedNode = stageRef.current.findOne(`#${selectedIds[0]}`);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer()?.batchDraw();
        return;
      }
    }
    transformerRef.current.nodes([]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedIds, elements, zoom]);

  // Handle click on empty background
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    // Check if user clicked the stage itself or the background layer
    if (e.target === stageRef.current || e.target.name() === 'background') {
      if (activeTool === 'select') {
        clearSelection();
        return;
      }

      // If a creation tool is active, create element at clicked position
      const pointer = stageRef.current?.getPointerPosition();
      if (!pointer) return;

      const clickXmm = canvasPxToMm(pointer.x, zoom);
      const clickYmm = canvasPxToMm(pointer.y, zoom);
      const newId = crypto.randomUUID();

      if (activeTool === 'text') {
        const newText: LabelElement = {
          id: newId,
          type: 'text',
          x: Math.max(0, clickXmm),
          y: Math.max(0, clickYmm),
          width: 30,
          height: 8,
          rotation: 0,
          locked: false,
          content: 'Sample Text',
          fontSize: 12,
          fontFamily: 'monospace',
          bold: false,
          italic: false,
          align: 'left',
        };
        addElement(newText);
      } else if (activeTool === 'rectangle') {
        const newRect: LabelElement = {
          id: newId,
          type: 'rectangle',
          x: Math.max(0, clickXmm),
          y: Math.max(0, clickYmm),
          width: 40,
          height: 20,
          rotation: 0,
          locked: false,
          strokeWidth: 1,
          stroke: '#000000',
          cornerRadius: 0,
        };
        addElement(newRect);
      } else if (activeTool === 'line') {
        const newLine: LabelElement = {
          id: newId,
          type: 'line',
          x: Math.max(0, clickXmm),
          y: Math.max(0, clickYmm),
          width: 40,
          height: 1,
          rotation: 0,
          locked: false,
          strokeWidth: 1,
          stroke: '#000000',
          orientation: 'horizontal',
        };
        addElement(newLine);
      } else if (activeTool === 'barcode') {
        const newBarcode: LabelElement = {
          id: newId,
          type: 'barcode',
          x: Math.max(0, clickXmm),
          y: Math.max(0, clickYmm),
          width: 50,
          height: 25,
          rotation: 0,
          locked: false,
          symbology: 'code128',
          data: '12345678',
          narrowBarRatio: 2,
          displayValue: true,
        };
        addElement(newBarcode);
      } else if (activeTool === 'qrcode') {
        const newQr: LabelElement = {
          id: newId,
          type: 'qrcode',
          x: Math.max(0, clickXmm),
          y: Math.max(0, clickYmm),
          width: 25,
          height: 25,
          rotation: 0,
          locked: false,
          data: 'https://openlabels.io',
          errorCorrection: 'M',
        };
        addElement(newQr);
      }
    }
  };

  const grid = useEditorStore(selectGrid);
  const snap = useEditorStore(selectSnap);

  // Handle DragEnd: converts visual px back to physical mm and commits with history snapshot
  const handleElementDragEnd = (id: string, newPxX: number, newPxY: number) => {
    const newMmX = canvasPxToMm(newPxX, zoom);
    const newMmY = canvasPxToMm(newPxY, zoom);

    const element = elements.find((el) => el.id === id);
    if (!element) return;

    // Apply snapping to grid and document borders
    const snapped = snapPointToBoundsAndGrid(
      { x: newMmX, y: newMmY },
      { width: element.width, height: element.height },
      { width: document.dimensions.width, height: document.dimensions.height },
      grid.sizeMm,
      snap.thresholdPx,
      zoom,
      snap.enabled,
      grid.enabled
    );

    updateElement(id, { x: snapped.point.x, y: snapped.point.y }, true);
  };

  // Handle TransformEnd: normalizes scaleX/scaleY to 1 and quantizes rotation to 90°
  const handleTransformEnd = () => {
    const node = transformerRef.current?.nodes()[0];
    if (!node) return;

    const id = node.id();
    const element = elements.find((el) => el.id === id);
    if (!element) return;

    // Calculate actual new size
    const newWidthPx = Math.max(5, node.width() * node.scaleX());
    const newHeightPx = Math.max(5, node.height() * node.scaleY());

    // Reset scales to prevent compounding deformation
    node.scaleX(1);
    node.scaleY(1);

    const newWidthMm = canvasPxToMm(newWidthPx, zoom);
    const newHeightMm = canvasPxToMm(newHeightPx, zoom);
    const newMmX = canvasPxToMm(node.x(), zoom);
    const newMmY = canvasPxToMm(node.y(), zoom);

    // Quantize rotation to orthogonal quadrants: 0, 90, 180, 270
    const rawRot = ((node.rotation() % 360) + 360) % 360;
    const quadrant = (Math.round(rawRot / 90) * 90) % 360 as 0 | 90 | 180 | 270;
    node.rotation(quadrant);

    let finalWidthMm = newWidthMm;
    let finalHeightMm = newHeightMm;
    if (element.type === 'qrcode') {
      const side = Math.max(newWidthMm, newHeightMm);
      finalWidthMm = side;
      finalHeightMm = side;
    }

    updateElement(
      id,
      {
        x: Math.max(0, newMmX),
        y: Math.max(0, newMmY),
        width: finalWidthMm,
        height: finalHeightMm,
        rotation: quadrant,
      },
      true
    );
  };

  const selectedElement = selectedIds.length === 1 ? elements.find((el) => el.id === selectedIds[0]) : undefined;

  return (
    <Stage
      ref={stageRef}
      width={stageWidth}
      height={stageHeight}
      onClick={handleStageClick}
      onTap={handleStageClick}
    >
      <Layer>
        {/* Render all elements in document layer order */}
        {renderedElements.map((el) => (
          <ElementRenderer
            key={el.id}
            element={el}
            zoom={zoom}
            isSelected={!isPreviewActive && selectedIds.includes(el.id)}
            onSelect={(multi) => (!isPreviewActive ? selectElement(el.id, multi) : undefined)}
            onDragEnd={(newX, newY) => (!isPreviewActive ? handleElementDragEnd(el.id, newX, newY) : undefined)}
          />
        ))}

        {/* Transformer for selected element (hidden in preview mode) */}
        {!isPreviewActive && (
          <Transformer
            ref={transformerRef}
            rotateEnabled={true}
            rotationSnaps={[0, 90, 180, 270]}
            keepRatio={selectedElement?.type === 'qrcode'}
            ignoreStroke={true}
            boundBoxFunc={(oldBox, newBox) => {
              // Disallow negative or microscopic dimensions
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
            onTransformEnd={handleTransformEnd}
          />
        )}
      </Layer>
    </Stage>
  );
};
