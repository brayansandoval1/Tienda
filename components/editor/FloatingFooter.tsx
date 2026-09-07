'use client';

import { useState, useEffect } from 'react'; // Import useState and useEffect
import {
  Trash2,
  RefreshCcw,
  Undo2,
  Redo2,
  Box,
} from 'lucide-react';

interface FloatingFooterProps {
  onReset?: () => void;
}

export default function FloatingFooter({ onReset }: FloatingFooterProps) { // Removed zoom props
  const [isObjectSelected, setIsObjectSelected] = useState(false);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  useEffect(() => {
    const handleSelectionChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent?.detail || {};
      setIsObjectSelected(!!detail.selectedObject);
    };

    // Listen for history updates from EditorCanvas
    const handleHistoryUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      setHistoryState(customEvent?.detail || { canUndo: false, canRedo: false });
    };

    window.addEventListener('editor:selection-changed', handleSelectionChanged);
    window.addEventListener('editor:history-updated', handleHistoryUpdate);

    return () => {
      window.removeEventListener('editor:selection-changed', handleSelectionChanged);
      window.removeEventListener('editor:history-updated', handleHistoryUpdate);
    };
  }, []);

  return (
    <div className="absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 scale-90 items-center gap-3 rounded-full bg-slate-900/90 px-3 py-1 text-xs font-medium text-white shadow-2xl backdrop-blur-md sm:scale-100">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('editor:delete-active'))}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white transition hover:bg-white/10 ${
            !isObjectSelected && 'opacity-50 pointer-events-none'
          }`}
          type="button"
          disabled={!isObjectSelected}
        >
          <Trash2 size={14} />
          Eliminar
        </button>

        <button onClick={() => window.dispatchEvent(new CustomEvent('editor:undo'))} className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:bg-white/10 ${
          !historyState.canUndo && 'opacity-50 pointer-events-none'
        }`} type="button" title="Deshacer" disabled={!historyState.canUndo}>
          <Undo2 size={15} />
        </button>
        <button onClick={() => window.dispatchEvent(new CustomEvent('editor:redo'))} className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:bg-white/10 ${
          !historyState.canRedo && 'opacity-50 pointer-events-none'
        }`} type="button" title="Rehacer" disabled={!historyState.canRedo}>
          <Redo2 size={15} />
        </button>

        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('editor:clear-canvas'));
            onReset?.();
          }}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white transition hover:bg-white/10"
          type="button"
        >
          <RefreshCcw size={14} />
          Reiniciar
        </button>

        <button
          type="button"
          onClick={() => (window as any).__openEditor3DPreview?.()}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 transition hover:bg-slate-200"
        >
          <Box size={14} />
          Ver en 3D
        </button>
      </div>
  );
}
