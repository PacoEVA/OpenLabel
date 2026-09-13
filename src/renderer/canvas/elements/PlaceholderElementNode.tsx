import React from 'react';
import { Group, Rect, Text } from 'react-konva';
import { LabelElement } from '../../../core/schemas/label.schema';
import { mmToCanvasPx } from '../coordinates';

interface PlaceholderElementNodeProps {
  element: LabelElement;
  zoom: number;
  isSelected: boolean;
  onSelect: (multi: boolean) => void;
  onDragEnd: (newXmm: number, newYmm: number) => void;
}

export const PlaceholderElementNode: React.FC<PlaceholderElementNodeProps> = ({
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

  const label =
    element.type === 'barcode'
      ? `BARCODE: ${(element as any).data || ''}`
      : element.type === 'qrcode'
      ? `QR: ${(element as any).data || ''}`
      : `IMAGE: ${(element as any).format || 'placeholder'}`;

  return (
    <Group
      id={element.id}
      x={xPx}
      y={yPx}
      rotation={element.rotation}
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
    >
      {/* Dashed placeholder container */}
      <Rect
        width={widthPx}
        height={heightPx}
        fill="#f4f4f5"
        stroke="#71717a"
        strokeWidth={1}
        dash={[4, 4]}
      />
      <Text
        text={label}
        width={widthPx}
        height={heightPx}
        align="center"
        verticalAlign="middle"
        fontSize={Math.max(8, 10 * zoom)}
        fill="#52525b"
        fontFamily="monospace"
      />
    </Group>
  );
};
