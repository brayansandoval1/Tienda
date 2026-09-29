'use client';

import { type PointerEvent, useRef } from 'react';
import type { SafeAreaPoint, SafeAreaShape } from '@/src/config/products';
import {
  normalizeSafeAreaPolygon,
  polygonBounds,
  seedSafeAreaPolygon,
} from '@/src/utils/safeAreaPolygon';

/** Zona de estampado tal y como la edita el panel: % sobre la imagen base + nodos. */
export type PrintArea = {
  x: number;
  y: number;
  width: number;
  height: number;
  shape?: SafeAreaShape;
  radius?: number;
  /** Nodos del contorno libre. Si existe (>= 3), manda sobre shape/radius. */
  polygon?: SafeAreaPoint[];
};

/** Radio por defecto (porcentaje del propio área) al activar 'rounded'. */
export const DEFAULT_SAFE_AREA_RADIUS = 25;

const roundPercent = (value: number) => Number(value.toFixed(2));
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeShape = (shape: unknown): SafeAreaShape | undefined =>
  shape === 'rect' || shape === 'rounded' || shape === 'ellipse' ? shape : undefined;

const normalizeRadius = (radius: unknown): number | undefined =>
  Number.isFinite(Number(radius)) ? Math.min(50, Math.max(0, Number(radius))) : undefined;

/**
 * Normaliza la zona. Con polígono, la caja (x/y/width/height) se DERIVA del
 * bounding box de los nodos: así cualquier consumidor que sólo entienda la
 * caja sigue viendo una zona coherente, aunque la forma real sea libre.
 */
export const normalizePrintArea = (area: PrintArea): PrintArea => {
  const shape = normalizeShape(area.shape) ?? 'rect';
  const radius = normalizeRadius(area.radius) ?? DEFAULT_SAFE_AREA_RADIUS;
  const polygon = normalizeSafeAreaPolygon(area.polygon);
  if (polygon) {
    const box = polygonBounds(polygon);
    return {
      ...box,
      ...(shape !== 'rect' ? { shape } : {}),
      ...(shape === 'rounded' ? { radius } : {}),
      polygon,
    };
  }
  const width = Math.min(100, Math.max(1, Number.isFinite(area.width) ? area.width : 50));
  const height = Math.min(100, Math.max(1, Number.isFinite(area.height) ? area.height : 50));
  return {
    x: Math.min(100 - width, Math.max(0, Number.isFinite(area.x) ? area.x : 25)),
    y: Math.min(100 - height, Math.max(0, Number.isFinite(area.y) ? area.y : 25)),
    width,
    height,
    ...(shape !== 'rect' ? { shape } : {}),
    ...(shape === 'rounded' ? { radius } : {}),
  };
};

/** Menos de 3 nodos no definen un área: el borrado nunca baja de ese mínimo. */
const MIN_POLYGON_NODES = 3;

/** Qué se está arrastrando: un nodo concreto (moldear) o toda la forma (mover). */
type DragMode = { kind: 'node'; index: number } | { kind: 'move' };

const SHAPE_OPTIONS: Array<{ value: SafeAreaShape; label: string; hint: string }> = [
  { value: 'rect', label: 'Rectángulo', hint: 'Base de 4 nodos: corte rectangular clásico.' },
  { value: 'rounded', label: 'Redondeado', hint: 'Base de 16 nodos: esquinas suaves moldeables.' },
  { value: 'ellipse', label: 'Óvalo', hint: 'Base de 16 nodos: corte ovalado o circular.' },
];

interface MockupAreaPickerProps {
  mockupUrl?: string;
  initialPrintArea: PrintArea;
  onChange: (newPrintArea: PrintArea) => void;
  /** Muestra la guía sin permitir arrastrarla (vista previa de la zona heredada). */
  readOnly?: boolean;
  /** Imagen alternativa cuando no hay mockup que mostrar de fondo. */
  fallbackLabel?: string;
  /**
   * Proporción ancho/alto del contenedor. Al igualar la proporción real de la
   * foto, el `object-contain` no deja bandas y el porcentaje se lee respecto a
   * la imagen (igual que `activeMockupBounds` en el editor).
   */
  aspectRatio?: number;
  /** Oculta el selector de forma (para quien sólo quiera moldear los nodos). */
  hideShapeControls?: boolean;
}


