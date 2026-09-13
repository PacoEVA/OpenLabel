import React from 'react';
import { Text as KonvaText } from 'react-konva';
import { TextElement } from '../../../core/schemas/label.schema';
import { mmToCanvasPx } from '../coordinates';

interface TextElementNodeProps {
  element: TextElement;
  zoom: number;
  isSelected: boolean;
  onSelect: (multi: boolean) => void;
  onDragEnd: (newXmm: number, newYmm: number) => void;
}

export const TextElementNode: React.FC<TextElementNodeProps> = ({
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
  const fontSizePx = element.fontSize * (96 / 72) * zoom; // Standard pt to px scaled by zoom

  let fontStyle = 'normal';
  if (element.bold && element.italic) fontStyle = 'bold italic';
  else if (element.bold) fontStyle = 'bold';
  else if (element.italic) fontStyle = 'italic';

  return (
    <KonvaText
      id={element.id}
      x={xPx}
      y={yPx}
      width={widthPx}
      height={heightPx}
      rotation={element.rotation}
      text={element.content}
      fontSize={fontSizePx}
      fontFamily={element.fontFamily || 'monospace'}
      fontStyle={fontStyle}
      align={element.align}
      verticalAlign="middle"
      fill="#000000"
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
