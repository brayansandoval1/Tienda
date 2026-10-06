'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Pencil } from 'lucide-react';
import { restackGroup } from './groupStacking';

type FabricCanvas = any;
type FabricObject = any;

type SmartItem = {
  id: string;
  object: FabricObject;
  kind: 'text' | 'image';
  label: string;
  value: string;
  preview: string | null;
};

const isEditableObject = (object: FabricObject) =>
  object?.visible !== false &&
  !object?.isGuide &&
  !object?.isGuideLine &&
  !object?.isMockup &&
  !object?.isCropOverlay &&
  !object?.isDesignBackground &&
  ['i-text', 'textbox', 'image'].includes(object?.type);

const getImageSource = (object: FabricObject): string | null => {
  const element = object?.getElement?.() ?? object?._element;
  return element?.currentSrc || element?.src || null;
};

/** Ids de los items que deben resaltarse según el objeto activo del canvas. */
const activeIdSet = (canvas: FabricCanvas): Set<string> => {
  const active = canvas.getActiveObject?.();
  if (!active) return new Set<string>();
  // Combo seleccionado → resaltar TODAS sus líneas en el panel.
  if (active.type === 'group') {
    return new Set(
      (active.getObjects?.() ?? [])
        .map((child: FabricObject) => child?.__smartInputId)
        .filter(Boolean) as string[],
    );
  }
  return new Set(active.__smartInputId ? [active.__smartInputId as string] : []);
};

