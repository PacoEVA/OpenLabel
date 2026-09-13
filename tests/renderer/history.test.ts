import { describe, it, expect } from 'vitest';
import {
  createHistoryState,
  pushHistory,
  undoHistory,
  redoHistory,
  canUndo,
  canRedo,
} from '../../src/renderer/store/history';
import { LabelDocument } from '../../src/core/schemas/label.schema';

describe('History Engine - Pure Undo/Redo Snapshots', () => {
  const createDoc = (title: string, elementCount: number = 0): LabelDocument => ({
    version: '1.0.0',
    meta: {
      title,
      author: 'Test',
      created: '2026-09-12T19:00:00.000Z',
    },
    dimensions: {
      width: 100,
      height: 50,
      unit: 'mm',
      dpi: 203,
    },
    elements: Array.from({ length: elementCount }).map((_, i) => ({
      id: `123e4567-e89b-12d3-a456-42661417400${i}`,
      type: 'text',
      x: 10 * i,
      y: 10 * i,
      width: 20,
      height: 10,
      rotation: 0,
      locked: false,
      content: `Item ${i}`,
      fontSize: 12,
      fontFamily: 'monospace',
      bold: false,
      italic: false,
      align: 'left',
    })),
  });

  it('should initialize empty history with canUndo and canRedo false', () => {
    const history = createHistoryState();
    expect(history.past).toEqual([]);
    expect(history.future).toEqual([]);
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it('should push snapshots to past and clear future', () => {
    let history = createHistoryState();
    const doc1 = createDoc('State 1');
    const doc2 = createDoc('State 2');

    history = pushHistory(history, doc1);
    expect(history.past.length).toBe(1);
    expect(history.past[0].meta.title).toBe('State 1');
    expect(canUndo(history)).toBe(true);
    expect(canRedo(history)).toBe(false);

    history = pushHistory(history, doc2);
    expect(history.past.length).toBe(2);
    expect(history.past[1].meta.title).toBe('State 2');
  });

  it('should undo changes back to previous state and populate future', () => {
    let history = createHistoryState();
    const doc1 = createDoc('State 1');
    const doc2 = createDoc('State 2');
    const currentDoc = createDoc('State 3');

    history = pushHistory(history, doc1);
    history = pushHistory(history, doc2);

    // Undo from State 3 -> should restore State 2
    const undo1 = undoHistory(history, currentDoc);
    expect(undo1).not.toBeNull();
    expect(undo1!.newDoc.meta.title).toBe('State 2');
    expect(undo1!.newHistory.past.length).toBe(1);
    expect(undo1!.newHistory.future.length).toBe(1);
    expect(undo1!.newHistory.future[0].meta.title).toBe('State 3');
    expect(canUndo(undo1!.newHistory)).toBe(true);
    expect(canRedo(undo1!.newHistory)).toBe(true);

    // Undo again from State 2 -> should restore State 1
    const undo2 = undoHistory(undo1!.newHistory, undo1!.newDoc);
    expect(undo2).not.toBeNull();
    expect(undo2!.newDoc.meta.title).toBe('State 1');
    expect(undo2!.newHistory.past.length).toBe(0);
    expect(undo2!.newHistory.future.length).toBe(2);
    expect(canUndo(undo2!.newHistory)).toBe(false);
    expect(canRedo(undo2!.newHistory)).toBe(true);

    // Undo when past is empty -> returns null
    const undo3 = undoHistory(undo2!.newHistory, undo2!.newDoc);
    expect(undo3).toBeNull();
  });

  it('should redo undone changes correctly', () => {
    let history = createHistoryState();
    const doc1 = createDoc('State 1');
    const doc2 = createDoc('State 2');

    history = pushHistory(history, doc1);
    const undoResult = undoHistory(history, doc2)!;

    // Redo back to doc2
    const redoResult = redoHistory(undoResult.newHistory, undoResult.newDoc);
    expect(redoResult).not.toBeNull();
    expect(redoResult!.newDoc.meta.title).toBe('State 2');
    expect(redoResult!.newHistory.past.length).toBe(1);
    expect(redoResult!.newHistory.past[0].meta.title).toBe('State 1');
    expect(redoResult!.newHistory.future.length).toBe(0);
    expect(canRedo(redoResult!.newHistory)).toBe(false);

    // Redo when future is empty -> returns null
    expect(redoHistory(redoResult!.newHistory, redoResult!.newDoc)).toBeNull();
  });

  it('should clear future when a new action is pushed after an undo', () => {
    let history = createHistoryState();
    const doc1 = createDoc('State 1');
    const doc2 = createDoc('State 2');
    const doc3 = createDoc('State 3 - Branch');

    history = pushHistory(history, doc1);
    const undoResult = undoHistory(history, doc2)!;
    expect(undoResult.newHistory.future.length).toBe(1);

    // User performs new action instead of redoing
    const newHistory = pushHistory(undoResult.newHistory, doc3);
    expect(newHistory.future.length).toBe(0);
    expect(newHistory.past.length).toBe(1);
    expect(canRedo(newHistory)).toBe(false);
  });

  it('should enforce maxHistory limit to prevent unbounded memory growth', () => {
    let history = createHistoryState();
    const max = 3;

    for (let i = 1; i <= 5; i++) {
      history = pushHistory(history, createDoc(`State ${i}`), max);
    }

    expect(history.past.length).toBe(3);
    expect(history.past[0].meta.title).toBe('State 3');
    expect(history.past[1].meta.title).toBe('State 4');
    expect(history.past[2].meta.title).toBe('State 5');
  });
});
