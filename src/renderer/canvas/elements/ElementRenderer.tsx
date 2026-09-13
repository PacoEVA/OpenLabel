import React from 'react';
import {
  LabelElement,
  TextElement,
  RectangleElement,
  LineElement,
} from '../../../core/schemas/label.schema';
import { TextElementNode } from './TextElementNode';
import { RectangleElementNode } from './RectangleElementNode';
import { LineElementNode } from './LineElementNode';
import { PlaceholderElementNode } from './PlaceholderElementNode';

interface ElementRendererProps {
  element: LabelElement;
  zoom: number;
  isSelected: boolean;
  onSelect: (multi: boolean) => void;
  onDragEnd: (newXmm: number, newYmm: number) => void;
}

export const ElementRenderer: React.FC<ElementRendererProps> = ({
  element,
  zoom,
  isSelected,
  onSelect,
  onDragEnd,
}) => {
  switch (element.type) {
    case 'text':
      return (
        <TextElementNode
          element={element as TextElement}
          zoom={zoom}
          isSelected={isSelected}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
        />
      );
    case 'rectangle':
      return (
        <RectangleElementNode
          element={element as RectangleElement}
          zoom={zoom}
          isSelected={isSelected}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
        />
      );
    case 'line':
      return (
        <LineElementNode
          element={element as LineElement}
          zoom={zoom}
          isSelected={isSelected}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
        />
      );
    case 'barcode':
    case 'qrcode':
    case 'image':
    default:
      return (
        <PlaceholderElementNode
          element={element}
          zoom={zoom}
          isSelected={isSelected}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
        />
      );
  }
};
