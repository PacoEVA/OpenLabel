import React from 'react';
import { Rect as KonvaRect } from 'react-konva';
import { RectangleElement } from '../../../core/schemas/label.schema';
import { mmToCanvasPx } from '../coordinates';

interface RectangleElementNodeProps {
  element: RectangleElement;
  zoom: number;
  isSelected: boolean;
  onSelect: (multi: boolean) => void;
  onDragEnd: (newXmm: number, newYmm: number) => void;
}

export const RectangleElementNode: React.FC<RectangleElementNodeProps> = ({
  element,
  zoom,
  isSelected,
  onSelect,
  onDragEnd,
}) => {
  const xPx = mmToCanvasPx(element.x, zoom);
  const yPx = mmToCanvasPx(element.y, zoom);
  const widthPx = mmToCanvasPx(element.width, zoom);
  const heightPx = mmToCanvasPx(element.height, zoom);
  const strokeWidthPx = Math.max(1, (element.strokeWidth ?? 1) * zoom);
  const cornerRadiusPx = (element.cornerRadius ?? 0) * zoom;

  return (
    <KonvaRect
      id={element.id}
      x={xPx}
      y={yPx}
      width={widthPx}
      height={heightPx}
      rotation={element.rotation}
      fill={element.fill || undefined}
      stroke={element.stroke || '#000000'}
      strokeWidth={strokeWidthPx}
      cornerRadius={cornerRadiusPx}
      draggable={!element.locked}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect(false);
      }}
      onDragEnd={(e) => {
        const node = e.target;
        onDragEnd(node.x(), node.y());
      }}
    />
  );
};
