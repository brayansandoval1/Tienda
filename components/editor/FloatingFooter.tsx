'use client';

import { useState, useEffect } from 'react'; // Import useState and useEffect
import {
  Trash2,
  RefreshCcw,
  Copy,
  Download,
  Undo2,
  Redo2,
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
    <div className="absolute bottom-4 left-1/2 z-10 w-[min(96%,_700px)] -translate-x-1/2 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-2xl shadow-slate-200/50 backdrop-blur">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-slate-700">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('editor:delete-active'))}
            className={`inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium transition hover:bg-slate-100 ${
              !isObjectSelected && 'opacity-50 pointer-events-none'
            }`}
            type="button"
            disabled={!isObjectSelected}
          >
            <Trash2 size={16} />
            Eliminar elemento
          </button>

          <button onClick={() => window.dispatchEvent(new CustomEvent('editor:duplicate-active'))} className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 ${
              !isObjectSelected && 'opacity-50 pointer-events-none'
            }`} type="button" title="Duplicar" disabled={!isObjectSelected}>
            <Copy size={16} />
          </button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('editor:undo'))} className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 ${
            !historyState.canUndo && 'opacity-50 pointer-events-none'
          }`} type="button" title="Deshacer" disabled={!historyState.canUndo}>
            <Undo2 size={16} />
          </button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('editor:redo'))} className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 ${
            !historyState.canRedo && 'opacity-50 pointer-events-none'
          }`} type="button" title="Rehacer" disabled={!historyState.canRedo}>
            <Redo2 size={16} />
          </button>

          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('editor:clear-canvas'));
              onReset?.();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium transition hover:bg-slate-100"
            type="button"
          >
            <RefreshCcw size={16} />
            Reiniciar
          </button>

          <button onClick={() => window.dispatchEvent(new CustomEvent('editor:export-print'))} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800" type="button">
            <Download size={16} />
            Descargar impresión
          </button>
        </div>
      </div>
    </div>
  );
}
