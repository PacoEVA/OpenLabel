import React, { useState } from 'react';
import { TopBar } from '../components/topbar/TopBar';
import { Toolbar } from '../components/toolbar/Toolbar';
import { EditorWorkspace } from './EditorWorkspace';
import { PropertiesPanel } from '../components/properties/PropertiesPanel';
import { LayersPanel } from '../components/layers/LayersPanel';
import { DataPanel } from '../components/data/DataPanel';
import { StatusBar } from '../components/statusbar/StatusBar';
import { Sliders, Layers as LayersIcon, Database } from 'lucide-react';
import { useEditorHotkeys } from '../hooks/use-editor-hotkeys';
import { useAutosave } from '../hooks/useAutosave';
import { CrashRecoveryDialog } from '../components/dialogs/CrashRecoveryDialog';
import { EmptyStateHome } from '../components/home/EmptyStateHome';
import { TemplatePickerDialog } from '../components/dialogs/TemplatePickerDialog';
import { useEditorStore } from '../store/editor.store';
import { selectIsDocumentOpen } from '../store/selectors';

interface EditorShellProps {
  children?: React.ReactNode;
}

export const EditorShell: React.FC<EditorShellProps> = ({ children }) => {
  useEditorHotkeys();
  useAutosave();
  const isDocumentOpen = useEditorStore(selectIsDocumentOpen);
  const [rightPanelTab, setRightPanelTab] = useState<'properties' | 'layers' | 'data'>('properties');
  const [isHomeTemplatePickerOpen, setIsHomeTemplatePickerOpen] = useState(false);

  return (
    <div className="w-full h-full flex flex-col bg-workspace-bg text-zinc-200 overflow-hidden font-sans select-none">
      <CrashRecoveryDialog />
      <TemplatePickerDialog
        isOpen={isHomeTemplatePickerOpen}
        onClose={() => setIsHomeTemplatePickerOpen(false)}
      />

      {/* Top Application Bar */}
      <TopBar />

      {!isDocumentOpen ? (
        <EmptyStateHome onOpenTemplatePicker={() => setIsHomeTemplatePickerOpen(true)} />
      ) : (
        <>
          {/* Main Workspace Body */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Left Toolbar */}
            <Toolbar />

            {/* Central Workspace Area */}
            <EditorWorkspace>{children}</EditorWorkspace>

            {/* Right Sidebar with Tabs */}
            <div className="flex flex-col bg-panel-bg border-l border-panel-border">
              {/* Sidebar Tabs */}
              <div className="h-8 flex border-b border-panel-border bg-panel-header text-2xs font-semibold">
                <button
                  onClick={() => setRightPanelTab('properties')}
                  className={`flex-1 flex items-center justify-center space-x-1.5 transition-colors border-r border-panel-border ${
                    rightPanelTab === 'properties'
                      ? 'bg-panel-bg text-zinc-100 border-t-2 border-t-blue-500'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                  }`}
                >
                  <Sliders className="w-3 h-3" />
                  <span>Props</span>
                </button>
                <button
                  onClick={() => setRightPanelTab('layers')}
                  className={`flex-1 flex items-center justify-center space-x-1.5 transition-colors border-r border-panel-border ${
                    rightPanelTab === 'layers'
                      ? 'bg-panel-bg text-zinc-100 border-t-2 border-t-blue-500'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                  }`}
                >
                  <LayersIcon className="w-3 h-3" />
                  <span>Layers</span>
                </button>
                <button
                  onClick={() => setRightPanelTab('data')}
                  className={`flex-1 flex items-center justify-center space-x-1.5 transition-colors ${
                    rightPanelTab === 'data'
                      ? 'bg-panel-bg text-zinc-100 border-t-2 border-t-blue-500'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                  }`}
                >
                  <Database className="w-3 h-3" />
                  <span>Data</span>
                </button>
              </div>

              {/* Active Sidebar Tab Panel */}
              <div className="flex-1 overflow-hidden">
                {rightPanelTab === 'properties' ? (
                  <PropertiesPanel />
                ) : rightPanelTab === 'layers' ? (
                  <LayersPanel />
                ) : (
                  <DataPanel />
                )}
              </div>
            </div>
          </div>

          {/* Bottom Status Bar */}
          <StatusBar />
        </>
      )}
    </div>
  );
};