export default function SmartInputPanel() {
  const [canvas, setCanvas] = useState<FabricCanvas | null>(null);
  const [items, setItems] = useState<SmartItem[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(() => new Set());
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  const idCounterRef = useRef(0);

  useEffect(() => {
    const connect = (nextCanvas: FabricCanvas | null) => setCanvas(nextCanvas);
    const handleReady = (event: Event) => connect((event as CustomEvent<{ canvas: FabricCanvas }>).detail?.canvas ?? null);
    connect((window as any).__editorFabricCanvas ?? null);
    window.addEventListener('editor:canvas-ready', handleReady);
    return () => window.removeEventListener('editor:canvas-ready', handleReady);
  }, []);

  useEffect(() => {
    if (!canvas) {
      setItems([]);
      return;
    }

    const objectId = (object: FabricObject) => {
      if (!object.__smartInputId) {
        idCounterRef.current += 1;
        object.__smartInputId = `smart-${idCounterRef.current}-${Date.now().toString(36)}`;
      }
      return object.__smartInputId as string;
    };

    const refresh = () => {
      let textNumber = 0;
      let imageNumber = 0;
      const toItem = (object: FabricObject, label?: string): SmartItem => {
        const kind = object.type === 'image' ? ('image' as const) : ('text' as const);
        const number = kind === 'text' ? ++textNumber : ++imageNumber;
        return {
          id: objectId(object),
          object,
          kind,
          label:
            label ??
            (object.label ||
              object.name ||
              object.layerName ||
              `${kind === 'text' ? 'Texto' : 'Imagen'} ${number}`),
          value: kind === 'text' ? object.text ?? '' : '',
          preview: kind === 'image' ? getImageSource(object) : null,
        };
      };
      const nextItems = canvas.getObjects().flatMap((object: FabricObject) => {
        // Combos de la galería (2+ capas apiladas en fabric.Group): se listan
        // LÍNEA A LÍNEA, cada IText con su propio input, para que un texto con
        // estilo se edite igual que uno normal desde "Edición rápida".
        if (object?.visible !== false && object?.type === 'group') {
          const children = (object.getObjects?.() ?? []).filter(
            (child: FabricObject) =>
              child?.visible !== false && ['i-text', 'textbox'].includes(child?.type),
          );
          if (!children.length) return [];
          const groupLabel =
            object.label || object.name || object.layerName || 'Texto';
          return children.map((child: FabricObject, index: number) =>
            toItem(child, children.length > 1 ? `${groupLabel} · línea ${index + 1}` : groupLabel),
          );
        }
        if (!isEditableObject(object)) return [];
        return [toItem(object)];
      });
      setItems(nextItems);
      setActiveIds(activeIdSet(canvas));
    };

    const events = ['object:added', 'object:removed', 'object:modified', 'selection:created', 'selection:updated', 'selection:cleared'];
    events.forEach((event) => canvas.on(event, refresh));
    refresh();
    return () => events.forEach((event) => canvas.off(event, refresh));
  }, [canvas]);

  const selectObject = (item: SmartItem) => {
    if (!canvas) return;
    // Un hijo dentro de un combo no puede seleccionarse solo en Fabric: se
    // selecciona el combo entero para que tiradores, resaltado del panel y
    // handlers de lienzo correspondan a lo que el usuario ve.
    const target = item.object.group ?? item.object;
    canvas.setActiveObject(target);
    canvas.requestRenderAll?.();
    setActiveIds(activeIdSet(canvas));
  };

  const updateText = (item: SmartItem, value: string) => {
    if (!canvas) return;
    item.object.set('text', value);
    item.object.setCoords?.();
    const parent = item.object.group;
    // Línea dentro de un combo: re-apilar para que la caja del grupo se adapte
    // al texto nuevo (si no, Fabric recortaría el texto más largo).
    if (parent && parent.type === 'group') restackGroup(canvas, parent);
    canvas.renderAll();
    // `set` no dispara eventos en Fabric; emitirlo mantiene historial y el
    // mapeo del panel sincronizados con las demás herramientas del editor.
    // El combo es el target para que los handlers que leen coordenadas de
    // lienzo (clip por segmento del 360) reciban datos válidos.
    canvas.fire('object:modified', { target: parent ?? item.object });
  };

  const replaceImage = (item: SmartItem, file: File) => {
    if (!canvas) return;
    const reader = new FileReader();
    reader.onload = () => {
      const source = reader.result;
      if (typeof source !== 'string') return;
      const object = item.object;
      // Caja visible actual de la foto, para que la nueva ocupe exactamente
      // el mismo espacio en el mockup.
      const boxWidth = Math.abs((object.width || 0) * (object.scaleX || 1));
      const boxHeight = Math.abs((object.height || 0) * (object.scaleY || 1));
      const centerBefore = typeof object.getCenterPoint === 'function' ? object.getCenterPoint() : null;
      const keptTransform = {
        angle: object.angle,
        flipX: object.flipX,
        flipY: object.flipY,
        skewX: object.skewX,
        skewY: object.skewY,
      };

      object.setSrc(source, () => {
        // `setSrc` recalcula `width`/`height` con el tamaño natural de la nueva
        // foto, pero conserva `cropX`/`cropY`: si no se limpian, se mostraría
        // una región cualquiera de la imagen nueva (y deformada).
        object.set({ cropX: 0, cropY: 0, ...keptTransform });

        // Reencajar la nueva foto DENTRO de la caja anterior respetando su
        // propia proporción. Reutilizar el `scaleX`/`scaleY` antiguos es lo que
        // estiraba la imagen al cambiar de foto.
        const naturalWidth = object.width || 0;
        const naturalHeight = object.height || 0;
        if (naturalWidth > 0 && naturalHeight > 0 && boxWidth > 0 && boxHeight > 0) {
          const fit = Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight);
          object.set({ scaleX: fit, scaleY: fit });
        }

        object.setCoords?.();
        // Se conserva el centro visual para que la foto no salte de sitio.
        if (centerBefore) {
          const centerAfter = object.getCenterPoint();
          object.set({
            left: (object.left || 0) + (centerBefore.x - centerAfter.x),
            top: (object.top || 0) + (centerBefore.y - centerAfter.y),
          });
          object.setCoords?.();
        }
        canvas.setActiveObject(object);
        canvas.renderAll();
        canvas.fire('object:modified', { target: object });
      }, { crossOrigin: 'anonymous' });
    };
    reader.readAsDataURL(file);
  };

  if (items.length === 0) return null;

  return (
    <section className="order-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Edición rápida">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
          <Pencil size={12} />
        </span>
        <div className="min-w-0 leading-tight">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700">Edición rápida</h2>
          <p className="truncate text-[10px] text-slate-400">Edita textos y fotos del diseño</p>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {items.map((item) => {
          const active = activeIds.has(item.id);
          return (
            <div key={item.id} className={`space-y-2 px-3 py-2.5 transition ${active ? 'bg-sky-50/80' : 'bg-white'}`}>
              <label className="block truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {item.label}
              </label>

              {item.kind === 'text' ? (
                item.object.type === 'textbox' ? (
                  <textarea
                    value={item.value}
                    rows={2}
                    onFocus={() => selectObject(item)}
                    onChange={(event) => updateText(item, event.target.value)}
                    className="min-h-16 w-full resize-y rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-900 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-900"
                  />
                ) : (
                  <input
                    type="text"
                    value={item.value}
                    onFocus={() => selectObject(item)}
                    onChange={(event) => updateText(item, event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-900 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-900"
                  />
                )
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onFocus={() => selectObject(item)}
                    onClick={() => fileInputsRef.current[item.id]?.click()}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-left transition hover:border-slate-300 hover:bg-white"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white text-slate-400">
                      {item.preview ? <img src={item.preview} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={18} />}
                    </span>
                    <span className="min-w-0 truncate text-xs text-slate-600">Foto actual</span>
                  </button>
                  <button
                    type="button"
                    onFocus={() => selectObject(item)}
                    onClick={() => fileInputsRef.current[item.id]?.click()}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-2 text-[10px] font-semibold text-white transition hover:bg-slate-700"
                  >
                    <Camera size={13} /> Cambiar foto
                  </button>
                  <input
                    ref={(element) => { fileInputsRef.current[item.id] = element; }}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) replaceImage(item, file);
                      event.target.value = '';
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
