'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, GripVertical, Image as ImageIcon, Lock, Shapes, Type, Unlock } from 'lucide-react';

type FabricObject = any;
type FabricCanvas = any;

const isDesignObject = (object: FabricObject) =>
  !object?.isGuide &&
  !object?.isGuideLine &&
  !object?.isMockup &&
  !object?.isCropOverlay &&
  !object?.isDesignBackground;

const getObjectImage = (object: FabricObject): string | null => {
  if (object?.type !== 'image') return null;
  const source = object.getElement?.() ?? object._element;
  return source?.currentSrc || source?.src || null;
};

type LayerKind = 'text' | 'image' | 'shape';

const getLayerKind = (object: FabricObject): LayerKind => {
  if (typeof object?.text === 'string') return 'text';
  return object?.type === 'image' ? 'image' : 'shape';
};

const getLayerKindLabel = (object: FabricObject) => {
  const kind = getLayerKind(object);
  return kind === 'text' ? 'Texto' : kind === 'image' ? 'Imagen' : 'Forma';
};

// La profundidad de Fabric cambia al reordenar, pero este número se mantiene:
// "Forma 2" sigue siendo la misma forma aunque se arrastre arriba o abajo.
const ensureLayerNumbers = (objects: FabricObject[]) => {
  const lastNumber: Record<LayerKind, number> = { text: 0, image: 0, shape: 0 };
  objects.forEach((object) => {
    const kind = getLayerKind(object);
    lastNumber[kind] = Math.max(lastNumber[kind], Number(object.__layerTypeNumber) || 0);
  });
  objects.forEach((object) => {
    if (Number(object.__layerTypeNumber) > 0) return;
    const kind = getLayerKind(object);
    object.__layerTypeNumber = ++lastNumber[kind];
  });
};

const getLayerTitle = (object: FabricObject) =>
  `${getLayerKindLabel(object)} ${object.__layerTypeNumber || 1}`;

const getLayerContent = (object: FabricObject) => {
  if (typeof object?.text === 'string') return object.text.trim() || 'Texto vacío';
  if (object?.type === 'image') return object.layerName || object.label || 'Imagen cargada';
  return object?.layerName || object?.label || (object?.type === 'group' ? 'Ilustración vectorial' : 'Forma');
};

const isObjectLocked = (object: FabricObject) => Boolean(
  object?.__layerLocked || object?.lockMovementX || object?.lockMovementY || object?.lockScalingX || object?.lockScalingY || object?.lockRotation,
);

function LayerIcon({ object }: { object: FabricObject }) {
  if (typeof object?.text === 'string') return <Type size={16} />;
  if (object?.type === 'image') return <ImageIcon size={16} />;
  return <Shapes size={16} />;
}

