import React from 'react';
import { Dataset, DatasetColumnType } from '../../../core/data-sources';
import { Database, AlertTriangle, Hash, Calendar, Type, CheckSquare } from 'lucide-react';

interface DataSourcePreviewTableProps {
  dataset: Dataset | null;
  loading?: boolean;
}

const getTypeBadge = (type: DatasetColumnType) => {
  switch (type) {
    case 'number':
      return (
        <span className="inline-flex items-center gap-0.5 text-2xs px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 font-mono">
          <Hash className="w-2.5 h-2.5" /> num
        </span>
      );
    case 'boolean':
      return (
        <span className="inline-flex items-center gap-0.5 text-2xs px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 font-mono">
          <CheckSquare className="w-2.5 h-2.5" /> bool
        </span>
      );
    case 'date':
      return (
        <span className="inline-flex items-center gap-0.5 text-2xs px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 font-mono">
          <Calendar className="w-2.5 h-2.5" /> date
        </span>
      );
    case 'string':
      return (
        <span className="inline-flex items-center gap-0.5 text-2xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
          <Type className="w-2.5 h-2.5" /> str
        </span>
      );
    default:
      return (
        <span className="text-2xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
          {type}
        </span>
      );
  }
};

export const DataSourcePreviewTable: React.FC<DataSourcePreviewTableProps> = ({
  dataset,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-zinc-400 text-xs">
        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2" />
        <span>Cargando datos...</span>
      </div>
    );
  }

  if (!dataset || dataset.columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-zinc-500 text-xs text-center">
        <Database className="w-8 h-8 text-zinc-600 mb-2" />
        <p>No hay datos cargados para vista previa.</p>
        <p className="text-2xs text-zinc-600 mt-1">Configura la fuente y pulsa "Cargar Vista Previa".</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden border border-zinc-700/60 rounded bg-zinc-950">
      {/* Table Metadata Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-2xs text-zinc-400">
        <div>
          <span>Columnas: <strong className="text-zinc-200">{dataset.columns.length}</strong></span>
          <span className="mx-2">•</span>
          <span>Filas mostradas: <strong className="text-zinc-200">{dataset.rows.length}</strong></span>
          {dataset.totalRows !== undefined && dataset.totalRows > dataset.rows.length && (
            <span> (de {dataset.totalRows} totales)</span>
          )}
        </div>
        {dataset.truncated && (
          <div className="flex items-center text-amber-400 gap-1 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
            <AlertTriangle className="w-3 h-3" />
            <span>Vista previa truncada a 100 filas</span>
          </div>
        )}
      </div>

      {/* Scrollable Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-zinc-900 text-zinc-300 shadow-sm border-b border-zinc-800 z-10">
            <tr>
              <th className="px-2.5 py-2 font-semibold text-zinc-500 w-10 text-center border-r border-zinc-800">
                #
              </th>
              {dataset.columns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 font-medium border-r border-zinc-800 last:border-r-0 whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5 justify-between">
                    <span className="text-zinc-200 font-semibold">{col.label}</span>
                    {getTypeBadge(col.inferredType)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-mono text-2xs">
            {dataset.rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-zinc-900/60 transition-colors">
                <td className="px-2.5 py-1.5 text-zinc-600 text-center border-r border-zinc-800/60 select-none">
                  {rowIdx + 1}
                </td>
                {dataset.columns.map((col) => {
                  const val = row[col.key];
                  const display =
                    val === null || val === undefined
                      ? '<null>'
                      : typeof val === 'object'
                      ? JSON.stringify(val)
                      : String(val);
                  const isNull = val === null || val === undefined;

                  return (
                    <td
                      key={col.key}
                      className={`px-3 py-1.5 border-r border-zinc-800/60 last:border-r-0 truncate max-w-xs ${
                        isNull ? 'text-zinc-600 italic' : 'text-zinc-300'
                      }`}
                      title={display}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
