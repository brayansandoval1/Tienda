'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, X, Trash2 } from 'lucide-react';
import type { TextOptions } from '../../types/product';
import type { Product, ProductView } from '@/src/store/useProductStore';

type PrintArea = ProductView['printArea'];
const ADMIN_BASE_SIZE = 800;

interface EditorCanvasProps {
  product: Product;
}

export default function EditorCanvas({ product: initialProduct }: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<any>(null);
  const safeZoneRef = useRef<any>(null);
  const historyRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const isRedoingUndoRef = useRef(false);
  const isUpdatingHistory = useRef(false);
  const [isCropping, setIsCropping] = useState(false);
  const [isImageSelected, setIsImageSelected] = useState(false);
  const [currentViewId, setCurrentViewId] = useState<string>(initialProduct.views[0]?.id ?? 'front');
  const [productViews, setProductViews] = useState<ProductView[]>(initialProduct.views);
  const currentViewIdRef = useRef<string>(initialProduct.views[0]?.id ?? 'front');
  const canvasDataRef = useRef<Record<string, string | null>>({});
  const switchViewRef = useRef<(viewId: string) => void>(null);
  const setupProductRef = useRef<((product: Product) => void) | null>(null);

  // El canvas de Fabric se conserva montado; al cambiar el producto sólo se
  // reconstruyen su mockup y guía. Esto evita renderizados sobre un contexto
  // ya destruido por React.
  useEffect(() => {
    setupProductRef.current?.(initialProduct);
  }, [initialProduct]);

  useEffect(() => {
    if (!canvasRef.current) return;

    let isMounted = true;
    let handleAddText: (e: Event) => void,
      handleColorChange: (e: Event) => void,
      handleFontChange: (e: Event) => void,
      handleFontSizeChange: (e: Event) => void,
      handleAddImage: (e: Event) => void,
      handleDelete: () => void,
      handleDuplicate: () => void,
      handleBringForward: () => void,
      handleSendBackward: () => void,
      handleKeyDown: (e: KeyboardEvent) => void,
      handleClear: () => void,
      handleUndo: () => void,
      handleRedo: () => void,
      handleAddShape: (e: Event) => void,
      handleAddSVG: (e: Event) => void,
      handleStartCrop: () => void,
      handleConfirmCrop: () => void,
      handleCancelCrop: () => void,
      handleCropStart: () => void,
      handleCropEnd: () => void,
      handleRequestExport: () => void,
      handleResetCrop: () => void,
      handleAlign: (e: Event) => void;

    // Carga dinámica de Fabric solo en el cliente
    import('fabric').then((fabricModule) => {
      if (!isMounted || !canvasRef.current) return;

      const fabric = fabricModule.fabric || fabricModule;
      // React.StrictMode puede montar/desmontar el efecto dos veces durante
      // desarrollo. Nunca dejes una instancia de Fabric sobre el mismo nodo.
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      // El canvas se muestra a 800×800 CSS px. Desactivar el buffer Retina
      // evita que Fabric duplique sus coordenadas internas y desincronice el
      // hit testing respecto al puntero.
      (fabric as any).devicePixelRatio = 1;
      const canvas = new (fabric as any).Canvas(canvasRef.current, {
        width: ADMIN_BASE_SIZE,
        height: ADMIN_BASE_SIZE,
        enableRetinaScaling: false,
        backgroundColor: '#F4F5F7',
        selection: true,
        interactive: true,
        preserveObjectStacking: true,
        subTargetCheck: false,
      });
      // Admin y editor comparten un único plano interno de 800×800 px.
      canvas.setWidth(ADMIN_BASE_SIZE);
      canvas.setHeight(ADMIN_BASE_SIZE);
      // Sólo el tamaño visual se adapta al contenedor; el buffer y las
      // coordenadas internas conservan siempre 800×800.
      canvas.setDimensions({ width: '100%', height: '100%' }, { cssOnly: true });

      // Forzar interactividad global del lienzo
      canvas.set({
        selection: true, // Permite seleccionar objetos con cuadro azul
        interactive: true, // Permite arrastrar, escalar y rotar
        skipTargetFind: false,
        defaultCursor: 'default',
        hoverCursor: 'move',
        moveCursor: 'move',
      });

      // Fabric crea un `upper-canvas` para recibir el puntero. Debe poder
      // recibir eventos aunque el componente se monte dentro de otros layouts.
      const fabricCanvasElement = canvas as any;
      fabricCanvasElement.upperCanvasEl.style.pointerEvents = 'auto';
      fabricCanvasElement.upperCanvasEl.style.userSelect = 'none';
      fabricCanvasElement.upperCanvasEl.style.webkitUserSelect = 'none';
      fabricCanvasElement.lowerCanvasEl.style.pointerEvents = 'auto';
      fabricCanvasElement.wrapperEl.style.pointerEvents = 'auto';

      // Recalcular coordenadas del mouse respecto a la pantalla
      canvas.calcOffset();

      fabricCanvasRef.current = canvas;

      // Propiedades por defecto para que todos los objetos sean libremente movibles/redimensionables
      const defaultObjectProps = {
        selectable: true,
        evented: true,
        hasControls: true,
        lockUniScaling: false,
        lockMovementX: false,
        lockMovementY: false,
        lockRotation: false,
        lockScalingX: false,
        lockScalingY: false,
        hasBorders: true,
      };

      // Reafirma la edición en cada objeto creado por el usuario. Se aplica
      // después de construirlo para que ninguna opción específica de Fabric
      // (o de un SVG cargado) pueda dejarlo estático.
      const makeObjectInteractive = <T extends any>(object: T): T => {
        (object as any).set({
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          lockMovementX: false,
          lockMovementY: false,
          lockRotation: false,
          lockScalingX: false,
          lockScalingY: false,
        });
        return object;
      };


      const updateHistoryButtons = () => {
        window.dispatchEvent(
          new CustomEvent('editor:history-updated', {
            detail: {
              canUndo: historyRef.current.length > 1,
              canRedo: redoStackRef.current.length > 0,
            },
          }),
        );
      };

      const saveState = () => {
        if (isRedoingUndoRef.current || isUpdatingHistory.current || !fabricCanvasRef.current) return;
        // Filtrar objetos normales excluyendo la guía y el overlay de recorte temporal
        const userObjects = canvas
          .getObjects()
          .filter((obj: any) => !obj.isGuide && !obj.isCropOverlay);
        const jsonState = userObjects.map((obj: any) => obj.toJSON());
        historyRef.current.push(JSON.stringify(jsonState));
        redoStackRef.current = [];
        updateHistoryButtons();
      };

      let activeProduct: Product = initialProduct;
      let activeView: ProductView = initialProduct.views[0];

      const getView = (viewId: string): ProductView =>
        activeProduct.views.find((v) => v.id === viewId) || activeProduct.views[0];

      const getPercentPrintArea = (view: ProductView): PrintArea => {
        if (view.printAreaUnit === 'percent') {
          return view.printArea;
        }
        // Compatibilidad con el catálogo creado antes de usar porcentajes.
        return {
          x: (view.printArea.x * 100) / ADMIN_BASE_SIZE,
          y: (view.printArea.y * 100) / ADMIN_BASE_SIZE,
          width: (view.printArea.width * 100) / ADMIN_BASE_SIZE,
          height: (view.printArea.height * 100) / ADMIN_BASE_SIZE,
        };
      };

      const getRenderedPrintArea = (view: ProductView): PrintArea => {
        const area = getPercentPrintArea(view);
        const backgroundImage = canvas.backgroundImage as any;
        if (!backgroundImage?.width || !backgroundImage?.height) {
          return {
            x: (area.x / 100) * canvas.getWidth(), y: (area.y / 100) * canvas.getHeight(),
            width: (area.width / 100) * canvas.getWidth(), height: (area.height / 100) * canvas.getHeight(),
          };
        }
        // El mockup siempre se carga con contain, por lo que su escala es
        // uniforme en ambos ejes.
        const imgScale = backgroundImage.scaleX || 1;
        const renderedWidth = backgroundImage.width * imgScale;
        const renderedHeight = backgroundImage.height * imgScale;
        const imgLeft = backgroundImage.left - renderedWidth / 2;
        const imgTop = backgroundImage.top - renderedHeight / 2;
        return {
          x: imgLeft + (area.x / 100) * renderedWidth,
          y: imgTop + (area.y / 100) * renderedHeight,
          width: (area.width / 100) * renderedWidth,
          height: (area.height / 100) * renderedHeight,
        };
      };

      const loadOverlay = (view: ProductView) => {
        // Cargar el overlay del artículo (taza, funda, playera...) según la vista activa.
        // La imagen se usa como fondo del canvas (setBackgroundImage): no pertenece a
        // getObjects() y, por defecto, es no interactiva (selectable/evented = false),
        // por lo que no puede bloquear el ratón sobre los textos/imágenes del usuario.
        // La carga se envuelve en try/catch y el callback verifica !img para que un
        // error de red (404, CORS bloqueado) nunca congele el flujo de la vista.
        return new Promise<void>((resolve) => {
          if (!view?.mockupUrl) {
            // Sin overlay: limpiar fondo residual y continuar sin bloquear el lienzo.
            canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
            drawSafeArea(getPercentPrintArea(view));
            resolve();
            return;
          }
          try {
            fabric.Image.fromURL(
              view.mockupUrl,
              (img) => {
                if (!img) {
                  // La red falló (404, CORS...). Limpiar el fondo y no congelar el lienzo.
                  canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
                  drawSafeArea(getPercentPrintArea(view));
                  resolve();
                  return;
                }
                const canvasWidth = canvas.getWidth();
                const canvasHeight = canvas.getHeight();
                const imageWidth = img.width || canvasWidth;
                const imageHeight = img.height || canvasHeight;
                const scale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight);
                img.set({
                  scaleX: scale,
                  scaleY: scale,
                  left: canvasWidth / 2,
                  top: canvasHeight / 2,
                  originX: 'center',
                  originY: 'center',
                  selectable: false,
                  evented: false,
                  lockMovementX: true,
                  lockMovementY: true,
                  lockScalingX: true,
                  lockScalingY: true,
                  lockRotation: true,
                });
                canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
                drawSafeArea(getPercentPrintArea(view));
                resolve();
              },
              { crossOrigin: 'anonymous' },
            );
          } catch (err) {
            // Error síncrono inesperado: limpiar fondo y seguir con el flujo de la vista.
            canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
            resolve();
          }
        });
      };

      const drawSafeArea = (printArea: PrintArea) => {
        // Zona de diseño seguro (caja punteada verde). Invisible para el puntero del
        // mouse: selectable/evented = false y enviada al fondo (sendToBack) para que
        // nunca tape ni bloquee los textos/imágenes agregados por el usuario.
        const c = fabricCanvasRef.current;
        const backgroundImage = c?.backgroundImage as any;
        if (!c || !printArea || !backgroundImage?.width || !backgroundImage?.height) return;

        // Eliminar guías/zonas de diseño previas
        const oldGuides = c.getObjects().filter((obj: any) => obj.isGuideLine);
        oldGuides.forEach((g: any) => c.remove(g));

        // `loadOverlay` aplica contain y centra la imagen. La zona segura se
        // calcula dentro del rectángulo realmente ocupado por el mockup, no
        // sobre el canvas de 800×800 que puede incluir franjas vacías.
        const imgScale = backgroundImage.scaleX || 1;
        const imgLeft = backgroundImage.left - (backgroundImage.width * imgScale / 2);
        const imgTop = backgroundImage.top - (backgroundImage.height * imgScale / 2);
        const safeZone = new fabric.Rect({
          left: imgLeft + ((Number(printArea.x) / 100) * (backgroundImage.width * imgScale)),
          top: imgTop + ((Number(printArea.y) / 100) * (backgroundImage.height * imgScale)),
          width: (Number(printArea.width) / 100) * (backgroundImage.width * imgScale),
          height: (Number(printArea.height) / 100) * (backgroundImage.height * imgScale),
          fill: 'transparent',
          stroke: '#22c55e',
          strokeDashArray: [6, 6],
          strokeWidth: 2,
          // PROPIEDADES CLAVE PARA QUE NO BLOQUEE EL MOUSE:
          selectable: false,
          evented: false,
          lockMovementX: true,
          lockMovementY: true,
          lockScalingX: true,
          lockScalingY: true,
          lockRotation: true,
          isGuideLine: true,
          hasControls: false,
          hasBorders: false,
          excludeFromExport: true,
        } as any);

        // Marcar como guía para excluirla de saveState/ensureObjectsInteractable
        (safeZone as any).isGuideLine = true;
        (safeZone as any).isGuide = true;

        safeZoneRef.current = safeZone;
        c.add(safeZone);
        c.sendToBack(safeZone); // Siempre detrás de los objetos del usuario
        c.requestRenderAll();
      };

      // Restringe los objetos del usuario para que no se dibujen fuera del printArea
      const clampToPrintArea = (obj: any) => {
        if (!obj || obj.isGuide || !activeView) return;
        const area = getRenderedPrintArea(activeView);
        const left = area.x;
        const top = area.y;
        const right = area.x + area.width;
        const bottom = area.y + area.height;

        let bound = { left: obj.left || 0, top: obj.top || 0, width: obj.width || 0, height: obj.height || 0 };
        if (typeof obj.getBoundingRect === 'function') {
          const br = obj.getBoundingRect();
          bound = { left: br.left, top: br.top, width: br.width, height: br.height };
        }
        // `getBoundingRect()` usa la esquina visual, mientras que `left/top`
        // dependen del origin del objeto (los nuevos se crean centrados). Se
        // corrige por delta para no sobrescribir la posición con coordenadas
        // de otro sistema durante cada frame del arrastre.
        const clampedLeft = Math.min(Math.max(bound.left, left), Math.max(left, right - bound.width));
        const clampedTop = Math.min(Math.max(bound.top, top), Math.max(top, bottom - bound.height));
        obj.set({
          left: (obj.left || 0) + (clampedLeft - bound.left),
          top: (obj.top || 0) + (clampedTop - bound.top),
        });
      };

      const snapshotCurrentObjects = () => {
        const c = fabricCanvasRef.current;
        const userObjects = c ? c.getObjects().filter((o: any) => !o.isGuide) : [];
        return JSON.stringify(userObjects.map((o: any) => o.toJSON()));
      };

      // Garantiza que ningún objeto quede bloqueado para arrastrar/escalar
      const ensureObjectsInteractable = () => {
        const c = fabricCanvasRef.current;
        if (!c) return;
        c.forEachObject((obj: any) => {
          if (obj && obj !== safeZoneRef.current && !obj.isGuide) {
            obj.set({
              selectable: true,
              evented: true,
              lockMovementX: false,
              lockMovementY: false,
              lockRotation: false,
              lockScalingX: false,
              lockScalingY: false,
              hasControls: true,
              hasBorders: true,
            });
          }
        });
      };

      const setupProduct = (product: Product) => {
        activeProduct = product;
        activeView = product.views[0];
        // Ajustar dimensiones del canvas de Fabric.js
        // El admin define printArea sobre este mismo sistema de coordenadas.
        canvas.setWidth(ADMIN_BASE_SIZE);
        canvas.setHeight(ADMIN_BASE_SIZE);
        canvas.calcOffset();

        canvasDataRef.current = {};
        currentViewIdRef.current = activeView.id;
        setCurrentViewId(activeView.id);
        setProductViews(product.views);

        // Limpiar el canvas reconstruyendo fondo + zona segura según la nueva vista
        isUpdatingHistory.current = true;
        canvas.clear();
        drawSafeArea(getPercentPrintArea(activeView));
        loadOverlay(activeView);
        canvas.requestRenderAll();
        isUpdatingHistory.current = false;
        ensureObjectsInteractable();

        historyRef.current = [snapshotCurrentObjects()];
        redoStackRef.current = [];
        updateHistoryButtons();
      };

      setupProductRef.current = setupProduct;
      setupProduct(initialProduct);

      // --- Vistas de producto (frente, espalda, etc.) ---
      const finishViewSwitch = (viewId: string) => {
        const view = getView(viewId);
        activeView = view;
        // Cambiar el overlay según la vista seleccionada
        loadOverlay(view);

        currentViewIdRef.current = viewId;
        setCurrentViewId(viewId); // Actualizar el estado
        isUpdatingHistory.current = false;

        // Restablecer el historial de la nueva vista a una sola línea base
        historyRef.current = [snapshotCurrentObjects()];
        redoStackRef.current = [];
        updateHistoryButtons();
        canvas.requestRenderAll();
      };

      const switchView = (viewId: string) => {
        const c = fabricCanvasRef.current;
        if (!c || viewId === currentViewIdRef.current) return;

        // Guardar el estado actual en la vista previa
        canvasDataRef.current[currentViewIdRef.current] = snapshotCurrentObjects();

        isUpdatingHistory.current = true;

        // Limpiar el canvas actual conservando la zona segura de la nueva vista
        c.clear();
        drawSafeArea(getPercentPrintArea(getView(viewId)));

        // Cargar el diseño existente de la nueva vista (si existe)
        const stored = canvasDataRef.current[viewId];
        if (stored) {
          // @ts-ignore Fabric.js types mismatch
          fabric.util.enlivenObjects(JSON.parse(stored), (enlivened: any[]) => {
            enlivened.forEach((obj: any) => c.add(obj));
            ensureObjectsInteractable();
            // Reafirmar interactividad global tras cargar objetos
            c.selection = true;
            c.calcOffset();
            if (safeZoneRef.current) c.sendToBack(safeZoneRef.current); // guía siempre detrás
            c.requestRenderAll();
            finishViewSwitch(viewId);
          });

        } else {
          c.selection = true;
          c.calcOffset();
          if (safeZoneRef.current) c.sendToBack(safeZoneRef.current); // guía siempre detrás
          finishViewSwitch(viewId);
        }
      };
      // @ts-ignore ref assignment for React 19 readonly typing
      (switchViewRef as any).current = switchView;

      // Restringir movimiento/escalado de los objetos al printArea de la vista activa
      canvas.on('object:moving', (e: any) => {
        const object = e.target;
        if (!object) return;
        clampToPrintArea(object);
        // Actualiza la matriz de colisión y los controles durante el drag,
        // sin escribir estado de React ni recrear el canvas.
        object.setCoords();
        canvas.requestRenderAll();
      });
      canvas.on('object:scaling', (e: any) => clampToPrintArea(e.target));
      canvas.on('object:modified', (e: any) => clampToPrintArea(e.target));
      // Fabric modifica el objeto en memoria durante las transformaciones.
      // Forzar el render mantiene sincronizado el upper-canvas visible con
      // esas modificaciones, especialmente en pantallas con escala Retina.
      canvas.on('object:scaling', () => canvas.requestRenderAll());
      canvas.on('object:rotating', () => canvas.requestRenderAll());
      canvas.on('object:modified', () => canvas.requestRenderAll());
      canvas.on('mouse:down', () => {
        canvas.calcOffset();
      });

      // Renderiza una cara determinada en el canvas (para exportación de ambas caras)
      const loadViewObjects = async (view: ProductView): Promise<void> => {
        const c = fabricCanvasRef.current;
        if (!c) return;
        isUpdatingHistory.current = true;

        // Limpiar solo objetos de usuario (conservando la zona segura)
        const userObjects = c.getObjects().filter((o: any) => o !== safeZoneRef.current);
        userObjects.forEach((o: any) => c.remove(o));
        await loadOverlay(view);
        drawSafeArea(getPercentPrintArea(view));

        const stored = canvasDataRef.current[view.id];
        if (!stored) {
          isUpdatingHistory.current = false;
          return;
        }
        await new Promise<void>((resolve) => {
          // @ts-ignore Fabric.js types mismatch
          fabric.util.enlivenObjects(JSON.parse(stored), (enlivened: any[]) => {
            enlivened.forEach((obj: any) => c.add(obj));
            ensureObjectsInteractable();
            // Reafirmar interactividad global tras cargar objetos
            c.selection = true;
            c.calcOffset();
            c.requestRenderAll();
            isUpdatingHistory.current = false;
            resolve();
          });

        });
      };

      // Exporta miniaturas/renders de todas las vistas para el resumen del pedido
      const exportAll = async () => {
        const c = fabricCanvasRef.current;
        if (!c) return {};

        const originalViewId = currentViewIdRef.current;
        canvasDataRef.current[originalViewId] = snapshotCurrentObjects();

        const renders: Record<string, string> = {};
        for (const view of activeProduct.views) {
          await loadViewObjects(view);
          renders[view.id] = c.toDataURL({ format: 'png', multiplier: 1 });
        }

        // Restaurar la vista original
        await loadViewObjects(getView(originalViewId));
        currentViewIdRef.current = originalViewId;
        setCurrentViewId(originalViewId);
        historyRef.current = [snapshotCurrentObjects()];
        redoStackRef.current = [];
        updateHistoryButtons();

        return renders;
      };

      handleRequestExport = async () => {
        const renders = await exportAll();
        window.dispatchEvent(new CustomEvent('editor:export-sides', { detail: renders }));
      };

      // Alineación / centrado del objeto dentro de la Zona Segura (printArea) de la
      // vista activa. Versión limpia: garantiza que el objeto conserve los permisos de
      // arrastre y reafirma la interactividad global del lienzo al terminar.
      handleAlign = (e: Event) => {
        const customEvent = e as CustomEvent<{ alignment?: string }>;
        const alignment = customEvent.detail?.alignment;
        const canvas = fabricCanvasRef.current;
        if (!canvas || !alignment) return;

        const obj = canvas.getActiveObject();
        if (!obj || (obj as any).isGuide) return;

        const printArea = getRenderedPrintArea(activeView);

        // Forzar que el objeto conserve los permisos de arrastre del ratón
        obj.set({
          selectable: true,
          evented: true,
          lockMovementX: false,
          lockMovementY: false,
          lockRotation: false,
          lockScalingX: false,
          lockScalingY: false,
        });

        const objBounds = obj.getBoundingRect();
        const objWidth = objBounds.width;
        const objHeight = objBounds.height;
        const originOffsetX = obj.left - objBounds.left;
        const originOffsetY = obj.top - objBounds.top;

        const centerX = printArea.x + printArea.width / 2;
        const centerY = printArea.y + printArea.height / 2;

        if (alignment === 'center-h' || alignment === 'center-both') {
          obj.set('left', centerX - objWidth / 2 + originOffsetX);
        }
        if (alignment === 'center-v' || alignment === 'center-both') {
          obj.set('top', centerY - objHeight / 2 + originOffsetY);
        }
        if (alignment === 'left') {
          obj.set('left', printArea.x);
        } else if (alignment === 'right') {
          obj.set('left', printArea.x + printArea.width - objWidth + originOffsetX);
        } else if (alignment === 'top') {
          obj.set('top', printArea.y);
        } else if (alignment === 'bottom') {
          obj.set('top', printArea.y + printArea.height - objHeight + originOffsetY);
        }

        obj.setCoords();
        canvas.setActiveObject(obj);

        // Reafirmar la interactividad global del lienzo tras alinear
        canvas.selection = true;
        canvas.interactive = true;
        canvas.skipTargetFind = false;
        canvas.calcOffset();
        canvas.requestRenderAll();

        saveState();
      };

      // Helper para cargar Google Fonts dinámicamente
      const loadGoogleFont = (fontFamily: string) => {
        const id = `google-font-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`;
        if (!document.getElementById(id)) {
          const link = document.createElement('link');
          link.id = id;
          link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@400;700&display=swap`;
          link.rel = 'stylesheet';
          document.head.appendChild(link);
        }
      };

      // --- Listeners para emitir eventos de selección ---
      const emitSelection = () => {
        // Refrescar bordes y controles de la selección inmediatamente.
        canvas.calcOffset();
        canvas.requestRenderAll();
        const activeObject = canvas.getActiveObject();

        let fill: string | undefined = activeObject ? activeObject.get('fill') : undefined;

        // Para grupos (SVG importado), tomar el color del primer hijo con relleno visible
        if (activeObject && (activeObject.type === 'group' || activeObject._objects)) {
          const children =
            activeObject.getObjects && typeof activeObject.getObjects === 'function'
              ? activeObject.getObjects()
              : [];
          const firstFilled = children.find(
            (c: any) => c.fill && c.fill !== 'none' && c.fill !== 'transparent' && c.fill !== '',
          );
          fill = (firstFilled ? firstFilled.fill : children[0]?.fill) ?? fill;
        }

        // Emitir evento unificado de cambio de selección (SIEMPRE con detail)
        setIsImageSelected(!!(activeObject && activeObject.type === 'image'));
        window.dispatchEvent(new CustomEvent('editor:selection-changed', {
          detail: {
            selectedObject: activeObject ? {
              type: activeObject.type,
              fill: fill ?? '#000000',
              fontFamily: activeObject.get('fontFamily'),
              fontSize: activeObject.get('fontSize'),
            } : null
          }
        }));
      };

      canvas.on('selection:created', emitSelection);
      canvas.on('selection:updated', emitSelection);
      canvas.on('selection:cleared', () => {
        setIsImageSelected(false);
        window.dispatchEvent(new CustomEvent('editor:selection-changed', {
          detail: { selectedObject: null }
        }));
      });

      // --- Listeners para recibir cambios desde la barra de herramientas ---
      handleColorChange = (e: Event) => {
        const customEvent = e as CustomEvent<{ color?: string }>;
        const newColor = customEvent.detail?.color;
        const canvas = fabricCanvasRef.current;
        if (!canvas || !newColor) return;

        const activeObjects = canvas.getActiveObjects();
        if (!activeObjects || activeObjects.length === 0) return;

        activeObjects.forEach((activeObject: any) => {
          if (!activeObject || !activeObject.set) return;

          // Si el objeto seleccionado es un Grupo (como un SVG importado)
          if (activeObject.type === 'group' || activeObject._objects) {
            activeObject.forEachObject((obj: any) => {
              if (!obj || !obj.set) return;
              // Cambiar fill si el objeto tiene relleno original o no está transparente
              if (obj.fill && obj.fill !== 'none' && obj.fill !== 'transparent') {
                obj.set('fill', newColor);
              }
              // Cambiar stroke si es una línea o trazo con borde
              if (obj.stroke && obj.stroke !== 'none' && obj.stroke !== 'transparent') {
                obj.set('stroke', newColor);
              }
            });
            return;
          }

          // Si es un objeto individual (Rect, Circle, Path simple o línea)
          if (activeObject.type === 'line') {
            activeObject.set({ stroke: newColor });
          } else {
            activeObject.set({ fill: newColor });
          }
        });

        canvas.requestRenderAll();
        saveState();
      };

      handleFontChange = async (e: Event) => {
        if (!fabricCanvasRef.current) return;
        const customEvent = e as CustomEvent;
        const { fontFamily } = customEvent.detail || {};
        if (!fontFamily) return;

        const activeObject = fabricCanvasRef.current.getActiveObject();
        if (!activeObject || (activeObject.type !== 'i-text' && activeObject.type !== 'text')) return;

        // Cargar el stylesheet de Google Fonts
        loadGoogleFont(fontFamily);

        // Esperar a que el navegador cargue la fuente antes de aplicarla
        try {
          await document.fonts.load(`16px "${fontFamily}"`);
          activeObject.set('fontFamily', fontFamily);
          fabricCanvasRef.current.renderAll();
          saveState();
        } catch (err) {
          console.warn('Error al cargar la fuente:', fontFamily, err);
          // Aplicar de todas formas incluso si falla la precarga
          activeObject.set('fontFamily', fontFamily);
          fabricCanvasRef.current.renderAll();
        }
      };

      handleFontSizeChange = (e: Event) => {
        const customEvent = e as CustomEvent;
        const detail = customEvent?.detail || {};
        const fontSize = detail.fontSize;
        
        if (!fontSize) return;
        
        const activeObject = fabricCanvasRef.current?.getActiveObject();
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'text')) {
          activeObject.set('fontSize', fontSize);
          fabricCanvasRef.current.renderAll();
          saveState();
        }
      };

      // Listener para agregar texto vía CustomEvent
      handleAddText = (e: Event) => {
        if (!fabricCanvasRef.current) return;
        const customEvent = e as CustomEvent;
        const { text, fontSize, fontWeight } = customEvent.detail || {};

        const newText = makeObjectInteractive(new fabric.IText(text || 'Texto', {
          left: canvas.getWidth() / 2,
          top: canvas.getHeight() / 2,
          originX: 'center',
          originY: 'center',
          fontSize: fontSize || 24,
          fontWeight: fontWeight || 'normal',
          fill: '#1e293b',
          editable: true,
          ...defaultObjectProps,
        }));

        fabricCanvasRef.current.add(newText);
        fabricCanvasRef.current.centerObject(newText);
        fabricCanvasRef.current.setActiveObject(newText);
        fabricCanvasRef.current.bringToFront(newText);
        fabricCanvasRef.current.renderAll();
      };

      // Listener para agregar imagen vía CustomEvent
      handleAddImage = (e: Event) => {
        if (!fabricCanvasRef.current) return;
        const customEvent = e as CustomEvent<{ dataUrl: string }>;
        const { dataUrl } = customEvent.detail || {};
        if (!dataUrl) return;

        // Crear un elemento img HTML oculto para precargar la imagen Base64
        const imgElement = document.createElement('img');
        imgElement.src = dataUrl;

        imgElement.onload = () => {
          // Una vez cargada en el HTML, crear el objeto de Fabric
          const fabricImage = makeObjectInteractive(new fabric.Image(imgElement, {
            left: canvas.getWidth() / 2,
            top: canvas.getHeight() / 2,
            originX: 'center',
            originY: 'center',
            cornerStyle: 'circle',
            transparentCorners: false,
            ...defaultObjectProps,
          }));

          // Escalar si es muy grande
          if (fabricImage.width && fabricImage.width > 300) {
            fabricImage.scaleToWidth(300);
          }

          fabricCanvasRef.current.add(fabricImage);
          fabricCanvasRef.current.centerObject(fabricImage);
          fabricCanvasRef.current.setActiveObject(fabricImage);
          fabricCanvasRef.current.bringToFront(fabricImage);
          fabricCanvasRef.current.renderAll();
        };
      };
      // --- Listeners para manipulación de objetos ---
      handleDelete = () => {
        if (!fabricCanvasRef.current) return;
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
          isUpdatingHistory.current = true;
          activeObjects.forEach((obj: any) => canvas.remove(obj));
          canvas.discardActiveObject();
          canvas.requestRenderAll();
          setTimeout(() => {
            isUpdatingHistory.current = false;
            saveState();
          }, 0);
        }
      };

      handleDuplicate = () => {
        if (!fabricCanvasRef.current) return;
        const activeObject = canvas.getActiveObject();
        if (!activeObject) return;
        
        activeObject.clone((clonedObj: any) => {
          canvas.discardActiveObject();
          clonedObj.set({
            left: clonedObj.left + 20,
            top: clonedObj.top + 20,
            evented: true,
          });
          canvas.add(clonedObj);
          canvas.setActiveObject(clonedObj);
          canvas.requestRenderAll();
          saveState();
        });
      };

      handleBringForward = () => {
        const activeObject = fabricCanvasRef.current?.getActiveObject();
        if (activeObject) {
          fabricCanvasRef.current.bringToFront(activeObject);
          fabricCanvasRef.current.renderAll();
        }
      };

      handleSendBackward = () => {
        const activeObject = fabricCanvasRef.current?.getActiveObject();
        if (activeObject) {
          fabricCanvasRef.current.sendToBack(activeObject);
          // Mantener la zona segura detrás de los objetos para que no bloquee el mouse
          if (safeZoneRef.current) {
            fabricCanvasRef.current.sendToBack(safeZoneRef.current);
          }
          fabricCanvasRef.current.renderAll();
          fabricCanvasRef.current.selection = true;
        }
      };

      // Listener para limpiar el canvas
      handleClear = () => {
        if (!fabricCanvasRef.current) return;
        const objects = fabricCanvasRef.current.getObjects();
        // No eliminar la zona segura
        const userObjects = objects.filter((obj: any) => obj !== safeZoneRef.current);
        userObjects.forEach((obj: any) => fabricCanvasRef.current.remove(obj));
        fabricCanvasRef.current.discardActiveObject();
        fabricCanvasRef.current.renderAll();
        saveState();
      };

      const restoreUserObjects = (jsonString: string) => {
        if (!fabricCanvasRef.current || !jsonString) return;
        const canvas = fabricCanvasRef.current;

        // 1. Remove only user objects
        const userObjects = canvas.getObjects().filter((obj: any) => !obj.isGuide);
        userObjects.forEach((obj: any) => canvas.remove(obj));

        // 2. Enliven and add new objects
        const objectsToLoad = JSON.parse(jsonString);
        // @ts-ignore Fabric.js types mismatch
        fabric.util.enlivenObjects(objectsToLoad, (enlivenedObjects: fabric.Object[]) => {
          enlivenedObjects.forEach((obj) => {
            canvas.add(obj);
          });
          ensureObjectsInteractable();
          canvas.renderAll();
          // Reset flag after render
          setTimeout(() => {
            isRedoingUndoRef.current = false;
          }, 0);
        });
      };

      handleUndo = () => {
        cancelCropMode();
        if (historyRef.current.length <= 1) return;
        isRedoingUndoRef.current = true;

        const current = historyRef.current.pop();
        if (current) {
          redoStackRef.current.push(current);
        }

        const previousState = historyRef.current[historyRef.current.length - 1];
        restoreUserObjects(previousState);
        updateHistoryButtons();
      };

      handleRedo = () => {
        cancelCropMode();
        if (redoStackRef.current.length === 0) return;
        isRedoingUndoRef.current = true;

        const nextState = redoStackRef.current.pop();
        if (nextState) {
          historyRef.current.push(nextState);
          restoreUserObjects(nextState);
          updateHistoryButtons();
        }
      };


      // Soporte para teclado
      handleKeyDown = (e: KeyboardEvent) => {
        const activeObject = fabricCanvasRef.current?.getActiveObject();
        if (activeObject && (activeObject as any).isEditing) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
          handleDelete();
        }
        
        // Keyboard shortcuts for undo/redo
        if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        }
        
        if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
          e.preventDefault();
          handleRedo();
        }
      };

      // Listener para agregar formas geométricas
      let cropOverlayRef: any = null;
      let targetImageRef: any = null;

      // Limpia cualquier proceso de recorte activo (overlays colgados, refs y estado React)
      const cancelCropMode = () => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        // Remover overlays de recorte que hayan quedado colgados
        const cropOverlays = canvas.getObjects().filter((obj: any) => obj.isCropOverlay);
        cropOverlays.forEach((obj: any) => canvas.remove(obj));

        // Limpiar referencias
        cropOverlayRef = null;
        targetImageRef = null;

        // Restablecer el estado booleano de React
        setIsCropping(false);

        canvas.requestRenderAll();
      };

      handleStartCrop = () => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const activeObject = canvas.getActiveObject();
        if (!activeObject || activeObject.type !== 'image') return;

        targetImageRef = activeObject;

        // Crear overlay de recorte sobre la imagen
        const cropOverlay = new fabric.Rect({
          left: activeObject.left,
          top: activeObject.top,
          width: activeObject.getScaledWidth(),
          height: activeObject.getScaledHeight(),
          fill: 'transparent',
          stroke: '#3B82F6',
          strokeWidth: 2,
          strokeDashArray: [6, 6],
          cornerColor: '#FFFFFF',
          cornerStrokeColor: '#3B82F6',
          cornerStyle: 'circle',
          cornerSize: 12,
          transparentCorners: false,
          hasRotatingPoint: false,
          lockRotation: true,
          isCropOverlay: true,
        } as any);

        cropOverlayRef = cropOverlay;
        canvas.add(cropOverlay);
        canvas.setActiveObject(cropOverlay);
        canvas.requestRenderAll();

        // Mostrar botones de confirmar/cancelar
        window.dispatchEvent(new CustomEvent('editor:crop-mode-active'));
      };

      handleConfirmCrop = () => {
        const canvas = fabricCanvasRef.current;
        if (!canvas || !cropOverlayRef || !targetImageRef) return;

        const img = targetImageRef;
        const rect = cropOverlayRef;

        // 1. Obtener coordenadas relativas del recuadro respecto a la imagen
        const imgElement = img._element;
        if (!imgElement) return;

        // Calcular la escala actual de la imagen
        const scaleX = img.scaleX || 1;
        const scaleY = img.scaleY || 1;

        // Calcular origen y tamaño del corte en píxeles reales de la imagen
        const cropX = Math.max(0, (rect.left - img.left) / scaleX);
        const cropY = Math.max(0, (rect.top - img.top) / scaleY);
        const cropWidth = (rect.width * rect.scaleX) / scaleX;
        const cropHeight = (rect.height * rect.scaleY) / scaleY;

        // 2. Crear un canvas auxiliar en memoria para recortar la imagen real
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = cropWidth;
        tempCanvas.height = cropHeight;
        const ctx = tempCanvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(
            imgElement,
            cropX, cropY, cropWidth, cropHeight, // Zona origen
            0, 0, cropWidth, cropHeight          // Zona destino
          );

          const croppedDataUrl = tempCanvas.toDataURL('image/png');

          // 3. Actualizar la fuente de la imagen en Fabric.js
          img.setSrc(croppedDataUrl, () => {
            img.set({
              left: rect.left,
              top: rect.top,
              width: cropWidth,
              height: cropHeight,
              scaleX: scaleX,
              scaleY: scaleY,
            });
            
            // Limpiar rectángulo de recorte
            canvas.remove(rect);
            cropOverlayRef = null;
            targetImageRef = null;

            canvas.setActiveObject(img);
            canvas.requestRenderAll();
            if (typeof saveState === 'function') saveState();
            
            window.dispatchEvent(new CustomEvent('editor:crop-mode-inactive'));
          });
        }
      };

      handleCancelCrop = () => {
        cancelCropMode();
        window.dispatchEvent(new CustomEvent('editor:crop-mode-inactive'));
      };

      handleResetCrop = () => {
        const canvas = fabricCanvasRef.current;
        if (!canvas || !cropOverlayRef || !targetImageRef) return;

        const img = targetImageRef;
        const rect = cropOverlayRef;

        // Restablecer el recuadro de recorte a los límites completos de la imagen
        rect.set({
          left: img.left,
          top: img.top,
          width: img.getScaledWidth(),
          height: img.getScaledHeight(),
          scaleX: 1,
          scaleY: 1,
        });
        canvas.setActiveObject(rect);
        canvas.requestRenderAll();
      };

      // Listeners para el estado de recorte
      handleCropStart = () => setIsCropping(true);
      handleCropEnd = () => setIsCropping(false);

      window.addEventListener('editor:crop-mode-active', handleCropStart);
      window.addEventListener('editor:crop-mode-inactive', handleCropEnd);



      handleAddShape = (e: any) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const { type } = e.detail || {};
        if (!type) return;

        import('fabric').then((fabricModule) => {
          const fabric = fabricModule.fabric || fabricModule;
          let shape: any = null;

          const defaultProps = {
            left: canvas.width / 2,
            top: canvas.height / 2,
            originX: 'center' as const,
            originY: 'center' as const,
            fill: '#1E293B',
            strokeWidth: 0,
            cornerStyle: 'circle' as const,
            transparentCorners: false,
            ...defaultObjectProps,
          };

          if (type === 'rect') {
            shape = new fabric.Rect({ ...defaultProps, width: 100, height: 100 });
          } else if (type === 'circle') {
            shape = new fabric.Circle({ ...defaultProps, radius: 50 });
          } else if (type === 'triangle') {
            shape = new fabric.Triangle({ ...defaultProps, width: 100, height: 100 });
          } else if (type === 'star') {
            // Polígono de 5 puntas para la estrella
            const points = [
              { x: 50, y: 0 }, { x: 63, y: 38 }, { x: 100, y: 38 },
              { x: 69, y: 59 }, { x: 82, y: 100 }, { x: 50, y: 75 },
              { x: 18, y: 100 }, { x: 31, y: 59 }, { x: 0, y: 38 }, { x: 37, y: 38 }
            ];
            shape = new fabric.Polygon(points, { ...defaultProps });
          } else if (type === 'heart') {
            const pathData = "M 272.7 51.2 C 226.4 13.7 153.2 27 118 77 C 82.7 27 9.5 13.7 -36.7 51.2 C -96.7 100 -80 180 118 320 C 316 180 332.7 100 272.7 51.2 Z";
            shape = new fabric.Path(pathData, { ...defaultProps, scaleX: 0.3, scaleY: 0.3 });
          }

          if (shape) {
            makeObjectInteractive(shape);
            shape.setCoords();
            canvas.add(shape);
            canvas.setActiveObject(shape);
            canvas.bringToFront(shape);
            canvas.requestRenderAll();

            // Notificar que hay un objeto seleccionado para activar botones de eliminar/duplicar
            window.dispatchEvent(new CustomEvent('editor:selection-changed', {
              detail: { selectedObject: shape }
            }));

            if (typeof saveState === 'function') saveState();
          }
        });
      };

      // Listener para agregar un ícono SVG desde la barra de recursos (Iconify)
      handleAddSVG = async (e: Event) => {
        const customEvent = e as CustomEvent<{ svgUrl?: string }>;
        const url = customEvent.detail?.svgUrl;
        const canvas = fabricCanvasRef.current;
        if (!url || !canvas) return;

        try {
          // Usar fetch + loadSVGFromString para evitar bloqueos de CORS o métodos obsoletos
          const res = await fetch(url);
          const svgText = await res.text();

          const targetCanvas = fabricCanvasRef.current;
          if (!targetCanvas) return;

          fabric.loadSVGFromString(svgText, (objects: any, options: any) => {
            if (!fabricCanvasRef.current) return;
            const svgGroup = fabric.util.groupSVGElements(objects, options);
            svgGroup.set({
              left: targetCanvas.width / 2,
              top: targetCanvas.height / 2,
              originX: 'center',
              originY: 'center',
              scaleX: 1.5,
              scaleY: 1.5,
              ...defaultObjectProps,
            });
            makeObjectInteractive(svgGroup);
            // Los iconos SVG pueden llegar como Path o Group. Recalcular sus
            // controles evita que el hit testing use límites desfasados.
            svgGroup.setCoords();

            targetCanvas.add(svgGroup);
            targetCanvas.setActiveObject(svgGroup);
            targetCanvas.bringToFront(svgGroup);
            targetCanvas.requestRenderAll();
            if (typeof saveState === 'function') saveState();
          });
        } catch (err) {
          console.error('Error cargando el SVG:', err);
        }
      };

      window.addEventListener('editor:add-text', handleAddText);
      window.addEventListener('editor:change-color', handleColorChange);
      window.addEventListener('editor:change-font', handleFontChange);
      window.addEventListener('editor:change-fontSize', handleFontSizeChange);
      window.addEventListener('editor:add-image', handleAddImage);
      window.addEventListener('editor:delete-active', handleDelete);
      window.addEventListener('editor:clear-canvas', handleClear);
      window.addEventListener('editor:duplicate-active', handleDuplicate);
      window.addEventListener('editor:bring-forward', handleBringForward);
      window.addEventListener('editor:send-backward', handleSendBackward);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('editor:add-shape', handleAddShape);
      window.addEventListener('editor:add-svg', handleAddSVG);
      window.addEventListener('editor:undo', handleUndo);
      window.addEventListener('editor:redo', handleRedo);
      window.addEventListener('editor:start-crop', handleStartCrop);
      window.addEventListener('editor:confirm-crop', handleConfirmCrop);
      window.addEventListener('editor:cancel-crop', handleCancelCrop);
      window.addEventListener('editor:reset-crop', handleResetCrop);
      window.addEventListener('editor:request-export', handleRequestExport);
      window.addEventListener('editor:align', handleAlign);

      canvas.on('object:added', saveState);
      canvas.on('object:modified', saveState);
      canvas.on('object:removed', saveState);
    });

    return () => {
      isMounted = false;
      if (handleAddText) {
        window.removeEventListener('editor:add-text', handleAddText);
      }
      if (handleColorChange) {
        window.removeEventListener('editor:change-color', handleColorChange);
      }
      if (handleFontChange) {
        window.removeEventListener('editor:change-font', handleFontChange);
      }
      if (handleFontSizeChange) {
        window.removeEventListener('editor:change-fontSize', handleFontSizeChange);
      }
      if (handleAddImage) {
        window.removeEventListener('editor:add-image', handleAddImage);
      }
      if (handleDelete) {
        window.removeEventListener('editor:delete-active', handleDelete);
        window.removeEventListener('keydown', handleKeyDown);
      }
      if (handleDuplicate) window.removeEventListener('editor:duplicate-active', handleDuplicate);
      if (handleBringForward) window.removeEventListener('editor:bring-forward', handleBringForward);
      if (handleSendBackward) {
        window.removeEventListener('editor:send-backward', handleSendBackward);
      }
      if (handleClear) {
        window.removeEventListener('editor:clear-canvas', handleClear);
      }
      if (handleUndo) {
        window.removeEventListener('editor:undo', handleUndo);
      }
      if (handleRedo) {
        window.removeEventListener('editor:redo', handleRedo);
      }
      if (handleAddShape) {
        window.removeEventListener('editor:add-shape', handleAddShape);
      }
      if (handleAddSVG) {
        window.removeEventListener('editor:add-svg', handleAddSVG);
      }
      if (handleStartCrop) {
        window.removeEventListener('editor:start-crop', handleStartCrop);
      }
      if (handleConfirmCrop) {
        window.removeEventListener('editor:confirm-crop', handleConfirmCrop);
      }
      if (handleCancelCrop) {
        window.removeEventListener('editor:cancel-crop', handleCancelCrop);
      }
      if (handleResetCrop) {
        window.removeEventListener('editor:reset-crop', handleResetCrop);
      }
      if (handleCropStart) {
        window.removeEventListener('editor:crop-mode-active', handleCropStart);
      }
      if (handleCropEnd) {
        window.removeEventListener('editor:crop-mode-inactive', handleCropEnd);
      }
      if (handleRequestExport) {
        window.removeEventListener('editor:request-export', handleRequestExport);
      }
      if (handleAlign) {
        window.removeEventListener('editor:align', handleAlign);
      }
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      setupProductRef.current = null;
    };
  }, []);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[32px] border border-slate-200 bg-[#F4F5F7] p-0 shadow-sm">
      <div className="pointer-events-auto mx-auto flex aspect-square w-full max-w-[600px] select-none items-center justify-center overflow-hidden rounded-md shadow-inner">
        <canvas ref={canvasRef} width={800} height={800} style={{ width: '100%', height: '100%', pointerEvents: 'auto' }} />
      </div>
      {!isCropping ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur-sm">
          {productViews.length > 1 &&
            productViews.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => switchViewRef.current?.(view.id)}
                className={`pointer-events-auto rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  currentViewId === view.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {view.label}
              </button>
            ))}
          {isImageSelected && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('editor:start-crop'))}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              ✂️ Recortar
            </button>
          )}
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100/95 p-2 shadow-lg backdrop-blur-sm">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('editor:confirm-crop'))}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            <Check size={16} />
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('editor:cancel-crop'))}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            <X size={16} />
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('editor:reset-crop'))}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            <Trash2 size={16} />
            Limpiar Recorte
          </button>
        </div>
      )}
    </div>
  );
}
