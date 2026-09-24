'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Download, Save } from 'lucide-react';
import type { SaveDesignResult } from '@/src/types/editorDesign';

export type EditorStep = 'design' | 'options' | 'review';

export default function Header({ activeStep, onStepChange }: { activeStep: EditorStep; onStepChange: (step: EditorStep) => void }) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const handleSaveResult = (event: Event) => {
      const result = (event as CustomEvent<SaveDesignResult>).detail;
      if (result.valid) {
        setSaveState('saved');
        setSaveMessage('Diseño listo para enviar a la API.');
        return;
      }
      setSaveState('error');
      setSaveMessage(result.errors.join(' '));
    };

    window.addEventListener('editor:save-result', handleSaveResult);
    return () => window.removeEventListener('editor:save-result', handleSaveResult);
  }, []);

  const handleSave = () => {
    setSaveState('saving');
    setSaveMessage('Preparando archivos de alta resolución...');
    window.dispatchEvent(new CustomEvent('editor:save-design'));
  };

  const nextStep: EditorStep = activeStep === 'design' ? 'options' : 'review';
  const stepLabel = activeStep === 'design' ? 'Opciones' : 'Revisar';

  return (
    <div className="h-14 border-b border-slate-200 bg-white px-1 shadow-sm">
      <div className="flex h-full items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-slate-700">
          <button className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800 transition hover:bg-slate-100" aria-label="Cerrar editor">
            ✕
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === 'saving'}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 disabled:cursor-wait disabled:opacity-60"
          >
            <Save size={16} />
            {saveState === 'saving' ? 'Guardando…' : 'Guardar diseño'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {([
            ['design', 'Diseño'],
            ['options', 'Opciones'],
            ['review', 'Revisar'],
          ] as Array<[EditorStep, string]>).map(([step, label]) => (
            <button key={step} type="button" onClick={() => onStepChange(step)} aria-current={activeStep === step ? 'step' : undefined} className={`rounded-xl px-4 py-2 text-sm transition ${activeStep === step ? 'bg-slate-900 font-semibold text-white shadow-sm' : 'bg-slate-100 font-medium text-slate-600 hover:bg-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('editor:export-print'))}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            <Download size={16} />
            📥 Descargar para Imprenta (HD)
          </button>
          <button type="button" onClick={() => onStepChange(nextStep)} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
            Siguiente: {stepLabel}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      {saveMessage && (
        <p
          role={saveState === 'error' ? 'alert' : 'status'}
          className={`mt-3 text-sm ${saveState === 'error' ? 'text-red-600' : 'text-emerald-700'}`}
        >
          {saveMessage}
        </p>
      )}
    </div>
  );
}
