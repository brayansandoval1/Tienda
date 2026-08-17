'use client';

import { type PointerEvent, useRef } from 'react';

export type PrintArea = { x: number; y: number; width: number; height: number };

const roundPercent = (value: number) => Number(value.toFixed(2));

export const normalizePrintArea = (area: PrintArea): PrintArea => {
  const width = Math.min(100, Math.max(1, Number.isFinite(area.width) ? area.width : 50));
  const height = Math.min(100, Math.max(1, Number.isFinite(area.height) ? area.height : 50));
  return {
    x: Math.min(100 - width, Math.max(0, Number.isFinite(area.x) ? area.x : 25)),
    y: Math.min(100 - height, Math.max(0, Number.isFinite(area.y) ? area.y : 25)),
    width,
    height,
  };
};

interface MockupAreaPickerProps {
  mockupUrl?: string;
  initialPrintArea: PrintArea;
  onChange: (newPrintArea: PrintArea) => void;
}

/** Selector controlado sobre el mismo plano lógico 800×800 del editor. */
export default function MockupAreaPicker({ mockupUrl, initialPrintArea, onChange }: MockupAreaPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; area: PrintArea } | null>(null);
  const area = normalizePrintArea(initialPrintArea);

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || !container) return;
    const rect = container.getBoundingClientRect();
    const dx = ((event.clientX - drag.startX) / rect.width) * 100;
    const dy = ((event.clientY - drag.startY) / rect.height) * 100;
    const next = drag.mode === 'move'
      ? normalizePrintArea({ ...drag.area, x: drag.area.x + dx, y: drag.area.y + dy })
      : normalizePrintArea({ ...drag.area, width: drag.area.width + dx, height: drag.area.height + dy });
    onChange({ x: roundPercent(next.x), y: roundPercent(next.y), width: roundPercent(next.width), height: roundPercent(next.height) });
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>, mode: 'move' | 'resize') => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, area };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return <div className="space-y-2">
    <p className="text-xs font-medium text-slate-600">Arrastra la zona verde o usa el tirador para redimensionarla. La vista usa el canvas común de 800×800.</p>
    <div ref={containerRef} onPointerMove={updateFromPointer} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} className="relative aspect-square w-full max-w-[800px] overflow-hidden rounded-lg border bg-slate-100 touch-none select-none">
      {mockupUrl ? <img src={mockupUrl} alt="Vista previa del mockup" className="pointer-events-none absolute inset-0 h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center p-8 text-center text-xs text-slate-400">Añade una URL de mockup para ver la zona sobre la imagen.</div>}
      <div onPointerDown={(event) => startDrag(event, 'move')} style={{ left: `${area.x}%`, top: `${area.y}%`, width: `${area.width}%`, height: `${area.height}%` }} className="absolute cursor-move border-2 border-dashed border-emerald-500 bg-emerald-500/20">
        <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 py-0.5 font-mono text-[10px] text-white shadow">{area.width}% × {area.height}%</span>
        <div onPointerDown={(event) => startDrag(event, 'resize')} className="absolute bottom-[-7px] right-[-7px] h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-emerald-600 shadow" />
      </div>
    </div>
  </div>;
}
