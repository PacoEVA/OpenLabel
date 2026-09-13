import React from 'react';
import { useEditorStore } from '../store/editor.store';
import { selectDocument, selectZoom, selectViewport } from '../store/selectors';
import { mmToCanvasPx } from '../canvas/coordinates';
import { EditorStage } from '../canvas/EditorStage';

interface EditorWorkspaceProps {
  children?: React.ReactNode;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({ children }) => {
  const document = useEditorStore(selectDocument);
  const zoom = useEditorStore(selectZoom);
  const viewport = useEditorStore(selectViewport);

  const canvasWidth = mmToCanvasPx(document.dimensions.width, zoom);
  const canvasHeight = mmToCanvasPx(document.dimensions.height, zoom);

  return (
    <main className="flex-1 bg-workspace-bg relative overflow-hidden flex items-center justify-center select-none">
      {/* Background Grid Texture */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, #71717a 1px, transparent 1px)`,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
        }}
      />

      {/* Workspace Content / Label Container */}
      <div
        className="relative transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px)`,
        }}
      >
        {/* Physical Label Surface Boundary */}
        <div
          id="label-surface"
          className="bg-white rounded-sm shadow-2xl shadow-black/80 border border-zinc-400 relative overflow-hidden"
          style={{
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
          }}
        >
          {children || <EditorStage />}
        </div>
      </div>
    </main>
  );
};
