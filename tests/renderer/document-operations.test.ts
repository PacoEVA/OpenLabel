import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentOperationsManager } from '../../src/renderer/hooks/useDocumentOperations';
import { useEditorStore } from '../../src/renderer/store/editor.store';
import { TextElement } from '../../src/core/schemas/label.schema';

describe('DocumentOperationsManager & Unsaved Changes Flow (Bloque 6)', () => {
  let mockApi: any;
  let manager: DocumentOperationsManager;

  beforeEach(() => {
    useEditorStore.getState().newDocument();

    mockApi = {
      openDocument: vi.fn(),
      saveDocument: vi.fn(),
      saveDocumentAs: vi.fn(),
      readDocumentFile: vi.fn(),
    };

    manager = new DocumentOperationsManager(
      useEditorStore,
      () => mockApi
    );
  });

  it('handleNew creates a fresh document directly when not dirty', () => {
    expect(manager.isUnsavedDialogOpen).toBe(false);

    manager.handleNew();

    expect(manager.isUnsavedDialogOpen).toBe(false);
    expect(useEditorStore.getState().session.isDirty).toBe(false);
  });

  it('handleNew prompts Unsaved Changes dialog when dirty, handles cancel, discard', () => {
    const sampleElement: TextElement = {
      id: 'el-1',
      type: 'text',
      x: 10,
      y: 10,
      width: 20,
      height: 10,
      rotation: 0,
      locked: false,
      content: 'Modified',
      fontSize: 12,
      fontFamily: 'Roboto',
      bold: false,
      italic: false,
      align: 'left',
    };

    useEditorStore.getState().addElement(sampleElement);
    expect(useEditorStore.getState().session.isDirty).toBe(true);

    manager.handleNew();

    expect(manager.isUnsavedDialogOpen).toBe(true);
    expect(manager.pendingAction).toEqual({ type: 'new' });

    // 1. Cancel
    manager.handleModalCancel();
    expect(manager.isUnsavedDialogOpen).toBe(false);
    expect(useEditorStore.getState().session.isDirty).toBe(true);
    expect(useEditorStore.getState().document.elements.length).toBe(1);

    // 2. Re-trigger and Discard
    manager.handleNew();
    expect(manager.isUnsavedDialogOpen).toBe(true);

    manager.handleModalDiscard();
    expect(manager.isUnsavedDialogOpen).toBe(false);
    expect(useEditorStore.getState().session.isDirty).toBe(false);
    expect(useEditorStore.getState().document.elements.length).toBe(0);
  });

  it('handleModalSave saves the document before executing pending action', async () => {
    const sampleElement: TextElement = {
      id: 'el-1',
      type: 'text',
      x: 10,
      y: 10,
      width: 20,
      height: 10,
      rotation: 0,
      locked: false,
      content: 'Modified',
      fontSize: 12,
      fontFamily: 'Roboto',
      bold: false,
      italic: false,
      align: 'left',
    };

    useEditorStore.getState().addElement(sampleElement);
    expect(useEditorStore.getState().session.isDirty).toBe(true);

    mockApi.saveDocumentAs.mockResolvedValueOnce({
      success: true,
      filePath: '/labels/saved.label',
    });

    manager.handleNew();
    expect(manager.isUnsavedDialogOpen).toBe(true);

    await manager.handleModalSave();

    expect(mockApi.saveDocumentAs).toHaveBeenCalled();
    expect(manager.isUnsavedDialogOpen).toBe(false);
    // After pending new action runs, a fresh doc is created
    expect(useEditorStore.getState().document.elements.length).toBe(0);
    expect(useEditorStore.getState().session.isDirty).toBe(false);
  });

  it('executeSave calls saveDocument when filePath exists, or saveDocumentAs when new', async () => {
    // 1. Initial document has no filePath -> calls saveDocumentAs
    mockApi.saveDocumentAs.mockResolvedValueOnce({
      success: true,
      filePath: '/labels/first.label',
    });

    const saved = await manager.executeSave();
    expect(saved).toBe(true);
    expect(mockApi.saveDocumentAs).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState().session.filePath).toBe('/labels/first.label');
    expect(useEditorStore.getState().session.isDirty).toBe(false);

    // 2. Modify and save again -> calls saveDocument with existing filePath
    useEditorStore.getState().updateMeta({ title: 'Updated Title' });
    expect(useEditorStore.getState().session.isDirty).toBe(true);

    mockApi.saveDocument.mockResolvedValueOnce({
      success: true,
      filePath: '/labels/first.label',
    });

    const savedAgain = await manager.executeSave();
    expect(savedAgain).toBe(true);
    expect(mockApi.saveDocument).toHaveBeenCalledWith(
      '/labels/first.label',
      expect.anything()
    );
    expect(useEditorStore.getState().session.isDirty).toBe(false);
  });
});
