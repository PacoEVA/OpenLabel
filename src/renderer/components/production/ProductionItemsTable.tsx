import React, { useState, useMemo } from 'react';
import type { ProductionItem, ProductionItemStatus } from '../../../core/production';
import {
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Ban,
  Activity,
  MinusCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  Slash,
  AlertTriangle,
} from 'lucide-react';

interface ProductionItemsTableProps {
  items: ProductionItem[];
  onResolveUnknown?: (itemId: string, resolution: 'mark_completed' | 'skip' | 'retry', forceRetry?: boolean) => void;
  onRetryFailed?: (itemId: string) => void;
  onSkipItem?: (itemId: string) => void;
}

export const ProductionItemsTable: React.FC<ProductionItemsTableProps> = ({
  items,
  onResolveUnknown,
  onRetryFailed,
  onSkipItem,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [statusFilter, setStatusFilter] = useState<'all' | 'attention' | ProductionItemStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Confirmation modal state for "Retry anyway" on unknown items
  const [confirmRetryItem, setConfirmRetryItem] = useState<ProductionItem | null>(null);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Filter by status
      if (statusFilter === 'attention') {
        if (item.status !== 'unknown' && item.status !== 'failed') return false;
      } else if (statusFilter !== 'all') {
        if (item.status !== statusFilter) return false;
      }

      // Filter by search query (record index or ID)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesRecord = String(item.recordIndex + 1).includes(q);
        const matchesId = item.id.toLowerCase().includes(q);
        const matchesJob = item.printJobId?.toLowerCase().includes(q);
        if (!matchesRecord && !matchesId && !matchesJob) return false;
      }

      return true;
    });
  }, [items, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, safePage, pageSize]);

  const getStatusBadge = (status: ProductionItemStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-2xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
            <CheckCircle2 className="w-3 h-3" />
            <span>Completed</span>
          </span>
        );
      case 'unknown':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-2xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60 animate-pulse">
            <HelpCircle className="w-3 h-3" />
            <span>Unknown (Ambiguous)</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-2xs font-semibold bg-rose-950/60 text-rose-300 border border-rose-800/60">
            <AlertCircle className="w-3 h-3" />
            <span>Failed</span>
          </span>
        );
      case 'dispatching':
      case 'compiling':
      case 'validating':
      case 'queued':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-2xs font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/60">
            <Activity className="w-3 h-3 animate-spin" />
            <span className="capitalize">{status}</span>
          </span>
        );
      case 'skipped':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-2xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
            <MinusCircle className="w-3 h-3" />
            <span>Skipped</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-2xs font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/60">
            <Ban className="w-3 h-3" />
            <span>Cancelled</span>
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-2xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
            <Clock className="w-3 h-3" />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full space-y-2">
      {/* Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-900/60 p-2.5 rounded border border-zinc-800">
        <div className="flex items-center space-x-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="bg-zinc-800 text-zinc-200 text-xs px-2.5 py-1.5 rounded border border-zinc-700 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Items ({items.length})</option>
            <option value="attention">Needs Attention (Unknown / Failed)</option>
            <option value="pending">Pending</option>
            <option value="dispatching">In-Flight / Dispatching</option>
            <option value="completed">Completed</option>
            <option value="unknown">Unknown</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Search */}
          <input
            type="text"
            placeholder="Search record # or Job ID..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-zinc-800 text-zinc-200 text-xs px-2.5 py-1.5 rounded border border-zinc-700 placeholder-zinc-500 focus:outline-none focus:border-blue-500 w-48"
          />
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center space-x-2 text-xs text-zinc-400">
          <span>Items per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-zinc-800 text-zinc-200 px-2 py-1 rounded border border-zinc-700"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <span className="text-zinc-500">|</span>

          <span>
            Page {safePage} of {totalPages} ({filteredItems.length} items)
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="p-1 rounded bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="p-1 rounded bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Virtualized/Paginated Table Container */}
      <div className="flex-1 overflow-auto border border-zinc-800 rounded bg-zinc-950 min-h-[300px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-zinc-900 text-zinc-400 uppercase tracking-wider text-2xs border-b border-zinc-800 select-none">
            <tr>
              <th className="py-2.5 px-3">Item / Record</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Attempts</th>
              <th className="py-2.5 px-3">Print Job Ref</th>
              <th className="py-2.5 px-3">Error / Note</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-mono">
            {pagedItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-500 font-sans">
                  No production items match the filter.
                </td>
              </tr>
            ) : (
              pagedItems.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="py-2 px-3">
                    <span className="font-semibold text-zinc-200">#{item.recordIndex + 1}</span>
                    <span className="text-3xs text-zinc-500 block truncate max-w-[120px]" title={item.id}>
                      {item.id.slice(0, 8)}...
                    </span>
                  </td>
                  <td className="py-2 px-3">{getStatusBadge(item.status)}</td>
                  <td className="py-2 px-3 text-zinc-300">{item.attempts}</td>
                  <td className="py-2 px-3 text-zinc-400">
                    {item.printJobId ? (
                      <span className="text-2xs bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/50" title={item.printJobId}>
                        {item.printJobId.slice(0, 8)}...
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 font-sans text-2xs max-w-xs truncate">
                    {item.error ? (
                      <span className="text-rose-400" title={item.error.message}>
                        [{item.error.code}] {item.error.message}
                      </span>
                    ) : item.status === 'unknown' ? (
                      <span className="text-amber-400">Ambiguous delivery — verification required</span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-sans space-x-1">
                    {/* Action buttons based on status */}
                    {item.status === 'unknown' && onResolveUnknown && (
                      <div className="inline-flex items-center space-x-1">
                        <button
                          onClick={() => onResolveUnknown(item.id, 'mark_completed')}
                          title="Mark Completed: label was confirmed to be printed"
                          className="px-2 py-0.5 text-2xs bg-emerald-700 hover:bg-emerald-600 text-white rounded font-medium transition-colors"
                        >
                          <Check className="w-3 h-3 inline mr-0.5" />
                          Printed
                        </button>
                        <button
                          onClick={() => onResolveUnknown(item.id, 'skip')}
                          title="Skip item"
                          className="px-2 py-0.5 text-2xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded font-medium transition-colors"
                        >
                          <Slash className="w-3 h-3 inline mr-0.5" />
                          Skip
                        </button>
                        <button
                          onClick={() => setConfirmRetryItem(item)}
                          title="Retry printing item"
                          className="px-2 py-0.5 text-2xs bg-amber-700 hover:bg-amber-600 text-white rounded font-medium transition-colors"
                        >
                          <RotateCcw className="w-3 h-3 inline mr-0.5" />
                          Retry
                        </button>
                      </div>
                    )}

                    {item.status === 'failed' && (
                      <div className="inline-flex items-center space-x-1">
                        {onRetryFailed && (
                          <button
                            onClick={() => onRetryFailed(item.id)}
                            className="px-2 py-0.5 text-2xs bg-blue-700 hover:bg-blue-600 text-white rounded font-medium transition-colors"
                          >
                            <RotateCcw className="w-3 h-3 inline mr-0.5" />
                            Retry
                          </button>
                        )}
                        {onSkipItem && (
                          <button
                            onClick={() => onSkipItem(item.id)}
                            className="px-2 py-0.5 text-2xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded font-medium transition-colors"
                          >
                            Skip
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal for Retry on UNKNOWN item */}
      {confirmRetryItem && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-amber-500/60 rounded-lg max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Warning: Ambiguous Print Job</h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Record #{confirmRetryItem.recordIndex + 1} experienced an ambiguous transmission status. The printer may have already received and printed this physical label.
                </p>
                <p className="text-xs font-semibold text-amber-400 pt-1">
                  Retrying anyway may produce a duplicate physical label on the printer with the same serial number.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setConfirmRetryItem(null)}
                className="px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onResolveUnknown) {
                    onResolveUnknown(confirmRetryItem.id, 'retry', true);
                  }
                  setConfirmRetryItem(null);
                }}
                className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded shadow transition-colors"
              >
                Retry Anyway (Duplicate Risk)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