/**
 * Editor de Nodos Vectoriales Libres de la zona segura.
 *
 * - Cada vértice es un tirador circular arrastrable (moldea la figura del
 *   producto nodo a nodo).
 * - Clic sobre cualquier tramo del borde INSERTA un nodo nuevo en ese punto
 *   (proyectado sobre el segmento, se queda pegado al contorno).
 * - Doble clic o clic derecho sobre un nodo lo ELIMINA (mínimo 3).
 * - Arrastrar el interior mueve toda la forma.
 * - Los botones de forma generan la semilla de nodos editable (4/16/16).
 */
export default function MockupAreaPicker({ mockupUrl, initialPrintArea, onChange, readOnly = false, fallbackLabel, aspectRatio, hideShapeControls = false }: MockupAreaPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; points: SafeAreaPoint[] } | null>(null);
  const area = normalizePrintArea(initialPrintArea);
  // Sin polígono persistido (productos paramétricos heredados o forma recién
  // elegida) se derivan los nodos de la forma: el editor SIEMPRE muestra
  // vértices, y en cuanto el usuario toca uno, la forma se vuelve libre.
  const points = area.polygon ?? seedSafeAreaPolygon(area.shape ?? 'rect', area.radius ?? DEFAULT_SAFE_AREA_RADIUS, area);
  const bounds = polygonBounds(points);

  /** Persiste una nueva lista de nodos; la caja se recalcula como bounding box. */
  const commit = (nextPoints: SafeAreaPoint[]) => {
    const polygon = normalizeSafeAreaPolygon(nextPoints);
    if (!polygon) return;
    const box = polygonBounds(polygon);
    onChange({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      ...(area.shape && area.shape !== 'rect' ? { shape: area.shape } : {}),
      ...(area.shape === 'rounded' && area.radius !== undefined ? { radius: area.radius } : {}),
      polygon,
    });
  };

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || !container || readOnly) return;
    const rect = container.getBoundingClientRect();
    const dx = ((event.clientX - drag.startX) / rect.width) * 100;
    const dy = ((event.clientY - drag.startY) / rect.height) * 100;
    if (drag.mode.kind === 'node') {
      const index = drag.mode.index;
      commit(drag.points.map((point, i) => (
        i === index ? { x: clamp(point.x + dx, 0, 100), y: clamp(point.y + dy, 0, 100) } : point
      )));
      return;
    }
    // Mover la forma entera sin que ningún nodo se salga del lienzo.
    const base = polygonBounds(drag.points);
    const shiftX = clamp(dx, -base.x, 100 - (base.x + base.width));
    const shiftY = clamp(dy, -base.y, 100 - (base.y + base.height));
    commit(drag.points.map((point) => ({ x: point.x + shiftX, y: point.y + shiftY })));
  };

  const startDrag = (event: PointerEvent<Element>, mode: DragMode) => {
    if (readOnly) return;
    // OJO: sin `preventDefault()` aquí, o el navegador cancelaría los eventos
    // de compatibilidad y el `onDoubleClick` de los nodos dejaría de disparar.
    // `touch-none` + `select-none` en el contenedor ya evitan scroll/selection.
    event.stopPropagation();
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, points };
    // Captura el puntero en el propio elemento: aunque el gesto salga del
    // contenedor o vaya rapidísimo, el nodo sigue a la mano hasta soltar.
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  /** Clic en un segmento: inserta un nodo nuevo proyectado sobre ese tramo. */
  const addNodeOnSegment = (event: PointerEvent<SVGLineElement>, index: number) => {
    if (readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const px = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const py = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lengthSq = abx * abx + aby * aby || 1;
    // Proyección sobre el segmento (con margen para no clonar un nodo vecino).
    const t = clamp(((px - a.x) * abx + (py - a.y) * aby) / lengthSq, 0.05, 0.95);
    const next = [...points];
    next.splice(index + 1, 0, { x: a.x + abx * t, y: a.y + aby * t });
    commit(next);
  };

  const removeNode = (index: number) => {
    if (readOnly || points.length <= MIN_POLYGON_NODES) return;
    commit(points.filter((_, i) => i !== index));
  };

  const applyPreset = (shape: SafeAreaShape) => {
    if (readOnly) return;
    const radius = area.radius ?? DEFAULT_SAFE_AREA_RADIUS;
    const box = { x: area.x, y: area.y, width: area.width, height: area.height };
    onChange({
      ...box,
      ...(shape !== 'rect' ? { shape, ...(shape === 'rounded' ? { radius } : {}) } : {}),
      polygon: seedSafeAreaPolygon(shape, radius, box),
    });
  };

  return <div className="space-y-2">
    <p className="text-xs font-medium text-slate-600">{readOnly
      ? 'Zona de estampado heredada de la referencia maestra (no editable).'
      : 'Arrastra los puntos para moldear la zona. Clic en el borde añade un punto; doble clic o clic derecho sobre un punto lo elimina. Arrastra el interior para mover toda la forma.'}</p>
    <div
      ref={containerRef}
      onPointerMove={updateFromPointer}
      onPointerUp={() => { dragRef.current = null; }}
      onPointerCancel={() => { dragRef.current = null; }}
      onLostPointerCapture={() => { dragRef.current = null; }}
      style={aspectRatio ? { aspectRatio } : undefined}
      className="relative aspect-square w-full max-w-[800px] rounded-lg border bg-slate-100 touch-none select-none"
    >
      {mockupUrl
        ? <img src={mockupUrl} alt="Vista previa del mockup" className="pointer-events-none absolute inset-0 h-full w-full rounded-lg object-contain" />
        : <div className="flex h-full items-center justify-center p-8 text-center text-xs text-slate-400">{fallbackLabel ?? 'Añade una URL de mockup para ver la zona sobre la imagen.'}</div>}

      {/* SVG 0-100 = porcentaje exacto del contenedor, igual que el plano lógico
          del editor. `preserveAspectRatio="none"` evita distorsión con aspect-ratio. */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full touch-none">
        {/* Relleno del polígono: arrastrar aquí mueve TODOS los nodos a la vez. */}
        <polygon
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          onPointerDown={readOnly ? undefined : (event) => startDrag(event, { kind: 'move' })}
          className={readOnly ? '' : 'pointer-events-auto cursor-move'}
          fill="rgba(16,185,129,0.18)"
          stroke="#059669"
          strokeWidth={2}
          strokeDasharray="6 6"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Segmentos invisibles (stroke 18px = ~18 % del viewBox, ancho generoso
            para táctil): un clic INSERTA un nodo nuevo proyectado en el tramo. */}
        {!readOnly && points.map((point, index) => {
          const next = points[(index + 1) % points.length];
          return (
            <line
              key={`edge-${index}`}
              x1={point.x} y1={point.y}
              x2={next.x} y2={next.y}
              stroke="transparent"
              strokeWidth={18}
              vectorEffect="non-scaling-stroke"
              className="pointer-events-auto cursor-crosshair"
              onPointerDown={(event) => addNodeOnSegment(event, index)}
            />
          );
        })}
      </svg>

      {/* Tiradores circulares de cada vértice: arrastrar = moldear;
          doble clic o clic derecho = eliminar (mínimo 3 nodos). */}
      {!readOnly && points.map((point, index) => (
        <div
          key={`node-${index}`}
          title="Arrastra para moldear · doble clic o clic derecho elimina el punto"
          onPointerDown={(event) => startDrag(event, { kind: 'node', index })}
          onDoubleClick={() => removeNode(index)}
          onContextMenu={(event) => { event.preventDefault(); removeNode(index); }}
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
          className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-white bg-emerald-600 shadow active:cursor-grabbing"
        />
      ))}

      {/* Etiqueta flotante: nº de nodos y bounding box en % del mockup. */}
      <span
        className="pointer-events-none absolute rounded bg-emerald-600 px-1.5 py-0.5 font-mono text-[10px] text-white shadow"
        style={{ left: `${bounds.x}%`, top: `${Math.max(0, bounds.y - 4.5)}%` }}
      >
        {points.length} nodos · {bounds.width}% × {bounds.height}%
      </span>
    </div>

    {!hideShapeControls && (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-500">Forma base:</span>
        {SHAPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.hint}
            disabled={readOnly}
            onClick={() => applyPreset(option.value)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              area.shape === option.value
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                : 'border-slate-300 bg-white text-slate-600 hover:border-emerald-400'
            } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            {option.label}
          </button>
        ))}
        <span className="text-[11px] text-slate-400">
          Cada forma genera sus nodos editables; luego puedes deformarla libremente.
        </span>
      </div>
    )}
  </div>;
}

