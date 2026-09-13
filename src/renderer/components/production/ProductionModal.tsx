import React, { useState, useEffect, useMemo } from 'react';
import { useEditorStore } from '../../store/editor.store';
import type { PrinterProfile } from '../../../core/printing';
import type {
  ProductionRun,
  ProductionPlan,
  ProductionPreflightResult,
  ProductionRecord,
} from '../../../core/production';
import { runProductionPreflight } from '../../../core/production/preflight';
import { generateRecords } from '../../../core/data/batch-generator';
import { parseRecordSelection } from './selection-parser';
import { ProductionProgress } from './ProductionProgress';
import { ProductionItemsTable } from './ProductionItemsTable';
import {
  Factory,
  Printer,
  Database,
  Sliders,
  Play,
  Pause,
  RotateCcw,
  Ban,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  AlertCircle,
} from 'lucide-react';

interface ProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReport?: (run: ProductionRun, plan?: ProductionPlan) => void;
}

export const ProductionModal: React.FC<ProductionModalProps> = ({
  isOpen,
  onClose,
  onOpenReport,
}) => {
  const document = useEditorStore((s) => s.document);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'setup' | 'execution' | 'items'>('setup');

  // Printer Selection
  const [profiles, setProfiles] = useState<PrinterProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  // Source & Records
  const [recordSelectionMode, setRecordSelectionMode] = useState<'all' | 'range'>('all');
  const [rangeInput, setRangeInput] = useState('1-100');
  const [copiesPerRecord, setCopiesPerRecord] = useState(1);
  const [skipInvalidRows, setSkipInvalidRows] = useState(false);

  // Available dataset rows
  const [availableRecords, setAvailableRecords] = useState<Array<Record<string, unknown>>>([]);

  // Preflight state
  const [isPreflighting, setIsPreflighting] = useState(false);
  const [preflightResult, setPreflightResult] = useState<ProductionPreflightResult | null>(null);

  // Active Production Run state
  const [activeRun, setActiveRun] = useState<ProductionRun | null>(null);
  const [activePlan, setActivePlan] = useState<ProductionPlan | null>(null);

  // Load profiles and datasets on open
  useEffect(() => {
    if (isOpen) {
      if (window.printAPI) {
        window.printAPI.listProfiles().then((list) => {
          setProfiles(list);
          if (list.length > 0 && !selectedProfileId) {
            setSelectedProfileId(list[0].id);
          }
        });
      }

      if (document.dataModel && document.dataModel.fields.length > 0) {
        const previewInputs = useEditorStore.getState().previewInputs;
        const genRes = generateRecords({
          fields: document.dataModel.fields,
          count: 500,
          context: { now: new Date() },
          userInputs: previewInputs,
        });
        if (genRes.success) {
          setAvailableRecords(genRes.records);
        }
      } else {
        setAvailableRecords([{}]);
      }
    }
  }, [isOpen, document]);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId),
    [profiles, selectedProfileId]
  );

  const selectionResult = useMemo(() => {
    return parseRecordSelection(
      recordSelectionMode,
      availableRecords.length,
      rangeInput
    );
  }, [recordSelectionMode, availableRecords.length, rangeInput]);

  const selectedRecordCount = selectionResult.isValid ? selectionResult.indices.length : 0;
  const safeCopies = Math.max(1, Math.min(999, copiesPerRecord));
  const totalCalculatedLabels = selectedRecordCount * safeCopies;

  // Helper to convert selected raw records into typed ProductionRecord[]
  const getSelectedProductionRecords = (): ProductionRecord[] => {
    return selectionResult.indices.map((idx, i) => {
      const raw = availableRecords[idx] || {};
      const stringValues: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) {
        stringValues[k] = v == null ? '' : String(v);
      }
      return {
        index: i,
        sourceRowIndex: idx,
        values: stringValues,
      };
    });
  };

  // Run Preflight validation
  const handleExecutePreflight = () => {
    if (!selectedProfile) return;
    setIsPreflighting(true);

    try {
      const prodRecords = getSelectedProductionRecords();
      const result = runProductionPreflight({
        document,
        printerProfile: selectedProfile,
        records: prodRecords,
        copiesPerRecord: safeCopies,
        skipInvalidRows,
      });
      setPreflightResult(result);
    } catch (err) {
      console.error('Preflight error:', err);
    } finally {
      setIsPreflighting(false);
    }
  };

  // Run Production Lifecycle Handlers
  const handleStartProduction = async () => {
    if (!selectedProfile || !selectionResult.isValid) return;

    const prodRecords = getSelectedProductionRecords();

    const preflight =
      preflightResult ||
      runProductionPreflight({
        document,
        printerProfile: selectedProfile,
        records: prodRecords,
        copiesPerRecord: safeCopies,
        skipInvalidRows,
      });

    if (!preflight.success && !skipInvalidRows) {
      setPreflightResult(preflight);
      return;
    }

    setActiveTab('execution');

    if ((window as any).productionAPI) {
      const res = await (window as any).productionAPI.createPlanAndRun({
        document,
        printerProfile: selectedProfile,
        records: prodRecords,
        copiesPerRecord: safeCopies,
        skipInvalidRows,
        preflightFingerprint: preflight.fingerprint,
      });

      if (res.success) {
        setActivePlan(res.plan);
        setActiveRun(res.run);
        await (window as any).productionAPI.startRun(res.run.id);
      }
    } else {
      const now = new Date().toISOString();
      const dummyRun: ProductionRun = {
        id: '00000000-0000-4000-8000-000000000001',
        planId: '00000000-0000-4000-8000-000000000002',
        status: 'running',
        totalItems: selectedRecordCount,
        processedItems: 0,
        successfulItems: 0,
        failedItems: 0,
        unknownItems: 0,
        skippedItems: 0,
        cancelledItems: 0,
        items: selectionResult.indices.map((idx, i) => ({
          id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
          recordIndex: idx,
          status: i === 0 ? 'dispatching' : 'pending',
          attempts: i === 0 ? 1 : 0,
          createdAt: now,
          updatedAt: now,
        })),
        startedAt: now,
      };
      setActiveRun(dummyRun);
    }
  };

  const handlePause = async () => {
    if (!activeRun) return;
    if ((window as any).productionAPI) {
      await (window as any).productionAPI.pauseRun(activeRun.id);
    } else {
      setActiveRun((r) => (r ? { ...r, status: 'paused' } : null));
    }
  };

  const handleResume = async () => {
    if (!activeRun) return;
    if ((window as any).productionAPI) {
      await (window as any).productionAPI.resumeRun(activeRun.id);
    } else {
      setActiveRun((r) => (r ? { ...r, status: 'running' } : null));
    }
  };

  const handleCancel = async () => {
    if (!activeRun) return;
    if ((window as any).productionAPI) {
      await (window as any).productionAPI.cancelRun(activeRun.id);
    } else {
      setActiveRun((r) => (r ? { ...r, status: 'cancelled' } : null));
    }
  };

  if (!isOpen) return null;

  const preflightErrors = preflightResult
    ? preflightResult.issues.filter((iss) => iss.level === 'error')
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl max-w-4xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="px-5 py-3.5 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center space-x-2">
                <span>Massive Batch Production</span>
                {activeRun && (
                  <span className="text-2xs px-2 py-0.5 rounded font-mono font-normal uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {activeRun.status}
                  </span>
                )}
              </h2>
              <p className="text-2xs text-zinc-400">Industrial controlled execution, frozen snapshots & backpressure</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Tabs */}
            <div className="flex items-center bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-700/60 text-xs">
              <button
                onClick={() => setActiveTab('setup')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  activeTab === 'setup'
                    ? 'bg-zinc-700 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Setup & Preflight
              </button>
              <button
                onClick={() => setActiveTab('execution')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  activeTab === 'execution'
                    ? 'bg-zinc-700 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Progress
              </button>
              <button
                onClick={() => setActiveTab('items')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  activeTab === 'items'
                    ? 'bg-zinc-700 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Items ({activeRun?.items.length || 0})
              </button>
            </div>

            <button
              onClick={onClose}
              title="Close panel (background production continues)"
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: SETUP & PREFLIGHT */}
          {activeTab === 'setup' && (
            <div className="space-y-4">
              {/* Top Banner: Total Calculated Labels */}
              <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/40 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <span className="text-2xs uppercase tracking-wider text-emerald-400 font-bold block mb-1">
                    Production Output Summary
                  </span>
                  <div className="flex items-baseline space-x-2 font-mono">
                    <span className="text-2xl font-black text-white">{selectedRecordCount}</span>
                    <span className="text-xs text-zinc-400">records</span>
                    <span className="text-zinc-500">×</span>
                    <span className="text-2xl font-black text-white">{safeCopies}</span>
                    <span className="text-xs text-zinc-400">copies</span>
                    <span className="text-zinc-500">=</span>
                    <span className="text-3xl font-black text-emerald-400">
                      {totalCalculatedLabels.toLocaleString()}
                    </span>
                    <span className="text-xs text-emerald-300 font-semibold">total labels</span>
                  </div>
                </div>

                <div className="text-right text-xs text-zinc-400">
                  <div>Document: <span className="text-zinc-200 font-mono">{document.dimensions.width}×{document.dimensions.height} {document.dimensions.unit}</span></div>
                  <div>Target DPI: <span className="text-zinc-200 font-mono">{selectedProfile?.dpi || document.dimensions.dpi} DPI</span></div>
                </div>
              </div>

              {/* Grid: Printer & Records Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Printer Profile */}
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-zinc-300">
                    <Printer className="w-4 h-4 text-indigo-400" />
                    <span>Target Printer Profile</span>
                  </div>
                  <select
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="w-full bg-zinc-800 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-700 focus:outline-none focus:border-blue-500"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.dpi || document.dimensions.dpi} DPI • {p.language.toUpperCase()})
                      </option>
                    ))}
                  </select>
                  {selectedProfile && (
                    <div className="text-2xs text-zinc-400 bg-zinc-950/60 p-2.5 rounded border border-zinc-800/80 space-y-1 font-mono">
                      <div>Language: <span className="text-zinc-300">{selectedProfile.language.toUpperCase()}</span></div>
                      <div>Connection: <span className="text-zinc-300">{selectedProfile.connection.type.toUpperCase()}</span></div>
                      {selectedProfile.dpi && selectedProfile.dpi !== document.dimensions.dpi && (
                        <div className="text-amber-400 flex items-center space-x-1 pt-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>DPI mismatch: Document is {document.dimensions.dpi}, Printer is {selectedProfile.dpi}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Record Selection & Copies */}
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-zinc-300">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span>Record Selection & Copies</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-2xs text-zinc-400 block mb-1">Selection Mode</label>
                      <select
                        value={recordSelectionMode}
                        onChange={(e) => setRecordSelectionMode(e.target.value as any)}
                        className="w-full bg-zinc-800 text-zinc-200 text-xs px-2.5 py-1.5 rounded border border-zinc-700"
                      >
                        <option value="all">All Available ({availableRecords.length})</option>
                        <option value="range">Specific Range</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-2xs text-zinc-400 block mb-1">Copies per Record</label>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={copiesPerRecord}
                        onChange={(e) => setCopiesPerRecord(parseInt(e.target.value, 10) || 1)}
                        className="w-full bg-zinc-800 text-zinc-200 text-xs px-2.5 py-1.5 rounded border border-zinc-700"
                      />
                    </div>
                  </div>

                  {recordSelectionMode === 'range' && (
                    <div>
                      <label className="text-2xs text-zinc-400 block mb-1">
                        Row Range (1-indexed, e.g. "1-50" or "1, 3, 5-10")
                      </label>
                      <input
                        type="text"
                        value={rangeInput}
                        onChange={(e) => setRangeInput(e.target.value)}
                        placeholder="1-100"
                        className="w-full bg-zinc-800 text-zinc-200 text-xs px-2.5 py-1.5 rounded border border-zinc-700 focus:outline-none focus:border-blue-500"
                      />
                      {!selectionResult.isValid && (
                        <p className="text-2xs text-rose-400 mt-1">{selectionResult.errorMessage}</p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="checkbox"
                      id="skipInvalidRows"
                      checked={skipInvalidRows}
                      onChange={(e) => setSkipInvalidRows(e.target.checked)}
                      className="rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-0"
                    />
                    <label htmlFor="skipInvalidRows" className="text-2xs text-zinc-300 select-none cursor-pointer">
                      Skip invalid rows automatically during preflight/execution
                    </label>
                  </div>
                </div>
              </div>

              {/* Preflight Inspection Section */}
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-zinc-300">Production Preflight Verification</span>
                  </div>
                  <button
                    onClick={handleExecutePreflight}
                    disabled={isPreflighting || !selectedProfile}
                    className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded border border-zinc-700 font-medium transition-colors"
                  >
                    {isPreflighting ? 'Inspecting...' : 'Run Preflight Inspection'}
                  </button>
                </div>

                {preflightResult ? (
                  <div className="space-y-2 pt-1 font-mono text-xs">
                    <div className="flex items-center space-x-2">
                      {preflightResult.success ? (
                        <span className="inline-flex items-center space-x-1 text-emerald-400 text-xs font-semibold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Preflight PASSED (Ready for production)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-rose-400 text-xs font-semibold">
                          <AlertCircle className="w-4 h-4" />
                          <span>Preflight FAILED ({preflightErrors.length} errors)</span>
                        </span>
                      )}
                      <span className="text-zinc-500 text-2xs">
                        Fingerprint: {preflightResult.fingerprint.slice(0, 12)}...
                      </span>
                    </div>

                    {preflightErrors.length > 0 && (
                      <div className="max-h-36 overflow-y-auto bg-zinc-950/80 p-2.5 rounded border border-rose-900/50 space-y-1 text-2xs text-rose-300 font-sans">
                        {preflightErrors.map((err, i) => (
                          <div key={i} className="flex items-start space-x-1.5">
                            <span className="text-rose-400 font-mono font-bold">[{err.code}]</span>
                            <span>{err.message}</span>
                            {err.recordIndex !== undefined && (
                              <span className="text-zinc-400 font-mono">(Row #{err.recordIndex + 1})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-2xs text-zinc-500">
                    Verify barcodes, dimensions, templates and physical boundaries before dispatching to hardware.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: EXECUTION & PROGRESS */}
          {activeTab === 'execution' && (
            <div className="space-y-4">
              {activeRun ? (
                <>
                  <ProductionProgress run={activeRun} totalCopies={safeCopies} />

                  {/* Controller Action Buttons */}
                  <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-zinc-400">Execution Controls:</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Paused state -> Resume & Cancel */}
                      {activeRun.status === 'paused' && (
                        <>
                          <button
                            onClick={handleResume}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium flex items-center space-x-1.5 transition-colors"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Resume Run</span>
                          </button>
                          <button
                            onClick={handleCancel}
                            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-rose-400 rounded text-xs font-medium flex items-center space-x-1.5 transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Cancel Run</span>
                          </button>
                        </>
                      )}

                      {/* Running state -> Pause & Cancel */}
                      {activeRun.status === 'running' && (
                        <>
                          <button
                            onClick={handlePause}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium flex items-center space-x-1.5 transition-colors"
                          >
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pause Run</span>
                          </button>
                          <button
                            onClick={handleCancel}
                            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-rose-400 rounded text-xs font-medium flex items-center space-x-1.5 transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Cancel Run</span>
                          </button>
                        </>
                      )}

                      {/* Interrupted state -> Resume & Cancel */}
                      {activeRun.status === 'interrupted' && (
                        <>
                          <button
                            onClick={handleResume}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium flex items-center space-x-1.5 transition-colors"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Resume Interrupted</span>
                          </button>
                          <button
                            onClick={handleCancel}
                            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-rose-400 rounded text-xs font-medium flex items-center space-x-1.5 transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Cancel Run</span>
                          </button>
                        </>
                      )}

                      {/* Completed -> View Report */}
                      {(activeRun.status === 'completed' ||
                        activeRun.status === 'completed_with_errors') &&
                        onOpenReport && (
                          <button
                            onClick={() => onOpenReport(activeRun, activePlan || undefined)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium flex items-center space-x-1.5 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View Production Report</span>
                          </button>
                        )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-16 text-center text-zinc-500 space-y-2">
                  <Factory className="w-12 h-12 mx-auto text-zinc-700" />
                  <p className="text-sm">No production run currently executing.</p>
                  <p className="text-xs">Configure your batch in Setup & Preflight, then click Start Production.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BATCH ITEMS TABLE */}
          {activeTab === 'items' && (
            <div className="h-[450px]">
              <ProductionItemsTable
                items={activeRun?.items || []}
                onResolveUnknown={async (itemId, resolution, forceRetry) => {
                  if ((window as any).productionAPI && activeRun) {
                    await (window as any).productionAPI.resolveUnknownItem({
                      runId: activeRun.id,
                      itemId,
                      resolution,
                      forceRetry,
                    });
                  } else {
                    setActiveRun((r) => {
                      if (!r) return null;
                      return {
                        ...r,
                        items: r.items.map((it) =>
                          it.id === itemId
                            ? {
                                ...it,
                                status: resolution === 'mark_completed' ? 'completed' : resolution === 'skip' ? 'skipped' : 'pending',
                              }
                            : it
                        ),
                      };
                    });
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-5 py-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs">
          <div className="text-zinc-500 text-2xs">
            Closing this window will NOT stop an active background print run in Main Process.
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
            >
              Close Panel
            </button>

            {activeTab === 'setup' && (
              <button
                onClick={handleStartProduction}
                disabled={!selectedProfile || !selectionResult.isValid || isPreflighting}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium flex items-center space-x-1.5 shadow-sm transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Start Production ({totalCalculatedLabels.toLocaleString()} Labels)</span>
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
