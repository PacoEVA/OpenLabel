import React, { useState, useMemo } from 'react';
import {
  Database,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Hash,
  Type,
  FileText,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useEditorStore } from '../../store/editor.store';
import { selectDocument } from '../../store/selectors';
import {
  DataField,
  StaticField,
  InputField,
  DateField,
  CounterField,
  FIELD_NAME_REGEX,
  SUPPORTED_DATE_FORMATS,
  DateFormat,
} from '../../../core/data/data.schema';
import { findFieldUsages } from '../../../core/data/field-usage';
import { resolveCounterValue } from '../../../core/data/counter-engine';
import { resolveDateValue } from '../../../core/data/date-engine';

export const DataPanel: React.FC = () => {
  const document = useEditorStore(selectDocument);
  const addField = useEditorStore((s) => s.addField);
  const updateField = useEditorStore((s) => s.updateField);
  const removeField = useEditorStore((s) => s.removeField);

  // Preview state from store
  const isPreviewActive = useEditorStore((s) => s.isPreviewActive);
  const previewRecordIndex = useEditorStore((s) => s.previewRecordIndex);
  const previewInputs = useEditorStore((s) => s.previewInputs);
  const setPreviewActive = useEditorStore((s) => s.setPreviewActive);
  const setPreviewRecordIndex = useEditorStore((s) => s.setPreviewRecordIndex);
  const setPreviewInputs = useEditorStore((s) => s.setPreviewInputs);

  const fields = document.dataModel?.fields ?? [];

  // Form State for creating/editing fields
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Field Form Fields
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<DataField['type']>('static');

  // Static
  const [staticValue, setStaticValue] = useState('');

  // Input
  const [inputRequired, setInputRequired] = useState(true);
  const [inputDefaultValue, setInputDefaultValue] = useState('');

  // Date
  const [dateMode, setDateMode] = useState<'now' | 'relative'>('now');
  const [dateFormat, setDateFormat] = useState<DateFormat>('YYYY-MM-DD');
  const [dateDays, setDateDays] = useState(0);
  const [dateMonths, setDateMonths] = useState(0);
  const [dateYears, setDateYears] = useState(0);

  // Counter
  const [counterStart, setCounterStart] = useState(1);
  const [counterStep, setCounterStep] = useState(1);
  const [counterPadding, setCounterPadding] = useState(4);
  const [counterPrefix, setCounterPrefix] = useState('SN-');
  const [counterSuffix, setCounterSuffix] = useState('');

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingFieldId(null);
    setFormError(null);
    setFieldName('');
    setFieldType('static');
    setStaticValue('');
    setInputRequired(true);
    setInputDefaultValue('');
    setDateMode('now');
    setDateFormat('YYYY-MM-DD');
    setDateDays(0);
    setDateMonths(0);
    setDateYears(0);
    setCounterStart(1);
    setCounterStep(1);
    setCounterPadding(4);
    setCounterPrefix('SN-');
    setCounterSuffix('');
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (field: DataField) => {
    setEditingFieldId(field.id);
    setFieldName(field.name);
    setFieldType(field.type);
    setFormError(null);

    if (field.type === 'static') {
      setStaticValue(field.value);
    } else if (field.type === 'input') {
      setInputRequired(field.required);
      setInputDefaultValue(field.defaultValue ?? '');
    } else if (field.type === 'date') {
      setDateMode(field.mode);
      setDateFormat(field.format);
      setDateDays(field.offset?.days ?? 0);
      setDateMonths(field.offset?.months ?? 0);
      setDateYears(field.offset?.years ?? 0);
    } else if (field.type === 'counter') {
      setCounterStart(field.start);
      setCounterStep(field.step);
      setCounterPadding(field.padding);
      setCounterPrefix(field.prefix ?? '');
      setCounterSuffix(field.suffix ?? '');
    }
    setIsFormOpen(true);
  };

  const handleSaveField = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = fieldName.trim();
    if (!FIELD_NAME_REGEX.test(trimmedName)) {
      setFormError('Name must start with letter/underscore and contain only letters, digits, and underscores');
      return;
    }

    const fieldId = editingFieldId ?? crypto.randomUUID();
    let constructedField: DataField;

    if (fieldType === 'static') {
      constructedField = {
        id: fieldId,
        name: trimmedName,
        type: 'static',
        value: staticValue,
      } as StaticField;
    } else if (fieldType === 'input') {
      constructedField = {
        id: fieldId,
        name: trimmedName,
        type: 'input',
        required: inputRequired,
        defaultValue: inputDefaultValue.trim() !== '' ? inputDefaultValue : undefined,
      } as InputField;
    } else if (fieldType === 'date') {
      constructedField = {
        id: fieldId,
        name: trimmedName,
        type: 'date',
        mode: dateMode,
        format: dateFormat,
        offset:
          dateMode === 'relative'
            ? {
                days: dateDays !== 0 ? dateDays : undefined,
                months: dateMonths !== 0 ? dateMonths : undefined,
                years: dateYears !== 0 ? dateYears : undefined,
              }
            : undefined,
      } as DateField;
    } else {
      constructedField = {
        id: fieldId,
        name: trimmedName,
        type: 'counter',
        start: counterStart,
        step: Math.max(1, counterStep),
        padding: Math.max(0, counterPadding),
        prefix: counterPrefix !== '' ? counterPrefix : undefined,
        suffix: counterSuffix !== '' ? counterSuffix : undefined,
      } as CounterField;
    }

    if (editingFieldId) {
      const res = updateField(editingFieldId, constructedField);
      if (!res.success) {
        setFormError(res.error || 'Failed to update field');
        return;
      }
    } else {
      const res = addField(constructedField);
      if (!res.success) {
        setFormError(res.error || 'Failed to add field');
        return;
      }
    }

    resetForm();
  };

  const handleDeleteField = (id: string) => {
    const res = removeField(id);
    if (!res.success) {
      alert(res.error || 'Cannot delete field');
    }
  };

  // Preview value helper for field row
  const getFieldPreview = (field: DataField): string => {
    if (field.type === 'static') {
      return field.value;
    }
    if (field.type === 'input') {
      return previewInputs[field.name] || field.defaultValue || (field.required ? '<Required>' : '<Empty>');
    }
    if (field.type === 'counter') {
      return resolveCounterValue(field, previewRecordIndex);
    }
    if (field.type === 'date') {
      return resolveDateValue(field, { now: new Date() });
    }
    return '';
  };

  return (
    <div className="w-64 bg-panel-bg flex flex-col h-full text-xs select-none">
      {/* Panel Header */}
      <div className="h-10 px-3 border-b border-panel-border flex items-center justify-between bg-panel-header">
        <div className="flex items-center space-x-1.5 font-semibold text-zinc-200">
          <Database className="w-3.5 h-3.5 text-blue-400" />
          <span>Data Variables</span>
          <span className="text-2xs text-zinc-400 bg-zinc-800 px-1.5 py-0.2 rounded-full">
            {fields.length}
          </span>
        </div>
        {!isFormOpen && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center space-x-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-2xs font-medium transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>New</span>
          </button>
        )}
      </div>

      {/* Preview Controller Bar */}
      <div className="px-3 py-2 border-b border-panel-border bg-zinc-900/60">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-2xs font-semibold text-zinc-400 uppercase tracking-wider">
            Preview Mode
          </span>
          <button
            onClick={() => setPreviewActive(!isPreviewActive)}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-2xs transition-colors ${
              isPreviewActive
                ? 'bg-emerald-600 text-white font-medium'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {isPreviewActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>{isPreviewActive ? 'Active' : 'Off'}</span>
          </button>
        </div>

        {isPreviewActive && (
          <div className="flex items-center justify-between bg-zinc-950/70 border border-zinc-800 rounded px-2 py-1 mt-1">
            <span className="text-2xs text-zinc-400 font-mono">
              Record #{previewRecordIndex + 1}
            </span>
            <div className="flex items-center space-x-1">
              <button
                disabled={previewRecordIndex <= 0}
                onClick={() => setPreviewRecordIndex(previewRecordIndex - 1)}
                className="p-0.5 hover:bg-zinc-800 disabled:opacity-30 rounded text-zinc-300"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPreviewRecordIndex(previewRecordIndex + 1)}
                className="p-0.5 hover:bg-zinc-800 rounded text-zinc-300"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Form Modal / Inline Editor */}
        {isFormOpen && (
          <form
            onSubmit={handleSaveField}
            className="p-3 bg-zinc-900/90 border border-blue-500/40 rounded-lg space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
              <span className="font-semibold text-zinc-200 text-2xs uppercase tracking-wider">
                {editingFieldId ? 'Edit Variable' : 'Create Variable'}
              </span>
              <button
                type="button"
                onClick={resetForm}
                className="text-zinc-500 hover:text-zinc-300 text-xs"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-1.5 bg-rose-950/40 border border-rose-800/60 rounded text-2xs text-rose-300 flex items-start space-x-1">
                <AlertCircle className="w-3 h-3 shrink-0 mt-0.5 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            {/* Field Name */}
            <div>
              <label className="text-2xs text-zinc-400 block mb-1">Field Name (ID)</label>
              <input
                type="text"
                required
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="e.g. serial_number"
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            {/* Field Type */}
            <div>
              <label className="text-2xs text-zinc-400 block mb-1">Type</label>
              <select
                value={fieldType}
                disabled={!!editingFieldId}
                onChange={(e) => setFieldType(e.target.value as DataField['type'])}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="static">Static (Constant)</option>
                <option value="input">Input (Prompted at Print)</option>
                <option value="counter">Counter (Progressive)</option>
                <option value="date">Date (Timestamp / Offset)</option>
              </select>
            </div>

            {/* Type Specific Fields */}
            {fieldType === 'static' && (
              <div>
                <label className="text-2xs text-zinc-400 block mb-1">Constant Value</label>
                <input
                  type="text"
                  required
                  value={staticValue}
                  onChange={(e) => setStaticValue(e.target.value)}
                  placeholder="e.g. ACME Industries"
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {fieldType === 'input' && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="input-required"
                    checked={inputRequired}
                    onChange={(e) => setInputRequired(e.target.checked)}
                    className="rounded bg-zinc-950 border-zinc-700 text-blue-600 focus:ring-0"
                  />
                  <label htmlFor="input-required" className="text-2xs text-zinc-300">
                    Required before printing
                  </label>
                </div>
                <div>
                  <label className="text-2xs text-zinc-400 block mb-1">Default Value (Optional)</label>
                  <input
                    type="text"
                    value={inputDefaultValue}
                    onChange={(e) => setInputDefaultValue(e.target.value)}
                    placeholder="e.g. Default Lot"
                    className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {fieldType === 'counter' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-2xs text-zinc-400 block mb-1">Start Value</label>
                    <input
                      type="number"
                      required
                      value={counterStart}
                      onChange={(e) => setCounterStart(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-2xs text-zinc-400 block mb-1">Step (Increment)</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={counterStep}
                      onChange={(e) => setCounterStep(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <label className="text-2xs text-zinc-400 block mb-1">Padding</label>
                    <input
                      type="number"
                      min="0"
                      value={counterPadding}
                      onChange={(e) => setCounterPadding(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-1.5 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-2xs text-zinc-400 block mb-1">Prefix</label>
                    <input
                      type="text"
                      value={counterPrefix}
                      onChange={(e) => setCounterPrefix(e.target.value)}
                      placeholder="SN-"
                      className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-1.5 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-2xs text-zinc-400 block mb-1">Suffix</label>
                    <input
                      type="text"
                      value={counterSuffix}
                      onChange={(e) => setCounterSuffix(e.target.value)}
                      placeholder=""
                      className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-1.5 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {fieldType === 'date' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-2xs text-zinc-400 block mb-1">Date Mode</label>
                    <select
                      value={dateMode}
                      onChange={(e) => setDateMode(e.target.value as 'now' | 'relative')}
                      className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
                    >
                      <option value="now">Current (Now)</option>
                      <option value="relative">Relative Offset</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-2xs text-zinc-400 block mb-1">Format</label>
                    <select
                      value={dateFormat}
                      onChange={(e) => setDateFormat(e.target.value as DateFormat)}
                      className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                    >
                      {SUPPORTED_DATE_FORMATS.map((fmt) => (
                        <option key={fmt} value={fmt}>
                          {fmt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {dateMode === 'relative' && (
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label className="text-2xs text-zinc-400 block mb-1">+Days</label>
                      <input
                        type="number"
                        value={dateDays}
                        onChange={(e) => setDateDays(parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-1.5 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-2xs text-zinc-400 block mb-1">+Months</label>
                      <input
                        type="number"
                        value={dateMonths}
                        onChange={(e) => setDateMonths(parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-1.5 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-2xs text-zinc-400 block mb-1">+Years</label>
                      <input
                        type="number"
                        value={dateYears}
                        onChange={(e) => setDateYears(parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-1.5 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-2.5 py-1 text-zinc-400 hover:text-zinc-200 text-2xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-2xs font-medium rounded transition-colors"
              >
                {editingFieldId ? 'Update Field' : 'Create Field'}
              </button>
            </div>
          </form>
        )}

        {/* Fields List */}
        {fields.length === 0 && !isFormOpen ? (
          <div className="py-8 text-center text-zinc-500 italic space-y-1">
            <p>No variable fields defined.</p>
            <p className="text-2xs text-zinc-600">
              Click &quot;New&quot; above to add serial counters, dates, or inputs.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {fields.map((field) => {
              const usages = findFieldUsages(document, field.name);
              const previewVal = getFieldPreview(field);

              return (
                <div
                  key={field.id}
                  className="p-2.5 bg-zinc-900/50 hover:bg-zinc-800/40 border border-zinc-800 rounded-lg transition-colors space-y-1.5 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      {field.type === 'counter' && <Hash className="w-3.5 h-3.5 text-blue-400" />}
                      {field.type === 'date' && <Calendar className="w-3.5 h-3.5 text-emerald-400" />}
                      {field.type === 'input' && <Type className="w-3.5 h-3.5 text-amber-400" />}
                      {field.type === 'static' && <FileText className="w-3.5 h-3.5 text-purple-400" />}
                      <span className="font-mono font-semibold text-zinc-200">
                        {`{${field.name}}`}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(field)}
                        title="Edit Field"
                        className="p-1 hover:bg-zinc-700/60 rounded text-zinc-400 hover:text-zinc-200"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteField(field.id)}
                        disabled={usages.length > 0}
                        title={
                          usages.length > 0
                            ? `Cannot delete: used in ${usages.length} element(s)`
                            : 'Delete Field'
                        }
                        className={`p-1 rounded ${
                          usages.length > 0
                            ? 'text-zinc-600 cursor-not-allowed'
                            : 'hover:bg-zinc-700/60 text-zinc-400 hover:text-rose-400'
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-2xs text-zinc-400 pt-0.5">
                    <span className="capitalize text-zinc-500">{field.type}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full ${
                        usages.length > 0
                          ? 'bg-blue-950 text-blue-400 border border-blue-800/40'
                          : 'bg-zinc-800/60 text-zinc-500'
                      }`}
                    >
                      {usages.length === 1 ? '1 use' : `${usages.length} uses`}
                    </span>
                  </div>

                  {/* Live Value Preview */}
                  <div className="bg-zinc-950/80 border border-zinc-800/70 rounded px-2 py-1 text-2xs font-mono text-zinc-300 truncate">
                    <span className="text-zinc-500 select-none mr-1.5">Value:</span>
                    <span>{previewVal}</span>
                  </div>

                  {/* If Input field and in preview mode, let user test typing value */}
                  {field.type === 'input' && isPreviewActive && (
                    <div className="pt-1">
                      <input
                        type="text"
                        placeholder="Live preview test value..."
                        value={previewInputs[field.name] || ''}
                        onChange={(e) =>
                          setPreviewInputs({ ...previewInputs, [field.name]: e.target.value })
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-0.5 text-2xs text-zinc-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
