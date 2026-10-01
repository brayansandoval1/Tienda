'use client';

import type { CustomizablePart } from '@/src/store/useProductStore';

interface ComponentColorsPanelProps {
  parts: CustomizablePart[];
  colors: Record<string, string>;
  enabledMeshNames: string[];
  onToggle: (meshName: string, enabled: boolean) => void;
  onColorChange: (meshName: string, color: string) => void;
}

export default function ComponentColorsPanel({ parts, colors, enabledMeshNames, onToggle, onColorChange }: ComponentColorsPanelProps) {
  if (!parts.length) return null;

  return (
    <section className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Colores de componentes 3D</p>
        <p className="mt-1 text-[10px] text-slate-400">Activa una pieza para personalizar su material.</p>
      </div>
      {parts.map((part) => {
        const enabled = enabledMeshNames.includes(part.meshName);
        return (
          <div key={part.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => onToggle(part.meshName, event.target.checked)}
              aria-label={`Activar ${part.label}`}
              className="h-4 w-4 accent-violet-600"
            />
            <span className="min-w-0 flex-1 text-xs font-medium text-slate-700">{part.label}</span>
            <input
              type="color"
              value={colors[part.meshName] ?? part.defaultColor ?? '#cbd5e1'}
              disabled={!enabled}
              onChange={(event) => onColorChange(part.meshName, event.target.value)}
              aria-label={part.label}
              title={`${part.label} · ${part.meshName}`}
              className="h-7 w-9 cursor-pointer rounded border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            />
          </div>
        );
      })}
    </section>
  );
}
