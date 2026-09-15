'use client';

import { useState, useEffect } from 'react'; // Import useState and useEffect
import {
  Trash2,
  RefreshCcw,
  Undo2,
  Redo2,
  Box,
  AlignCenterHorizontal,
  AlignCenterVertical,
  Copy,
  Minus,
  Plus,
} from 'lucide-react';

interface FloatingFooterProps {
  onReset?: () => void;
}

export default function FloatingFooter({ onReset }: FloatingFooterProps) { // Removed zoom props
  const [isObjectSelected, setIsObjectSelected] = useState(false);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [zoom, setZoom] = useState(100);

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
    const handleZoomChanged = (e: Event) => {
      const percentage = (e as CustomEvent<{ percentage?: number }>).detail?.percentage;
      if (typeof percentage === 'number') setZoom(percentage);
    };

    window.addEventListener('editor:selection-changed', handleSelectionChanged);
    window.addEventListener('editor:history-updated', handleHistoryUpdate);
    window.addEventListener('editor:zoom-changed', handleZoomChanged);

    return () => {
      window.removeEventListener('editor:selection-changed', handleSelectionChanged);
      window.removeEventListener('editor:history-updated', handleHistoryUpdate);
      window.removeEventListener('editor:zoom-changed', handleZoomChanged);
    };
  }, []);

  return (
    <div className="absolute bottom-2 left-1/2 z-30 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 rounded-full bg-slate-900/90 px-2 py-1.5 text-xs font-medium text-white shadow-2xl backdrop-blur-md">
        <div className="flex items-center border-r border-white/15 pr-1">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('editor:align', { detail: { alignment: 'center-h' } }))}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10 ${!isObjectSelected ? 'pointer-events-none opacity-50' : ''}`}
            type="button"
            title="Centrar horizontalmente"
            aria-label="Centrar horizontalmente"
            disabled={!isObjectSelected}
          >
            <AlignCenterHorizontal size={16} />
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('editor:align', { detail: { alignment: 'center-v' } }))}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10 ${!isObjectSelected ? 'pointer-events-none opacity-50' : ''}`}
            type="button"
            title="Centrar verticalmente"
            aria-label="Centrar verticalmente"
            disabled={!isObjectSelected}
          >
            <AlignCenterVertical size={16} />
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('editor:duplicate-active'))}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10 ${!isObjectSelected ? 'pointer-events-none opacity-50' : ''}`}
            type="button"
            title="Duplicar objeto"
            aria-label="Duplicar objeto"
            disabled={!isObjectSelected}
          >
            <Copy size={15} />
          </button>
        </div>

        <div className="flex items-center gap-0.5 border-r border-white/15 pr-1" aria-label="Control de zoom">
          <button
            type="button"
            title="Alejar lienzo"
            aria-label="Alejar lienzo"
            onClick={() => window.dispatchEvent(new CustomEvent('editor:zoom', { detail: { delta: -0.1 } }))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10"
          >
            <Minus size={15} />
          </button>
          <span className="min-w-10 text-center text-[11px] tabular-nums text-slate-200">{zoom}%</span>
          <button
            type="button"
            title="Acercar lienzo"
            aria-label="Acercar lienzo"
            onClick={() => window.dispatchEvent(new CustomEvent('editor:zoom', { detail: { delta: 0.1 } }))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10"
          >
            <Plus size={15} />
          </button>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('editor:delete-active'))}
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium text-white transition hover:bg-white/10 ${
            !isObjectSelected && 'opacity-50 pointer-events-none'
          }`}
          type="button"
          disabled={!isObjectSelected}
        >
          <Trash2 size={14} />
          Eliminar
        </button>

        <button onClick={() => window.dispatchEvent(new CustomEvent('editor:undo'))} className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/10 ${
          !historyState.canUndo && 'opacity-50 pointer-events-none'
        }`} type="button" title="Deshacer" disabled={!historyState.canUndo}>
          <Undo2 size={15} />
        </button>
        <button onClick={() => window.dispatchEvent(new CustomEvent('editor:redo'))} className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/10 ${
          !historyState.canRedo && 'opacity-50 pointer-events-none'
        }`} type="button" title="Rehacer" disabled={!historyState.canRedo}>
          <Redo2 size={15} />
        </button>

        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('editor:clear-canvas'));
            onReset?.();
          }}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium text-white transition hover:bg-white/10"
          type="button"
        >
          <RefreshCcw size={14} />
          Reiniciar
        </button>

        <button
          type="button"
          onClick={() => (window as any).__openEditor3DPreview?.()}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-200"
        >
          <Box size={14} />
          Ver en 3D
        </button>
      </div>
  );
}
