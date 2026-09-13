import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../src/renderer/store/editor.store';
import { TextElement } from '../../src/core/schemas/label.schema';

describe('DocumentSession & Dirty State Tracking', () => {
  beforeEach(() => {
    useEditorStore.getState().newDocument();
  });

  it('initializes with a clean session and null filePath', () => {
    const { session } = useEditorStore.getState();
    expect(session.isDirty).toBe(false);
    expect(session.filePath).toBeNull();
    expect(session.displayName).toBe('Untitled Label');
    expect(session.isMigrated).toBe(false);
  });

  it('marks dirty when an element is added', () => {
    const textEl: TextElement = {
      id: 'el-1',
      type: 'text',
      x: 10,
      y: 10,
      width: 30,
      height: 10,
      rotation: 0,
      locked: false,
      content: 'Sample',
      fontSize: 12,
      fontFamily: 'Roboto',
      bold: false,
      italic: false,
      align: 'left',
    };

    useEditorStore.getState().addElement(textEl);

    const { session } = useEditorStore.getState();
    expect(session.isDirty).toBe(true);
    expect(session.displayName).toBe('Untitled Label');
  });

  it('marks clean after markSaved is called', () => {
    const textEl: TextElement = {
      id: 'el-1',
      type: 'text',
      x: 10,
      y: 10,
      width: 30,
      height: 10,
      rotation: 0,
      locked: false,
      content: 'Sample',
      fontSize: 12,
      fontFamily: 'Roboto',
      bold: false,
      italic: false,
      align: 'left',
    };

    useEditorStore.getState().addElement(textEl);
    expect(useEditorStore.getState().session.isDirty).toBe(true);

    useEditorStore.getState().markSaved('/labels/shipping.label');

    const { session } = useEditorStore.getState();
    expect(session.isDirty).toBe(false);
    expect(session.filePath).toBe('/labels/shipping.label');
    expect(session.displayName).toBe('shipping.label');
    expect(session.lastSavedAt).toBeDefined();
  });

  it('handles Save + Undo correctly (undo after save marks dirty)', () => {
    // 1. Add element 1
    const el1: TextElement = {
      id: 'el-1',
      type: 'text',
      x: 10,
      y: 10,
      width: 20,
      height: 10,
      rotation: 0,
      locked: false,
      content: 'First',
      fontSize: 10,
      fontFamily: 'Roboto',
      bold: false,
      italic: false,
      align: 'left',
    };
    useEditorStore.getState().addElement(el1);

    // 2. Save
    useEditorStore.getState().markSaved('/labels/test.label');
    expect(useEditorStore.getState().session.isDirty).toBe(false);

    // 3. Edit (Add element 2)
    const el2: TextElement = {
      id: 'el-2',
      type: 'text',
      x: 20,
      y: 20,
      width: 20,
      height: 10,
      rotation: 0,
      locked: false,
      content: 'Second',
      fontSize: 10,
      fontFamily: 'Roboto',
      bold: false,
      italic: false,
      align: 'left',
    };
    useEditorStore.getState().addElement(el2);
    expect(useEditorStore.getState().session.isDirty).toBe(true);

    // 4. Undo -> reverts back to having only el1, which matches saved snapshot!
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().session.isDirty).toBe(false);

    // 5. Undo again -> reverts back to empty doc, which DIFFERS from saved snapshot!
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().session.isDirty).toBe(true);
  });

  it('does NOT mark dirty for transient UI actions (zoom, pan, selection, tool)', () => {
    expect(useEditorStore.getState().session.isDirty).toBe(false);

    useEditorStore.getState().setZoom(2.0);
    expect(useEditorStore.getState().session.isDirty).toBe(false);

    useEditorStore.getState().panViewport({ x: 50, y: 50 });
    expect(useEditorStore.getState().session.isDirty).toBe(false);

    useEditorStore.getState().setActiveTool('rectangle');
    expect(useEditorStore.getState().session.isDirty).toBe(false);

    useEditorStore.getState().setGrid({ enabled: false });
    expect(useEditorStore.getState().session.isDirty).toBe(false);

    useEditorStore.getState().setSnap({ enabled: false });
    expect(useEditorStore.getState().session.isDirty).toBe(false);

    useEditorStore.getState().selectElement('non-existent');
    expect(useEditorStore.getState().session.isDirty).toBe(false);

    useEditorStore.getState().clearSelection();
    expect(useEditorStore.getState().session.isDirty).toBe(false);
  });

  it('marks dirty when dimensions or meta are modified', () => {
    expect(useEditorStore.getState().session.isDirty).toBe(false);

    useEditorStore.getState().updateDimensions({ width: 150 });
    expect(useEditorStore.getState().session.isDirty).toBe(true);

    useEditorStore.getState().markSaved('/labels/dim.label');
    expect(useEditorStore.getState().session.isDirty).toBe(false);

    useEditorStore.getState().updateMeta({ title: 'New Title' });
    expect(useEditorStore.getState().session.isDirty).toBe(true);
    expect(useEditorStore.getState().session.displayName).toBe('dim.label');
  });
});
