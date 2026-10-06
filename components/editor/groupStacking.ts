// ── Re-apilado de combos tipográficos ────────────────────────────────────────
// Los presets de 2+ capas de la galería se insertan como un fabric.Group de
// IText apilados verticalmente. Cualquier edición que cambie las métricas de
// una línea (texto, tamaño, fuente...) debe volver a apilar el combo y
// recalcular su caja: Fabric cachea el grupo con el tamaño anterior y
// recortaría el texto más largo. `__stackOptions` guarda el gap/alineación
// originales del preset ({8,'center'} como respaldo tras recargas de historial).

/** Opciones de apilado guardadas en el combo por handleAddTextPreset. */
export interface GroupStackOptions {
  gap?: number;
  align?: 'left' | 'center';
}

/**
 * Re-apila las capas del combo con el mismo algoritmo que la creación del
 * preset (capa más ancha como referencia) y devuelve el grupo a su centro
 * visual original. Actualización in-place: conserva identidad, orden de capas,
 * selección e historial (el llamador debe disparar `object:modified`).
 */
export const restackGroup = (canvas: any, group: any): void => {
  const children: any[] = group?.getObjects?.() ?? [];
  if (!children.length || typeof group._calcBounds !== 'function') return;
  const stackOptions: GroupStackOptions = group.__stackOptions ?? {};
  const gap = Number.isFinite(stackOptions.gap as number) ? (stackOptions.gap as number) : 8;
  const align = stackOptions.align === 'left' ? 'left' : 'center';
  const centerBefore = group.getCenterPoint();
  const widest = Math.max(1, ...children.map((child: any) => child.width || 0));
  let cursorY = 0;
  children.forEach((child: any) => {
    child.set({
      left: align === 'center' ? (widest - (child.width || 0)) / 2 : 0,
      top: cursorY,
    });
    cursorY += (child.height || 0) + gap;
  });
  // Mismo flujo interno que el constructor de fabric.Group: recalcular bounds,
  // re-centrar los hijos en el nuevo marco y reanclar el combo donde estaba.
  group._calcBounds();
  group._updateObjectsCoords();
  group.setPositionByOrigin(centerBefore, group.originX, group.originY);
  group.setCoords();
  group.dirty = true;
  canvas?.requestRenderAll?.();
};
