import React, { useEffect, useState } from 'react';
import type { PrinterProfile, PrinterDpi } from '../../../core/printing';
import type { SystemPrinterInfo } from '../../../main/printing/discovery/system-printers.types';
import { Wifi, Printer, Trash2, CheckCircle2, AlertTriangle, Plus } from 'lucide-react';

export const ProfileManager: React.FC = () => {
  const [profiles, setProfiles] = useState<PrinterProfile[]>([]);
  const [systemPrinters, setSystemPrinters] = useState<SystemPrinterInfo[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // New Profile Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'tcp' | 'system'>('tcp');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(9100);
  const [dpi, setDpi] = useState<PrinterDpi>(203);
  const [selectedSystemPrinter, setSelectedSystemPrinter] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    if (window.printAPI) {
      const pList = await window.printAPI.listProfiles();
      setProfiles(pList);
      const sList = await window.printAPI.listPrinters();
      setSystemPrinters(sList);
      if (sList.length > 0 && !selectedSystemPrinter) {
        setSelectedSystemPrinter(sList[0].name);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTestConnection = async (profileId: string) => {
    if (!window.printAPI) return;
    setTestingId(profileId);
    setTestResult(null);
    try {
      const res = await window.printAPI.testConnection(profileId);
      setTestResult({ id: profileId, success: res.success, message: res.message });
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!window.printAPI) return;
    await window.printAPI.deleteProfile(profileId);
    loadData();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.printAPI) return;
    setFormError(null);

    const newId = crypto.randomUUID();

    let rawProfile: Record<string, unknown>;

    if (type === 'tcp') {
      if (!host.trim()) {
        setFormError('Host / IP address is required for TCP connection');
        return;
      }
      rawProfile = {
        id: newId,
        name: name.trim() || `Zebra ${host}`,
        connection: {
          type: 'tcp',
          host: host.trim(),
          port: Number(port) || 9100,
          timeoutMs: 5000,
        },
        language: 'zpl',
        dpi,
        enabled: true,
      };
    } else {
      if (!selectedSystemPrinter) {
        setFormError('Please select a system printer');
        return;
      }
      rawProfile = {
        id: newId,
        name: name.trim() || selectedSystemPrinter,
        connection: {
          type: 'system',
          printerName: selectedSystemPrinter,
        },
        language: 'pdf',
        enabled: true,
      };
    }

    const res = await window.printAPI.saveProfile(rawProfile);
    if (!res.success) {
      setFormError(res.errors?.join(', ') || 'Failed to save profile');
      return;
    }

    // Reset and reload
    setName('');
    setHost('');
    setShowAddForm(false);
    loadData();
  };

  return (
    <div className="space-y-4 max-h-96 overflow-y-auto pr-1 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-neutral-200">Configured Printer Profiles</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
        >
          <Plus size={14} />
          <span>{showAddForm ? 'Cancel' : 'Add Profile'}</span>
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSaveProfile} className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg space-y-3">
          <div className="font-medium text-neutral-300">New Printer Profile</div>

          {formError && (
            <div className="p-2 bg-rose-950/40 border border-rose-800 text-rose-300 rounded">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-400 mb-1">Profile Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Shipping Line 1"
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-200"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1">Connection Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'tcp' | 'system')}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-200"
              >
                <option value="tcp">TCP RAW (Thermal / Port 9100)</option>
                <option value="system">OS Spooler (PDF Printer)</option>
              </select>
            </div>
          </div>

          {type === 'tcp' ? (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-neutral-400 mb-1">Host / IP</label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="192.168.1.100"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-200"
                  required
                />
              </div>
              <div>
                <label className="block text-neutral-400 mb-1">Port</label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-200"
                />
              </div>
              <div>
                <label className="block text-neutral-400 mb-1">DPI</label>
                <select
                  value={dpi}
                  onChange={(e) => setDpi(Number(e.target.value) as PrinterDpi)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-200"
                >
                  <option value={203}>203 DPI</option>
                  <option value={300}>300 DPI</option>
                  <option value={600}>600 DPI</option>
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-neutral-400 mb-1">Select Installed System Printer</label>
              {systemPrinters.length > 0 ? (
                <select
                  value={selectedSystemPrinter}
                  onChange={(e) => setSelectedSystemPrinter(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-200"
                >
                  {systemPrinters.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.displayName} {p.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={selectedSystemPrinter}
                  onChange={(e) => setSelectedSystemPrinter(e.target.value)}
                  placeholder="Printer name as registered in OS"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-200"
                  required
                />
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1 text-neutral-400 hover:text-neutral-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium transition"
            >
              Save Profile
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {profiles.map((p) => {
          const isTcp = p.connection.type === 'tcp';
          const isTesting = testingId === p.id;
          const currentTestResult = testResult?.id === p.id ? testResult : null;

          return (
            <div
              key={p.id}
              className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isTcp ? (
                    <Wifi size={16} className="text-emerald-400" />
                  ) : (
                    <Printer size={16} className="text-blue-400" />
                  )}
                  <span className="font-medium text-neutral-200">{p.name}</span>
                  <span className="px-1.5 py-0.5 text-[10px] bg-neutral-800 text-neutral-400 rounded font-mono uppercase">
                    {p.language} {p.dpi ? `@ ${p.dpi} DPI` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection(p.id)}
                    disabled={isTesting}
                    className="px-2 py-1 text-[11px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition disabled:opacity-50"
                  >
                    {isTesting ? 'Testing...' : 'Test Connection'}
                  </button>

                  <button
                    onClick={() => handleDeleteProfile(p.id)}
                    className="p-1 text-neutral-500 hover:text-rose-400 transition"
                    title="Delete profile"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="text-[11px] font-mono text-neutral-400 flex items-center gap-4">
                {p.connection.type === 'tcp' ? (
                  <span>
                    TCP Socket: {p.connection.host}:{p.connection.port}
                  </span>
                ) : (
                  <span>Spooler Printer: {p.connection.printerName}</span>
                )}
                <span>Status: {p.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>

              {currentTestResult && (
                <div
                  className={`flex items-center gap-1.5 p-1.5 rounded text-[11px] ${
                    currentTestResult.success
                      ? 'bg-emerald-950/40 border border-emerald-800/50 text-emerald-300'
                      : 'bg-rose-950/40 border border-rose-800/50 text-rose-300'
                  }`}
                >
                  {currentTestResult.success ? (
                    <CheckCircle2 size={13} />
                  ) : (
                    <AlertTriangle size={13} />
                  )}
                  <span>{currentTestResult.message}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
