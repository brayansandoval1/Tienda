'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Download, Save, X } from 'lucide-react';
import type { SaveDesignResult } from '@/src/types/editorDesign';

export type EditorStep = 'design' | 'options' | 'review';

export default function Header({ activeStep, onStepChange, canContinue = true, productId }: { activeStep: EditorStep; onStepChange: (step: EditorStep) => void; canContinue?: boolean; productId?: string }) {
  const [exitMenuOpen, setExitMenuOpen] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'done' | 'error'>('idle');
  const [downloadMessage, setDownloadMessage] = useState('');

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
    const handleExportStarted = () => {
      setDownloadState('downloading');
      setDownloadMessage('Preparando PNG de alta resolución por vista y una imagen panorámica…');
    };
    const handleExportCompleted = (event: Event) => {
      const count = (event as CustomEvent<{ viewCount?: number }>).detail?.viewCount ?? 1;
      setDownloadState('done');
      setDownloadMessage(`Descarga lista: ${count} ${count === 1 ? 'vista individual' : 'vistas individuales'} y un PNG panorámico en un archivo ZIP.`);
    };
    const handleExportError = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      setDownloadState('error');
      setDownloadMessage(message || 'No se pudieron preparar los archivos de imprenta.');
    };
    window.addEventListener('editor:export-started', handleExportStarted);
    window.addEventListener('editor:export-completed', handleExportCompleted);
    window.addEventListener('editor:export-error', handleExportError);
    return () => {
      window.removeEventListener('editor:save-result', handleSaveResult);
      window.removeEventListener('editor:export-started', handleExportStarted);
      window.removeEventListener('editor:export-completed', handleExportCompleted);
      window.removeEventListener('editor:export-error', handleExportError);
    };
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
          <div className="relative">
            <button
              type="button"
              aria-expanded={exitMenuOpen}
              aria-haspopup="dialog"
              onClick={() => setExitMenuOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-cyan-200"
            >
              <X size={17} /> Guardar y salir
            </button>
            {exitMenuOpen && (
              <div role="dialog" aria-label="Guardar y salir" className="absolute left-0 top-[calc(100%+12px)] z-[100] w-72 rounded-2xl border border-slate-100 bg-white p-4 text-slate-900 shadow-xl sm:w-80">
                <span className="absolute -top-2 left-7 h-4 w-4 rotate-45 border-l border-t border-slate-100 bg-white" />
                <h2 className="relative mb-2 text-base font-bold">¿A dónde quieres ir?</h2>
                <button type="button" onClick={() => setExitMenuOpen(false)} className="relative flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm hover:bg-slate-50">
                  <ArrowLeft size={19} /> Seguir diseñando
                </button>
                {productId && <Link href={`/editor/${productId}`} onClick={() => setExitMenuOpen(false)} className="relative flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm hover:bg-slate-50"><ArrowLeft size={19} /> Volver a este producto</Link>}
                <Link href="/#catalogo" onClick={() => setExitMenuOpen(false)} className="relative flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm hover:bg-slate-50"><ArrowLeft size={19} /> Explorar el catálogo</Link>
                <Link href="/disenos-guardados" onClick={() => setExitMenuOpen(false)} className="relative flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm hover:bg-slate-50"><ArrowLeft size={19} /> Ir a mis diseños guardados</Link>
                <p className="relative mt-2 border-t border-slate-100 pt-3 pl-8 text-xs leading-5 text-slate-500">Tu trabajo se guarda automáticamente en este navegador.</p>
                <button type="button" onClick={handleSave} disabled={saveState === 'saving'} className="relative mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"><Save size={15} /> {saveState === 'saving' ? 'Preparando…' : 'Preparar archivos para imprenta'}</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {([
            ['design', 'Diseño'],
            ['options', 'Opciones'],
            ['review', 'Revisar'],
          ] as Array<[EditorStep, string]>).map(([step, label]) => (
            <button key={step} type="button" disabled={step === 'review' && !canContinue} onClick={() => onStepChange(step)} aria-current={activeStep === step ? 'step' : undefined} title={step === 'review' && !canContinue ? 'Completa la cantidad mínima para continuar' : undefined} className={`rounded-xl px-4 py-2 text-sm transition ${activeStep === step ? 'bg-slate-900 font-semibold text-white shadow-sm' : 'bg-slate-100 font-medium text-slate-600 hover:bg-slate-200'} disabled:cursor-not-allowed disabled:opacity-40`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={downloadState === 'downloading'}
            onClick={() => {
              setDownloadState('downloading');
              setDownloadMessage('Preparando archivos de alta resolución…');
              window.dispatchEvent(new CustomEvent('editor:export-print'));
            }}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
          >
            <Download size={16} />
            {downloadState === 'downloading' ? 'Preparando archivos…' : '📥 Descargar para Imprenta (HD)'}
          </button>
          <button type="button" disabled={nextStep === 'review' && !canContinue} onClick={() => onStepChange(nextStep)} title={nextStep === 'review' && !canContinue ? 'Completa la cantidad mínima para continuar' : undefined} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
            Siguiente: {stepLabel}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      {downloadMessage && <p role={downloadState === 'error' ? 'alert' : 'status'} className={`mt-2 text-xs ${downloadState === 'error' ? 'text-red-600' : 'text-slate-500'}`}>{downloadMessage}</p>}
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
