import { EditorState } from './editor.store';
import { canUndo, canRedo } from './history';
import { LabelDocument, LabelDimensions, LabelElement } from '../../core/schemas/label.schema';
import { Point } from '../canvas/coordinates';

/**
 * OpenLabels - Atomic Store Selectors
 * Ensures fine-grained subscription to avoid unnecessary re-renders in the UI.
 */

export const selectDocument = (state: EditorState): LabelDocument => state.document;

export const selectDimensions = (state: EditorState): LabelDimensions => state.document.dimensions;

export const selectElements = (state: EditorState): LabelElement[] => state.document.elements;

export const selectSelectedElementIds = (state: EditorState): string[] => state.selectedElementIds;

export const selectSelectedElements = (state: EditorState): LabelElement[] =>
  state.document.elements.filter((el) => state.selectedElementIds.includes(el.id));

export const selectFirstSelectedElement = (state: EditorState): LabelElement | undefined => {
  if (state.selectedElementIds.length === 0) return undefined;
  const firstId = state.selectedElementIds[0];
  return state.document.elements.find((el) => el.id === firstId);
};

export const selectIsElementSelected =
  (id: string) =>
  (state: EditorState): boolean =>
    state.selectedElementIds.includes(id);

export const selectActiveTool = (state: EditorState): EditorState['activeTool'] => state.activeTool;

export const selectZoom = (state: EditorState): number => state.zoom;

export const selectViewport = (state: EditorState): Point => state.viewport;

export const selectGrid = (state: EditorState): EditorState['grid'] => state.grid;

export const selectSnap = (state: EditorState): EditorState['snap'] => state.snap;

export const selectCanUndo = (state: EditorState): boolean => canUndo(state.history);

export const selectCanRedo = (state: EditorState): boolean => canRedo(state.history);
