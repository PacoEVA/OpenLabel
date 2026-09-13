import { LabelDocument } from '../../core/schemas/label.schema';

/**
 * OpenLabels - Pure History State & Undo/Redo Engine
 * Decoupled from React and DOM for complete testability.
 */

export interface HistoryState {
  past: LabelDocument[];
  future: LabelDocument[];
}

export const DEFAULT_MAX_HISTORY = 50;

/**
 * Creates an empty initial history state.
 */
export function createHistoryState(): HistoryState {
  return {
    past: [],
    future: [],
  };
}

/**
 * Records a new document snapshot into past history and clears any redo future.
 * Clamps history to maxHistory entries to prevent unbounded memory growth.
 */
export function pushHistory(
  history: HistoryState,
  currentDoc: LabelDocument,
  maxHistory: number = DEFAULT_MAX_HISTORY
): HistoryState {
  // Deep-clone/serialize snapshot to guarantee immutability
  const snapshot = JSON.parse(JSON.stringify(currentDoc)) as LabelDocument;

  const newPast = [...history.past, snapshot];
  if (newPast.length > maxHistory) {
    newPast.shift();
  }

  return {
    past: newPast,
    future: [], // Any new action invalidates the redo branch
  };
}

/**
 * Checks if an undo operation is available.
 */
export function canUndo(history: HistoryState): boolean {
  return history.past.length > 0;
}

/**
 * Checks if a redo operation is available.
 */
export function canRedo(history: HistoryState): boolean {
  return history.future.length > 0;
}

/**
 * Undoes the latest change:
 * Moves current document to future and pops the last document from past.
 */
export function undoHistory(
  history: HistoryState,
  currentDoc: LabelDocument
): { newDoc: LabelDocument; newHistory: HistoryState } | null {
  if (!canUndo(history)) {
    return null;
  }

  const newPast = [...history.past];
  const previousDoc = newPast.pop()!;

  const currentSnapshot = JSON.parse(JSON.stringify(currentDoc)) as LabelDocument;
  const newFuture = [currentSnapshot, ...history.future];

  return {
    newDoc: previousDoc,
    newHistory: {
      past: newPast,
      future: newFuture,
    },
  };
}

/**
 * Redoes an undone change:
 * Moves current document to past and shifts the next document from future.
 */
export function redoHistory(
  history: HistoryState,
  currentDoc: LabelDocument
): { newDoc: LabelDocument; newHistory: HistoryState } | null {
  if (!canRedo(history)) {
    return null;
  }

  const newFuture = [...history.future];
  const nextDoc = newFuture.shift()!;

  const currentSnapshot = JSON.parse(JSON.stringify(currentDoc)) as LabelDocument;
  const newPast = [...history.past, currentSnapshot];

  return {
    newDoc: nextDoc,
    newHistory: {
      past: newPast,
      future: newFuture,
    },
  };
}
