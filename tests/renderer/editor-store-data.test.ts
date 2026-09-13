import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../src/renderer/store/editor.store';
import { CounterField, StaticField } from '../../src/core/data/data.schema';
import { TextElement } from '../../src/core/schemas/label.schema';

describe('Editor Store - Data Model & Preview (Bloque 9)', () => {
  beforeEach(() => {
    useEditorStore.getState().newDocument();
  });

  it('adds a field and marks document as dirty', () => {
    const store = useEditorStore.getState();
    expect(store.session.isDirty).toBe(false);

    const field: CounterField = {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf1',
      name: 'serial',
      type: 'counter',
      start: 1,
      step: 1,
      padding: 4,
    };

    const res = store.addField(field);
    expect(res.success).toBe(true);

    const updated = useEditorStore.getState();
    expect(updated.document.dataModel?.fields).toHaveLength(1);
    expect(updated.document.dataModel?.fields[0].name).toBe('serial');
    expect(updated.session.isDirty).toBe(true);
  });

  it('rejects adding duplicate field names', () => {
    const store = useEditorStore.getState();
    const field1: StaticField = {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf1',
      name: 'lot',
      type: 'static',
      value: 'L-1',
    };
    const field2: StaticField = {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf2',
      name: 'lot',
      type: 'static',
      value: 'L-2',
    };

    expect(store.addField(field1).success).toBe(true);
    const res = useEditorStore.getState().addField(field2);
    expect(res.success).toBe(false);
    expect(res.error).toContain("already exists");
  });

  it('supports undo and redo for field addition', () => {
    const field: StaticField = {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf1',
      name: 'company',
      type: 'static',
      value: 'Acme',
    };

    useEditorStore.getState().addField(field);
    expect(useEditorStore.getState().document.dataModel?.fields).toHaveLength(1);

    // Undo
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.dataModel?.fields).toHaveLength(0);

    // Redo
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document.dataModel?.fields).toHaveLength(1);
  });

  it('renames a field and updates element references atomically', () => {
    const field: CounterField = {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf1',
      name: 'sn',
      type: 'counter',
      start: 1,
      step: 1,
      padding: 3,
    };
    useEditorStore.getState().addField(field);

    const textElem: TextElement = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      type: 'text',
      x: 10,
      y: 10,
      width: 50,
      height: 10,
      rotation: 0,
      locked: false,
      content: 'SN: {sn}',
      fontSize: 12,
      fontFamily: 'monospace',
      bold: false,
      italic: false,
      align: 'left',
    };
    useEditorStore.getState().addElement(textElem);

    // Rename sn -> serial_number
    const res = useEditorStore.getState().renameField('sn', 'serial_number');
    expect(res.success).toBe(true);

    const updated = useEditorStore.getState();
    expect(updated.document.dataModel?.fields[0].name).toBe('serial_number');
    const elem = updated.document.elements[0] as TextElement;
    expect(elem.content).toBe('SN: {serial_number}');
  });

  it('blocks deletion of a field when it is currently used by elements', () => {
    const field: CounterField = {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf1',
      name: 'item_code',
      type: 'counter',
      start: 1,
      step: 1,
      padding: 3,
    };
    useEditorStore.getState().addField(field);

    const textElem: TextElement = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      type: 'text',
      x: 10,
      y: 10,
      width: 50,
      height: 10,
      rotation: 0,
      locked: false,
      content: 'Item: {item_code}',
      fontSize: 12,
      fontFamily: 'monospace',
      bold: false,
      italic: false,
      align: 'left',
    };
    useEditorStore.getState().addElement(textElem);

    // Attempt to delete in-use field
    const res = useEditorStore.getState().removeField(field.id);
    expect(res.success).toBe(false);
    expect(res.error).toContain('referenced by 1 element(s)');

    // Field should still be present
    expect(useEditorStore.getState().document.dataModel?.fields).toHaveLength(1);
  });

  it('allows deletion of unused fields and participates in history', () => {
    const field: StaticField = {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf1',
      name: 'unused_field',
      type: 'static',
      value: 'val',
    };
    useEditorStore.getState().addField(field);
    expect(useEditorStore.getState().document.dataModel?.fields).toHaveLength(1);

    const res = useEditorStore.getState().removeField(field.id);
    expect(res.success).toBe(true);
    expect(useEditorStore.getState().document.dataModel?.fields).toHaveLength(0);

    // Undo should restore the deleted field
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.dataModel?.fields).toHaveLength(1);
  });

  it('does NOT mark document dirty when navigating preview records', () => {
    // Initial saved state
    useEditorStore.getState().markSaved('/path/to/test.label');
    expect(useEditorStore.getState().session.isDirty).toBe(false);

    // Toggle preview active
    useEditorStore.getState().setPreviewActive(true);
    expect(useEditorStore.getState().session.isDirty).toBe(false);

    // Navigate records
    useEditorStore.getState().setPreviewRecordIndex(10);
    expect(useEditorStore.getState().previewRecordIndex).toBe(10);
    expect(useEditorStore.getState().session.isDirty).toBe(false);

    // Change preview runtime inputs
    useEditorStore.getState().setPreviewInputs({ sample: 'test' });
    expect(useEditorStore.getState().session.isDirty).toBe(false);

    // Deactivate preview
    useEditorStore.getState().setPreviewActive(false);
    expect(useEditorStore.getState().session.isDirty).toBe(false);
  });
});
