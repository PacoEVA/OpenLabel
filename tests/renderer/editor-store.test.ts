import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore, createDefaultDocument } from '../../src/renderer/store/editor.store';
import {
  selectElements,
  selectSelectedElements,
  selectFirstSelectedElement,
  selectZoom,
  selectCanUndo,
  selectCanRedo,
} from '../../src/renderer/store/selectors';
import { TextElement, RectangleElement } from '../../src/core/schemas/label.schema';

describe('Editor Zustand Store', () => {
  const sampleText: TextElement = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    type: 'text',
    x: 10,
    y: 10,
    width: 30,
    height: 10,
    rotation: 0,
    locked: false,
    content: 'Hello World',
    fontSize: 12,
    fontFamily: 'monospace',
    bold: false,
    italic: false,
    align: 'left',
  };

  const sampleRect: RectangleElement = {
    id: '123e4567-e89b-12d3-a456-426614174002',
    type: 'rectangle',
    x: 20,
    y: 20,
    width: 40,
    height: 20,
    rotation: 0,
    locked: false,
    strokeWidth: 1,
    stroke: '#000000',
    cornerRadius: 0,
  };

  beforeEach(() => {
    // Reset store with a fresh default document
    useEditorStore.getState().setDocument(createDefaultDocument());
  });

  describe('Document & Element CRUD', () => {
    it('should initialize with an empty elements array in default document', () => {
      const state = useEditorStore.getState();
      expect(selectElements(state)).toEqual([]);
      expect(state.document.dimensions.width).toBe(100);
      expect(state.document.dimensions.height).toBe(50);
    });

    it('should add an element, select it, switch tool to select, and record history', () => {
      useEditorStore.getState().setActiveTool('text');
      useEditorStore.getState().addElement(sampleText);

      const state = useEditorStore.getState();
      expect(selectElements(state).length).toBe(1);
      expect(state.selectedElementIds).toEqual([sampleText.id]);
      expect(state.activeTool).toBe('select');
      expect(selectCanUndo(state)).toBe(true);
    });

    it('should update element properties correctly', () => {
      useEditorStore.getState().addElement(sampleText);
      useEditorStore.getState().updateElement(sampleText.id, { x: 25, y: 15 }, true);

      const state = useEditorStore.getState();
      const updated = state.document.elements[0];
      expect(updated.x).toBe(25);
      expect(updated.y).toBe(15);
    });

    it('should prevent updating locked elements unless changing locked flag', () => {
      useEditorStore.getState().addElement({ ...sampleText, locked: true });
      useEditorStore.getState().updateElement(sampleText.id, { x: 50 });

      const state = useEditorStore.getState();
      expect(state.document.elements[0].x).toBe(10); // unchanged

      // Unlocking is allowed
      useEditorStore.getState().updateElement(sampleText.id, { locked: false });
      expect(useEditorStore.getState().document.elements[0].locked).toBe(false);
    });

    it('should remove element and update selection', () => {
      useEditorStore.getState().addElement(sampleText);
      useEditorStore.getState().addElement(sampleRect);
      expect(useEditorStore.getState().document.elements.length).toBe(2);

      useEditorStore.getState().removeElement(sampleText.id);
      const state = useEditorStore.getState();
      expect(state.document.elements.length).toBe(1);
      expect(state.document.elements[0].id).toBe(sampleRect.id);
      expect(state.selectedElementIds).not.toContain(sampleText.id);
    });

    it('should duplicate an element with a new UUID and +2mm offset', () => {
      useEditorStore.getState().addElement(sampleText);
      useEditorStore.getState().duplicateElement(sampleText.id);

      const state = useEditorStore.getState();
      expect(state.document.elements.length).toBe(2);

      const duplicated = state.document.elements[1];
      expect(duplicated.id).not.toBe(sampleText.id);
      expect(duplicated.x).toBe(sampleText.x + 2);
      expect(duplicated.y).toBe(sampleText.y + 2);
      expect(duplicated.locked).toBe(false);
      expect(state.selectedElementIds).toEqual([duplicated.id]);
    });

    it('should toggle lock status', () => {
      useEditorStore.getState().addElement(sampleText);
      expect(useEditorStore.getState().document.elements[0].locked).toBe(false);

      useEditorStore.getState().toggleLockElement(sampleText.id);
      expect(useEditorStore.getState().document.elements[0].locked).toBe(true);

      useEditorStore.getState().toggleLockElement(sampleText.id);
      expect(useEditorStore.getState().document.elements[0].locked).toBe(false);
    });
  });

  describe('Selection Management', () => {
    it('should select single element and clear selection', () => {
      useEditorStore.getState().addElement(sampleText);
      useEditorStore.getState().addElement(sampleRect);

      useEditorStore.getState().selectElement(sampleText.id);
      expect(useEditorStore.getState().selectedElementIds).toEqual([sampleText.id]);

      useEditorStore.getState().clearSelection();
      expect(useEditorStore.getState().selectedElementIds).toEqual([]);
    });

    it('should support multi-selection toggle', () => {
      useEditorStore.getState().addElement(sampleText);
      useEditorStore.getState().addElement(sampleRect);

      useEditorStore.getState().selectElement(sampleText.id, false);
      useEditorStore.getState().selectElement(sampleRect.id, true); // multi

      const state = useEditorStore.getState();
      expect(state.selectedElementIds).toEqual([sampleText.id, sampleRect.id]);
      expect(selectSelectedElements(state).length).toBe(2);

      // Toggle off sampleText
      useEditorStore.getState().selectElement(sampleText.id, true);
      expect(useEditorStore.getState().selectedElementIds).toEqual([sampleRect.id]);
    });

    it('should retrieve first selected element correctly', () => {
      useEditorStore.getState().addElement(sampleText);
      useEditorStore.getState().addElement(sampleRect);
      useEditorStore.getState().setSelectedElements([sampleRect.id, sampleText.id]);

      const first = selectFirstSelectedElement(useEditorStore.getState());
      expect(first?.id).toBe(sampleRect.id);
    });
  });

  describe('Layer Reordering', () => {
    it('should bring forward, send backward, bring to front, and send to back', () => {
      const el1 = { ...sampleText, id: '11111111-1111-4111-a111-111111111111' };
      const el2 = { ...sampleText, id: '22222222-2222-4222-a222-222222222222' };
      const el3 = { ...sampleText, id: '33333333-3333-4333-a333-333333333333' };

      useEditorStore.getState().addElement(el1);
      useEditorStore.getState().addElement(el2);
      useEditorStore.getState().addElement(el3);

      // Initial order: [el1, el2, el3]
      // Send el3 to back -> [el3, el1, el2]
      useEditorStore.getState().reorderElement(el3.id, 'sendToBack');
      let order = useEditorStore.getState().document.elements.map((e) => e.id);
      expect(order).toEqual([el3.id, el1.id, el2.id]);

      // Bring el3 forward -> [el1, el3, el2]
      useEditorStore.getState().reorderElement(el3.id, 'bringForward');
      order = useEditorStore.getState().document.elements.map((e) => e.id);
      expect(order).toEqual([el1.id, el3.id, el2.id]);

      // Send el3 backward -> [el3, el1, el2]
      useEditorStore.getState().reorderElement(el3.id, 'sendBackward');
      order = useEditorStore.getState().document.elements.map((e) => e.id);
      expect(order).toEqual([el3.id, el1.id, el2.id]);

      // Bring el3 to front -> [el1, el2, el3]
      useEditorStore.getState().reorderElement(el3.id, 'bringToFront');
      order = useEditorStore.getState().document.elements.map((e) => e.id);
      expect(order).toEqual([el1.id, el2.id, el3.id]);
    });
  });

  describe('Zoom & Viewport', () => {
    it('should clamp zoom within [0.25, 4.0]', () => {
      useEditorStore.getState().setZoom(0.1);
      expect(selectZoom(useEditorStore.getState())).toBe(0.25);

      useEditorStore.getState().setZoom(5.0);
      expect(selectZoom(useEditorStore.getState())).toBe(4.0);

      useEditorStore.getState().setZoom(1.5);
      expect(selectZoom(useEditorStore.getState())).toBe(1.5);
    });

    it('should pan viewport and reset view', () => {
      useEditorStore.getState().setViewport({ x: 50, y: 50 });
      useEditorStore.getState().panViewport({ x: 10, y: -20 });

      expect(useEditorStore.getState().viewport).toEqual({ x: 60, y: 30 });

      useEditorStore.getState().resetView();
      expect(useEditorStore.getState().zoom).toBe(1.0);
      expect(useEditorStore.getState().viewport).toEqual({ x: 0, y: 0 });
    });
  });

  describe('Undo / Redo integration in store', () => {
    it('should undo element addition and redo it cleanly', () => {
      expect(selectCanUndo(useEditorStore.getState())).toBe(false);

      useEditorStore.getState().addElement(sampleText);
      expect(selectElements(useEditorStore.getState()).length).toBe(1);
      expect(selectCanUndo(useEditorStore.getState())).toBe(true);

      // Undo
      useEditorStore.getState().undo();
      expect(selectElements(useEditorStore.getState()).length).toBe(0);
      expect(selectCanRedo(useEditorStore.getState())).toBe(true);

      // Redo
      useEditorStore.getState().redo();
      expect(selectElements(useEditorStore.getState()).length).toBe(1);
      expect(selectElements(useEditorStore.getState())[0].id).toBe(sampleText.id);
    });
  });
});
