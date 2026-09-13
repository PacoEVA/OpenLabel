import { create } from 'zustand';
import { LabelDocument, LabelElement } from '../../core/schemas/label.schema';
import { Point } from '../canvas/coordinates';
import {
  HistoryState,
  createHistoryState,
  pushHistory,
  undoHistory,
  redoHistory,
  canUndo,
  canRedo,
} from './history';
import { DocumentSession, getDocumentDisplayName } from '../../core/documents';

export type ToolType = 'select' | 'text' | 'rectangle' | 'line' | 'barcode' | 'qrcode' | 'pan';

export interface GridConfig {
  enabled: boolean;
  sizeMm: number;
}

export interface SnapConfig {
  enabled: boolean;
  thresholdPx: number;
}

export interface EditorState {
  // Document source of truth
  document: LabelDocument;

  // Document Session & Dirty State Tracking
  session: DocumentSession;
  savedSnapshotJson: string;

  // Visual selection
  selectedElementIds: string[];

  // Active Tool
  activeTool: ToolType;

  // Viewport & Zoom
  zoom: number;
  viewport: Point;

  // Grid & Snapping settings
  grid: GridConfig;
  snap: SnapConfig;

  // History
  history: HistoryState;

  // Active document visibility (Empty State vs Canvas)
  isDocumentOpen: boolean;

  // Actions
  setDocument: (doc: LabelDocument, options?: { filePath?: string | null; isMigrated?: boolean }) => void;
  markSaved: (filePath: string) => void;
  newDocument: (overrides?: Partial<LabelDocument>) => void;
  closeDocument: () => void;
  selectElement: (id: string, multi?: boolean) => void;
  setSelectedElements: (ids: string[]) => void;
  clearSelection: () => void;
  setActiveTool: (tool: ToolType) => void;
  setZoom: (zoom: number) => void;
  setViewport: (viewport: Point) => void;
  panViewport: (delta: Point) => void;
  resetView: () => void;
  setGrid: (patch: Partial<GridConfig>) => void;
  setSnap: (patch: Partial<SnapConfig>) => void;

  // Document meta & dimensions
  updateDimensions: (dimensions: Partial<LabelDocument['dimensions']>) => void;
  updateMeta: (meta: Partial<LabelDocument['meta']>) => void;

  // Element CRUD & Layer Operations
  addElement: (element: LabelElement) => void;
  updateElement: (id: string, patch: Partial<LabelElement>, recordHistory?: boolean) => void;
  removeElement: (id: string) => void;
  removeSelectedElements: () => void;
  duplicateElement: (id: string) => void;
  toggleLockElement: (id: string) => void;
  reorderElement: (
    id: string,
    action: 'bringToFront' | 'sendToBack' | 'bringForward' | 'sendBackward'
  ) => void;

  // History actions
  undo: () => void;
  redo: () => void;
}

/**
 * Creates a default valid LabelDocument for development and new labels.
 */
export function createDefaultDocument(overrides?: Partial<LabelDocument>): LabelDocument {
  return {
    version: '1.0.0',
    meta: {
      title: 'Untitled Label',
      author: 'OpenLabels User',
      created: new Date().toISOString(),
    },
    dimensions: {
      width: 100,
      height: 50,
      unit: 'mm',
      dpi: 203,
    },
    elements: [],
    ...overrides,
  };
}

const initialDoc = createDefaultDocument();
const initialJson = JSON.stringify(initialDoc);

