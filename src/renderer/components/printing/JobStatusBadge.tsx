import React from 'react';
import type { PrintJobStatus } from '../../../core/printing';

interface JobStatusBadgeProps {
  status: PrintJobStatus;
}

export const JobStatusBadge: React.FC<JobStatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'queued':
      return (
        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
          Queued
        </span>
      );
    case 'validating':
      return (
        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-900/60 text-purple-300 border border-purple-700/50">
          Validating
        </span>
      );
    case 'dispatching':
      return (
        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-900/60 text-amber-300 border border-amber-700/50 animate-pulse">
          Dispatching...
        </span>
      );
    case 'completed':
      return (
        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
          Sent (Dispatched)
        </span>
      );
    case 'retry_wait':
      return (
        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-orange-900/60 text-orange-300 border border-orange-700/50">
          Retrying...
        </span>
      );
    case 'failed':
      return (
        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-rose-900/60 text-rose-300 border border-rose-700/50">
          Failed
        </span>
      );
    case 'cancelled':
      return (
        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
          Cancelled
        </span>
      );
    case 'unknown':
    default:
      return (
        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-yellow-900/60 text-yellow-300 border border-yellow-700/50">
          Unknown
        </span>
      );
  }
};
