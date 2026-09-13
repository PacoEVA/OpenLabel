import React from 'react';
import { Line as KonvaLine } from 'react-konva';
import { LineElement } from '../../../core/schemas/label.schema';
import { mmToCanvasPx } from '../coordinates';

interface LineElementNodeProps {
  element: LineElement;
  zoom: number;
  isSelected: boolean;
  onSelect: (multi: boolean) => void;
  onDragEnd: (newXmm: number, newYmm: number) => void;
}

export const LineElementNode: React.FC<LineElementNodeProps> = ({
  element,
  zoom,
  isSelected,
  onSelect,
  onDragEnd,
}) => {
  const xPx = mmToCanvasPx(element.x, zoom);
  const yPx = mmToCanvasPx(element.y, zoom);
  const widthPx = mmToCanvasPx(element.width, zoom);
  const strokeWidthPx = Math.max(1, (element.strokeWidth ?? 1) * zoom);

  // Line points from (0,0) to (widthPx, 0)
  const points = [0, 0, widthPx, 0];

  return (
    <KonvaLine
      id={element.id}
      x={xPx}
      y={yPx}
      points={points}
      rotation={element.rotation}
      stroke={element.stroke || '#000000'}
      strokeWidth={strokeWidthPx}
      hitStrokeWidth={Math.max(10, strokeWidthPx)}
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
