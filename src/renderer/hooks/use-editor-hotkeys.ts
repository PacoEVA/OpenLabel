import { useEffect } from 'react';
import { useEditorStore } from '../store/editor.store';

/**
 * OpenLabels - Global Hotkey Controller
 * Intercepts desktop application shortcuts while safely ignoring keystrokes inside text inputs.
 */
export function useEditorHotkeys(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is currently typing inside an input, textarea, or select
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 1. Undo / Redo (works even when inputs are not focused)
      if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        if (!isInput) {
          e.preventDefault();
          useEditorStore.getState().undo();
          return;
        }
      }

      if (
        (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z') ||
        (cmdOrCtrl && e.key.toLowerCase() === 'y')
      ) {
        if (!isInput) {
          e.preventDefault();
          useEditorStore.getState().redo();
          return;
        }
      }

      // 2. Duplicate selection: Ctrl/Cmd + D
      if (cmdOrCtrl && e.key.toLowerCase() === 'd') {
        if (!isInput) {
          e.preventDefault();
          const selected = useEditorStore.getState().selectedElementIds;
          if (selected.length > 0) {
            useEditorStore.getState().duplicateElement(selected[0]);
          }
          return;
        }
      }

      // If typing inside an input element, do NOT intercept single-key shortcuts
      if (isInput) return;

      // 3. Delete / Backspace: Remove selected elements
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        useEditorStore.getState().removeSelectedElements();
        return;
      }

      // 4. Escape: Deselect and switch back to 'select' tool
      if (e.key === 'Escape') {
        e.preventDefault();
        useEditorStore.getState().clearSelection();
        useEditorStore.getState().setActiveTool('select');
        return;
      }

      // 5. Tool Switching Hotkeys
      if (!cmdOrCtrl && !e.altKey && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'v':
            useEditorStore.getState().setActiveTool('select');
            break;
          case 't':
            useEditorStore.getState().setActiveTool('text');
            break;
          case 'r':
            useEditorStore.getState().setActiveTool('rectangle');
            break;
          case 'l':
            useEditorStore.getState().setActiveTool('line');
            break;
          case 'h':
            useEditorStore.getState().setActiveTool('pan');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
