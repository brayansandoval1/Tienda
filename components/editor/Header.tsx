'use client';

import { ChevronRight } from 'lucide-react';

export default function Header() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-slate-700">
          <button className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100">
            ✕
          </button>
          <span className="text-sm font-semibold">Guardar y salir</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">
            Diseño
          </button>
          <button className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">
            Opciones
          </button>
          <button className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">
            Revisar
          </button>
        </div>

        <button className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
          Siguiente: Opciones
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
