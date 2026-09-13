import React, { useState, useEffect, useMemo } from 'react';
import { X, Copy, Check, FileCode, FileText, Download, Loader2 } from 'lucide-react';
import { useEditorStore } from '../../store/editor.store';
import { selectDocument } from '../../store/selectors';
import { compileLabelToZpl } from '../../../core/compilers/zpl/zpl-compiler';
import { CompileIssues } from './CompileIssues';

interface ExportPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportPreviewDialog: React.FC<ExportPreviewDialogProps> = ({ isOpen, onClose }) => {
  const document = useEditorStore(selectDocument);
  const [activeTab, setActiveTab] = useState<'zpl' | 'pdf'>('zpl');
  const [copied, setCopied] = useState(false);

  // PDF Generation State
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfErrors, setPdfErrors] = useState<string[]>([]);
  const [pdfWarnings, setPdfWarnings] = useState<Array<{ code: string; message: string }>>([]);

  // Compile ZPL whenever dialog is open and document changes
  const zplResult = useMemo(() => {
    if (!isOpen) return null;
    return compileLabelToZpl(document);
  }, [isOpen, document]);

  // Handle PDF Generation
  const handleGeneratePdf = async () => {
    setIsPdfLoading(true);
    setPdfErrors([]);
    setPdfWarnings([]);
    setPdfBase64(null);

    try {
      if (typeof window !== 'undefined' && window.labelAPI?.generatePdf) {
        const res = await window.labelAPI.generatePdf(document);
        if (res.success && res.pdfBase64) {
          setPdfBase64(res.pdfBase64);
          setPdfWarnings(res.warnings || []);
        } else {
          setPdfErrors(res.errors || ['Failed to generate PDF document']);
          setPdfWarnings(res.warnings || []);
        }
      } else {
        // Fallback message if running in non-Electron test/dev environment
        setPdfErrors(['PDF generation requires Electron Main Process via window.labelAPI']);
      }
    } catch (err: unknown) {
      setPdfErrors([err instanceof Error ? err.message : String(err)]);
    } finally {
      setIsPdfLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'pdf' && !pdfBase64 && !isPdfLoading) {
      handleGeneratePdf();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleCopyZpl = async () => {
    if (zplResult?.success && zplResult.data) {
      await navigator.clipboard.writeText(zplResult.data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfBase64) return;
    const byteCharacters = atob(pdfBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${document.meta.title || 'label'}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="h-12 px-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-zinc-100 text-sm">Export & Preview</span>
            <span className="text-2xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
              {document.dimensions.width} × {document.dimensions.height} {document.dimensions.unit} @ {document.dimensions.dpi} DPI
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 px-4">
          <button
            onClick={() => setActiveTab('zpl')}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'zpl'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>ZPL II Output</span>
          </button>
          <button
            onClick={() => setActiveTab('pdf')}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'pdf'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF Vector</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'zpl' && zplResult && (
            <div className="space-y-3">
              {/* Compile Issues */}
              <CompileIssues
                errors={!zplResult.success ? zplResult.errors : []}
                warnings={zplResult.warnings}
              />

              {zplResult.success ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-zinc-400 font-mono">
                      Generated ZPL ({zplResult.data.length} characters)
                    </span>
                    <button
                      onClick={handleCopyZpl}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs flex items-center space-x-1.5 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy ZPL</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded text-2xs font-mono text-emerald-400/90 whitespace-pre-wrap select-text max-h-72 overflow-y-auto">
                    {zplResult.data}
                  </pre>
                </div>
              ) : (
                <div className="p-4 bg-rose-950/20 border border-rose-900/50 rounded text-rose-300 text-xs text-center">
                  ZPL Compilation failed. Resolve the errors above to generate valid printer code.
                </div>
              )}
            </div>
          )}

          {activeTab === 'pdf' && (
            <div className="space-y-3">
              <CompileIssues
                errors={pdfErrors.map((msg) => ({ code: 'PDF_ERROR', message: msg }))}
                warnings={pdfWarnings}
              />

              {isPdfLoading ? (
                <div className="p-8 flex flex-col items-center justify-center space-y-2 text-zinc-400">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="text-xs">Generating physical vector PDF...</span>
                </div>
              ) : pdfBase64 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-emerald-400 font-medium">
                      ✓ Vector PDF generated ({Math.round((pdfBase64.length * 3) / 4 / 1024)} KB)
                    </span>
                    <button
                      onClick={handleDownloadPdf}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs flex items-center space-x-1.5 font-medium shadow-sm transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </button>
                  </div>

                  <iframe
                    src={`data:application/pdf;base64,${pdfBase64}`}
                    className="w-full h-72 rounded border border-zinc-800 bg-white"
                    title="PDF Preview"
                  />
                </div>
              ) : (
                <div className="p-4 flex justify-center">
                  <button
                    onClick={handleGeneratePdf}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs"
                  >
                    Generate PDF
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
