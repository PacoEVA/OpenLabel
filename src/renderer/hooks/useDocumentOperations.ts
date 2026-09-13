import { useState, useCallback, useEffect, useMemo } from 'react';
import { useEditorStore } from '../store/editor.store';
import {
  selectDocument,
  selectSession,
  selectIsDirty,
  selectDisplayName,
} from '../store/selectors';

export type PendingDocumentAction =
  | { type: 'new' }
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'open-path'; filePath: string };

/**
 * Pure manager for document operations, dialog state, and unsaved changes flow.
 * Can be instantiated and tested independently of React rendering.
 */
export class DocumentOperationsManager {
  public pendingAction: PendingDocumentAction | null = null;
  public isUnsavedDialogOpen: boolean = false;

  constructor(
    private store: typeof useEditorStore,
    private getDocumentApi: () => Window['documentAPI'] | undefined,
    private onStateChange?: () => void
  ) {}

  private notify() {
    this.onStateChange?.();
  }

  public async executeSave(): Promise<boolean> {
    const api = this.getDocumentApi();
    if (!api) return false;

    const { document, session } = this.store.getState();

    if (session.filePath) {
      const res = await api.saveDocument(session.filePath, document);
      if (res.success && res.filePath) {
        this.store.getState().markSaved(res.filePath);
        return true;
      }
      return false;
    } else {
      const res = await api.saveDocumentAs(document, document.meta.title);
      if (res.success && res.filePath) {
        this.store.getState().markSaved(res.filePath);
        return true;
      }
      return false;
    }
  }

  public async executeSaveAs(): Promise<boolean> {
    const api = this.getDocumentApi();
    if (!api) return false;

    const { document } = this.store.getState();
    const res = await api.saveDocumentAs(document, document.meta.title);
    if (res.success && res.filePath) {
      this.store.getState().markSaved(res.filePath);
      return true;
    }
    return false;
  }

  public async executePendingAction(action: PendingDocumentAction): Promise<void> {
    if (action.type === 'new') {
      this.store.getState().newDocument();
    } else if (action.type === 'open') {
      const api = this.getDocumentApi();
      if (api) {
        const res = await api.openDocument();
        if (res.success && res.document && res.filePath) {
          this.store.getState().setDocument(res.document, {
            filePath: res.filePath,
            isMigrated: res.migrated,
          });
        }
      }
    } else if (action.type === 'open-path') {
      const api = this.getDocumentApi();
      if (api) {
        const res = await api.readDocumentFile(action.filePath);
        if (res.success && res.document && res.filePath) {
          this.store.getState().setDocument(res.document, {
            filePath: res.filePath,
            isMigrated: res.migrated,
          });
        }
      }
    } else if (action.type === 'close') {
      this.store.getState().closeDocument();
    }
  }

  public handleNew(): void {
    const { session } = this.store.getState();
    if (session.isDirty) {
      this.pendingAction = { type: 'new' };
      this.isUnsavedDialogOpen = true;
      this.notify();
    } else {
      this.store.getState().newDocument();
    }
  }

  public handleOpen(): void {
    const { session } = this.store.getState();
    if (session.isDirty) {
      this.pendingAction = { type: 'open' };
      this.isUnsavedDialogOpen = true;
      this.notify();
    } else {
      this.executePendingAction({ type: 'open' });
    }
  }

  public handleClose(): void {
    const { session } = this.store.getState();
    if (session.isDirty) {
      this.pendingAction = { type: 'close' };
      this.isUnsavedDialogOpen = true;
      this.notify();
    } else {
      this.store.getState().closeDocument();
    }
  }

  public handleOpenPath(filePath: string): void {
    const { session } = this.store.getState();
    if (session.isDirty) {
      this.pendingAction = { type: 'open-path', filePath };
      this.isUnsavedDialogOpen = true;
      this.notify();
    } else {
      this.executePendingAction({ type: 'open-path', filePath });
    }
  }

  public async handleModalSave(): Promise<void> {
    const saved = await this.executeSave();
    if (saved && this.pendingAction) {
      const action = this.pendingAction;
      this.isUnsavedDialogOpen = false;
      this.pendingAction = null;
      this.notify();
      await this.executePendingAction(action);
    }
  }

  public async handleModalDiscard(): Promise<void> {
    const action = this.pendingAction;
    this.isUnsavedDialogOpen = false;
    this.pendingAction = null;
    this.notify();
    if (action) {
      await this.executePendingAction(action);
    }
  }

  public handleModalCancel(): void {
    this.isUnsavedDialogOpen = false;
    this.pendingAction = null;
    this.notify();
  }
}

export function useDocumentOperations() {
  const isDirty = useEditorStore(selectIsDirty);
  const displayName = useEditorStore(selectDisplayName);

  const [, setTick] = useState(0);
  const manager = useMemo(() => {
    return new DocumentOperationsManager(
      useEditorStore,
      () => (typeof window !== 'undefined' ? window.documentAPI : undefined),
      () => setTick((t) => t + 1)
    );
  }, []);

  // Sync window title with document name and dirty status
  useEffect(() => {
    const dirtyMark = isDirty ? ' •' : '';
    window.document.title = `${displayName}${dirtyMark} - OpenLabels`;
  }, [displayName, isDirty]);

  // Keyboard shortcuts (Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (!mod) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        manager.handleNew();
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        manager.handleOpen();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (e.shiftKey) {
          manager.executeSaveAs();
        } else {
          manager.executeSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [manager]);

  return {
    handleNew: useCallback(() => manager.handleNew(), [manager]),
    handleOpen: useCallback(() => manager.handleOpen(), [manager]),
    handleClose: useCallback(() => manager.handleClose(), [manager]),
    handleOpenPath: useCallback((path: string) => manager.handleOpenPath(path), [manager]),
    handleSave: useCallback(() => manager.executeSave(), [manager]),
    handleSaveAs: useCallback(() => manager.executeSaveAs(), [manager]),
    isUnsavedDialogOpen: manager.isUnsavedDialogOpen,
    displayName,
    handleModalSave: useCallback(() => manager.handleModalSave(), [manager]),
    handleModalDiscard: useCallback(() => manager.handleModalDiscard(), [manager]),
    handleModalCancel: useCallback(() => manager.handleModalCancel(), [manager]),
  };
}
