import React, { useMemo } from 'react';
import {
  Dataset,
  FieldMapping,
  FieldMappingRule,
  validateFieldMapping,
  NullHandlingPolicy,
} from '../../../core/data-sources';
import { DataField } from '../../../core/data/data.schema';
import { ArrowRight, AlertCircle, CheckCircle2, Wand2, Trash2 } from 'lucide-react';

interface FieldMappingEditorProps {
  dataset: Dataset;
  dataFields: DataField[];
  mapping: FieldMapping;
  onChange: (newMapping: FieldMapping) => void;
}

export const FieldMappingEditor: React.FC<FieldMappingEditorProps> = ({
  dataset,
  dataFields,
  mapping,
  onChange,
}) => {
  // Live Validation
  const validation = useMemo(() => {
    return validateFieldMapping(mapping, dataset, dataFields);
  }, [mapping, dataset, dataFields]);

  // Handle setting or updating a mapping rule
  const handleSetTargetField = (columnKey: string, targetFieldId: string) => {
    // If targetFieldId is empty, remove the rule
    if (!targetFieldId) {
      const updatedRules = mapping.rules.filter((r) => r.sourceColumnKey !== columnKey);
      onChange({ rules: updatedRules });
      return;
    }

    const field = dataFields.find((f) => f.id === targetFieldId);
    if (!field) return;

    // Remove any existing rule for this column or this field (avoid duplicates)
    const filtered = mapping.rules.filter(
      (r) => r.sourceColumnKey !== columnKey && r.dataFieldId !== field.id
    );

    const newRule: FieldMappingRule = {
      dataFieldId: field.id,
      dataFieldName: field.name,
      sourceColumnKey: columnKey,
      nullHandling: 'default',
    };

    onChange({ rules: [...filtered, newRule] });
  };

  const handleUpdateRule = (columnKey: string, patch: Partial<FieldMappingRule>) => {
    const updated = mapping.rules.map((r) => {
      if (r.sourceColumnKey === columnKey) {
        return { ...r, ...patch };
      }
      return r;
    });
    onChange({ rules: updated });
  };

  // Auto-map columns to fields with matching names
  const handleAutoMap = () => {
    const newRules: FieldMappingRule[] = [];
    const usedFieldIds = new Set<string>();

    for (const col of dataset.columns) {
      const normalizedCol = col.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      const match = dataFields.find((f) => {
        if (usedFieldIds.has(f.id)) return false;
        const normalizedField = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalizedCol === normalizedField;
      });

      if (match) {
        usedFieldIds.add(match.id);
        newRules.push({
          dataFieldId: match.id,
          dataFieldName: match.name,
          sourceColumnKey: col.key,
          nullHandling: 'default',
        });
      }
    }

    onChange({ rules: newRules });
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Action Header & Validation Banner */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-300">
          Asocia las columnas de tu fuente externa con las variables de la etiqueta.
        </div>
        <button
          onClick={handleAutoMap}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-blue-400 rounded text-xs transition-colors border border-zinc-700"
          title="Mapear automáticamente por coincidencia de nombre"
        >
          <Wand2 className="w-3 h-3" />
          <span>Auto-mapear</span>
        </button>
      </div>

      {/* Validation Status */}
      {validation.valid ? (
        <div className="flex items-center gap-2 p-2 bg-emerald-950/40 border border-emerald-800/50 rounded text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Mapeo consistente: todos los campos requeridos están correctamente asignados.</span>
        </div>
      ) : (
        <div className="p-2.5 bg-rose-950/40 border border-rose-800/50 rounded text-rose-300 text-xs space-y-1">
          <div className="flex items-center gap-2 font-medium text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Inconsistencias detectadas en el mapeo:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-2xs pl-2 text-rose-300">
            {validation.errors.map((err, idx) => (
              <li key={idx}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Mapping Table */}
      <div className="flex-1 overflow-auto border border-zinc-700/60 rounded bg-zinc-950">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 font-semibold w-1/3">Columna Fuente (Origen)</th>
              <th className="px-2 py-2 w-8 text-center text-zinc-600"></th>
              <th className="px-3 py-2 font-semibold w-1/3">Campo de Etiqueta (Destino)</th>
              <th className="px-3 py-2 font-semibold w-1/4">Política Null</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {dataset.columns.map((col) => {
              const currentRule = mapping.rules.find((r) => r.sourceColumnKey === col.key);

              return (
                <tr key={col.key} className="hover:bg-zinc-900/40 transition-colors">
                  {/* Source Column */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-zinc-200">{col.label}</span>
                      <span className="text-2xs font-mono text-zinc-500">({col.inferredType})</span>
                    </div>
                  </td>

                  {/* Arrow Indicator */}
                  <td className="px-2 py-2 text-center text-zinc-600">
                    <ArrowRight className={`w-3.5 h-3.5 ${currentRule ? 'text-blue-400' : 'text-zinc-600'}`} />
                  </td>

                  {/* Target DataField Dropdown */}
                  <td className="px-3 py-2">
                    <select
                      value={currentRule?.dataFieldId || ''}
                      onChange={(e) => handleSetTargetField(col.key, e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Sin mapear --</option>
                      {dataFields.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.name} ({field.type}
                          {field.type === 'input' && field.required ? ' *' : ''})
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Null Policy & Fallback */}
                  <td className="px-3 py-2">
                    {currentRule ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={currentRule.nullHandling || 'default'}
                          onChange={(e) =>
                            handleUpdateRule(col.key, {
                              nullHandling: e.target.value as NullHandlingPolicy,
                            })
                          }
                          className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-2xs text-zinc-300 focus:outline-none"
                        >
                          <option value="default">Default</option>
                          <option value="empty">Vacío ("")</option>
                          <option value="error">Error</option>
                        </select>
                        {currentRule.nullHandling === 'default' && (
                          <input
                            type="text"
                            placeholder="Fallback opcional"
                            value={currentRule.fallbackValue || ''}
                            onChange={(e) =>
                              handleUpdateRule(col.key, { fallbackValue: e.target.value })
                            }
                            className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-2xs text-zinc-300 w-24 focus:outline-none"
                          />
                        )}
                        <button
                          onClick={() => handleSetTargetField(col.key, '')}
                          className="text-zinc-500 hover:text-rose-400 p-1 transition-colors"
                          title="Eliminar mapeo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-2xs text-zinc-600 italic">No mapeado</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
