'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, X, Trash2 } from 'lucide-react';
import type { TextOptions } from '../../types/product';
import type { ColorVariant, Product, ProductOptionValue, ProductView } from '@/src/store/useProductStore';
import type { SaveDesignResult, SavedDesignPayload } from '@/src/types/editorDesign';

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
  const [selectedColor, setSelectedColor] = useState<ColorVariant | null>(
    initialProduct.views[0]?.colorVariants?.[0] ?? initialProduct.colors?.[0] ?? null,
  );
  const [selectedColorIds, setSelectedColorIds] = useState<Record<string, string>>({});
  const [designBackgroundColor, setDesignBackgroundColor] = useState<string>('transparent');
  const selectedColorIdsRef = useRef<Record<string, string>>({});
  const designBackgroundColorsRef = useRef<Record<string, string>>({});
  const currentViewIdRef = useRef<string>(initialProduct.views[0]?.id ?? 'front');
  const canvasDataRef = useRef<Record<string, string | null>>({});
  const switchViewRef = useRef<(viewId: string) => void>(null);
  const handleColorChangeRef = useRef<((variant: ColorVariant) => void) | null>(null);
  const handleDesignBgColorChangeRef = useRef<((color: string) => void) | null>(null);
  const setupProductRef = useRef<((product: Product) => void) | null>(null);

  // El canvas de Fabric se conserva montado; al cambiar el producto sólo se
  // reconstruyen su mockup y guía. Esto evita renderizados sobre un contexto
  // ya destruido por React.
  useEffect(() => {
    console.log('📌 [EDITOR - PRODUCTO BASE CARGADO]:', {
      id: initialProduct?.id,
      name: initialProduct?.name,
      baseViews: initialProduct?.views,
    });
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
      handleExportPrint: () => void,
      handleResetCrop: () => void,
      handleAlign: (e: Event) => void,
      handleSaveDesign: () => void,
      handleOptionMockup: (e: Event) => void,
      handleOptionsChanged: (e: Event) => void;

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
      // Conserva las coordenadas lógicas del editor, pero aumenta el buffer
      // interno para que texto y vectores se rendericen nítidos en pantallas
      // de alta densidad (también en monitores de densidad estándar).
      (fabric as any).devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2);
      const canvas = new (fabric as any).Canvas(canvasRef.current, {
        width: ADMIN_BASE_SIZE,
        height: ADMIN_BASE_SIZE,
        enableRetinaScaling: true,
        imageSmoothingEnabled: true,
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
        applyPrintAreaClip(object as any);
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
          .filter((obj: any) => !obj.isGuide && !obj.isCropOverlay && !obj.isDesignBackground);
        const jsonState = userObjects.map((obj: any) => obj.toJSON());
        historyRef.current.push(JSON.stringify(jsonState));
        redoStackRef.current = [];
        updateHistoryButtons();
      };

      let activeProduct: Product = initialProduct;
      let activeView: ProductView = initialProduct.views[0];
      // Cada carga de fondo recibe un token. Un callback de Fabric que llega
      // tarde nunca puede sobrescribir la variante/vista ya resuelta.
      let currentRenderToken = 0;
      let baseProductViews: ProductView[] = initialProduct.views;
      let activeOptionSelections: Record<string, ProductOptionValue> = {};
      // Un valor de opción puede sustituir temporalmente la zona de la vista.
      // `null` significa explícitamente usar la zona segura base del producto.
      let activeOptionPrintArea: PrintArea | null = null;

      const getView = (viewId: string): ProductView =>
        activeProduct.views.find((v) => v.id === viewId) || activeProduct.views[0];

      const resolveCurrentViewData = (
        productViews: ProductView[],
        currentViewIndex: number,
        selectedOptionsMap: Record<string, ProductOptionValue>,
      ) => {
        const baseView = productViews[currentViewIndex] || productViews[0];
        const selectedValues = Object.values(selectedOptionsMap).filter(Boolean);
        const logResolvedView = (resolvedView: { mockupUrl: string; printArea: PrintArea; name: string }) => {
          console.log('🔍 [RESOLVIENDO VISTA]:', {
            vistaIndicePedido: currentViewIndex,
            baseViewEsperada: baseView,
            opcionesSeleccionadas: selectedOptionsMap,
            vistaResueltaFinal: resolvedView,
          });
          return resolvedView;
        };

        // Sin interacción explícita de opciones, el producto base es la única
        // fuente válida de imagen y zona segura.
        if (selectedValues.length === 0) {
          return logResolvedView({
            mockupUrl: baseView.mockupUrl || (baseView as any).url,
            printArea: baseView.printArea,
            name: baseView.name,
          });
        }

        for (const value of selectedValues) {
          if (value.views && Array.isArray(value.views) && value.views.length > 0) {
            const matchedView = value.views.find(
              (view) => view.viewId === baseView.id,
            ) || value.views[currentViewIndex];
            // `null`/cadena vacía significa explícitamente: no sustituir esta
            // cara. Se ignora la variante y se permite el fallback base.
            if (!matchedView?.mockupUrl) continue;
            console.log('✅ [RESOLVER VISTA] Usando vista dinámica específica:', matchedView);
            return logResolvedView({
              mockupUrl: matchedView.mockupUrl,
              printArea: matchedView.printArea || baseView.printArea,
              name: baseView.name,
            });
          }
        }

        console.log('🏠 [RESOLVER VISTA] Usando vista BASE del producto:', baseView);
        return logResolvedView({
          mockupUrl: baseView.mockupUrl || (baseView as any).url,
          printArea: baseView.printArea,
          name: baseView.name,
        });
      };

      const getBasePercentPrintArea = (view: ProductView): PrintArea => {
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

      const getPercentPrintArea = (view: ProductView): PrintArea => activeOptionPrintArea ?? getBasePercentPrintArea(view);

      const getRenderedPrintArea = (view: ProductView): PrintArea => {
        const area = getPercentPrintArea(view);
        // La zona segura siempre se expresa respecto del plano lógico común
        // de 800×800, nunca respecto de los píxeles (o márgenes) del PNG.
        // El Admin usa este mismo contenedor cuadrado.
        return {
          x: (area.x / 100) * canvas.getWidth(),
          y: (area.y / 100) * canvas.getHeight(),
          width: (area.width / 100) * canvas.getWidth(),
          height: (area.height / 100) * canvas.getHeight(),
        };
      };

      // Fabric aplica el clipPath por objeto. Así el mockup y la guía siguen
      // visibles completos, mientras que el diseño del usuario sólo aparece
      // dentro del área imprimible sobre el cuerpo del producto.
      const applyPrintAreaClip = (object: any, view = activeView) => {
        if (!object || object.isGuide || object.isCropOverlay) return;
        const area = getRenderedPrintArea(view);
        object.set({
          clipPath: new fabric.Rect({
            left: area.x,
            top: area.y,
            width: area.width,
            height: area.height,
            originX: 'left',
            originY: 'top',
            absolutePositioned: true,
          } as any),
        });
      };

      const applyPrintAreaClipping = (view = activeView) => {
        canvas.getObjects().forEach((object: any) => applyPrintAreaClip(object, view));
      };

      // Una variante puede usar una imagen diferente para cada cara del
      // producto. Si no existe ese mapa, se conserva su mockup general.
      const getColorMockupUrl = (view: ProductView, color?: ColorVariant): string =>
        color?.mockupUrls?.[view.id] || color?.mockupUrl || view.mockupUrl;

      const fitMockupToCanvas = (img: any) => {
        const scale = Math.min(canvas.getWidth() / img.width, canvas.getHeight() / img.height);
        img.set({
          originX: 'left',
          originY: 'top',
          left: (canvas.getWidth() - img.width * scale) / 2,
          top: (canvas.getHeight() - img.height * scale) / 2,
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
          excludeFromExport: true,
        });
      };

      const loadProductMockup = (view: ProductView, mockupUrlOverride?: string) => {
        const selectedVariant = view.colorVariants?.find(
          (variant) => variant.id === selectedColorIdsRef.current[view.id],
        );
        const mockupUrl = mockupUrlOverride || getColorMockupUrl(view, selectedVariant);
        const renderToken = ++currentRenderToken;
        // Cargar el overlay del artículo (taza, funda, playera...) según la vista activa.
        // La imagen se usa como fondo del canvas (setBackgroundImage): no pertenece a
        // getObjects() y, por defecto, es no interactiva (selectable/evented = false),
        // por lo que no puede bloquear el ratón sobre los textos/imágenes del usuario.
        // La carga se envuelve en try/catch y el callback verifica !img para que un
        // error de red (404, CORS bloqueado) nunca congele el flujo de la vista.
        return new Promise<void>((resolve) => {
          // Cada mockup parte de un sistema de coordenadas 1:1: sin zoom ni
          // paneo residual de una vista o interacción previa.
          canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
          canvas.setZoom(1);
          canvas.calcOffset();
          // Eliminar cualquier fondo anterior antes de iniciar la carga. El
          // callback de Fabric garantiza que no quede un frame obsoleto.
          canvas.setBackgroundImage(null, () => canvas.requestRenderAll());
          if (!mockupUrl) {
            // Sin mockup: dejar el lienzo utilizable y mostrar su zona segura.
            drawSafeArea(canvas.getWidth(), canvas.getHeight(), getPercentPrintArea(view));
            resolve();
            return;
          }
          try {
            console.log('4. Intentando cargar imagen en Fabric.js:', mockupUrl);
            fabric.Image.fromURL(
              mockupUrl,
              (img) => {
                if (renderToken !== currentRenderToken) {
                  console.log('⛔ Petición obsoleta descartada:', mockupUrl);
                  resolve();
                  return;
                }
                // Fabric devuelve `null` ante un 404/CORS y algunas fuentes
                // pueden crear el objeto sin dimensiones. No redimensionar en
                // ninguno de esos casos evita dejar el canvas vacío o inválido.
                if (!img || !img.width || !img.height) {
                  console.error(`❌ Error al cargar la imagen del mockup en la ruta: ${mockupUrl}`);
                  drawSafeArea(canvas.getWidth(), canvas.getHeight(), getPercentPrintArea(view));
                  canvas.requestRenderAll();
                  resolve();
                  return;
                }
                console.log('5. Imagen cargada con éxito en Fabric.js. Renderizando canvas...', { mockupUrl });
                const rawWidth = img.width;
                const rawHeight = img.height;
                console.log('📸 MOCKUP CARGADO CON ÉXITO:', {
                  url: mockupUrl,
                  dimensiones: `${rawWidth}x${rawHeight}`,
                });
                // El canvas nunca adopta las dimensiones naturales del archivo:
                // Admin y cliente trabajan sobre el mismo plano 800×800. El
                // mockup se centra con `contain`, igual que la vista previa del
                // Admin, sin deformar imágenes rectangulares.
                const mockupScale = Math.min(ADMIN_BASE_SIZE / rawWidth, ADMIN_BASE_SIZE / rawHeight);
                console.log('📐 DIAGNÓSTICO DE ESCALADO MOCKUP:', {
                  url: mockupUrl,
                  dimensionesOriginales: `${rawWidth}x${rawHeight}`,
                  tamanoCanvas: `${ADMIN_BASE_SIZE}x${ADMIN_BASE_SIZE}`,
                  escalaCalculada: mockupScale,
                  anchoFinalEnCanvas: rawWidth * mockupScale,
                  altoFinalEnCanvas: rawHeight * mockupScale,
                });
                img.set({
                  lockMovementX: true,
                  lockMovementY: true,
                  lockScalingX: true,
                  lockScalingY: true,
                  lockRotation: true,
                });
                fitMockupToCanvas(img);
                canvas.setBackgroundImage(img, () => {
                  if (renderToken !== currentRenderToken) {
                    console.log('⛔ Petición obsoleta descartada:', mockupUrl);
                    resolve();
                    return;
                  }
                  console.log('✅ BackgroundImage aplicado correctamente al Canvas');
                  // La guía y los recortes usan la matriz final del fondo.
                  setupSafeAreaAndClipping(view);
                  canvas.renderAll();
                  canvas.requestRenderAll();
                  resolve();
                });
              },
              { crossOrigin: 'anonymous' },
            );
          } catch (err) {
            // Error síncrono inesperado: conservar el editor interactivo y
            // mostrar una guía, en vez de abortar el cambio de vista.
            console.error(`❌ Error al iniciar la carga del mockup: ${mockupUrl}`, err);
            drawSafeArea(canvas.getWidth(), canvas.getHeight(), getPercentPrintArea(view));
            canvas.requestRenderAll();
            resolve();
          }
        });
      };

      // Punto único para cargar una vista resuelta en Fabric. La URL nunca se
      // vuelve a deducir desde color/base después de que el resolver decide.
      const loadResolvedViewBackground = async (
        view: ProductView,
        resolvedView: { mockupUrl: string; printArea: PrintArea; name?: string },
      ) => {
        const resolvedCanvasView: ProductView = {
          ...view,
          mockupUrl: resolvedView.mockupUrl,
          printArea: resolvedView.printArea,
          printAreaUnit: 'percent',
        };
        activeProduct = {
          ...activeProduct,
          views: activeProduct.views.map((item) => item.id === resolvedCanvasView.id ? resolvedCanvasView : item),
        };
        activeView = resolvedCanvasView;
        console.log('🎨 [VISTA RESUELTA -> FABRIC]:', {
          viewId: resolvedCanvasView.id,
          mockupUrl: resolvedView.mockupUrl,
          printArea: resolvedView.printArea,
        });
        await loadProductMockup(resolvedCanvasView, resolvedView.mockupUrl);
        setupSafeAreaAndClipping(resolvedCanvasView);
        const c = fabricCanvasRef.current;
        if (c) {
          c.getObjects().forEach((object: any) => {
            if (!object.isGuide && !object.isDesignBackground) {
              clampToPrintArea(object);
            }
          });
          c.requestRenderAll();
        }
      };

      /**
       * Sustituye exclusivamente el fondo del mockup. El lienzo y sus objetos
       * no se limpian ni se reescalan, por lo que el diseño del cliente se
       * conserva exactamente en la misma posición al cambiar de color.
       */
      // Manejador de variantes: reemplaza sólo el mockup de Fabric.
      const handleProductColorChange = (variant: ColorVariant) => {
        console.log('1. Color cliqueado:', variant);
        setSelectedColor(variant);
        const c = fabricCanvasRef.current;
        const mockupUrl = getColorMockupUrl(activeView, variant);
        const renderToken = ++currentRenderToken;
        console.log('2. URL de la imagen a cargar:', mockupUrl, { viewId: activeView.id });

        if (!mockupUrl) {
          console.error('❌ ERROR: color.mockupUrl está vacío o indefinido', { variant, viewId: activeView.id });
          return;
        }
        if (!c) {
          console.error('❌ ERROR: el canvas de Fabric no está disponible');
          return;
        }

        console.log('3. Reemplazando el fondo de Fabric con:', mockupUrl);
        console.log('4. Intentando cargar imagen en Fabric.js:', mockupUrl);

        fabric.Image.fromURL(
          mockupUrl,
          (img: any) => {
            if (renderToken !== currentRenderToken) {
              console.log('⛔ Petición obsoleta descartada:', mockupUrl);
              return;
            }
            if (!img || !img.width || !img.height) {
              console.error('❌ ERROR: Fabric no pudo cargar el mockup de color', { mockupUrl, img });
              return;
            }
            console.log('5. Imagen cargada con éxito en Fabric.js. Renderizando canvas...', { mockupUrl });

            // El área de impresión usa las dimensiones actuales del canvas.
            // Ajustar el fondo a ese mismo plano evita mover el arte existente
            // incluso si el archivo del mockup tiene otra resolución.
            fitMockupToCanvas(img);

            c.setBackgroundImage(img, () => {
              if (renderToken !== currentRenderToken) {
                console.log('⛔ Petición obsoleta descartada:', mockupUrl);
                return;
              }
              applyPrintAreaClipping(activeView);
              c.renderAll();
              c.requestRenderAll();
              // El color es una opción del producto, no de una sola cara:
              // conservarlo hace que Frente/Espalda carguen su mockup
              // correspondiente al alternar de vista.
              const nextSelectedColors = activeProduct.views.reduce<Record<string, string>>(
                (colors, view) => ({ ...colors, [view.id]: variant.id }),
                { ...selectedColorIdsRef.current },
              );
              selectedColorIdsRef.current = nextSelectedColors;
              setSelectedColorIds(nextSelectedColors);
              console.log('✅ Mockup de color actualizado correctamente', { mockupUrl, viewId: activeView.id });
            });
          },
          { crossOrigin: 'anonymous' },
        );
      };

      // Sincroniza un único estado de variante con las vistas que ve React y
      // con la vista que utiliza Fabric. Así las miniaturas nunca quedan con
      // el mockup anterior al cambiar una opción.
      const syncEditorWithVariant = (selections: Record<string, ProductOptionValue>, preferredValue?: ProductOptionValue) => {
        console.log('🔁 [SYNC VARIANTE] Inicio:', {
          activeViewId: currentViewIdRef.current,
          selectedOptionIds: Object.fromEntries(Object.entries(selections).map(([optionId, value]) => [optionId, value.id])),
          preferredValue: preferredValue?.label,
        });
        activeOptionSelections = selections;
        const currentViewIndex = Math.max(0, baseProductViews.findIndex((view) => view.id === currentViewIdRef.current));
        const selectedValues = Object.values(selections);
        const optionWithViews = selectedValues.find((value) => value?.views && Array.isArray(value.views) && value.views.length > 0);
        const resolvedCurrentView = resolveCurrentViewData(baseProductViews, currentViewIndex, selections);

        // La misma regla resolutora alimenta la lista completa de vistas. Se
        // reconstruye desde base en cada cambio, evitando arrastrar URLs de
        // una variante anterior a Frente/Espalda.
        const nextViews = baseProductViews.map((baseView, index) => {
          const resolvedView = resolveCurrentViewData(baseProductViews, index, selections);
          const dynamicView = optionWithViews?.views?.find(
            (view) => view.viewId === baseView.id || view.name === baseView.name,
          ) || optionWithViews?.views?.[index];
          return {
            ...baseView,
            ...resolvedView,
            // Sólo una zona específica de la variante está en porcentajes;
            // si falta, se conserva la unidad de la vista base de esta cara.
            printAreaUnit: dynamicView?.printArea ? 'percent' as const : baseView.printAreaUnit,
          };
        });

        activeProduct = { ...activeProduct, views: nextViews };
        activeView = getView(currentViewIdRef.current);
        if (activeView.id !== currentViewIdRef.current) {
          currentViewIdRef.current = activeView.id;
          setCurrentViewId(activeView.id);
        }
        // Una variante con `views` ya incluye su propia zona por cara; para
        // una variante global se usa su printArea opcional.
        activeOptionPrintArea = null;
        setProductViews(nextViews);
        console.log('✅ [SYNC VARIANTE] Vistas activas actualizadas:', nextViews.map((view) => ({
          id: view.id,
          mockupUrl: view.mockupUrl,
          printArea: view.printArea,
        })));
        return { mockupUrl: resolvedCurrentView.mockupUrl, printArea: resolvedCurrentView.printArea };
      };

      // Las opciones pueden ofrecer mockup y zona segura propios. Si el valor
      // no define `printArea`, se restaura de forma explícita la zona base.
      handleOptionMockup = (event: Event) => {
        const detail = (event as CustomEvent<{ optionId?: string; optionValue?: ProductOptionValue; selections?: Record<string, ProductOptionValue> }>).detail;
        const optionValue = detail?.optionValue;
        const c = fabricCanvasRef.current;
        if (!c) return;
        if (!optionValue) {
          const currentViewIndex = Math.max(0, baseProductViews.findIndex((view) => view.id === currentViewIdRef.current));
          const baseView = baseProductViews[currentViewIndex] || baseProductViews[0];
          const baseResolvedView = resolveCurrentViewData(baseProductViews, currentViewIndex, {});
          console.log('🔄 Estado vacío detectado. Restaurando vista base en Fabric.js...', {
            currentViewIndex,
            baseView,
            baseResolvedView,
          });
          activeOptionSelections = {};
          activeOptionPrintArea = null;
          syncEditorWithVariant({});
          void loadResolvedViewBackground(baseView, baseResolvedView);
          return;
        }
        const selectedOptionId = detail.optionId ?? optionValue.id;
        const { [selectedOptionId]: _previousValue, ...otherSelections } = activeOptionSelections;
        const selections = detail.selections ?? { ...otherSelections, [selectedOptionId]: optionValue };
        const synced = syncEditorWithVariant(selections, optionValue);
        if (!synced) return;
        const mockupUrl = synced.mockupUrl;
        const renderToken = ++currentRenderToken;
        console.log('🎨 [APLICANDO AL CANVAS]:', {
          viewId: activeView.id,
          mockupUrl,
          printArea: synced.printArea,
        });
        console.log('🖼️ [CANVAS VARIANTE] Cargando fondo y zona segura:', {
          viewId: activeView.id,
          mockupUrl,
          printArea: getPercentPrintArea(activeView),
        });
        if (!mockupUrl) {
          setupSafeAreaAndClipping(activeView);
          c.getObjects().filter((object: any) => !object.isGuide && !object.isDesignBackground).forEach(clampToPrintArea);
          c.requestRenderAll();
          return;
        }
        fabric.Image.fromURL(mockupUrl, (img: any) => {
          if (renderToken !== currentRenderToken) {
            console.log('⛔ Petición obsoleta descartada:', mockupUrl);
            return;
          }
          if (!img?.width || !img?.height) return;
          fitMockupToCanvas(img);
          c.setBackgroundImage(img, () => {
            if (renderToken !== currentRenderToken) {
              console.log('⛔ Petición obsoleta descartada:', mockupUrl);
              return;
            }
            setupSafeAreaAndClipping(activeView);
            c.getObjects().filter((object: any) => !object.isGuide && !object.isDesignBackground).forEach(clampToPrintArea);
            c.renderAll();
            c.requestRenderAll();
            console.log('✅ Canvas sincronizado correctamente');
          });
        }, { crossOrigin: 'anonymous' });
      };

      handleOptionsChanged = (event: Event) => {
        const detail = (event as CustomEvent<{ selections?: Record<string, ProductOptionValue> }>).detail;
        const nextSelections = detail?.selections ?? {};
        activeOptionSelections = nextSelections;

        if (Object.keys(nextSelections).length === 0) {
          const currentViewIndex = Math.max(0, baseProductViews.findIndex((view) => view.id === currentViewIdRef.current));
          const baseView = baseProductViews[currentViewIndex] || baseProductViews[0];
          const baseResolvedView = resolveCurrentViewData(baseProductViews, currentViewIndex, {});
          console.log('🔄 Estado vacío detectado. Restaurando vista base en Fabric.js...', {
            currentViewIndex,
            baseView,
            baseResolvedView,
          });
          activeOptionPrintArea = null;
          syncEditorWithVariant({});
          if (fabricCanvasRef.current && baseView) void loadResolvedViewBackground(baseView, baseResolvedView);
          return;
        }

        syncEditorWithVariant(nextSelections);
      };

      const drawSafeArea = (canvasWidth: number, canvasHeight: number, printArea: PrintArea) => {
        // Zona de diseño seguro (caja punteada verde). Invisible para el puntero del
        // mouse: selectable/evented = false y enviada al fondo (sendToBack) para que
        // nunca tape ni bloquee los textos/imágenes agregados por el usuario.
        const c = fabricCanvasRef.current;
        if (!c || !printArea) return;

        // Eliminar guías/zonas de diseño previas
        const oldGuides = c.getObjects().filter((obj: any) => obj.isGuideLine);
        oldGuides.forEach((g: any) => c.remove(g));

        // La traducción se hace sobre el plano lógico unificado, no sobre el
        // rectángulo visible del PNG contenido dentro de él.
        const safeZone = new fabric.Rect({
          left: (Number(printArea.x) / 100) * canvasWidth,
          top: (Number(printArea.y) / 100) * canvasHeight,
          width: (Number(printArea.width) / 100) * canvasWidth,
          height: (Number(printArea.height) / 100) * canvasHeight,
          fill: 'rgba(34, 197, 94, 0.05)',
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
        applyPrintAreaClipping(activeView);
        c.requestRenderAll();
      };

      // El fondo impreso es un objeto Fabric real: a diferencia de la guía,
      // permanece incluido al exportar y se puede guardar por cada vista.
      const setDesignBackground = (color: string, view = activeView) => {
        const c = fabricCanvasRef.current;
        if (!c || !view) return;
        const existing = c.getObjects().filter((obj: any) => obj.isDesignBackground);
        existing.forEach((obj: any) => c.remove(obj));

        const normalizedColor = !color || color === 'transparent' ? 'transparent' : color;
        designBackgroundColorsRef.current = {
          ...designBackgroundColorsRef.current,
          [view.id]: normalizedColor,
        };
        setDesignBackgroundColor(normalizedColor);

        if (normalizedColor === 'transparent') {
          c.requestRenderAll();
          return;
        }

        const area = getRenderedPrintArea(view);
        const background = new fabric.Rect({
          left: area.x,
          top: area.y,
          width: area.width,
          height: area.height,
          originX: 'left',
          originY: 'top',
          fill: normalizedColor,
          selectable: false,
          evented: false,
          excludeFromExport: false,
          isDesignBackground: true,
        } as any);
        c.add(background);
        if (safeZoneRef.current) c.sendToBack(safeZoneRef.current);
        c.sendToBack(background);
        // La guía debe seguir detrás del fondo, y el fondo detrás del arte.
        if (safeZoneRef.current) c.sendToBack(safeZoneRef.current);
        c.requestRenderAll();
      };

      const handleDesignBgColorChange = (color: string) => setDesignBackground(color);

      const setupSafeAreaAndClipping = (view: ProductView) => {
        activeView = view;
        drawSafeArea(canvas.getWidth(), canvas.getHeight(), getPercentPrintArea(view));
        setDesignBackground(designBackgroundColorsRef.current[view.id] ?? 'transparent', view);
        applyPrintAreaClipping(view);
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
        if (!c) return '[]';
        // `toJSON()` conserva todas las propiedades necesarias para volver a
        // enlivenar textos, imágenes y vectores de esta cara. Las guías no se
        // incluyen porque se marcan con `excludeFromExport`.
        const serializedCanvas = c.toJSON();
        return JSON.stringify((serializedCanvas.objects || []).filter((obj: any) => !obj.isDesignBackground));
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
        const productColors: ColorVariant[] = product.colors?.length
          ? product.colors
          : [{
              id: 'blanco',
              name: 'Blanco',
              hexColor: '#FFFFFF',
              mockupUrl: product.views[0]?.mockupUrl ?? '',
            }];
        // El catálogo declara las variantes a nivel de producto; se propagan
        // a cada vista que no tenga variantes específicas.
        activeProduct = {
          ...product,
          colors: productColors,
          views: product.views.map((view) => ({
            ...view,
            colorVariants: view.colorVariants?.length ? view.colorVariants : productColors,
          })),
        };
        baseProductViews = activeProduct.views.map((view) => ({ ...view }));
        activeOptionSelections = {};
        activeView = activeProduct.views[0];
        // La carga inicial muestra siempre la vista base, sin aplicar la
        // primera opción/variante automáticamente.
        activeOptionPrintArea = null;
        // Ajustar dimensiones del canvas de Fabric.js
        // El admin define printArea sobre este mismo sistema de coordenadas.
        canvas.setWidth(ADMIN_BASE_SIZE);
        canvas.setHeight(ADMIN_BASE_SIZE);
        canvas.calcOffset();

        canvasDataRef.current = {};
        designBackgroundColorsRef.current = {};
        setDesignBackgroundColor('transparent');
        const firstColor = activeView.colorVariants?.[0] ?? null;
        const initialColorIds = firstColor ? { [activeView.id]: firstColor.id } : {};
        selectedColorIdsRef.current = initialColorIds;
        setSelectedColorIds(initialColorIds);
        currentViewIdRef.current = activeView.id;
        setCurrentViewId(activeView.id);
        setProductViews(activeProduct.views);
        setSelectedColor(firstColor);

        // Limpiar el canvas reconstruyendo fondo + zona segura según la nueva vista
        isUpdatingHistory.current = true;
        canvas.clear();
        drawSafeArea(canvas.getWidth(), canvas.getHeight(), getPercentPrintArea(activeView));
        loadProductMockup(activeView);
        canvas.requestRenderAll();
        isUpdatingHistory.current = false;
        ensureObjectsInteractable();

        historyRef.current = [snapshotCurrentObjects()];
        redoStackRef.current = [];
        updateHistoryButtons();
      };

      setupProductRef.current = setupProduct;
      setupProduct(initialProduct);
      handleColorChangeRef.current = handleProductColorChange;
      handleDesignBgColorChangeRef.current = handleDesignBgColorChange;

      // --- Vistas de producto (frente, espalda, etc.) ---
      const finishViewSwitch = (viewId: string) => {
        const view = getView(viewId);
        activeView = view;

        currentViewIdRef.current = viewId;
        setCurrentViewId(viewId); // Actualizar el estado
        window.dispatchEvent(new CustomEvent('editor:view-changed', {
          detail: {
            viewId,
            viewIndex: Math.max(0, baseProductViews.findIndex((item) => item.id === viewId)),
          },
        }));
        setSelectedColor(
          view.colorVariants?.find((variant) => variant.id === selectedColorIdsRef.current[viewId])
            ?? view.colorVariants?.[0]
            ?? null,
        );
        setDesignBackgroundColor(designBackgroundColorsRef.current[viewId] ?? 'transparent');
        isUpdatingHistory.current = false;

        // Restablecer el historial de la nueva vista a una sola línea base
        historyRef.current = [snapshotCurrentObjects()];
        redoStackRef.current = [];
        updateHistoryButtons();
        canvas.requestRenderAll();
      };

      const switchView = async (viewId: string) => {
        const c = fabricCanvasRef.current;
        if (!c || viewId === currentViewIdRef.current) return;

        const requestedViewIndex = activeProduct.views.findIndex((view) => view.id === viewId);
        console.log('👁️ [CAMBIO DE VISTA]: Index pedido ->', requestedViewIndex);
        console.log('👁️ [VISTA APUNTADA]:', activeProduct.views[requestedViewIndex]);

        // Persistir los objetos de la cara actual antes de cambiar de mockup.
        canvasDataRef.current[currentViewIdRef.current] = snapshotCurrentObjects();
        isUpdatingHistory.current = true;
        const nextView = getView(viewId);
        activeView = nextView;
        currentViewIdRef.current = viewId;
        setCurrentViewId(viewId);
        const currentViewIndex = Math.max(0, baseProductViews.findIndex((view) => view.id === viewId));
        const syncedView = Object.keys(activeOptionSelections).length
          ? syncEditorWithVariant(activeOptionSelections)
          : null;
        const resolvedView = syncedView ?? resolveCurrentViewData(baseProductViews, currentViewIndex, activeOptionSelections);
        console.log('🎨 [CAMBIO DE VISTA -> FABRIC]:', {
          viewId,
          resolvedMockupUrl: resolvedView.mockupUrl,
          resolvedPrintArea: resolvedView.printArea,
        });

        await loadResolvedViewBackground(activeView, resolvedView);

        const stored = canvasDataRef.current[viewId];
        if (stored) {
          await new Promise<void>((resolve) => {
            // @ts-ignore Fabric.js types mismatch
            fabric.util.enlivenObjects(JSON.parse(stored), (enlivened: any[]) => {
              enlivened.forEach((obj: any) => c.add(makeObjectInteractive(obj)));
              resolve();
            });
          });
        }
        ensureObjectsInteractable();
        c.selection = true;
        c.calcOffset();
        if (safeZoneRef.current) c.sendToBack(safeZoneRef.current);
        c.requestRenderAll();
        finishViewSwitch(viewId);
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
        const viewIndex = Math.max(0, baseProductViews.findIndex((baseView) => baseView.id === view.id));
        const resolvedView = resolveCurrentViewData(baseProductViews, viewIndex, activeOptionSelections);
        await loadResolvedViewBackground(view, resolvedView);
        drawSafeArea(canvas.getWidth(), canvas.getHeight(), getPercentPrintArea(view));

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

      // Exporta sólo el arte del usuario, recortado al área imprimible de la
      // cara actual. El canvas vuelve exactamente a su estado visual previo
      // incluso si la generación del PNG falla.
      const exportToPrint = () => {
        const c = fabricCanvasRef.current;
        if (!c || !activeView) return;

        const printArea = getRenderedPrintArea(activeView);
        if (printArea.width <= 0 || printArea.height <= 0) return;

        const guides = c.getObjects().filter((object: any) => object.isGuideLine);
        const guideVisibility = guides.map((guide: any) => guide.visible);
        const originalBackground = c.backgroundImage;
        const originalBackgroundColor = c.backgroundColor;
        const originalClipPath = c.clipPath;

        try {
          // La guía, el mockup y el color de fondo son sólo ayudas visuales;
          // la imprenta recibe un PNG transparente con el diseño plano.
          guides.forEach((guide: any) => guide.set('visible', false));
          c.backgroundImage = null;
          c.backgroundColor = '';
          c.clipPath = undefined;
          c.getObjects().forEach((object: any) => object.setCoords());
          c.renderAll();

          const highResDataUrl = c.toDataURL({
            format: 'png',
            left: printArea.x,
            top: printArea.y,
            width: printArea.width,
            height: printArea.height,
            multiplier: 3,
            quality: 1,
          });

          const link = document.createElement('a');
          link.download = `diseno-impresion-${activeView.id}.png`;
          link.href = highResDataUrl;
          link.click();
        } finally {
          c.backgroundImage = originalBackground;
          c.backgroundColor = originalBackgroundColor;
          c.clipPath = originalClipPath;
          guides.forEach((guide: any, index: number) => guide.set('visible', guideVisibility[index]));
          c.renderAll();
          c.requestRenderAll();
        }
      };

      handleExportPrint = exportToPrint;

      const createPrintFile = (): string | null => {
        const c = fabricCanvasRef.current;
        if (!c || !activeView) return null;
        const printArea = getRenderedPrintArea(activeView);
        if (printArea.width <= 0 || printArea.height <= 0) return null;

        const guides = c.getObjects().filter((object: any) => object.isGuideLine);
        const guideVisibility = guides.map((guide: any) => guide.visible);
        const originalBackground = c.backgroundImage;
        const originalBackgroundColor = c.backgroundColor;
        const originalClipPath = c.clipPath;
        try {
          guides.forEach((guide: any) => guide.set('visible', false));
          c.backgroundImage = null;
          c.backgroundColor = '';
          c.clipPath = undefined;
          c.renderAll();
          return c.toDataURL({
            format: 'png', left: printArea.x, top: printArea.y,
            width: printArea.width, height: printArea.height, multiplier: 3, quality: 1,
          });
        } finally {
          c.backgroundImage = originalBackground;
          c.backgroundColor = originalBackgroundColor;
          c.clipPath = originalClipPath;
          guides.forEach((guide: any, index: number) => guide.set('visible', guideVisibility[index]));
          c.renderAll();
        }
      };

      const getNormalizedPrintArea = (view: ProductView): PrintArea => getPercentPrintArea(view);

      handleSaveDesign = async () => {
        const errors: string[] = [];
        if (!activeProduct.id || !activeProduct.name) errors.push('El producto seleccionado no es válido.');
        if (!activeProduct.views.length) errors.push('El producto no tiene vistas configuradas.');

        // Guarda la cara actualmente visible antes de recorrer las demás.
        canvasDataRef.current[currentViewIdRef.current] = snapshotCurrentObjects();
        const hasDesign = Object.values(canvasDataRef.current).some((serialized) => {
          try { return Boolean(serialized && JSON.parse(serialized).length); } catch { return false; }
        });
        if (!hasDesign) errors.push('Agrega al menos un elemento al diseño antes de guardar.');
        if (errors.length) {
          window.dispatchEvent(new CustomEvent<SaveDesignResult>('editor:save-result', {
            detail: { valid: false, errors },
          }));
          return;
        }

        const originalViewId = currentViewIdRef.current;
        const views: SavedDesignPayload['views'] = [];
        try {
          for (const view of activeProduct.views) {
            await loadViewObjects(view);
            const canvasJson = canvasDataRef.current[view.id] || '[]';
            views.push({
              id: view.id,
              name: view.name || view.label || view.id,
              printArea: getNormalizedPrintArea(view),
              printAreaUnit: 'percent',
              canvasJson,
              printFile: createPrintFile() || '',
              preview: canvas.toDataURL({ format: 'png', multiplier: 1 }),
            });
          }
        } catch (error) {
          console.error('No se pudo preparar el diseño para guardar.', error);
          errors.push('No fue posible generar los archivos del diseño. Intenta de nuevo.');
        } finally {
          await loadViewObjects(getView(originalViewId));
          currentViewIdRef.current = originalViewId;
          setCurrentViewId(originalViewId);
          historyRef.current = [snapshotCurrentObjects()];
          redoStackRef.current = [];
          updateHistoryButtons();
        }

        if (errors.length || views.some((view) => !view.printFile)) {
          if (!errors.length) errors.push('Una o más vistas no pudieron generar su archivo de impresión.');
          window.dispatchEvent(new CustomEvent<SaveDesignResult>('editor:save-result', {
            detail: { valid: false, errors },
          }));
          return;
        }

        const payload: SavedDesignPayload = {
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
          product: {
            id: activeProduct.id, name: activeProduct.name, category: activeProduct.category,
            unitPrice: activeProduct.price, canvasWidth: activeProduct.canvasWidth,
            canvasHeight: activeProduct.canvasHeight, printWidthCm: activeProduct.printWidthCm,
            printHeightCm: activeProduct.printHeightCm,
          },
          quantity: 1,
          currency: 'USD',
          views,
        };
        // Punto de integración para API, carrito o base de datos.
        window.dispatchEvent(new CustomEvent<SavedDesignPayload>('editor:design-saved', { detail: payload }));
        window.dispatchEvent(new CustomEvent<SaveDesignResult>('editor:save-result', {
          detail: { valid: true, errors: [], payload },
        }));
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
        const { text, fontSize, fontWeight, fontFamily } = customEvent.detail || {};
        // Estas dimensiones son las coordenadas lógicas reales del mockup.
        // Fabric aplica el multiplicador HDPI solamente a su buffer interno.
        const rawWidth = canvas.getWidth();
        const rawHeight = canvas.getHeight();

        const newText = makeObjectInteractive(new fabric.IText(text || 'Texto', {
          left: rawWidth / 2,
          top: rawHeight / 3,
          originX: 'center',
          originY: 'center',
          fontSize: fontSize || 24,
          fontWeight: fontWeight || 'normal',
          fill: '#1e293b',
          fontFamily: fontFamily || 'Arial',
          editable: true,
          ...defaultObjectProps,
        }));

        fabricCanvasRef.current.add(newText);
        fabricCanvasRef.current.setActiveObject(newText);
        fabricCanvasRef.current.bringToFront(newText);
        fabricCanvasRef.current.requestRenderAll();
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
          const printArea = getRenderedPrintArea(activeView);
          const maxInitialSize = Math.min(300, printArea.width, printArea.height);
          // Una vez cargada en el HTML, crear el objeto de Fabric
          const fabricImage = makeObjectInteractive(new fabric.Image(imgElement, {
            // Insertar en el centro de la zona segura, que coincide con el
            // centro del canvas para áreas centradas y nunca cae fuera de ella.
            left: printArea.x + printArea.width / 2,
            top: printArea.y + printArea.height / 2,
            originX: 'center',
            originY: 'center',
            cornerStyle: 'circle',
            transparentCorners: false,
            ...defaultObjectProps,
          }));

          // Limitar proporcionalmente el tamaño inicial para que la imagen
          // quede dentro de la zona segura sin deformarse.
          const largestSide = Math.max(fabricImage.width || 0, fabricImage.height || 0);
          if (largestSide > maxInitialSize && maxInitialSize > 0) {
            fabricImage.scale(maxInitialSize / largestSide);
          }

          fabricCanvasRef.current.add(fabricImage);
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

      const startCroppingImage = (activeObject: any) => {
        const c = fabricCanvasRef.current;
        if (!c || !activeObject || activeObject.type !== 'image') return;

        // Sincronizar la matriz antes de leer posición/tamaño. Esto evita que
        // el overlay use coordenadas previas al último arrastre o escalado.
        activeObject.setCoords();

        // Todas las imágenes de usuario usan un origen superior izquierdo al
        // recortar. Se conserva exactamente su posición visual al convertir
        // el origen desde center (el valor usado al insertarlas).
        const center = activeObject.getCenterPoint();
        activeObject.set({ originX: 'left', originY: 'top' });
        activeObject.setPositionByOrigin(center, 'center', 'center');

        if (!activeObject.originalWidth) {
          activeObject.originalWidth = activeObject.width;
          activeObject.originalHeight = activeObject.height;
        }

        c.setActiveObject(activeObject);
        activeObject.setCoords();
        c.calcOffset();
        c.requestRenderAll();

        targetImageRef = activeObject;
        // El bounding rect usa la posición global ya transformada por Fabric;
        // es la referencia visual exacta para dibujar el control de recorte.
        const bound = activeObject.getBoundingRect(true, true);
        const cropOverlay = new fabric.Rect({
          // Rectángulo global: se superpone a los bordes visibles de la foto
          // incluso si acaba de ser escalada, volteada o reposicionada.
          left: bound.left,
          top: bound.top,
          width: bound.width,
          height: bound.height,
          originX: 'left',
          originY: 'top',
          fill: 'rgba(59, 130, 246, 0.15)',
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

        cropOverlay.setCoords();
        cropOverlayRef = cropOverlay;
        c.add(cropOverlay);
        c.setActiveObject(cropOverlay);
        c.requestRenderAll();
        window.dispatchEvent(new CustomEvent('editor:crop-mode-active'));
      };

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
        startCroppingImage(activeObject);
      };

      const applyImageCrop = (targetImg: any, cropRect: any) => {
        const c = fabricCanvasRef.current;
        if (!c || !targetImg || !cropRect) return;

        const scaleX = targetImg.scaleX || 1;
        const scaleY = targetImg.scaleY || 1;
        const cropRectLeft = cropRect.left || 0;
        const cropRectTop = cropRect.top || 0;
        const imageLeft = targetImg.left || 0;
        const imageTop = targetImg.top || 0;

        // Convertir las coordenadas visuales del control a píxeles de la
        // imagen fuente. `getScaledWidth` incluye cualquier ajuste aplicado
        // por el usuario a los tiradores del rectángulo azul.
        const relativeLeft = (cropRectLeft - imageLeft) / scaleX;
        const relativeTop = (cropRectTop - imageTop) / scaleY;
        const newCropX = Math.max(0, (targetImg.cropX || 0) + relativeLeft);
        const newCropY = Math.max(0, (targetImg.cropY || 0) + relativeTop);
        const newWidth = Math.max(1, cropRect.getScaledWidth() / scaleX);
        const newHeight = Math.max(1, cropRect.getScaledHeight() / scaleY);

        targetImg.set({
          cropX: newCropX,
          cropY: newCropY,
          width: newWidth,
          height: newHeight,
          left: cropRectLeft,
          top: cropRectTop,
        });
        targetImg.setCoords();
        c.remove(cropRect);
        cropOverlayRef = null;
        targetImageRef = null;
        c.setActiveObject(targetImg);
        c.requestRenderAll();
        saveState();
        window.dispatchEvent(new CustomEvent('editor:crop-mode-inactive'));
      };

      handleConfirmCrop = () => {
        applyImageCrop(targetImageRef, cropOverlayRef);
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
        img.setCoords();
        const bound = img.getBoundingRect(true, true);

        // Restablecer el recuadro de recorte a los límites completos de la imagen
        rect.set({
          left: bound.left,
          top: bound.top,
          width: bound.width,
          height: bound.height,
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
      window.addEventListener('editor:export-print', handleExportPrint);
      window.addEventListener('editor:align', handleAlign);
      window.addEventListener('editor:save-design', handleSaveDesign);
      window.addEventListener('editor:option-mockup', handleOptionMockup);
      window.addEventListener('editor:options-changed', handleOptionsChanged);

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
      if (handleExportPrint) {
        window.removeEventListener('editor:export-print', handleExportPrint);
      }
      if (handleAlign) {
        window.removeEventListener('editor:align', handleAlign);
      }
      if (handleSaveDesign) {
        window.removeEventListener('editor:save-design', handleSaveDesign);
      }
      if (handleOptionMockup) {
        window.removeEventListener('editor:option-mockup', handleOptionMockup);
      }
      if (handleOptionsChanged) {
        window.removeEventListener('editor:options-changed', handleOptionsChanged);
      }
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      setupProductRef.current = null;
    };
  }, []);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-auto bg-gray-50 p-4">
      <div
        className="pointer-events-auto relative flex max-h-[70vh] max-w-full shrink-0 select-none items-center justify-center overflow-hidden rounded-lg bg-white shadow-xl"
        style={{
          aspectRatio: '1 / 1',
          width: 'min(100%, 70vh)',
        }}
      >
        <canvas ref={canvasRef} className="block max-h-full max-w-full object-contain" style={{ width: '100%', height: '100%', pointerEvents: 'auto' }} />
      </div>
      {!isCropping ? (
        <div className="pointer-events-none absolute left-4 top-4 z-20 w-60 space-y-3 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur-md">
          {productViews.length > 1 && <div>
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-gray-400">Vistas</span>
            <div className="flex items-center gap-2">
            {productViews.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => switchViewRef.current?.(view.id)}
                aria-pressed={currentViewId === view.id}
                className={`pointer-events-auto flex-1 rounded-xl border p-1.5 text-center transition-all ${
                  currentViewId === view.id
                    ? 'border-blue-600 bg-blue-50/50 font-bold text-blue-600 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <img src={view.mockupUrl} alt="" className="mx-auto mb-0.5 h-8 w-8 object-contain" />
                <span className="block text-[10px] leading-none">{view.name || view.label || 'Vista'}</span>
              </button>
            ))}
            </div>
          </div>}
          {!isCropping && productViews.find((view) => view.id === currentViewId)?.colorVariants?.length ? (
            <div className="pointer-events-auto space-y-3">
              {productViews.length > 1 && <hr className="border-gray-100" />}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  1. Color del producto
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                {productViews
                  .find((view) => view.id === currentViewId)
                  ?.colorVariants?.map((variant) => {
                    const isSelected = selectedColor?.id === variant.id;
                    const isWhite = variant.hexColor.toLowerCase() === '#ffffff';
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => handleColorChangeRef.current?.(variant)}
                        className={`relative flex h-6 w-6 items-center justify-center rounded-full shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 ${
                          isSelected
                            ? 'scale-105 ring-2 ring-blue-600 ring-offset-1'
                            : 'opacity-80 hover:scale-105 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: variant.hexColor,
                          borderColor: isWhite ? '#cbd5e1' : 'transparent',
                        }}
                        title={variant.name}
                        aria-label={`Seleccionar color ${variant.name}`}
                        aria-pressed={isSelected}
                      >
                        {isSelected && (
                          <span className={`h-2.5 w-2.5 rounded-full ${isWhite ? 'bg-blue-600' : 'bg-white'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <hr className="border-gray-100" />
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  2. Fondo impreso
                </label>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleDesignBgColorChangeRef.current?.('transparent')}
                    className={`flex w-full items-center justify-center gap-1 rounded-lg border py-1 text-[11px] font-medium transition-all ${
                      designBackgroundColor === 'transparent' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    🚫 Transparente
                  </button>
                  <div className="grid grid-cols-5 gap-1.5">
                  {['#000000', '#FFFFFF', '#2d4a3e', '#1e3a8a', '#7c2d12', '#e11d48'].map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => handleDesignBgColorChangeRef.current?.(hex)}
                      className={`h-6 w-full rounded-md border shadow-sm transition-all ${
                        designBackgroundColor === hex ? 'scale-105 ring-2 ring-blue-600' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex, borderColor: hex === '#FFFFFF' ? '#cbd5e1' : 'transparent' }}
                      title={`Fondo ${hex}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={designBackgroundColor === 'transparent' ? '#ffffff' : designBackgroundColor}
                    onChange={(event) => handleDesignBgColorChangeRef.current?.(event.target.value)}
                    className="h-6 w-full cursor-pointer rounded-md border bg-transparent p-0"
                    title="Elegir color personalizado"
                  />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
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