function computeSession(
  prevSession: DocumentSession,
  currentDoc: LabelDocument,
  savedSnapshotJson: string,
  overrides?: Partial<DocumentSession>
): DocumentSession {
  const isDirty = JSON.stringify(currentDoc) !== savedSnapshotJson;
  const filePath = overrides?.filePath !== undefined ? overrides.filePath : prevSession.filePath;
  const displayName = getDocumentDisplayName(currentDoc.meta.title, filePath);
  return {
    ...prevSession,
    ...overrides,
    filePath,
    displayName,
    isDirty,
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: initialDoc,
  savedSnapshotJson: initialJson,
  session: {
    filePath: null,
    displayName: getDocumentDisplayName(initialDoc.meta.title, null),
    isDirty: false,
    isMigrated: false,
    lastSavedAt: null,
  },
  selectedElementIds: [],
  activeTool: 'select',
  zoom: 1.0,
  viewport: { x: 0, y: 0 },
  grid: {
    enabled: true,
    sizeMm: 1.0,
  },
  snap: {
    enabled: true,
    thresholdPx: 6,
  },
  history: createHistoryState(),
  isDocumentOpen: false,

  setDocument: (doc: LabelDocument, options?: { filePath?: string | null; isMigrated?: boolean }) => {
    const json = JSON.stringify(doc);
    const filePath = options?.filePath !== undefined ? options.filePath : null;
    set({
      document: doc,
      savedSnapshotJson: json,
      selectedElementIds: [],
      history: createHistoryState(),
      isDocumentOpen: true,
      session: {
        filePath,
        displayName: getDocumentDisplayName(doc.meta.title, filePath),
        isDirty: false,
        isMigrated: options?.isMigrated ?? false,
        lastSavedAt: filePath ? new Date().toISOString() : null,
      },
    });
  },

  markSaved: (filePath: string) => {
    const { document, session } = get();
    const json = JSON.stringify(document);
    set({
      savedSnapshotJson: json,
      session: {
        ...session,
        filePath,
        displayName: getDocumentDisplayName(document.meta.title, filePath),
        isDirty: false,
        isMigrated: false,
        lastSavedAt: new Date().toISOString(),
      },
    });
  },

  newDocument: (overrides?: Partial<LabelDocument>) => {
    const doc = createDefaultDocument(overrides);
    const json = JSON.stringify(doc);
    set({
      document: doc,
      savedSnapshotJson: json,
      selectedElementIds: [],
      history: createHistoryState(),
      isDocumentOpen: true,
      session: {
        filePath: null,
        displayName: getDocumentDisplayName(doc.meta.title, null),
        isDirty: false,
        isMigrated: false,
        lastSavedAt: null,
      },
      zoom: 1.0,
      viewport: { x: 0, y: 0 },
    });
  },

  closeDocument: () => {
    set({
      isDocumentOpen: false,
      selectedElementIds: [],
    });
  },

  selectElement: (id: string, multi: boolean = false) => {
    set((state) => {
      if (multi) {
        const isSelected = state.selectedElementIds.includes(id);
        const newIds = isSelected
          ? state.selectedElementIds.filter((selectedId) => selectedId !== id)
          : [...state.selectedElementIds, id];
        return { selectedElementIds: newIds };
      }
      return { selectedElementIds: [id] };
    });
  },

  setSelectedElements: (ids: string[]) => {
    set({ selectedElementIds: ids });
  },

  clearSelection: () => {
    set({ selectedElementIds: [] });
  },

  setActiveTool: (tool: ToolType) => {
    set({ activeTool: tool });
  },

  setZoom: (rawZoom: number) => {
    // Clamp zoom to [0.25, 4.0] (25% to 400%)
    const clampedZoom = Math.max(0.25, Math.min(4.0, rawZoom));
    set({ zoom: clampedZoom });
  },

  setViewport: (viewport: Point) => {
    set({ viewport });
  },

  panViewport: (delta: Point) => {
    set((state) => ({
      viewport: {
        x: state.viewport.x + delta.x,
        y: state.viewport.y + delta.y,
      },
    }));
  },

  resetView: () => {
    set({ zoom: 1.0, viewport: { x: 0, y: 0 } });
  },

  setGrid: (patch: Partial<GridConfig>) => {
    set((state) => ({ grid: { ...state.grid, ...patch } }));
  },

  setSnap: (patch: Partial<SnapConfig>) => {
    set((state) => ({ snap: { ...state.snap, ...patch } }));
  },

  updateDimensions: (dimensionsPatch: Partial<LabelDocument['dimensions']>) => {
    const { document, history, session, savedSnapshotJson } = get();
    const newHistory = pushHistory(history, document);
    const newDoc: LabelDocument = {
      ...document,
      dimensions: { ...document.dimensions, ...dimensionsPatch },
    };
    set({
      document: newDoc,
      session: computeSession(session, newDoc, savedSnapshotJson),
      history: newHistory,
    });
  },

  updateMeta: (metaPatch: Partial<LabelDocument['meta']>) => {
    const { document, history, session, savedSnapshotJson } = get();
    const newHistory = pushHistory(history, document);
    const newDoc: LabelDocument = {
      ...document,
      meta: { ...document.meta, ...metaPatch },
    };
    set({
      document: newDoc,
      session: computeSession(session, newDoc, savedSnapshotJson),
      history: newHistory,
    });
  },

  addElement: (element: LabelElement) => {
    const { document, history, session, savedSnapshotJson } = get();
    const newHistory = pushHistory(history, document);
    const newDoc: LabelDocument = {
      ...document,
      elements: [...document.elements, element],
    };

    set({
      document: newDoc,
      session: computeSession(session, newDoc, savedSnapshotJson),
      history: newHistory,
      selectedElementIds: [element.id],
      activeTool: 'select',
    });
  },

  updateElement: (id: string, patch: Partial<LabelElement>, recordHistory: boolean = false) => {
    const { document, history, session, savedSnapshotJson } = get();
    const targetElement = document.elements.find((el) => el.id === id);
    if (!targetElement) return;

    // Do not modify locked elements unless changing the locked state itself
    if (targetElement.locked && patch.locked === undefined) return;

    let newHistory = history;
    if (recordHistory) {
      newHistory = pushHistory(history, document);
    }

    const newElements = document.elements.map((el) => {
      if (el.id === id) {
        return { ...el, ...patch } as LabelElement;
      }
      return el;
    });

    const newDoc = { ...document, elements: newElements };
    set({
      document: newDoc,
      session: computeSession(session, newDoc, savedSnapshotJson),
      history: newHistory,
    });
  },

  removeElement: (id: string) => {
    const { document, history, selectedElementIds, session, savedSnapshotJson } = get();
    if (!document.elements.some((el) => el.id === id)) return;

    const newHistory = pushHistory(history, document);
    const newElements = document.elements.filter((el) => el.id !== id);
    const newSelected = selectedElementIds.filter((selectedId) => selectedId !== id);
    const newDoc = { ...document, elements: newElements };

    set({
      document: newDoc,
      session: computeSession(session, newDoc, savedSnapshotJson),
      selectedElementIds: newSelected,
      history: newHistory,
    });
  },

  removeSelectedElements: () => {
    const { document, history, selectedElementIds, session, savedSnapshotJson } = get();
    if (selectedElementIds.length === 0) return;

    // Filter out locked elements from deletion
    const toDeleteIds = new Set(
      document.elements
        .filter((el) => selectedElementIds.includes(el.id) && !el.locked)
        .map((el) => el.id)
    );

    if (toDeleteIds.size === 0) return;

    const newHistory = pushHistory(history, document);
    const newElements = document.elements.filter((el) => !toDeleteIds.has(el.id));
    const newSelected = selectedElementIds.filter((id) => !toDeleteIds.has(id));
    const newDoc = { ...document, elements: newElements };

    set({
      document: newDoc,
      session: computeSession(session, newDoc, savedSnapshotJson),
      selectedElementIds: newSelected,
      history: newHistory,
    });
  },

  duplicateElement: (id: string) => {
    const { document, history, session, savedSnapshotJson } = get();
    const original = document.elements.find((el) => el.id === id);
    if (!original) return;

    const newHistory = pushHistory(history, document);
    const newId = crypto.randomUUID();

    // Offset +2mm X and Y, clamping within label dimensions
    const offsetX = Math.min(original.x + 2, document.dimensions.width - original.width);
    const offsetY = Math.min(original.y + 2, document.dimensions.height - original.height);

    const duplicated: LabelElement = {
      ...JSON.parse(JSON.stringify(original)),
      id: newId,
      x: Math.max(0, offsetX),
      y: Math.max(0, offsetY),
      locked: false,
    };
    const newDoc = { ...document, elements: [...document.elements, duplicated] };

    set({
      document: newDoc,
      session: computeSession(session, newDoc, savedSnapshotJson),
      selectedElementIds: [newId],
      history: newHistory,
    });
  },

  toggleLockElement: (id: string) => {
    const { document, history, session, savedSnapshotJson } = get();
    const element = document.elements.find((el) => el.id === id);
    if (!element) return;

    const newHistory = pushHistory(history, document);
    const newElements = document.elements.map((el) =>
      el.id === id ? ({ ...el, locked: !el.locked } as LabelElement) : el
    );
    const newDoc = { ...document, elements: newElements };

    set({
      document: newDoc,
      session: computeSession(session, newDoc, savedSnapshotJson),
      history: newHistory,
    });
  },

  reorderElement: (id: string, action) => {
    const { document, history, session, savedSnapshotJson } = get();
    const index = document.elements.findIndex((el) => el.id === id);
    if (index === -1) return;

    const elements = [...document.elements];
    const [target] = elements.splice(index, 1);

    if (action === 'bringToFront') {
      elements.push(target);
    } else if (action === 'sendToBack') {
      elements.unshift(target);
    } else if (action === 'bringForward') {
      const targetIndex = Math.min(index + 1, elements.length);
      elements.splice(targetIndex, 0, target);
    } else if (action === 'sendBackward') {
      const targetIndex = Math.max(index - 1, 0);
      elements.splice(targetIndex, 0, target);
    }

    const newHistory = pushHistory(history, document);
    const newDoc = { ...document, elements };
    set({
      document: newDoc,
      session: computeSession(session, newDoc, savedSnapshotJson),
      history: newHistory,
    });
  },

  undo: () => {
    const { document, history, session, savedSnapshotJson } = get();
    const result = undoHistory(history, document);
    if (result) {
      set({
        document: result.newDoc,
        session: computeSession(session, result.newDoc, savedSnapshotJson),
        history: result.newHistory,
        // Remove selection if element no longer exists in restored doc
        selectedElementIds: get().selectedElementIds.filter((id) =>
          result.newDoc.elements.some((el) => el.id === id)
        ),
      });
    }
  },

  redo: () => {
    const { document, history, session, savedSnapshotJson } = get();
    const result = redoHistory(history, document);
    if (result) {
      set({
        document: result.newDoc,
        session: computeSession(session, result.newDoc, savedSnapshotJson),
        history: result.newHistory,
      });
    }
  },
}));
