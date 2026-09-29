import type { SafeAreaPoint, SafeAreaShape } from '@/src/config/products';

/**
 * Geometría compartida de la zona segura como polígono de nodos libres.
 * El Admin (editor de vértices), el editor Fabric (clipPath) y Revisar
 * (clip 2D / CSS) consumen TODOS esta misma lista de puntos, así la forma
 * moldeada coincide píxel a píxel entre las tres vistas.
 */

const round2 = (value: number) => Number(value.toFixed(2));
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Valida y sanea una lista de nodos; `undefined` si no es un polígono útil (< 3 puntos o coords inválidas). */
export function normalizeSafeAreaPolygon(value: unknown): SafeAreaPoint[] | undefined {
  if (!Array.isArray(value) || value.length < 3) return undefined;
  const points = value.map((point) => ({
    x: Number((point as SafeAreaPoint | undefined)?.x),
    y: Number((point as SafeAreaPoint | undefined)?.y),
  }));
  if (points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return undefined;
  return points.map((point) => ({ x: round2(clamp(point.x, 0, 100)), y: round2(clamp(point.y, 0, 100)) }));
}

/** Caja envolvente (bounding box) del polígono, con lado mínimo de 1 %. */
export function polygonBounds(points: SafeAreaPoint[]): { x: number; y: number; width: number; height: number } {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  let x = Math.min(...xs);
  let y = Math.min(...ys);
  let width = Math.max(...xs) - x;
  let height = Math.max(...ys) - y;
  if (width < 1) { x = clamp(x - (1 - width) / 2, 0, 99); width = 1; }
  if (height < 1) { y = clamp(y - (1 - height) / 2, 0, 99); height = 1; }
  return { x: round2(x), y: round2(y), width: round2(width), height: round2(height) };
}

/**
 * Estructura base de nodos a partir de una forma predefinida paramétrica:
 * 4 vértices para el rectángulo, 16 muestras para el redondeado (4 por
 * esquina) y 16 para el óvalo. El admin la usa como semilla editable: el
 * usuario luego deforma, añade o elimina nodos a voluntad.
 */
export function seedSafeAreaPolygon(
  shape: SafeAreaShape,
  radius: number,
  box: { x: number; y: number; width: number; height: number },
): SafeAreaPoint[] {
  const { x, y, width, height } = box;
  const points: SafeAreaPoint[] = [];
  if (shape === 'ellipse') {
    const steps = 16;
    for (let i = 0; i < steps; i += 1) {
      const angle = (i / steps) * Math.PI * 2;
      points.push({
        x: x + width / 2 + (width / 2) * Math.cos(angle),
        y: y + height / 2 + (height / 2) * Math.sin(angle),
      });
    }
  } else if (shape === 'rounded') {
    const rx = Math.min(width / 2, (clamp(radius, 0, 50) / 100) * width);
    const ry = Math.min(height / 2, (clamp(radius, 0, 50) / 100) * height);
    // Centro de cada arco + rango de ángulos en el que barre (grados).
    const corners = [
      { cx: x + width - rx, cy: y + ry, from: -90 },
      { cx: x + width - rx, cy: y + height - ry, from: 0 },
      { cx: x + rx, cy: y + height - ry, from: 90 },
      { cx: x + rx, cy: y + ry, from: 180 },
    ];
    for (const corner of corners) {
      for (let step = 0; step <= 3; step += 1) {
        const angle = ((corner.from + step * 30) * Math.PI) / 180;
        points.push({
          x: corner.cx + rx * Math.cos(angle),
          y: corner.cy + ry * Math.sin(angle),
        });
      }
    }
  } else {
    points.push({ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height });
  }
  return points.map((point) => ({ x: round2(point.x), y: round2(point.y) }));
}

/** Cadena canónica para comparar dos polígonos tras normalizar. */
export function safeAreaPolygonSignature(points: SafeAreaPoint[] | undefined): string {
  if (!points || points.length < 3) return '';
  return points.map((point) => `${round2(point.x)}:${round2(point.y)}`).join('|');
}

/**
 * `clip-path: polygon(...)` en CSS, con los nodos reexpresados como
 * porcentaje de SU bounding box (el contenedor DOM ya se posiciona con él).
 */
export function polygonCssClipPath(points: SafeAreaPoint[], box: { x: number; y: number; width: number; height: number }): string {
  return `polygon(${points
    .map((point) => `${round2(clamp(((point.x - box.x) / box.width) * 100, 0, 100))}% ${round2(clamp(((point.y - box.y) / box.height) * 100, 0, 100))}%`)
    .join(', ')})`;
}
