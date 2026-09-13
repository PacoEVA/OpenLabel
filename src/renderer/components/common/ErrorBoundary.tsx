import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw, FileText } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorId: string;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorId: '',
      errorMessage: '',
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;
    return {
      hasError: true,
      errorId,
      errorMessage: error.message || 'An unexpected rendering error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an unhandled React error:', {
      errorId: this.state.errorId,
      message: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleExportDiagnostics = async (): Promise<void> => {
    if ((window as any).diagnosticsAPI) {
      await (window as any).diagnosticsAPI.exportDiagnosticsBundle();
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6 select-none font-sans">
          <div className="bg-zinc-900 border border-rose-900/60 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                <AlertOctagon className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-wide">Application Encountered an Error</h1>
                <p className="text-2xs text-zinc-400">The session has been suspended safely to protect your data</p>
              </div>
            </div>

            <div className="bg-zinc-950/80 border border-zinc-800 rounded-lg p-3 space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between text-2xs text-zinc-400">
                <span>Reference Code:</span>
                <span className="text-rose-400 font-bold">{this.state.errorId}</span>
              </div>
              <div className="text-2xs text-zinc-300 truncate" title={this.state.errorMessage}>
                {this.state.errorMessage}
              </div>
            </div>

            <p className="text-2xs text-zinc-400 leading-relaxed">
              Your label design files on disk remain safe. You can reload the application workspace or generate a redacted diagnostics bundle to report this issue.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-zinc-800">
              <button
                onClick={this.handleExportDiagnostics}
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export Diagnostics</span>
              </button>

              <button
                onClick={this.handleReload}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reload Workspace</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
