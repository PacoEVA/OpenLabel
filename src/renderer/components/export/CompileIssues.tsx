import React from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { CompileError, CompileWarning } from '../../../core/compilers/compile.types';

interface CompileIssuesProps {
  errors?: CompileError[];
  warnings?: CompileWarning[];
}

export const CompileIssues: React.FC<CompileIssuesProps> = ({ errors = [], warnings = [] }) => {
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 select-text">
      {errors.map((err, i) => (
        <div
          key={`err-${i}`}
          className="bg-rose-950/40 border border-rose-800/80 rounded p-2.5 text-xs flex items-start space-x-2 text-rose-200"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-rose-300">Error:</span>
              <span className="px-1.5 py-0.2 bg-rose-900/60 rounded text-2xs font-mono text-rose-200">
                {err.code}
              </span>
              {err.elementId && (
                <span className="text-2xs text-rose-400 font-mono">
                  (Element: {err.elementId.slice(0, 8)})
                </span>
              )}
            </div>
            <p className="mt-1 text-rose-300/90">{err.message}</p>
          </div>
        </div>
      ))}

      {warnings.map((warn, i) => (
        <div
          key={`warn-${i}`}
          className="bg-amber-950/40 border border-amber-800/80 rounded p-2.5 text-xs flex items-start space-x-2 text-amber-200"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-amber-300">Warning:</span>
              <span className="px-1.5 py-0.2 bg-amber-900/60 rounded text-2xs font-mono text-amber-200">
                {warn.code}
              </span>
              {warn.elementId && (
                <span className="text-2xs text-amber-400 font-mono">
                  (Element: {warn.elementId.slice(0, 8)})
                </span>
              )}
            </div>
            <p className="mt-1 text-amber-300/90">{warn.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
