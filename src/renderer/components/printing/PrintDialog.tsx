import React, { useState, useEffect } from 'react';
import { useEditorStore } from '../../store/editor.store';
import type { PrinterProfile } from '../../../core/printing';
import { PrintJobHistory } from './PrintJobHistory';
import { ProfileManager } from './ProfileManager';
import {
  Printer,
  History,
  Settings,
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
} from 'lucide-react';

interface PrintDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrintDialog: React.FC<PrintDialogProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'print' | 'history' | 'profiles'>('print');
  const [profiles, setProfiles] = useState<PrinterProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [copies, setCopies] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    success: boolean;
    message: string;
    jobId?: string;
  } | null>(null);

  const document = useEditorStore((state) => state.document);

  useEffect(() => {
    if (isOpen && window.printAPI) {
      window.printAPI.listProfiles().then((list) => {
        setProfiles(list);
        if (list.length > 0 && !selectedProfileId) {
          setSelectedProfileId(list[0].id);
        }
      });
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  const handlePrintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.printAPI || !selectedProfileId) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const result = await window.printAPI.createJob({
        document,
        printerProfileId: selectedProfileId,
        copies: Math.max(1, Math.min(999, copies)),
      });

      if (result.success && result.job) {
        setFeedback({
          success: true,
          message: `Job dispatched to queue (ID: ${result.job.id.slice(0, 8)}...). Status: ${result.job.status}.`,
          jobId: result.job.id,
        });
      } else {
        setFeedback({
          success: false,
          message: result.errors?.join('\n') || 'Failed to dispatch print job',
        });
      }
    } catch (err: unknown) {
      setFeedback({
        success: false,
        message: err instanceof Error ? err.message : 'An unexpected error occurred during dispatch',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Printer size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-100">Print Dispatch Subsystem</h2>
              <p className="text-xs text-neutral-400">
                Hardware Printing & Spooler Queue (Phase 5)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-md transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/20 px-6 pt-2">
          <button
            onClick={() => setActiveTab('print')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'print'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Send size={14} />
            <span>Print Job</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'history'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <History size={14} />
            <span>Queue & History</span>
          </button>

          <button
            onClick={() => setActiveTab('profiles')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'profiles'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Settings size={14} />
            <span>Printer Profiles</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'print' && (
            <form onSubmit={handlePrintSubmit} className="space-y-4">
              {/* Document Summary Card */}
              <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg text-xs space-y-1">
                <div className="font-medium text-neutral-300">Document Specifications:</div>
                <div className="text-neutral-400 font-mono flex items-center gap-4">
                  <span>
                    Size: {document.dimensions.width} × {document.dimensions.height} {document.dimensions.unit}
                  </span>
                  <span>Elements: {document.elements.length}</span>
                </div>
              </div>

              {/* Profile Selector */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Target Printer Profile
                </label>
                {profiles.length > 0 ? (
                  <select
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-100"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.connection.type.toUpperCase()} - {p.language.toUpperCase()}{p.dpi ? ` @ ${p.dpi} DPI` : ''})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs text-rose-400">
                    No printer profiles configured. Please add one in the "Printer Profiles" tab.
                  </div>
                )}
              </div>

              {/* Selected Profile Details */}
              {selectedProfile && (
                <div className="p-3 bg-neutral-800/40 rounded-lg text-xs text-neutral-400 font-mono space-y-1">
                  <div>
                    Transport:{' '}
                    {selectedProfile.connection.type === 'tcp'
                      ? `TCP Socket (${selectedProfile.connection.host}:${selectedProfile.connection.port})`
                      : `OS Spooler (${selectedProfile.connection.printerName})`}
                  </div>
                  <div>
                    Format: {selectedProfile.language.toUpperCase()}
                    {selectedProfile.dpi ? ` (Hardware DPI: ${selectedProfile.dpi})` : ''}
                  </div>
                </div>
              )}

              {/* Copies */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Copies (1 - 999)
                </label>
                <div className="flex items-center gap-2">
                  <Copy size={16} className="text-neutral-500" />
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, Math.min(999, Number(e.target.value))))}
                    className="w-32 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-100"
                  />
                </div>
              </div>

              {/* Feedback Banner */}
              {feedback && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                    feedback.success
                      ? 'bg-emerald-950/50 border border-emerald-800/60 text-emerald-200'
                      : 'bg-rose-950/50 border border-rose-800/60 text-rose-200'
                  }`}
                >
                  {feedback.success ? (
                    <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-400 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{feedback.message}</p>
                    {feedback.success && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className="underline text-emerald-400 hover:text-emerald-300 mt-1 inline-block"
                      >
                        View in Queue History →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedProfileId}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  <Send size={14} />
                  <span>{isSubmitting ? 'Dispatching...' : 'Dispatch to Printer'}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'history' && <PrintJobHistory />}

          {activeTab === 'profiles' && <ProfileManager />}
        </div>
      </div>
    </div>
  );
};
