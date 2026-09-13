import React, { useState } from 'react';
import {
  ExternalDataSource,
  DataSourceType,
  Dataset,
  FieldMapping,
  CsvDataSourceConfig,
  ExcelDataSourceConfig,
  SqlDataSourceConfig,
  RestDataSourceConfig,
} from '../../../core/data-sources';
import { DataField } from '../../../core/data/data.schema';
import { DataSourcePreviewTable } from './DataSourcePreviewTable';
import { FieldMappingEditor } from './FieldMappingEditor';
import {
  X,
  Database,
  FileSpreadsheet,
  FileText,
  Globe,
  Play,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';

interface DataSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataFields: DataField[];
  initialSource?: ExternalDataSource | null;
  initialMapping?: FieldMapping;
  onSave: (source: ExternalDataSource, mapping: FieldMapping) => void;
  onTestConnection?: (source: ExternalDataSource) => Promise<{ success: boolean; message?: string }>;
  onLoadPreview?: (source: ExternalDataSource) => Promise<Dataset>;
  onSelectFile?: (type: 'csv' | 'excel') => Promise<string | null>;
}

export const DataSourcesModal: React.FC<DataSourcesModalProps> = ({
  isOpen,
  onClose,
  dataFields,
  initialSource,
  initialMapping,
  onSave,
  onTestConnection,
  onLoadPreview,
  onSelectFile,
}) => {
  if (!isOpen) return null;

  // Active Tab: 'config' | 'preview' | 'mapping'
  const [activeTab, setActiveTab] = useState<'config' | 'preview' | 'mapping'>('config');

  // Source Type
  const [sourceType, setSourceType] = useState<DataSourceType>(initialSource?.type || 'csv');
  const [sourceName, setSourceName] = useState(initialSource?.name || 'Fuente Externa');

  // Config States
  const [csvConfig, setCsvConfig] = useState<CsvDataSourceConfig>(
    initialSource?.type === 'csv'
      ? initialSource.config
      : {
          filePath: '',
          delimiter: ',',
          hasHeader: true,
          encoding: 'utf-8',
          skipEmptyLines: true,
        }
  );

  const [excelConfig, setExcelConfig] = useState<ExcelDataSourceConfig>(
    initialSource?.type === 'excel'
      ? initialSource.config
      : {
          filePath: '',
          sheetName: '',
          headerRow: 1,
        }
  );

  const [sqlConfig, setSqlConfig] = useState<SqlDataSourceConfig>(
    initialSource?.type === 'sql'
      ? initialSource.config
      : {
          engine: 'mssql',
          host: 'localhost',
          port: 1433,
          database: '',
          username: '',
          queryMode: 'table',
          tableName: '',
          timeoutMs: 30000,
          encrypt: true,
          trustServerCertificate: false,
        }
  );

  const [restConfig, setRestConfig] = useState<RestDataSourceConfig>(
    initialSource?.type === 'rest'
      ? initialSource.config
      : {
          url: 'https://api.example.com/data',
          method: 'GET',
          headers: [],
          timeoutMs: 10000,
        }
  );

  // Mapping and Preview States
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>(initialMapping || { rules: [] });
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Helper to build the current ExternalDataSource object
  const buildCurrentSource = (): ExternalDataSource => {
    const id = initialSource?.id || crypto.randomUUID();
    const name = sourceName || 'Fuente de Datos';

    if (sourceType === 'csv') {
      return { id, name, type: 'csv', enabled: true, config: csvConfig };
    }
    if (sourceType === 'excel') {
      return { id, name, type: 'excel', enabled: true, config: excelConfig };
    }
    if (sourceType === 'sql') {
      return { id, name, type: 'sql', enabled: true, config: sqlConfig };
    }
    return { id, name, type: 'rest', enabled: true, config: restConfig };
  };

  const handleTestConnection = async () => {
    if (!onTestConnection) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await onTestConnection(buildCurrentSource());
      setTestResult(res);
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleLoadPreview = async () => {
    if (!onLoadPreview) return;
    setIsLoadingPreview(true);
    try {
      const data = await onLoadPreview(buildCurrentSource());
      setDataset(data);
      setActiveTab('preview');
    } catch (err: unknown) {
      alert(`Error al cargar vista previa: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleFileBrowse = async () => {
    if (!onSelectFile) return;
    const selected = await onSelectFile(sourceType === 'csv' ? 'csv' : 'excel');
    if (selected) {
      if (sourceType === 'csv') {
        setCsvConfig((prev) => ({ ...prev, filePath: selected }));
      } else {
        setExcelConfig((prev) => ({ ...prev, filePath: selected }));
      }
    }
  };

  const handleSave = () => {
    onSave(buildCurrentSource(), mapping);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl w-full max-w-4xl h-[640px] flex flex-col overflow-hidden text-zinc-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-semibold">Configuración de Fuente Externa de Datos</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 pt-2 border-b border-zinc-800 bg-zinc-950 text-xs">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 font-medium border-b-2 transition-colors ${
              activeTab === 'config'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            1. Origen y Parámetros
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 font-medium border-b-2 transition-colors ${
              activeTab === 'preview'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            2. Vista Previa {dataset ? `(${dataset.rows.length} filas)` : ''}
          </button>
          <button
            onClick={() => setActiveTab('mapping')}
            className={`px-3 py-1.5 font-medium border-b-2 transition-colors ${
              activeTab === 'mapping'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            3. Mapeo de Variables ({mapping.rules.length} asignadas)
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 p-4 overflow-y-auto bg-zinc-900">
          {activeTab === 'config' && (
            <div className="space-y-4 max-w-2xl">
              {/* Name & Type Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold text-zinc-400 uppercase mb-1">
                    Nombre de la Fuente
                  </label>
                  <input
                    type="text"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                    placeholder="Ej. Catálogo Productos"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-zinc-400 uppercase mb-1">
                    Tipo de Adaptador
                  </label>
                  <div className="flex rounded border border-zinc-700 bg-zinc-950 p-0.5">
                    <button
                      type="button"
                      onClick={() => setSourceType('csv')}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-2xs font-medium transition-colors ${
                        sourceType === 'csv'
                          ? 'bg-blue-600 text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <FileText className="w-3 h-3" /> CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceType('excel')}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-2xs font-medium transition-colors ${
                        sourceType === 'excel'
                          ? 'bg-emerald-600 text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <FileSpreadsheet className="w-3 h-3" /> Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceType('sql')}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-2xs font-medium transition-colors ${
                        sourceType === 'sql'
                          ? 'bg-amber-600 text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Database className="w-3 h-3" /> SQL
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceType('rest')}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-2xs font-medium transition-colors ${
                        sourceType === 'rest'
                          ? 'bg-purple-600 text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Globe className="w-3 h-3" /> REST
                    </button>
                  </div>
                </div>
              </div>

              {/* Source-specific configuration */}
              {sourceType === 'csv' && (
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded space-y-3">
                  <div>
                    <label className="block text-2xs font-semibold text-zinc-400 uppercase mb-1">
                      Ruta del Archivo CSV
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={csvConfig.filePath}
                        onChange={(e) => setCsvConfig({ ...csvConfig, filePath: e.target.value })}
                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
                        placeholder="C:\ruta\al\archivo.csv"
                      />
                      <button
                        type="button"
                        onClick={handleFileBrowse}
                        className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs text-zinc-200"
                      >
                        <FolderOpen className="w-3.5 h-3.5" /> Explorar...
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs font-semibold text-zinc-400 uppercase mb-1">
                        Delimitador
                      </label>
                      <select
                        value={csvConfig.delimiter}
                        onChange={(e) =>
                          setCsvConfig({ ...csvConfig, delimiter: e.target.value as any })
                        }
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                      >
                        <option value=",">Coma (,)</option>
                        <option value=";">Punto y coma (;)</option>
                        <option value="&#9;">Tabulador (\t)</option>
                        <option value="|">Barra (|)</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="csvHasHeader"
                        checked={csvConfig.hasHeader}
                        onChange={(e) =>
                          setCsvConfig({ ...csvConfig, hasHeader: e.target.checked })
                        }
                        className="rounded border-zinc-700 bg-zinc-900"
                      />
                      <label htmlFor="csvHasHeader" className="text-xs text-zinc-300">
                        La primera fila contiene encabezados
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {sourceType === 'excel' && (
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded space-y-3">
                  <div>
                    <label className="block text-2xs font-semibold text-zinc-400 uppercase mb-1">
                      Ruta del Archivo Excel (.xlsx)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={excelConfig.filePath}
                        onChange={(e) => setExcelConfig({ ...excelConfig, filePath: e.target.value })}
                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
                        placeholder="C:\ruta\al\archivo.xlsx"
                      />
                      <button
                        type="button"
                        onClick={handleFileBrowse}
                        className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs text-zinc-200"
                      >
                        <FolderOpen className="w-3.5 h-3.5" /> Explorar...
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs font-semibold text-zinc-400 uppercase mb-1">
                        Nombre de la Hoja (Opcional)
                      </label>
                      <input
                        type="text"
                        value={excelConfig.sheetName || ''}
                        onChange={(e) => setExcelConfig({ ...excelConfig, sheetName: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                        placeholder="Primera hoja por defecto"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-zinc-400 uppercase mb-1">
                        Fila de Encabezados
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={excelConfig.headerRow}
                        onChange={(e) =>
                          setExcelConfig({ ...excelConfig, headerRow: parseInt(e.target.value) || 1 })
                        }
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                      />
                    </div>
                  </div>
                </div>
              )}

              {sourceType === 'sql' && (
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-2xs font-semibold text-zinc-400 uppercase mb-1">
                        Motor SQL
                      </label>
                      <select
                        value={sqlConfig.engine}
                        onChange={(e) => setSqlConfig({ ...sqlConfig, engine: e.target.value as any })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                      >
                        <option value="mssql">SQL Server (T-SQL)</option>
                        <option value="postgres">PostgreSQL</option>
                        <option value="mysql">MySQL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-zinc-400 uppercase mb-1">
                        Host / Servidor
                      </label>
                      <input
                        type="text"
                        value={sqlConfig.host}
                        onChange={(e) => setSqlConfig({ ...sqlConfig, host: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                        placeholder="localhost o 10.0.0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-zinc-400 uppercase mb-1">
                        Puerto
                      </label>
                      <input
                        type="number"
                        value={sqlConfig.port}
                        onChange={(e) =>
                          setSqlConfig({ ...sqlConfig, port: parseInt(e.target.value) || 1433 })
                        }
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs font-semibold text-zinc-400 uppercase mb-1">
                        Base de Datos
                      </label>
                      <input
                        type="text"
                        value={sqlConfig.database}
                        onChange={(e) => setSqlConfig({ ...sqlConfig, database: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                        placeholder="Nombre de la base de datos"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-zinc-400 uppercase mb-1">
                        Usuario (Read-only)
                      </label>
                      <input
                        type="text"
                        value={sqlConfig.username}
                        onChange={(e) => setSqlConfig({ ...sqlConfig, username: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-zinc-400 uppercase mb-1">
                      Tabla o Vista
                    </label>
                    <input
                      type="text"
                      value={sqlConfig.tableName || ''}
                      onChange={(e) => setSqlConfig({ ...sqlConfig, tableName: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                      placeholder="dbo.Products"
                    />
                  </div>
                </div>
              )}

              {sourceType === 'rest' && (
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded space-y-3">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-1">
                      <label className="block text-2xs font-semibold text-zinc-400 uppercase mb-1">
                        Método
                      </label>
                      <select
                        value={restConfig.method}
                        onChange={(e) => setRestConfig({ ...restConfig, method: e.target.value as any })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="block text-2xs font-semibold text-zinc-400 uppercase mb-1">
                        URL del Endpoint (http/https)
                      </label>
                      <input
                        type="url"
                        value={restConfig.url}
                        onChange={(e) => setRestConfig({ ...restConfig, url: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                        placeholder="https://api.empresa.com/v1/etiquetas"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-zinc-400 uppercase mb-1">
                      Ruta JSON de Datos (Opcional)
                    </label>
                    <input
                      type="text"
                      value={restConfig.dataPath || ''}
                      onChange={(e) => setRestConfig({ ...restConfig, dataPath: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                      placeholder="data.items o results"
                    />
                  </div>
                </div>
              )}

              {/* Test Connection Actions & Status */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs font-medium text-zinc-200 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>Probar Conexión</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadPreview}
                  disabled={isLoadingPreview}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium text-white transition-colors disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{isLoadingPreview ? 'Cargando...' : 'Cargar Vista Previa'}</span>
                </button>

                {testResult && (
                  <div
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border ${
                      testResult.success
                        ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                        : 'bg-rose-950/50 border-rose-800 text-rose-300'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5" />
                    )}
                    <span>{testResult.message || (testResult.success ? 'Conexión exitosa' : 'Fallo de conexión')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <DataSourcePreviewTable dataset={dataset} loading={isLoadingPreview} />
          )}

          {activeTab === 'mapping' && (
            dataset ? (
              <FieldMappingEditor
                dataset={dataset}
                dataFields={dataFields}
                mapping={mapping}
                onChange={setMapping}
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-zinc-500 text-xs text-center">
                <Database className="w-8 h-8 text-zinc-600 mb-2" />
                <p>Primero debes cargar una vista previa de la fuente externa.</p>
                <button
                  onClick={() => setActiveTab('config')}
                  className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs"
                >
                  Ir a Configuración
                </button>
              </div>
            )
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 bg-zinc-950">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 transition-colors"
          >
            Cancelar
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-semibold text-white transition-colors"
            >
              Guardar y Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
