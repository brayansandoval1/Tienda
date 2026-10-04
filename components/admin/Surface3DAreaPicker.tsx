'use client';

import { useRef, type PointerEvent } from 'react';

export type Surface3DArea = { x: number; y: number; width: number; height: number };

type DragState = {
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  area: Surface3DArea;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function Surface3DAreaPicker({ mockupUrl, area, viewName, onChange }: {
  mockupUrl: string;
  area: Surface3DArea;
  viewName: string;
  onChange: (area: Surface3DArea) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const imageUrl = mockupUrl.trim();

  const startDrag = (event: PointerEvent<HTMLDivElement>, mode: DragState['mode']) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, area };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || !container) return;
    const bounds = container.getBoundingClientRect();
    const deltaX = ((event.clientX - drag.startX) / bounds.width) * 100;
    const deltaY = ((event.clientY - drag.startY) / bounds.height) * 100;
    if (drag.mode === 'move') {
      onChange({
        ...drag.area,
        x: clamp(drag.area.x + deltaX, 0, 100 - drag.area.width),
        y: clamp(drag.area.y + deltaY, 0, 100 - drag.area.height),
      });
      return;
    }
    onChange({
      ...drag.area,
      width: clamp(drag.area.width + deltaX, 5, 100 - drag.area.x),
      height: clamp(drag.area.height + deltaY, 5, 100 - drag.area.y),
    });
  };

  return <div
    ref={containerRef}
    className="relative aspect-square w-full max-w-[800px] touch-none select-none overflow-hidden rounded-lg border border-slate-300 bg-slate-100"
    onPointerMove={updateDrag}
    onPointerUp={() => { dragRef.current = null; }}
    onPointerCancel={() => { dragRef.current = null; }}
    onLostPointerCapture={() => { dragRef.current = null; }}
    aria-label={`Panel UV 3D para ${viewName}`}
  >
    {imageUrl
      ? <img src={imageUrl} alt={`Referencia de ${viewName}`} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
      : <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-slate-400">Carga un mockup para ver el área 3D sobre la vista.</div>}
    <div
      role="group"
      aria-label={`Área que se proyectará en 3D para ${viewName}`}
      onPointerDown={(event) => startDrag(event, 'move')}
      style={{ left: `${area.x}%`, top: `${area.y}%`, width: `${area.width}%`, height: `${area.height}%` }}
      className="absolute cursor-move border-2 border-sky-600 bg-sky-400/10 shadow-[0_0_0_1px_white]"
    >
      <span className="pointer-events-none absolute left-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 shadow-sm">Vista 3D</span>
      <div
        role="slider"
        aria-label={`Cambiar tamaño del área 3D para ${viewName}`}
        aria-valuetext={`${area.width.toFixed(0)}% × ${area.height.toFixed(0)}%`}
        onPointerDown={(event) => startDrag(event, 'resize')}
        className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-sky-700 shadow"
      />
    </div>
  </div>;
}