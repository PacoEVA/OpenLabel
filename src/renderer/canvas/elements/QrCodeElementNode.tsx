import React, { useState, useEffect } from 'react';
import { Group, Rect, Text, Image as KonvaImage } from 'react-konva';
import { QrCodeElement } from '../../../core/schemas/label.schema';
import { mmToCanvasPx } from '../coordinates';
import { getBarcodeImage } from '../../barcodes/barcode-cache';

interface QrCodeElementNodeProps {
  element: QrCodeElement;
  zoom: number;
  isSelected: boolean;
  onSelect: (multi: boolean) => void;
  onDragEnd: (newXmm: number, newYmm: number) => void;
}

export const QrCodeElementNode: React.FC<QrCodeElementNodeProps> = ({
  element,
  zoom,
  isSelected,
  onSelect,
  onDragEnd,
}) => {
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [, setTrigger] = useState(0);

  const xPx = mmToCanvasPx(element.x, zoom);
  const yPx = mmToCanvasPx(element.y, zoom);
  const widthPx = mmToCanvasPx(element.width, zoom);
  const heightPx = mmToCanvasPx(element.height, zoom);

  // Preserve 1:1 aspect ratio to avoid 2D matrix distortion
  const sidePx = Math.min(widthPx, heightPx);
  const offsetX = (widthPx - sidePx) / 2;
  const offsetY = (heightPx - sidePx) / 2;

  const { image, result } = getBarcodeImage(
    {
      symbology: 'qrcode',
      data: element.data,
      errorCorrection: element.errorCorrection,
    },
    () => {
      setTrigger((prev) => prev + 1);
    }
  );

  useEffect(() => {
    if (image && image.complete && image.naturalWidth > 0) {
      setImageObj(image);
    } else if (image) {
      const handleLoad = () => setImageObj(image);
      image.addEventListener('load', handleLoad);
      return () => {
        image.removeEventListener('load', handleLoad);
      };
    }
  }, [image, element.data, element.errorCorrection]);

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
      {result.success ? (
        imageObj ? (
          <KonvaImage
            image={imageObj}
            x={offsetX}
            y={offsetY}
            width={sidePx}
            height={sidePx}
          />
        ) : (
          <Rect
            width={widthPx}
            height={heightPx}
            fill="#f8fafc"
            stroke="#cbd5e1"
            strokeWidth={1}
            dash={[2, 2]}
          />
        )
      ) : (
        <Group>
          <Rect
            width={widthPx}
            height={heightPx}
            fill="#fff1f2"
            stroke="#e11d48"
            strokeWidth={1}
            dash={[4, 4]}
          />
          <Text
            text="⚠ Invalid QR CODE"
            x={4}
            y={Math.max(2, heightPx / 2 - 14)}
            width={Math.max(10, widthPx - 8)}
            align="center"
            fontSize={Math.max(9, 11 * zoom)}
            fontStyle="bold"
            fill="#be123c"
            fontFamily="sans-serif"
          />
          <Text
            text={result.error}
            x={4}
            y={Math.max(16, heightPx / 2 + 2)}
            width={Math.max(10, widthPx - 8)}
            align="center"
            fontSize={Math.max(7, 9 * zoom)}
            fill="#9f1239"
            fontFamily="sans-serif"
            wrap="word"
          />
        </Group>
      )}
    </Group>
  );
};