export default function LayersPanel() {
  const [canvas, setCanvas] = useState<FabricCanvas | null>(null);
  const [objects, setObjects] = useState<FabricObject[]>([]);
  const [activeObjects, setActiveObjects] = useState<FabricObject[]>([]);
  const [draggedObject, setDraggedObject] = useState<FabricObject | null>(null);
  const [dropTarget, setDropTarget] = useState<{ object: FabricObject; before: boolean } | null>(null);

  useEffect(() => {
    const connect = (nextCanvas: FabricCanvas | null) => setCanvas(nextCanvas);
    const handleReady = (event: Event) => connect((event as CustomEvent<{ canvas: FabricCanvas }>).detail?.canvas ?? null);

    connect((window as any).__editorFabricCanvas ?? null);
    window.addEventListener('editor:canvas-ready', handleReady);
    return () => window.removeEventListener('editor:canvas-ready', handleReady);
  }, []);

  useEffect(() => {
    if (!canvas) {
      setObjects([]);
      setActiveObjects([]);
      return;
    }

    const refresh = () => {
      const visibleObjects = canvas.getObjects().filter(isDesignObject);
      // Canvas conserva los objetos en orden de inserción. Se numeran antes
      // de invertir la lista para que el nombre no cambie al reordenar capas.
      ensureLayerNumbers(visibleObjects);
      // Fabric almacena de fondo a frente; el panel reproduce el orden de Canva.
      setObjects([...visibleObjects].reverse());
      setActiveObjects(canvas.getActiveObjects().filter(isDesignObject));
    };

    const events = ['object:added', 'object:removed', 'object:modified', 'selection:created', 'selection:updated', 'selection:cleared'];
    events.forEach((event) => canvas.on(event, refresh));
    refresh();
    return () => events.forEach((event) => canvas.off(event, refresh));
  }, [canvas]);

  const selectObject = (object: FabricObject) => {
    if (!canvas) return;
    canvas.setActiveObject(object);
    canvas.requestRenderAll?.();
    setActiveObjects([object]);
  };

  const refreshLocalState = () => {
    if (!canvas) return;
    const designObjects = canvas.getObjects().filter(isDesignObject);
    ensureLayerNumbers(designObjects);
    setObjects([...designObjects].reverse());
    setActiveObjects(canvas.getActiveObjects().filter(isDesignObject));
  };

  const toggleVisibility = (object: FabricObject) => {
    if (!canvas) return;
    const nextVisible = object.visible === false;
    object.set({ visible: nextVisible });
    if (!nextVisible && canvas.getActiveObject?.() === object) canvas.discardActiveObject?.();
    canvas.requestRenderAll?.();
    refreshLocalState();
  };

  const toggleLock = (object: FabricObject) => {
    if (!canvas) return;
    const nextLocked = !isObjectLocked(object);
    object.set({
      __layerLocked: nextLocked,
      lockMovementX: nextLocked,
      lockMovementY: nextLocked,
      lockScalingX: nextLocked,
      lockScalingY: nextLocked,
      lockRotation: nextLocked,
      selectable: !nextLocked,
      evented: !nextLocked,
    });
    if (nextLocked && canvas.getActiveObject?.() === object) canvas.discardActiveObject?.();
    canvas.requestRenderAll?.();
    refreshLocalState();
  };

  const moveObject = (source: FabricObject, target: FabricObject, before: boolean) => {
    if (!canvas || source === target) return;
    const stack = canvas.getObjects().filter(isDesignObject);
    const withoutSource = stack.filter((object: FabricObject) => object !== source);
    const targetIndex = withoutSource.indexOf(target);
    if (targetIndex < 0) return;

    // "before" significa visualmente arriba: en Fabric equivale a estar delante.
    const newIndex = targetIndex + (before ? 1 : 0);
    if (typeof canvas.moveObjectTo === 'function') canvas.moveObjectTo(source, newIndex);
    else if (typeof canvas.moveTo === 'function') canvas.moveTo(source, newIndex);
    else if (before) source.bringForward?.();
    else source.sendBackwards?.();
    canvas.setActiveObject(source);
    canvas.renderAll();
    setDraggedObject(null);
    setDropTarget(null);
  };

  return (
    <aside className="flex min-h-0 w-full max-w-[320px] flex-col bg-white" aria-label="Capas del diseño">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Capas</h2>
        <p className="mt-0.5 text-xs text-slate-500">Ordena, oculta o bloquea elementos</p>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {!canvas || objects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
            Aún no hay elementos en el diseño.
          </div>
        ) : (
          objects.map((object, index) => {
            const selected = activeObjects.includes(object);
            const image = getObjectImage(object);
            const isDropTarget = dropTarget?.object === object;
            const hidden = object.visible === false;
            const locked = isObjectLocked(object);
            return (
              <div
                key={object.__sid || object.__uid || `${object.type}-${index}`}
                draggable={!hidden && !locked}
                onDragStart={(event) => {
                  if (hidden || locked) return;
                  event.dataTransfer.effectAllowed = 'move';
                  setDraggedObject(object);
                }}
                onDragEnd={() => {
                  setDraggedObject(null);
                  setDropTarget(null);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  setDropTarget({ object, before: event.clientY < rect.top + rect.height / 2 });
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedObject && dropTarget) moveObject(draggedObject, object, dropTarget.before);
                }}
                className={`relative flex w-full items-center gap-2 rounded-xl border p-2 text-left transition ${
                  selected ? 'border-violet-500 bg-violet-50 shadow-sm' : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                } ${draggedObject === object || hidden ? 'opacity-45' : ''}`}
              >
                {isDropTarget && dropTarget?.before && <span className="absolute -top-0.5 left-2 right-2 h-0.5 rounded bg-slate-900" />}
                {isDropTarget && !dropTarget?.before && <span className="absolute -bottom-0.5 left-2 right-2 h-0.5 rounded bg-slate-900" />}
                <GripVertical size={16} className="shrink-0 cursor-grab text-slate-400 active:cursor-grabbing" aria-hidden="true" />
                <button type="button" onClick={() => selectObject(object)} className="flex min-w-0 flex-1 items-center gap-2 text-left" disabled={hidden}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-600">
                    {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <LayerIcon object={object} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-800">{getLayerTitle(object)} {locked && <span className="ml-1 text-violet-500">· bloqueada</span>}</span>
                    <span className="block truncate text-[11px] text-slate-500">{hidden ? 'Oculta' : getLayerContent(object)}</span>
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button type="button" onClick={(event) => { event.stopPropagation(); toggleVisibility(object); }} className={`rounded-lg p-1.5 transition ${hidden ? 'text-slate-400 hover:bg-slate-100' : 'text-slate-600 hover:bg-violet-100 hover:text-violet-700'}`} aria-label={hidden ? `Mostrar ${getLayerTitle(object)}` : `Ocultar ${getLayerTitle(object)}`} title={hidden ? 'Mostrar capa' : 'Ocultar capa'}>{hidden ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); toggleLock(object); }} className={`rounded-lg p-1.5 transition ${locked ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`} aria-label={locked ? `Desbloquear ${getLayerTitle(object)}` : `Bloquear ${getLayerTitle(object)}`} title={locked ? 'Desbloquear capa' : 'Bloquear capa'}>{locked ? <Lock size={15} /> : <Unlock size={15} />}</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
