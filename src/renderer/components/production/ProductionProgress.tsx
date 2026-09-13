import React from 'react';
import type { ProductionRun } from '../../../core/production';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  Ban,
  Activity,
  MinusCircle,
} from 'lucide-react';

interface ProductionProgressProps {
  run: ProductionRun;
  totalCopies: number;
}

export const ProductionProgress: React.FC<ProductionProgressProps> = ({ run, totalCopies }) => {
  const total = run.totalItems;

  // Real percentage: (successfulItems + skippedItems) / total
  const completedOrSkipped = run.successfulItems + run.skippedItems;
  const percent = total > 0 ? Math.min(100, Math.round((completedOrSkipped / total) * 100)) : 0;

  // Active / in-flight is calculating / compiling / queued / dispatching
  const inFlightCount = run.items.filter((it) =>
    ['validating', 'compiling', 'queued', 'dispatching'].includes(it.status)
  ).length;

  const pendingCount = run.items.filter((it) => it.status === 'pending').length;

  return (
    <div className="bg-zinc-900/90 border border-zinc-700/60 rounded-lg p-4 space-y-3">
      {/* Top bar: Percent & Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-zinc-200">Execution Progress</span>
          <span className="px-2 py-0.5 text-2xs uppercase tracking-wider rounded font-mono font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
            {run.status}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="font-mono text-lg font-bold text-white">{percent}%</span>
          <span className="text-xs text-zinc-400">
            ({run.successfulItems} of {total} records • {run.successfulItems * totalCopies} of {total * totalCopies} labels)
          </span>
        </div>
      </div>

      {/* Real Progress Bar */}
      <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden border border-zinc-700/50 flex">
        {/* Completed portion */}
        <div
          className="bg-emerald-500 h-full transition-all duration-300 ease-out"
          style={{ width: `${total > 0 ? (run.successfulItems / total) * 100 : 0}%` }}
          title={`Completed: ${run.successfulItems}`}
        />
        {/* Active portion */}
        <div
          className="bg-blue-500 h-full transition-all duration-300 ease-out animate-pulse"
          style={{ width: `${total > 0 ? (inFlightCount / total) * 100 : 0}%` }}
          title={`Active / In-Flight: ${inFlightCount}`}
        />
        {/* Unknown portion */}
        <div
          className="bg-amber-500 h-full transition-all duration-300 ease-out"
          style={{ width: `${total > 0 ? (run.unknownItems / total) * 100 : 0}%` }}
          title={`Unknown: ${run.unknownItems}`}
        />
        {/* Failed portion */}
        <div
          className="bg-rose-500 h-full transition-all duration-300 ease-out"
          style={{ width: `${total > 0 ? (run.failedItems / total) * 100 : 0}%` }}
          title={`Failed: ${run.failedItems}`}
        />
        {/* Skipped portion */}
        <div
          className="bg-zinc-600 h-full transition-all duration-300 ease-out"
          style={{ width: `${total > 0 ? (run.skippedItems / total) * 100 : 0}%` }}
          title={`Skipped: ${run.skippedItems}`}
        />
      </div>

      {/* Grid of statuses */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 pt-1">
        <div className="bg-zinc-800/60 p-2 rounded border border-zinc-700/40 text-center">
          <div className="flex items-center justify-center space-x-1 text-2xs text-zinc-400 mb-0.5">
            <Clock className="w-3 h-3 text-zinc-400" />
            <span>Pending</span>
          </div>
          <span className="font-mono text-sm font-semibold text-zinc-200">{pendingCount}</span>
        </div>

        <div className="bg-zinc-800/60 p-2 rounded border border-zinc-700/40 text-center">
          <div className="flex items-center justify-center space-x-1 text-2xs text-blue-400 mb-0.5">
            <Activity className="w-3 h-3 text-blue-400" />
            <span>In-Flight</span>
          </div>
          <span className="font-mono text-sm font-semibold text-blue-300">{inFlightCount}</span>
        </div>

        <div className="bg-zinc-800/60 p-2 rounded border border-zinc-700/40 text-center">
          <div className="flex items-center justify-center space-x-1 text-2xs text-emerald-400 mb-0.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Completed</span>
          </div>
          <span className="font-mono text-sm font-semibold text-emerald-300">{run.successfulItems}</span>
        </div>

        <div className="bg-zinc-800/60 p-2 rounded border border-zinc-700/40 text-center">
          <div className="flex items-center justify-center space-x-1 text-2xs text-amber-400 mb-0.5">
            <HelpCircle className="w-3 h-3 text-amber-400" />
            <span>Unknown</span>
          </div>
          <span className="font-mono text-sm font-semibold text-amber-300">{run.unknownItems}</span>
        </div>

        <div className="bg-zinc-800/60 p-2 rounded border border-zinc-700/40 text-center">
          <div className="flex items-center justify-center space-x-1 text-2xs text-rose-400 mb-0.5">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            <span>Failed</span>
          </div>
          <span className="font-mono text-sm font-semibold text-rose-300">{run.failedItems}</span>
        </div>

        <div className="bg-zinc-800/60 p-2 rounded border border-zinc-700/40 text-center">
          <div className="flex items-center justify-center space-x-1 text-2xs text-zinc-400 mb-0.5">
            <MinusCircle className="w-3 h-3 text-zinc-400" />
            <span>Skipped</span>
          </div>
          <span className="font-mono text-sm font-semibold text-zinc-300">{run.skippedItems}</span>
        </div>

        <div className="bg-zinc-800/60 p-2 rounded border border-zinc-700/40 text-center">
          <div className="flex items-center justify-center space-x-1 text-2xs text-purple-400 mb-0.5">
            <Ban className="w-3 h-3 text-purple-400" />
            <span>Cancelled</span>
          </div>
          <span className="font-mono text-sm font-semibold text-purple-300">{run.cancelledItems}</span>
        </div>
      </div>
    </div>
  );
};
