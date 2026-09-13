import { useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editor.store';
import { selectDocument, selectSession, selectIsDirty } from '../store/selectors';

const AUTOSAVE_DEBOUNCE_MS = 3000; // 3 seconds after last user edit

export function useAutosave() {
  const document = useEditorStore(selectDocument);
  const session = useEditorStore(selectSession);
  const isDirty = useEditorStore(selectIsDirty);

  // Stable document session UUID for recovery tracking
  const documentIdRef = useRef<string>(crypto.randomUUID());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When filePath changes or a new document is opened, rotate the session UUID
  useEffect(() => {
    documentIdRef.current = crypto.randomUUID();
  }, [session.filePath]);

  useEffect(() => {
    // If not dirty, cancel any scheduled snapshot and cleanup any existing recovery file
    if (!isDirty) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (typeof window !== 'undefined' && window.documentAPI) {
        window.documentAPI.removeRecoveryItem(documentIdRef.current).catch(() => {});
      }
      return;
    }

    // Clear existing timer if editing continues
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Schedule new autosave snapshot
    timerRef.current = setTimeout(async () => {
      if (typeof window !== 'undefined' && window.documentAPI) {
        try {
          await window.documentAPI.autosaveSnapshot({
            recoveryVersion: 1,
            documentId: documentIdRef.current,
            sourcePath: session.filePath,
            savedAt: new Date().toISOString(),
            document,
          });
        } catch {
          // Non-fatal background error
        }
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [document, isDirty, session.filePath]);
}
