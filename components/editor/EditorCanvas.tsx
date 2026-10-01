'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, X, Trash2, Loader2 } from 'lucide-react';
import type { TextOptions } from '../../types/product';
import type { ColorVariant, Product, ProductOptionValue, ProductView } from '@/src/store/useProductStore';
import type { ExportedDesignFiles, SaveDesignResult, SavedDesignPayload } from '@/src/types/editorDesign';
import Product3DModal from '@/components/editor/Product3DModal';
import { saveTemplateToStorage, updateTemplateInStorage, listSavedTemplates, getCategoryIcon } from '@/src/utils/templateStorage';
import { clearDraft, getDraft, saveDraft, type DesignDraft } from '@/src/utils/designDraftStorage';
import { useCartStore } from '@/src/store/useCartStore';
import { loadGoogleFonts } from '@/lib/googleFonts';
import { libraryFontWeights } from '@/lib/googleFontLibrary';
import { TYPOGRAPHY_PRESETS, presetFontRequests } from '@/components/editor/typographyPresets';
import {
  decodeDesignBackground,
  designBackgroundToCss,
  encodeDesignBackground,
  gradientPresetToBackground,
  GRADIENT_BACKGROUND_PRESETS,
  GRADIENT_DIRECTIONS,
  makeLinearBackground,
  SOLID_BACKGROUND_SWATCHES,
  type DesignBackground,
} from '@/components/editor/designBackground';


type PrintArea = ProductView['printArea'];
const ADMIN_BASE_SIZE = 800;
type ThreeDViewPreview = { id: string; label: string; textureUrl: string };

const resolveImageUrl = (url: string) => {
  if (!url) return '';
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return '';
  if (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('/') || trimmedUrl.startsWith('data:')) {
    return trimmedUrl;
  }
  return `data:image/png;base64,${trimmedUrl}`;
};

const getInitialSelectedOptions = (_product: Product): Record<string, ProductOptionValue> => ({});

interface EditorCanvasProps {
  product: Product;
  workflowStep?: 'design' | 'options' | 'review';
}

export default function EditorCanvas({ product: initialProduct, workflowStep = 'design' }: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Contenedor del lienzo central: se usa para dimensionar el canvas y aplicar
  // "zoom to fit" de forma proporcional al área disponible del editor.
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<any>(null);
  const safeZoneRef = useRef<any>(null);
  // Vector gemelo de la guía punteada que recibe el color de la barra
  // "Fondo" (`set('fill', ...)`). Existe aparte de la guía porque ésta se
  // desvanece (opacity 0) al dejar de interactuar y el color debe verse.
  const safeAreaBackgroundRef = useRef<any>(null);
  const historyRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const isRedoingUndoRef = useRef(false);
  const isUpdatingHistory = useRef(false);
  const addonOrderRef = useRef<{ addons: Array<{ id: string; name: string; price: number; userText?: string }>; basePrice: number; totalPrice: number }>({ addons: [], basePrice: initialProduct.price, totalPrice: initialProduct.price });
  const [isCropping, setIsCropping] = useState(false);
  const [isImageSelected, setIsImageSelected] = useState(false);
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);
  const [threeDTextureUrl, setThreeDTextureUrl] = useState('');
  const [threeDViews, setThreeDViews] = useState<ThreeDViewPreview[]>([]);
  const [currentViewId, setCurrentViewId] = useState<string>(initialProduct.views[0]?.id ?? 'front');
  const [productViews, setProductViews] = useState<ProductView[]>(initialProduct.views);
  const activeView = productViews.find((view) => view.id === currentViewId) ?? productViews[0];
  const [selectedColor, setSelectedColor] = useState<ColorVariant | null>(
    initialProduct.views[0]?.colorVariants?.[0] ?? initialProduct.colors?.[0] ?? null,
  );
  const [selectedColorIds, setSelectedColorIds] = useState<Record<string, string>>({});
  const [designBackgroundColor, setDesignBackgroundColor] = useState<string>('transparent');
  // Estado del degradado personalizado del panel "Fondo impreso": dos colores
  // y una dirección (ángulo CSS). Se aplica como spec serializada a través de
  // handleDesignBgColorChangeRef, igual que los colores sólidos.
  const [customGradient, setCustomGradient] = useState({
    from: '#a5b4fc',
    to: '#f9a8d4',
    angle: 180,
  });
  // Valor decodificado del fondo activo: la UI lo usa para saber qué muestra
  // (sólido, preset o degradado propio) debe mostrarse como seleccionada.
  const designBackgroundSpec = decodeDesignBackground(designBackgroundColor);
  // Hex actual del selector de color personalizado (caída segura a blanco
  // cuando el fondo activo es 'transparent' o un degradado).
  const activeSolidHex =
    designBackgroundSpec.kind === 'solid' && /^#[0-9a-f]{6}$/i.test(designBackgroundSpec.color)
      ? designBackgroundSpec.color
      : '#ffffff';
  const [selectedOptions, setSelectedOptions] = useState<Record<string, ProductOptionValue>>(
    () => getInitialSelectedOptions(initialProduct),
  );
  const [currentMockupUrl, setCurrentMockupUrl] = useState(initialProduct.views[0]?.mockupUrl ?? '');
  const [currentPrintArea, setCurrentPrintArea] = useState<PrintArea | null>(initialProduct.views[0]?.printArea ?? null);
  // Previsualización persistente por cara. No se deriva del estado de React del
  // lienzo: se captura directamente desde Fabric para reflejar texto, imágenes,
  // fondo y posición exactos de cada diseño.
  const [viewThumbnails, setViewThumbnails] = useState<Record<string, string>>({});
  const selectedColorIdsRef = useRef<Record<string, string>>({});
  const designBackgroundColorsRef = useRef<Record<string, string>>({});
  const currentViewIdRef = useRef<string>(initialProduct.views[0]?.id ?? 'front');
  const currentLoadRequestId = useRef(0);
  const canvasDataRef = useRef<Record<string, string | null>>({});
  const viewThumbnailsRef = useRef<Record<string, string>>({});
  const thumbnailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHydratingDraftRef = useRef(true);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isExporting, setIsExporting] = useState(false);
  const switchViewRef = useRef<(viewId: string) => void>(null);
  const handleColorChangeRef = useRef<((variant: ColorVariant) => void) | null>(null);
  const handleDesignBgColorChangeRef = useRef<((color: string) => void) | null>(null);
  const setupProductRef = useRef<((product: Product) => void) | null>(null);
  const refreshResolvedMockupRef = useRef<((viewId: string, options: Record<string, ProductOptionValue>, product: Product) => void) | null>(null);

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
    const initialSelections = getInitialSelectedOptions(initialProduct);
    setSelectedOptions(initialSelections);
  }, [initialProduct]);

  useEffect(() => {
    if (!initialProduct || !activeView || !currentViewId) return;
    refreshResolvedMockupRef.current?.(currentViewId, selectedOptions, initialProduct);
  }, [selectedOptions, currentViewId, activeView, initialProduct]);

  useEffect(() => {
    if (!canvasRef.current) return;

    let isMounted = true;
    // Referencia al "zoom to fit" definido dentro de la carga asíncrona de
    // Fabric, para poder reaplicarlo desde el listener de resize y limpiarlo.
    let fitOnResize: (() => void) | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleFit = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => fitOnResize?.(), 120);
    };
    const handleWindowResize = () => scheduleFit();
    // Observer sobre el propio contenedor: al habilitarse/deshabilitarse la
    // franja de herramientas (TextToolbar) o al plegar el sidebar cambia la
    // altura disponible SIN que ocurra un resize de ventana. Sin esto el canvas
    // conserva el fit antiguo y el mockup desborda/queda cortado hacia abajo.
    let containerObserver: ResizeObserver | null = null;
    let handleAddText: (e: Event) => void,
      handleAddTextPreset: (e: Event) => void,
      handleApplyLibraryFont: (e: Event) => void,
      handleColorChange: (e: Event) => void,
      handleProductColor: (e: Event) => void,
      handleDesignBackground: (e: Event) => void,
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
      handleDesignRender: (e: Event) => Promise<void>,
      handleResetCrop: () => void,
      handleAlign: (e: Event) => void,
      handleZoom: (e: Event) => void,
      handleSaveDesign: () => Promise<SavedDesignPayload | null>,
      handleOptionMockup: (e: Event) => void,
      handleOptionsChanged: (e: Event) => void,
      handleAddonsChanged: (e: Event) => void,
      handleApplyTemplate: (e: Event) => void,
      handleExportTemplate: (e: Event) => void,
      handleClearDraft: () => void,
      handleAddToCart: (event: Event) => void;
            let handleReplaceText: ((e: Event) => void) | undefined = undefined;

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
        // El fondo GLOBAL del canvas es SIEMPRE transparente: el color que
        // elige el usuario en la barra "Fondo" se aplica únicamente al vector
        // de la Zona Segura (setDesignBackground). Así la imagen base del
        // producto (mockup) no se tapa jamás con un relleno cuadrado. El tono
        // neutro del área de trabajo lo aporta el contenedor (bg-slate-100/50).
        backgroundColor: 'transparent',
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
      // Los paneles auxiliares (por ejemplo Capas) se conectan a esta misma
      // instancia para poder escuchar los eventos nativos de Fabric.
      (window as any).__editorFabricCanvas = canvas;
      window.dispatchEvent(new CustomEvent('editor:canvas-ready', { detail: { canvas } }));

      // ===== ZOOM TO FIT =====================================================
      // Escala el lienzo para que el teléfono/mockup completo (de arriba a
      // abajo) sea siempre visible en el contenedor sin importar la resolución.
      // Se conserva el plano lógico fijo (ADMIN_BASE_SIZE) para no romper las
      // coordenadas de la zona segura, el clipPath ni la exportación: el zoom
      // escala TODO de forma proporcional y uniforme.
      let fitZoom = 1;
      let relativeZoom = 1;
      const emitZoomChanged = () => {
        window.dispatchEvent(
          new CustomEvent('editor:zoom-changed', { detail: { percentage: Math.round(relativeZoom * 100) } }),
        );
      };
      const fitCanvasToContainer = () => {
        const canvasInstance = fabricCanvasRef.current;
        const containerEl = canvasAreaRef.current;
        if (!canvasInstance || !containerEl) return;

        const containerWidth = containerEl.clientWidth;
        const containerHeight = containerEl.clientHeight;
        if (!containerWidth || !containerHeight) return;

        // `clientWidth/Height` incluyen el padding del contenedor (p-6): hay
        // que descontarlo, o el mockup se dimensiona para un área mayor que la
        // realmente disponible y desborda/queda cortado en pantallas bajas.
        const containerStyle = window.getComputedStyle(containerEl);
        const verticalPadding = (parseFloat(containerStyle.paddingTop) || 0) + (parseFloat(containerStyle.paddingBottom) || 0);
        const horizontalPadding = (parseFloat(containerStyle.paddingLeft) || 0) + (parseFloat(containerStyle.paddingRight) || 0);
        // La barra flotante de herramientas (FloatingFooter, 'absolute
        // bottom-2') se superpone al pie del área: se reserva su banda para
        // que nunca tape el mockup. En pantallas estrechas la barra envuelve a
        // dos filas, así que la reserva es mayor.
        const footerReserve = containerWidth < 640 ? 104 : 72;
        const availableHeight = Math.max(180, containerHeight - verticalPadding - footerReserve);
        const availableWidth = Math.max(180, containerWidth - horizontalPadding);

        // Dimensiones nativas de la plantilla de la funda (aspecto 3:4 vertical).
        const originalWidth = 600;
        const originalHeight = 800;

        // La funda (mockup) debe ocupar como máximo el 95% del ALTO útil
        // restante (ya descontadas padding y banda de la barra inferior). El
        // ancho se acota para que el plano lógico 800×800 nunca desborde.
        const scale = Math.min(
          (availableHeight * 0.95) / originalHeight,
          availableWidth / ADMIN_BASE_SIZE,
        );

        // El plano lógico sigue siendo 800×800 (con el mockup 600×800 centrado
        // dentro), pero el BUFFER del canvas se dimensiona al plano escalado:
        // así el elemento respeta la proporción, el mockup llena el alto al 92%
        // y no hay estiramiento ni recorte por CSS.
        canvasInstance.setDimensions({
          width: ADMIN_BASE_SIZE * scale,
          height: ADMIN_BASE_SIZE * scale,
        });

        // El centrado flex del contenedor (items-center) reparte el aire libre
        // por igual arriba y abajo. Al añadir como margen inferior la banda
        // reservada a la barra flotante, el centro efectivo pasa a ser el del
        // área útil POR ENCIMA de la barra: el mockup sube, queda completo y
        // alineado desde arriba en lugar de desplazado hacia el pie. El margen
        // se aplica al wrapper que Fabric inserta en el flujo (canvas-container),
        // no al <canvas> interno (posicionado absolutamente dentro del wrapper).
        const wrapperEl = (canvasInstance as any).wrapperEl as HTMLElement | undefined;
        if (wrapperEl) wrapperEl.style.marginBottom = `${footerReserve}px`;

        fitZoom = scale;
        relativeZoom = 1;
        canvasInstance.setZoom(fitZoom);
        canvasInstance.calcOffset();
        canvasInstance.requestRenderAll();
        emitZoomChanged();
      };

      // Ajuste inicial una vez montado el contenedor.
      fitCanvasToContainer();
      fitOnResize = fitCanvasToContainer;

      // Reajuste cuando cambia el tamaño del propio contenedor (por ejemplo,
      // al habilitarse la franja de herramientas o plegar el sidebar), aunque
      // la ventana no se redimensione.
      if (typeof ResizeObserver !== 'undefined' && canvasAreaRef.current) {
        containerObserver = new ResizeObserver(() => scheduleFit());
        containerObserver.observe(canvasAreaRef.current);
      }

      handleZoom = (e: Event) => {
        const detail = (e as CustomEvent<{ delta?: number; zoom?: number }>).detail;
        const nextZoom = typeof detail?.zoom === 'number'
          ? detail.zoom
          : relativeZoom + (detail?.delta ?? 0);
        relativeZoom = Math.min(2, Math.max(0.5, nextZoom));
        // `setZoom` escala desde el origen del viewport (esquina
        // superior-izquierda): al acercar, el zoom "enfoca" solo esa esquina y
        // recorta los lados derecho e inferior de la imagen. `zoomToPoint`
        // ancla el punto indicado: pasándole el centro visible del lienzo el
        // acercamiento/alejamiento crece o encoge alrededor de toda la imagen,
        // repartiendo el recorte por igual en los cuatro lados.
        const zoomCenter = new (fabric as any).Point(
          canvas.getWidth() / 2,
          canvas.getHeight() / 2,
        );
        canvas.zoomToPoint(zoomCenter, fitZoom * relativeZoom);
        canvas.calcOffset();
        canvas.requestRenderAll();
        emitZoomChanged();
      };

      // Reajuste automático al redimensionar la ventana (debounced).
      window.addEventListener('resize', handleWindowResize);

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
          .filter((obj: any) => !obj.isGuide && !obj.isMockup && !obj.isCropOverlay && !obj.isDesignBackground);
        const jsonState = userObjects.map((obj: any) => obj.toJSON());
        historyRef.current.push(JSON.stringify(jsonState));
        redoStackRef.current = [];
        updateHistoryButtons();
      };

            
      // ── Panel de edición rápida (Smart Inputs) ────────────────────────────
      // Cada objeto de texto recibe un ID de sesión (__sid). La barra lateral
      // escucha 'editor:smart-inputs' para renderizar un input por texto y
      // reemplazarlo sin tocar el lienzo vía 'editor:replace-text'.
      let sidCounter = 0;
      const resolveSid = (obj: any) => {
        if (!obj.__sid) {
          sidCounter += 1;
          obj.__sid = `el-${sidCounter}-${Date.now().toString(36)}`;
        }
        return obj.__sid as string;
      };
      // Lee o asigna un nombre descriptivo ("layerName") al objeto; si no existe
      // se genera uno genérico basado en el tipo ("Texto 1", "Texto 2"...).
      const resolveLabel = (obj: any, index: number): string => {
        if (obj.layerName) return obj.layerName;
        if (obj.label) return obj.label;
        return `Texto ${index}`;
      };

      const emitSmartInputs = () => {
        const c = fabricCanvasRef.current;
        if (!c) return;
        let textIndex = 0;
        const texts = c
          .getObjects()
          .filter((obj: any) => !obj.isMockup && !obj.isGuide && !obj.isGuideLine && !obj.isDesignBackground)
          .filter((obj: any) => typeof obj.text === 'string')
          .map((obj: any) => {
            const sid = resolveSid(obj);
            textIndex += 1;
            // Se recuerda el último contenido no vacío: sirve de respaldo para
            // que un texto que queda vacío pueda restaurarse (ver más abajo).
            if (obj.text) obj.__lastText = obj.text;
            return {
              id: sid,
              text: obj.text ?? '',
              label: resolveLabel(obj, textIndex),
            };
          });
        window.dispatchEvent(
          new CustomEvent('editor:smart-inputs', { detail: { texts } }),
        );
      };

      // Red de seguridad: un texto no debe quedar vacío al salir de edición,
      // porque pierde su caja y el usuario ya no puede volver a seleccionarlo
      // (el "párrafo" desaparecería del diseño). Se restaura su último
      // contenido no vacío.
      const preserveEmptyText = (e: any) => {
        const target = e?.target;
        if (!target || typeof target.text !== 'string') return;
        if (target.text === '') {
          const fallback = target.__lastText || 'Tu Texto';
          target.set({ text: fallback });
          target.setCoords();
          fabricCanvasRef.current?.requestRenderAll();
          emitSmartInputs();
        } else {
          target.__lastText = target.text;
        }
      };

      const handleReplaceText = (e: Event) => {
        const c = fabricCanvasRef.current;
        const detail = (e as CustomEvent<{ id?: string; text?: string }>).detail;
        if (!c || !detail?.id || typeof detail.text !== 'string') return;
        // Limpiar el campo de la edición rápida NUNCA vacía el lienzo: si el
        // usuario borra todo el contenido del input se conserva el texto
        // original, de modo que el objeto (y su "función" de párrafo) sigue
        // visible y editable en la zona segura.
        if (!detail.text.trim()) return;
        const target = c.getObjects().find((obj: any) => obj.__sid === detail.id);
        if (!target || typeof (target as any).text !== 'string') return;
        if ((target as any).text === detail.text) return;
        (target as any).set({ text: detail.text });
        (target as any).setCoords();
        c.requestRenderAll();
        saveState();
        emitSmartInputs();
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
      // Límites reales del mockup después de aplicar `contain`. La zona segura
      // es porcentual respecto a la imagen, no a las franjas del canvas.
      let activeMockupBounds = { left: 0, top: 0, width: ADMIN_BASE_SIZE, height: ADMIN_BASE_SIZE };

      // Dimensiones LÓGICAS del plano de trabajo (800×800). Con el "zoom to
      // fit" activo, canvas.getWidth() devuelve píxeles de pantalla
      // (800·fitZoom); las coordenadas de los objetos, en cambio, viven en el
      // plano lógico ancho = width/zoom. Todo lo que coloque mockups, guías o
      // recortes debe usar estas medidas y nunca las del buffer.
      const logicalCanvasSize = () => {
        const zoom = canvas.getZoom?.() || 1;
        return {
          width: canvas.getWidth() / zoom,
          height: canvas.getHeight() / zoom,
        };
      };

      // Fabric 5 (`StaticCanvas.toCanvasElement`) interpreta left/top/width/
      // height del recorte en píxeles de PANTALLA ya aplicados el zoom y la
      // traslación del viewport: out = multiplier·(zoom·p + vp[4] − left).
      // Las áreas imprimibles se calculan en el plano lógico, así que hay que
      // convertirlas; sin esto el PNG exportado sale desplazado y escalado
      // 1/zoom (diseño "no coincide" en Revisar e imprenta). `pxPerLogical`
      // fija la resolución de salida independientemente del fitZoom.
      const buildCropExportOptions = (
        c: any,
        area: PrintArea,
        pxPerLogical: number,
      ) => {
        const zoom = c.getZoom?.() || 1;
        const vpt: number[] = c.viewportTransform || [1, 0, 0, 1, 0, 0];
        return {
          format: 'png' as const,
          quality: 1,
          left: area.x * zoom + vpt[4],
          top: area.y * zoom + vpt[5],
          width: area.width * zoom,
          height: area.height * zoom,
          multiplier: Math.max(0.5, Math.min(6, pxPerLogical / zoom)),
        };
      };

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

        // Una opción sólo sustituye la vista activa cuando declara una imagen
        // específica para esa vista. Su mockup global nunca cruza de una cara
        // a otra: si falta la configuración, se conserva la vista base.
        for (const value of [...selectedValues].reverse()) {
          const viewsConfig = value.viewsConfig ?? {};
          const normalizedViewName = baseView.name.trim().toLowerCase();
          const configKey = Object.keys(viewsConfig).find((key) =>
            key === baseView.id
            || key.trim().toLowerCase() === baseView.id.trim().toLowerCase()
            || key.trim().toLowerCase() === normalizedViewName,
          );
          const keyedView = configKey ? viewsConfig[configKey] : undefined;
          if (keyedView?.mockupUrl?.trim()) {
            return logResolvedView({
              mockupUrl: keyedView.mockupUrl,
              printArea: keyedView.printArea || baseView.printArea,
              name: baseView.name,
            });
          }
          if (keyedView?.printArea) {
            return logResolvedView({
              mockupUrl: baseView.mockupUrl,
              printArea: keyedView.printArea,
              name: baseView.name,
            });
          }

          const perViewMockup = value.mockupUrls?.[baseView.id]?.trim();
          if (perViewMockup) {
            return logResolvedView({
              mockupUrl: perViewMockup,
              printArea: value.printArea || baseView.printArea,
              name: baseView.name,
            });
          }

          if (value.views && Array.isArray(value.views) && value.views.length > 0) {
            const matchedView = value.views.find(
              (view) => view.viewId === baseView.id,
            ) || value.views.find(
              (view) => view.name.trim().toLowerCase() === baseView.name.trim().toLowerCase(),
            );
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
        const selectedVariant = baseView.colorVariants?.find(
          (variant) => variant.id === selectedColorIdsRef.current[baseView.id],
        );
        const selectedColorMockup = selectedVariant?.mockupUrls?.[baseView.id]
          || selectedVariant?.mockupUrl;
        return logResolvedView({
          mockupUrl: selectedColorMockup || baseView.mockupUrl || (baseView as any).url,
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
          shape: view.printArea.shape,
          radius: view.printArea.radius,
          polygon: view.printArea.polygon,
        };
      };

      const getPercentPrintArea = (view: ProductView): PrintArea => activeOptionPrintArea ?? getBasePercentPrintArea(view);

      const getRenderedPrintArea = (view: ProductView): PrintArea => {
        const area = getPercentPrintArea(view);
        // Recalcular con los límites del mockup evita desfasar la guía cuando
        // una variante rectangular deja márgenes dentro del canvas cuadrado.
        return {
          x: activeMockupBounds.left + (area.x / 100) * activeMockupBounds.width,
          y: activeMockupBounds.top + (area.y / 100) * activeMockupBounds.height,
          width: (area.width / 100) * activeMockupBounds.width,
          height: (area.height / 100) * activeMockupBounds.height,
          // La forma (rect/rounded/ellipse y su polígono libre) es relativa a
          // la caja, así que se hereda tal cual al traducirla al plano del lienzo.
          shape: area.shape,
          radius: area.radius,
          // El polígono se viaja preconvertido: sus nodos, que se persisten en
          // % de la imagen base, pasan a px del plano del lienzo con la MISMA
          // fórmula que la posición de la caja, para que guía y clipPath
          // calcen con el contorno moldeado en el Admin.
          polygon: area.polygon?.map((point) => ({
            x: activeMockupBounds.left + (Number(point.x) / 100) * activeMockupBounds.width,
            y: activeMockupBounds.top + (Number(point.y) / 100) * activeMockupBounds.height,
          })),
        };
      };

      /**
       * Crea la figura Fabric que representa la zona segura: polígono libre
       * (`fabric.Polygon`, la fuente de verdad cuando el admin moldeó nodos),
       * rectángulo clásico (comportamiento histórico cuando `shape` falta),
       * rectángulo con esquinas redondeadas (`rx`/`ry` en px derivados del
       * radio %) u óvalo (`fabric.Ellipse`). Se usa tanto para la guía punteada
       * como para el `clipPath` por objeto: al recortar con la curva, el diseño
       * se ve —y se exporta— con la forma real del producto.
       *
       * `options` permite mezclar los atributos de la guía (trazo verde) sin
       * duplicar la traducción de la caja al plano del lienzo.
       */
      const buildSafeAreaShape = (area: PrintArea, options: Record<string, any> = {}) => {
        const shared = {
          originX: 'left',
          originY: 'top',
          ...options,
        } as any;
        // Polígono de nodos libres: los % de cada nodo se traducen a px con la
        // misma caja ya convertida al plano del lienzo, así la guía y el
        // clipPath calcados sobre el contorno moldeado en el Admin.
        const polygon = Array.isArray(area.polygon) && area.polygon.length >= 3 ? area.polygon : null;
        if (polygon) {
          // `area.polygon` llega ya en px del plano del lienzo (ver
          // `getRenderedPrintArea` / `drawSafeArea`), igual que left/top.
          return new fabric.Polygon(polygon.map((point) => ({ x: Number(point.x), y: Number(point.y) })), shared);
        }
        const shape = area.shape === 'rounded' || area.shape === 'ellipse' ? area.shape : 'rect';
        if (shape === 'ellipse') {
          // En Fabric 5 `rx`/`ry` son los RADIOS de la elipse y el bounding box
          // sigue anclándose en left/top con origen left/top (igual que Rect).
          return new fabric.Ellipse({
            left: area.x,
            top: area.y,
            rx: Math.max(1, area.width / 2),
            ry: Math.max(1, area.height / 2),
            ...shared,
          } as any);
        }
        const radiusPercent = shape === 'rounded'
          ? Math.min(50, Math.max(0, Number(area.radius) || 0))
          : 0;
        return new fabric.Rect({
          left: area.x,
          top: area.y,
          width: area.width,
          height: area.height,
          // Misma semántica que `border-radius` en %: radioX respecto al ancho
          // y radioY respecto al alto de la propia caja.
          rx: radiusPercent > 0 ? (radiusPercent / 100) * area.width : 0,
          ry: radiusPercent > 0 ? (radiusPercent / 100) * area.height : 0,
          ...shared,
        } as any);
      };

      // Fabric aplica el clipPath por objeto. Así el mockup y la guía siguen
      // visibles completos, mientras que el diseño del usuario sólo aparece
      // dentro del área imprimible sobre el cuerpo del producto.
      const applyPrintAreaClip = (object: any, view = activeView) => {
        // El relleno de la zona segura YA tiene la forma exacta del área
        // imprimible: recortarlo con su propio clipPath es redundante.
        if (!object || object.isGuide || object.isMockup || object.isCropOverlay || object.isSafeAreaBackground) return;
        const area = getRenderedPrintArea(view);
        object.set({
          clipPath: buildSafeAreaShape(area, { absolutePositioned: true }),
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
        const naturalWidth = img?._element?.naturalWidth || img.width;
        const naturalHeight = img?._element?.naturalHeight || img.height;
        // Ajustar sobre el plano lógico (no sobre los píxeles del buffer):
        // con fitZoom activo, usar canvas.getWidth() dejaba el mockup más
        // pequeño que el área visible y desplazado hacia arriba-izquierda.
        const { width: canvasWidth, height: canvasHeight } = logicalCanvasSize();
        const scale = Math.min(canvasWidth / naturalWidth, canvasHeight / naturalHeight);
        const renderedWidth = naturalWidth * scale;
        const renderedHeight = naturalHeight * scale;
        activeMockupBounds = {
          left: (canvasWidth - renderedWidth) / 2,
          top: (canvasHeight - renderedHeight) / 2,
          width: renderedWidth,
          height: renderedHeight,
        };
        img.set({
          originX: 'center',
          originY: 'center',
          left: canvasWidth / 2,
          top: canvasHeight / 2,
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
          // El mockup se excluye del JSON exportado, del PNG de imprenta y de
          // la interactividad; es únicamente la base visual fija del escenario.
          excludeFromExport: true,
          isMockup: true,
          lockMovementX: true,
          lockMovementY: true,
          lockScalingX: true,
          lockScalingY: true,
          lockRotation: true,
          hasControls: false,
          hasBorders: false,
          // Sombra suave tipo "drop-shadow-2xl": da profundidad 3D al producto
          // sobre el fondo del Canvas (nivel Zazzle). `nonScaling` mantiene el
          // blur constante aunque el mockup escale con el zoom-to-fit.
          shadow: new fabric.Shadow({
            color: 'rgba(15, 23, 42, 0.30)',
            blur: 40,
            offsetX: 0,
            offsetY: 18,
            nonScaling: true,
          }),
        });
        console.log('📐 [MOCKUP AJUSTADO]', { naturalWidth, naturalHeight, scale, renderedBounds: activeMockupBounds });
      };

      const loadProductMockup = async (view: ProductView, mockupUrlOverride?: string) => {
        currentLoadRequestId.current += 1;
        const requestId = currentLoadRequestId.current;
        const selectedVariant = view.colorVariants?.find(
          (variant) => variant.id === selectedColorIdsRef.current[view.id],
        );
        const rawMockupUrl = mockupUrlOverride || getColorMockupUrl(view, selectedVariant);
        const mockupUrl = resolveImageUrl(rawMockupUrl ?? '');
        const renderToken = ++currentRenderToken;

        return new Promise<void>((resolve) => {
          const finishLoad = () => {
            if (requestId !== currentLoadRequestId.current) {
              resolve();
              return;
            }
            canvas.requestRenderAll();
            resolve();
          };

          const applyMockupImage = async (img: any) => {
            try {
              if (requestId !== currentLoadRequestId.current || renderToken !== currentRenderToken) {
                console.log('⛔ Petición obsoleta descartada:', mockupUrl);
                resolve();
                return;
              }

              if (!img || !img.width || !img.height) {
                console.error(`❌ Error al cargar la imagen del mockup en la ruta: ${mockupUrl}`);
                activeMockupBounds = { left: 0, top: 0, ...logicalCanvasSize() };
                drawSafeArea(canvas.getWidth(), canvas.getHeight(), getPercentPrintArea(view));
                return;
              }

              console.log('5. Imagen cargada con éxito en Fabric.js. Renderizando canvas...', { mockupUrl });
              const rawWidth = img.width;
              const rawHeight = img.height;
              console.log('📸 MOCKUP CARGADO CON ÉXITO:', {
                url: mockupUrl,
                dimensiones: `${rawWidth}x${rawHeight}`,
              });

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

              // El mockup se añade como objeto fijo al escenario (no como
              // backgroundImage). Así el "zoom to fit" escala proporcionalmente
              // el mockup, la guía de la zona segura y el clipPath por igual, y
              // la imagen del producto siempre queda superpuesta al cuerpo del
              // teléfono sin quedar descuadrada por el viewport.
              //
              // Se elimina el mockup previo (mismo flag) y se re-inserta al
              // fondo para que nunca tape el área imprimible ni los objetos.
              canvas.getObjects()
                .filter((obj: any) => obj?.isMockup)
                .forEach((obj: any) => canvas.remove(obj));

              canvas.add(img);
              img.sendToBack();
              // Flag propio para que guías/interactividad/exportación reconozcan
              // el mockup como base fija y no lo traten como objeto de usuario.
              // `isProductImage` es el alias canónico pedido para la exclusión
              // en el guardado de plantillas.
              (img as any).isMockup = true;
              (img as any).isProductImage = true;
              (img as any).excludeFromExport = true;

              console.log('✅ Mockup anclado como objeto base del escenario');
              setupSafeAreaAndClipping(view);
              canvas.renderAll();
              canvas.requestRenderAll();
            } catch (err) {
              console.error(`❌ Error al decodificar el mockup: ${mockupUrl}`, err);
              activeMockupBounds = { left: 0, top: 0, ...logicalCanvasSize() };
              drawSafeArea(canvas.getWidth(), canvas.getHeight(), getPercentPrintArea(view));
              canvas.requestRenderAll();
            } finally {
              finishLoad();
            }
          };

          canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
          // En vez de forzar zoom=1, re-aplicamos el "zoom to fit" para que el
          // mockup y la zona segura queden proporcionados al contenedor.
          fitCanvasToContainer();
          canvas.setBackgroundImage(null, () => canvas.requestRenderAll());

          if (!mockupUrl) {
            activeMockupBounds = { left: 0, top: 0, ...logicalCanvasSize() };
            drawSafeArea(canvas.getWidth(), canvas.getHeight(), getPercentPrintArea(view));
            finishLoad();
            return;
          }

          try {
            console.log('4. Intentando cargar imagen en Fabric.js:', mockupUrl);
            const imageResult = (fabric.Image.fromURL as any)(
              mockupUrl,
              (img: any) => {
                if (requestId !== currentLoadRequestId.current) {
                  resolve();
                  return;
                }
                void applyMockupImage(img);
              },
              { crossOrigin: 'anonymous' },
            );

            if (imageResult && typeof imageResult.then === 'function') {
              imageResult
                .then((img: any) => {
                  if (requestId !== currentLoadRequestId.current) {
                    resolve();
                    return;
                  }
                  void applyMockupImage(img);
                })
                .catch((err: unknown) => {
                  console.error(`❌ Error al cargar el mockup con Promise: ${mockupUrl}`, err);
                  activeMockupBounds = { left: 0, top: 0, ...logicalCanvasSize() };
                  drawSafeArea(canvas.getWidth(), canvas.getHeight(), getPercentPrintArea(view));
                  canvas.requestRenderAll();
                  finishLoad();
                });
            }
          } catch (err) {
            console.error(`❌ Error al iniciar la carga del mockup: ${mockupUrl}`, err);
            drawSafeArea(canvas.getWidth(), canvas.getHeight(), getPercentPrintArea(view));
            canvas.requestRenderAll();
            finishLoad();
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
        activeView = resolvedCanvasView;
        console.log('🎨 [VISTA RESUELTA -> FABRIC]:', {
          viewId: resolvedCanvasView.id,
          mockupUrl: resolvedView.mockupUrl,
          printArea: resolvedView.printArea,
        });
        await loadProductMockup(resolvedCanvasView, resolvedView.mockupUrl);
        setupSafeAreaAndClipping(resolvedCanvasView);
        // NO mover diseños al recargar el fondo: la zona segura de una
        // variante puede ser menor y el clamp destructivo desalinearía el
        // diseño al volver a "Estándar". El clipPath ya recorta lo visible.
        const c = fabricCanvasRef.current;
        if (c) {
          c.requestRenderAll();
        }
      };

      refreshResolvedMockupRef.current = (viewId, options, product) => {
        const view = product.views.find((item) => item.id === viewId) ?? activeProduct.views.find((item) => item.id === viewId);
        if (!view || !fabricCanvasRef.current) return;

        const viewIndex = Math.max(0, baseProductViews.findIndex((item) => item.id === view.id));
        const resolvedView = resolveCurrentViewData(baseProductViews, viewIndex, options);
        activeOptionSelections = options;
        activeView = {
          ...view,
          mockupUrl: resolvedView.mockupUrl,
          printArea: resolvedView.printArea,
          printAreaUnit: 'percent',
        };
        setCurrentMockupUrl(resolvedView.mockupUrl);
        setCurrentPrintArea(resolvedView.printArea);
        void loadResolvedViewBackground(activeView, resolvedView);
      };

      /**
       * Sustituye exclusivamente el fondo del mockup. El lienzo y sus objetos
       * no se limpian ni se reescalan, por lo que el diseño del cliente se
       * conserva exactamente en la misma posición al cambiar de color.
       */
      // Manejador de variantes: reemplaza sólo el mockup de Fabric.
      const handleProductColorChange = async (variant: ColorVariant) => {
        console.log('1. Color cliqueado:', variant);
        setSelectedColor(variant);
        const c = fabricCanvasRef.current;
        const nextSelectedColors = activeProduct.views.reduce<Record<string, string>>(
          (colors, view) => ({ ...colors, [view.id]: variant.id }),
          { ...selectedColorIdsRef.current },
        );
        selectedColorIdsRef.current = nextSelectedColors;
        setSelectedColorIds(nextSelectedColors);
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
        try {
          await loadProductMockup(activeView, mockupUrl);
          if (renderToken !== currentRenderToken) {
            console.log('⛔ Petición obsoleta descartada:', mockupUrl);
            return;
          }

          applyPrintAreaClipping(activeView);
          c.renderAll();
          c.requestRenderAll();

          console.log('✅ Mockup de color actualizado correctamente', { mockupUrl, viewId: activeView.id });
        } catch (err) {
          console.error('❌ Error al cambiar el mockup de color:', err);
        }
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
        const detail = (event as CustomEvent<{
          optionId?: string;
          optionValue?: ProductOptionValue;
          selections?: Record<string, ProductOptionValue>;
          mockupUrl?: string;
          printArea?: PrintArea;
          viewId?: string;
        }>).detail;
        const c = fabricCanvasRef.current;
        if (!c) return;

        const incomingSelections = detail?.selections ?? {};
        activeOptionSelections = incomingSelections;
        setSelectedOptions(incomingSelections);
        const incomingMockupUrl = resolveImageUrl(detail?.mockupUrl?.trim() ?? '');
        const incomingPrintArea = detail?.printArea ?? null;
        const incomingViewId = detail?.viewId ?? currentViewIdRef.current ?? activeView.id;

        if (detail?.optionId !== 'standard' && incomingMockupUrl) {
          const targetView = getView(incomingViewId) || activeView;
          const renderToken = ++currentRenderToken;
          activeOptionPrintArea = incomingPrintArea ?? null;
          activeView = targetView;
          currentViewIdRef.current = targetView.id;
          setCurrentViewId(targetView.id);

          void loadProductMockup(targetView, incomingMockupUrl).then(() => {
            if (renderToken !== currentRenderToken) {
              console.log('⛔ Petición obsoleta descartada:', incomingMockupUrl);
              return;
            }
            setupSafeAreaAndClipping(targetView);
            // NO re-clampar posiciones en bloque al cambiar de opción: eso
            // MOVERÍA permanentemente el diseño del usuario hacia la zona de
            // la opción y, al regresar a "Estándar", las piezas ya no
            // coincidirían con lo diseñado. El clipPath de
            // `setupSafeAreaAndClipping` ya oculta lo que queda fuera; el
            // clamp solo actúa al arrastrar/transformar (listeners de
            // object:moving/scaled/rotating), decisión del usuario.
            c.renderAll();
            c.requestRenderAll();
            console.log('✅ Canvas sincronizado correctamente con mockup resuelto:', incomingMockupUrl);
          });
          return;
        }

        const optionValue = detail?.optionValue;
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
          setSelectedOptions({});
          void loadResolvedViewBackground(baseView, baseResolvedView);
          return;
        }
        const selectedOptionId = detail.optionId ?? optionValue.id;
        const { [selectedOptionId]: _previousValue, ...otherSelections } = activeOptionSelections;
        const selections = detail.selections ?? { ...otherSelections, [selectedOptionId]: optionValue };
        setSelectedOptions(selections);
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
          activeOptionPrintArea = null;
          setupSafeAreaAndClipping(activeView);
          // Sin clamp masivo: ver comentario en la ruta del mockup de opción
          // (mover el diseño aquí lo desalinearía al volver a Estándar).
          c.requestRenderAll();
          return;
        }
        activeOptionPrintArea = synced.printArea ?? null;
        void loadProductMockup(activeView, mockupUrl).then(() => {
          if (renderToken !== currentRenderToken) {
            console.log('⛔ Petición obsoleta descartada:', mockupUrl);
            return;
          }
          setupSafeAreaAndClipping(activeView);
          // Sin clamp masivo (ver nota en handleOptionMockup): la zona de la
          // variante solo recorta visualmente, jamás mueve el diseño.
          c.renderAll();
          c.requestRenderAll();
          console.log('✅ Canvas sincronizado correctamente');
        });
      };

      handleOptionsChanged = (event: Event) => {
        const detail = (event as CustomEvent<{ selections?: Record<string, ProductOptionValue | string> }>).detail;
        const rawSelections = detail?.selections ?? {};
        // OptionsPanel heredado emite ids de texto y posteriormente emite el
        // evento completo `option-mockup`. No intentes resolver esos ids como
        // objetos de variante: espera el evento completo para no perder views.
        if (Object.values(rawSelections).some((value) => typeof value === 'string')) return;
        const nextSelections = rawSelections as Record<string, ProductOptionValue>;
        activeOptionSelections = nextSelections;
        setSelectedOptions(nextSelections);

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

        const currentViewIndex = Math.max(0, baseProductViews.findIndex((view) => view.id === currentViewIdRef.current));
        const synced = syncEditorWithVariant(nextSelections);
        const resolvedView = synced ?? resolveCurrentViewData(baseProductViews, currentViewIndex, nextSelections);
        // La actualización del estado y la imagen deben ser atómicas desde la
        // perspectiva del editor: Fabric recibe de inmediato el fondo que el
        // resolver acaba de escoger para la vista activa.
        if (fabricCanvasRef.current && activeView) {
          void loadResolvedViewBackground(activeView, resolvedView);
        }
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
        // Debe usar el mismo rectángulo que el clipPath y la alineación.
        // El mockup puede dejar márgenes dentro del canvas (por ejemplo, una
        // funda vertical), así que calcularlo sobre 800×800 desplazaba la guía.
        const renderedArea = {
          x: activeMockupBounds.left + (Number(printArea.x) / 100) * activeMockupBounds.width,
          y: activeMockupBounds.top + (Number(printArea.y) / 100) * activeMockupBounds.height,
          width: (Number(printArea.width) / 100) * activeMockupBounds.width,
          height: (Number(printArea.height) / 100) * activeMockupBounds.height,
          shape: printArea.shape,
          radius: printArea.radius,
          // Nodos en px del plano del lienzo (misma conversión que arriba),
          // para que la guía punteada siga exactamente el contorno libre.
          polygon: printArea.polygon?.map((point) => ({
            x: activeMockupBounds.left + (Number(point.x) / 100) * activeMockupBounds.width,
            y: activeMockupBounds.top + (Number(point.y) / 100) * activeMockupBounds.height,
          })),
        };
        (window as any).__editorPrintArea = {
          left: renderedArea.x,
          top: renderedArea.y,
          width: renderedArea.width,
          height: renderedArea.height,
        };
        window.dispatchEvent(new CustomEvent('editor:print-area-changed', {
          detail: (window as any).__editorPrintArea,
        }));
        // La guía se dibuja con la MISMA figura que el clipPath (rectángulo,
        // esquinas redondeadas u óvalo), para que lo que el cliente ve recortado
        // coincida exactamente con la línea punteada verde.
        const safeZone = buildSafeAreaShape(renderedArea as PrintArea, {
          fill: 'rgba(34, 197, 94, 0.05)',
          stroke: '#22c55e',
          strokeDashArray: [6, 6],
          strokeWidth: 2,
          // Oculta por defecto: la guía sólo aparece mientras el usuario
          // interactúa con el lienzo (ver flashGuides más abajo).
          opacity: 0,
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
        });

        // Marcar como guía para excluirla de saveState/ensureObjectsInteractable
        (safeZone as any).isGuideLine = true;
        (safeZone as any).isGuide = true;

        safeZoneRef.current = safeZone;
        c.add(safeZone);

        // ── Relleno impreso de la Zona Segura ───────────────────────────────
        // Clon del MISMO vector (Rect, Rect redondeado, Elipse o Polygon) que
        // sirve de guía, pero SIN trazo y siempre opaco: es el objeto que la
        // barra "Fondo" colorea con `set('fill', color)` (ver
        // setDesignBackground). Va separado de la guía punteada porque la
        // guía se desvanece a opacity 0 al dejar de interactuar, y el color
        // elegido debe permanecer visible. Lleva `isDesignBackground` para
        // quedar excluido del historial, borradores y plantillas, y a la vez
        // incluido en los archivos de impresión.
        c.getObjects()
          .filter((obj: any) => obj?.isSafeAreaBackground)
          .forEach((obj: any) => c.remove(obj));
        const safeAreaBackground = buildSafeAreaShape(renderedArea as PrintArea, {
          fill: 'transparent',
          // Oculto hasta que el usuario elija un color en la barra "Fondo".
          // El color del fondo del termo/gorra se aplica SOLO dentro de la
          // zona segura, nunca sobre el canvas completo.
          selectable: false,
          evented: false,
          lockMovementX: true,
          lockMovementY: true,
          lockScalingX: true,
          lockScalingY: true,
          lockRotation: true,
          hasControls: false,
          hasBorders: false,
          isSafeAreaBackground: true,
          isDesignBackground: true,
        });
        safeAreaBackgroundRef.current = safeAreaBackground;
        c.add(safeAreaBackground);

        // Orden de capas (de fondo a frente):
        //   mockup → relleno de zona segura → guía punteada → arte del usuario.
        // Cada sendToBack re-ubica el objeto al índice 0, así que llamándolos
        // en orden inverso queda la pila exacta de arriba. El relleno NUNCA
        // tapa textos, imágenes ni stickers del cliente.
        c.sendToBack(safeZone);
        c.sendToBack(safeAreaBackground);
        // El mockup base se mantiene SIEMPRE en el fondo, por debajo de la zona
        // segura, para que el rectángulo punteado verde marque la zona imprimible
        // sobre el teléfono (y no al revés). Esto aplica a todas las rutas.
        c.getObjects()
          .filter((obj: any) => obj?.isMockup)
          .forEach((obj: any) => c.sendToBack(obj));
        applyPrintAreaClipping(activeView);
        c.requestRenderAll();
      };

      // ── Guías visibles sólo durante la interacción ──────────────────────
      // La zona segura punteada se muestra cuando el usuario toca/mueve objetos
      // en el lienzo y se desvanece tras 1.5s sin actividad (vista limpia tipo
      // Zazzle cuando se observan las vistas previas finales).
      let guideHideTimer: ReturnType<typeof setTimeout> | null = null;
      const setGuidesOpacity = (opacity: number) => {
        const c = fabricCanvasRef.current;
        if (!c) return;
        c.getObjects()
          .filter((obj: any) => obj?.isGuideLine)
          .forEach((obj: any) => obj.set('opacity', opacity));
        c.requestRenderAll();
      };
      const flashGuides = () => {
        setGuidesOpacity(1);
        if (guideHideTimer) clearTimeout(guideHideTimer);
        guideHideTimer = setTimeout(() => setGuidesOpacity(0), 1500);
      };
      // Interacción: cualquier toque, arrastre, redimensionado o cambio de
      // selección vuelve a encender la guía.
      canvas.on('mouse:down', flashGuides);
      canvas.on('object:moving', flashGuides);
      canvas.on('object:scaling', flashGuides);
      canvas.on('object:rotating', flashGuides);
      canvas.on('object:modified', flashGuides);
      canvas.on('selection:created', flashGuides);
      canvas.on('selection:updated', flashGuides);
      canvas.on('selection:cleared', flashGuides);

      // El fondo impreso es un relleno que vive EXCLUSIVAMENTE en el vector de
      // la Zona Segura: a diferencia de la guía, permanece visible, viaja a la
      // exportación y se guarda por cada vista.
      //
      // Relleno sólido, transparente o degradado en coordenadas locales de la
      // figura de la zona segura (Rect, Rect redondeado, Elipse o Polygon).
      const buildFabricBackgroundFill = (
        background: DesignBackground,
        width: number,
        height: number,
      ): string | fabric.Gradient => {
        if (background.kind === 'solid') return background.color;
        if (background.kind === 'transparent') return 'transparent';
        const colorStops = background.stops.map((stop) => ({
          offset: Math.min(1, Math.max(0, Number(stop.offset) || 0)),
          color: stop.color,
        }));
        if (colorStops.length === 0) return '#ffffff';
        if (background.kind === 'radial') {
          return new fabric.Gradient({
            type: 'radial',
            coords: {
              x1: width / 2,
              y1: height * 0.4,
              r1: 0,
              x2: width / 2,
              y2: height * 0.4,
              r2: Math.hypot(width / 2, height * 0.6),
            },
            colorStops,
          } as any);
        }
        // Ángulo estilo CSS: 0deg sube, 90deg va a la derecha, 180deg baja.
        const angle = (background.angle * Math.PI) / 180;
        const dx = Math.sin(angle);
        const dy = -Math.cos(angle);
        const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
        return new fabric.Gradient({
          type: 'linear',
          coords: {
            x1: width / 2 - dx * half,
            y1: height / 2 - dy * half,
            x2: width / 2 + dx * half,
            y2: height / 2 + dy * half,
          },
          colorStops,
        } as any);
      };

      // El color elegido en la barra "Fondo" se aplica EXCLUSIVAMENTE al
      // vector de la Zona Segura (safeAreaBackgroundRef): el fondo global del
      // canvas NUNCA se pinta (permanece 'transparent'), de modo que la
      // imagen base del producto/termo no queda tapada por un cuadrado.
      const setDesignBackground = (rawValue: string, view = activeView) => {
        const c = fabricCanvasRef.current;
        if (!c || !view) return;

        // 1) FONDO GLOBAL DEL CANVAS: siempre transparente. Se refuerza en
        //    cada aplicación por si un borrador o versión previa lo dejó
        //    pintado (canvas.setBackgroundColor(null) equivalent).
        c.backgroundColor = 'transparent';

        // Acepta hex, 'transparent' o el JSON de un degradado (ver
        // designBackground.ts). El valor normalizado viaja al estado y al ref
        // de vistas para seguir sobreviviendo a cambios de cara/opción.
        const background = decodeDesignBackground(rawValue);
        const normalizedValue = encodeDesignBackground(background);
        designBackgroundColorsRef.current = {
          ...designBackgroundColorsRef.current,
          [view.id]: normalizedValue,
        };
        setDesignBackgroundColor(normalizedValue);

        // 2) APLICAR EL COLOR ÚNICAMENTE A LA ZONA SEGURA: el único objetivo
        //    intervenido es el vector gemelo de la guía punteada
        //    (buildSafeAreaShape). Recibe 'fill' = color sólido, 'transparent'
        //    para la opción "Ninguno / Transparente" (diagonal roja), o un
        //    fabric.Gradient para los degradados. Si la zona aún no existe
        //    (mockup cargando), el valor queda guardado en el ref y
        //    setupSafeAreaAndClipping lo reaplica en cuanto drawSafeArea la
        //    dibuja.
        const safeAreaBackground = safeAreaBackgroundRef.current;
        if (!safeAreaBackground || !c.getObjects().includes(safeAreaBackground)) {
          c.renderAll();
          return;
        }
        safeAreaBackground.set(
          'fill',
          buildFabricBackgroundFill(
            background,
            safeAreaBackground.width ?? 0,
            safeAreaBackground.height ?? 0,
          ),
        );

        // 3) MANTENER EL ORDEN DE CAPAS (Z-INDEX): el relleno se re-ubica en
        //    el fondo de la zona — mockup (base) → relleno → guía punteada →
        //    arte del usuario — para que NUNCA tape textos, imágenes ni
        //    stickers agregados por el cliente. La guía punteada queda por
        //    encima del relleno porque no se movió del resto de la pila.
        c.sendToBack(safeAreaBackground);
        c.getObjects()
          .filter((obj: any) => obj?.isMockup)
          .forEach((obj: any) => c.sendToBack(obj));

        // 4) Refresco inmediato de la vista.
        c.renderAll();
      };

      const handleDesignBgColorChange = (color: string) => setDesignBackground(color);

      const setupSafeAreaAndClipping = (view: ProductView) => {
        activeView = view;
        drawSafeArea(canvas.getWidth(), canvas.getHeight(), getPercentPrintArea(view));
        setDesignBackground(designBackgroundColorsRef.current[view.id] ?? 'transparent', view);
        applyPrintAreaClipping(view);
      };

      // Restringe los objetos del usuario para que no se dibujen fuera del printArea
      // Para zonas con forma ('rounded'/'ellipse') la sujeción sigue siendo la
      // CAJA envolvente (igual que en Zazzle): la curva recorta lo visible y lo
      // exportado vía `clipPath`, pero nunca empuja objetos de forma impredecible
      // en las esquinas, así arrastrar sigue siendo estable.
      const clampToPrintArea = (obj: any) => {
        if (!obj || obj.isGuide || obj.isMockup || !activeView) return;
        const area = getRenderedPrintArea(activeView);
        const left = area.x;
        const top = area.y;
        const right = area.x + area.width;
        const bottom = area.y + area.height;

        let bound = { left: obj.left || 0, top: obj.top || 0, width: obj.width || 0, height: obj.height || 0 };
        if (typeof obj.getBoundingRect === 'function') {
          // `true` = coordenadas ABSOLUTAS (sin viewport transform/zoom). Sin
          // esto, con zoom ≠ 1 el rect parece desplazado y el clamp empuja el
          // objeto hacia la derecha en cada frame del arrastre.
          const br = obj.getBoundingRect(true);
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
        const serializedCanvas = c.toJSON(['id', 'label', 'layerName', 'isLock']);
        return JSON.stringify((serializedCanvas.objects || []).filter((obj: any) => !obj.isDesignBackground));
      };

      // Genera una miniatura del escenario completo sin alterar la exportación
      // normal. Los mockups se excluyen de los archivos de impresión, pero sí
      // deben aparecer aquí para que la tarjeta sea reconocible de un vistazo.
      // La guía permanece fuera gracias a `excludeFromExport`.
      const captureViewThumbnail = (viewId = currentViewIdRef.current, immediate = false) => {
        const capture = () => {
          const c = fabricCanvasRef.current;
          if (!c || viewId !== currentViewIdRef.current) return;
          const mockups = c.getObjects().filter((object: any) => object?.isMockup);
          const originalExportFlags = mockups.map((mockup: any) => mockup.excludeFromExport);
          mockups.forEach((mockup: any) => mockup.set('excludeFromExport', false));
          try {
            const thumbnail = c.toDataURL({ format: 'png', multiplier: 0.25 });
            setViewThumbnails((current) => {
              if (current[viewId] === thumbnail) return current;
              const next = { ...current, [viewId]: thumbnail };
              viewThumbnailsRef.current = next;
              return next;
            });
          } finally {
            mockups.forEach((mockup: any, index: number) => mockup.set('excludeFromExport', originalExportFlags[index]));
          }
        };

        if (immediate) {
          if (thumbnailTimerRef.current) clearTimeout(thumbnailTimerRef.current);
          thumbnailTimerRef.current = null;
          capture();
          return;
        }
        if (thumbnailTimerRef.current) clearTimeout(thumbnailTimerRef.current);
        thumbnailTimerRef.current = setTimeout(() => {
          thumbnailTimerRef.current = null;
          capture();
        }, 120);
      };

      // Garantiza que ningún objeto quede bloqueado para arrastrar/escalar
      const ensureObjectsInteractable = () => {
        const c = fabricCanvasRef.current;
        if (!c) return;
        c.forEachObject((obj: any) => {
          if (obj && obj !== safeZoneRef.current && !obj.isGuide && !obj.isMockup) {
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
        activeOptionSelections = getInitialSelectedOptions(product);
        activeView = activeProduct.views[0];
        console.log('🎨 [CANVAS INIT] Selecciones de opciones iniciales:', {
          productId: product.id,
          selectedOptions: activeOptionSelections,
          activeView: {
            id: activeView?.id,
            name: activeView?.name,
          },
        });
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
        viewThumbnailsRef.current = {};
        setViewThumbnails({});
        setDesignBackgroundColor('transparent');
        const firstColor = activeView.colorVariants?.[0] ?? null;
        const initialColorIds = firstColor ? { [activeView.id]: firstColor.id } : {};
        selectedColorIdsRef.current = initialColorIds;
        setSelectedColorIds(initialColorIds);
        currentViewIdRef.current = activeView.id;
        setCurrentViewId(activeView.id);
        setSelectedOptions(activeOptionSelections);
        setCurrentMockupUrl(activeView.mockupUrl);
        setCurrentPrintArea(getBasePercentPrintArea(activeView));
        setProductViews(activeProduct.views);
        setSelectedColor(firstColor);

        // Limpiar el canvas reconstruyendo fondo + zona segura según la nueva vista
        isUpdatingHistory.current = true;
        canvas.clear();
        drawSafeArea(canvas.getWidth(), canvas.getHeight(), getPercentPrintArea(activeView));
        const mockupLoad = loadProductMockup(activeView);
        void mockupLoad.then(() => captureViewThumbnail(activeView.id, true));
        canvas.requestRenderAll();
        isUpdatingHistory.current = false;
        ensureObjectsInteractable();

        historyRef.current = [snapshotCurrentObjects()];
        redoStackRef.current = [];
        updateHistoryButtons();
        return mockupLoad;
      };

      const open3DPreview = () => {
        const c = fabricCanvasRef.current;
        if (!c) return;
        // Cada cara usa el mockup compuesto real del editor. Así no se deforma
        // una foto 2D sobre una malla inventada y se conservan frente, espalda
        // y cualquier vista extra creada en el producto.
        c.discardActiveObject();
        c.renderAll();
        const activePreview = c.toDataURL({ format: 'png', multiplier: 1 });
        const previews = activeProduct.views.map((view) => ({
          id: view.id,
          label: view.label || view.name || view.id,
          textureUrl: view.id === currentViewIdRef.current
            ? activePreview
            : viewThumbnailsRef.current[view.id] || view.mockupUrl,
        }));
        setThreeDTextureUrl(activePreview);
        setThreeDViews(previews);
        setIs3DModalOpen(true);
      };

      setupProductRef.current = setupProduct;
      const initialProductSetup = setupProduct(initialProduct);
      handleColorChangeRef.current = handleProductColorChange;
      handleProductColor = (event: Event) => {
        const variant = (event as CustomEvent<{ variant?: ColorVariant }>).detail?.variant;
        if (variant) handleProductColorChange(variant);
      };
      handleDesignBackground = (event: Event) => {
        const color = (event as CustomEvent<{ color?: string }>).detail?.color;
        if (color) handleDesignBgColorChangeRef.current?.(color);
      };
      handleDesignBgColorChangeRef.current = handleDesignBgColorChange;
      (window as any).__openEditor3DPreview = open3DPreview;

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
        captureViewThumbnail(viewId, true);
      };

      const switchView = async (viewId: string) => {
        const c = fabricCanvasRef.current;
        if (!c || viewId === currentViewIdRef.current) return;

        const requestedViewIndex = activeProduct.views.findIndex((view) => view.id === viewId);
        console.log('👁️ [CAMBIO DE VISTA]: Index pedido ->', requestedViewIndex);
        console.log('👁️ [VISTA APUNTADA]:', activeProduct.views[requestedViewIndex]);

        // Persistir los objetos de la cara actual antes de cambiar de mockup.
        captureViewThumbnail(currentViewIdRef.current, true);
        canvasDataRef.current[currentViewIdRef.current] = snapshotCurrentObjects();
        isUpdatingHistory.current = true;
        // Cada vista tiene su diseño INDEPENDIENTE: tras guardar el snapshot,
        // se eliminan del lienzo los objetos del usuario (y el fondo de color
        // de esta vista, que se re-aplica al volver). Sin esto, el diseño de
        // la vista anterior se arrastraba a la vista nueva.
        c.getObjects()
          .filter((obj: any) => !obj.isMockup && !obj.isGuide && !obj.isGuideLine)
          .forEach((obj: any) => c.remove(obj));
        const nextView = getView(viewId);
        activeView = nextView;
        console.log('🔍 [EDITOR - VISTA ACTIVA]:', {
          id: activeView?.id,
          name: activeView?.name,
        });
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
        // Refresca el panel de textos de la sidebar para la vista cargada.
        emitSmartInputs();
      };
      // @ts-ignore ref assignment for React 19 readonly typing
      (switchViewRef as any).current = switchView;

      const isDraftDesignObject = (object: any) =>
        !object?.isMockup &&
        !object?.isGuide &&
        !object?.isGuideLine &&
        !object?.isCropOverlay &&
        !object?.isDesignBackground;

      const serializeCurrentDraftView = () => {
        // Estas propiedades son parte del contrato del diseño y deben viajar
        // intactas a localStorage (y después al endpoint de persistencia).
        const canvasJSON = canvas.toJSON(['id', 'label', 'layerName', 'isLock']);
        // Las capas del sistema no forman parte del diseño: se recrean a partir
        // del producto activo al recuperar el borrador.
        canvasJSON.objects = canvas.getObjects()
          .filter(isDraftDesignObject)
          .map((object: any) => object.toJSON(['id', 'label', 'layerName', 'isLock']));
        return canvasJSON as Record<string, unknown>;
      };

      const persistDraft = () => {
        if (isHydratingDraftRef.current || !fabricCanvasRef.current) return;
        const canvasJSON = serializeCurrentDraftView();
        canvasDataRef.current[currentViewIdRef.current] = JSON.stringify(canvasJSON.objects ?? []);
        const views = Object.fromEntries(
          Object.entries(canvasDataRef.current).filter(([, objects]) => typeof objects === 'string'),
        ) as Record<string, string>;
        const draft: DesignDraft = {
          schemaVersion: 1,
          productId: activeProduct.id,
          updatedAt: Date.now(),
          currentViewId: currentViewIdRef.current,
          views,
          canvasJSON,
        };
        if (saveDraft(draft)) setDraftStatus('saved');
      };

      const scheduleDraftSave = () => {
        if (isHydratingDraftRef.current) return;
        if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
        setDraftStatus('saving');
        draftSaveTimerRef.current = setTimeout(() => {
          draftSaveTimerRef.current = null;
          persistDraft();
        }, 1000);
      };

      const restoreDraftCanvas = (canvasJSON: Record<string, any>) => new Promise<void>((resolve) => {
        const preservedBase = canvas.getObjects().filter(
          (object: any) => object.isGuide || object.isGuideLine || object.isDesignBackground || object.isMockup,
        );
        const objects = Array.isArray(canvasJSON.objects) ? canvasJSON.objects : [];
        canvas.loadFromJSON({ ...canvasJSON, objects }, () => {
          if (fabricCanvasRef.current !== canvas) return resolve();
          preservedBase.forEach((baseObject: any) => {
            canvas.add(baseObject);
            if (baseObject.isMockup || baseObject.isGuide) canvas.sendToBack(baseObject);
          });
          canvas.getObjects().filter(isDraftDesignObject).forEach((object: any) => {
            makeObjectInteractive(object);
            object.setCoords?.();
            // Sin clamp destructivo al restaurar: el borrador es la palabra
            // final del usuario y sus coordenadas se respetan tal cual; el
            // clipPath oculta lo que cae fuera de la zona vigente.
          });
          if (safeZoneRef.current) canvas.sendToBack(safeZoneRef.current);
          canvas.renderAll();
          emitSmartInputs();
          window.dispatchEvent(new CustomEvent('editor:selection-changed', { detail: { selectedObject: null } }));
          resolve();
        });
      });

      const hydrateDraft = async () => {
        const draft = getDraft(activeProduct.id);
        await initialProductSetup;
        if (!draft || fabricCanvasRef.current !== canvas) {
          isHydratingDraftRef.current = false;
          return;
        }

        canvasDataRef.current = { ...draft.views };
        if (draft.currentViewId !== currentViewIdRef.current && activeProduct.views.some((view) => view.id === draft.currentViewId)) {
          await switchView(draft.currentViewId);
        } else {
          await restoreDraftCanvas(draft.canvasJSON);
        }
        // `loadFromJSON` limpia la instancia de Fabric. Aunque se reinserten
        // las referencias de la base, una carga de mockup previa puede seguir
        // en vuelo (por ejemplo, tras vaciar la caché del navegador). Volver a
        // resolver la vista al terminar la hidratación hace atómica la pareja
        // mockup + zona segura y evita una guía calculada sin imagen base.
        const restoredView = getView(currentViewIdRef.current);
        const restoredViewIndex = Math.max(
          0,
          baseProductViews.findIndex((view) => view.id === restoredView.id),
        );
        const restoredResolvedView = resolveCurrentViewData(
          baseProductViews,
          restoredViewIndex,
          activeOptionSelections,
        );
        await loadResolvedViewBackground(restoredView, restoredResolvedView);
        historyRef.current = [snapshotCurrentObjects()];
        redoStackRef.current = [];
        updateHistoryButtons();
        isHydratingDraftRef.current = false;
        setDraftStatus('saved');
      };

      handleClearDraft = () => {
        if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
        clearDraft(activeProduct.id);
        setDraftStatus('idle');
      };
      void hydrateDraft();

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
      canvas.on('object:scaling', (e: any) => {
        clampToPrintArea(e.target);
        e.target?.setCoords?.();
      });
      canvas.on('object:modified', (e: any) => {
        clampToPrintArea(e.target);
        // Recalcular coordenadas y offset tras cada transformación para que
        // el cursor y el objeto queden perfectamente sincronizados (sin saltos).
        e.target?.setCoords?.();
        canvas.calcOffset();
      });
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
            // Los objetos del borrador traen su clipPath absoluto calculado
            // con los límites de otra sesión/zoom: reafirmar el área de ESTA
            // vista para que el recorte de exportación no los borre de un
            // plumazo al renderizar otra cara (multi-vista sin diseño).
            applyPrintAreaClipping(view);
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

      // ===== Render para la pestaña "Revisar" (Review Gallery) ================
      // La pantalla Revisar pide el diseño del usuario como PNG transparente
      // recortado a la zona segura de la vista solicitada. El consumidor lo
      // dibuja sobre las fotos de reseña dentro de los porcentajes guardados
      // (`masterPrintArea` / `customPrintArea`). Mismo mecanismo de capas que
      // `handleExportPrint`: las ayudas visuales nunca entran al PNG.
      handleDesignRender = async (event: Event) => {
        const c = fabricCanvasRef.current;
        if (!c) return;
        const detail = ((event as CustomEvent<{ viewId?: string; requestId?: string }>).detail || {}) as {
          viewId?: string;
          requestId?: string;
        };
        const targetView = activeProduct.views.find((view) => view.id === detail.viewId) ?? activeView;
        if (!targetView) return;

        // Si la foto de reseña pertenece a otra cara, renderizar esa cara en
        // memoria (igual que `exportAll`) y restaurar la vista activa al final.
        const originalViewId = currentViewIdRef.current;
        const mustRestore = targetView.id !== originalViewId;
        if (mustRestore) {
          canvasDataRef.current[originalViewId] = snapshotCurrentObjects();
          await loadViewObjects(targetView);
        }

        // Zona segura realmente dibujada (refleja la vista cargada arriba).
        const safeZone = safeZoneRef.current;
        const printArea = safeZone
          ? {
              x: safeZone.left ?? 0,
              y: safeZone.top ?? 0,
              width: safeZone.getScaledWidth?.() ?? safeZone.width ?? 0,
              height: safeZone.getScaledHeight?.() ?? safeZone.height ?? 0,
            }
          : getRenderedPrintArea(targetView);

        const systemLayers = c.getObjects().filter((object: any) =>
          object.isMockup || object.isGuide || object.isGuideLine || object.isCropOverlay || object.isDesignBackground,
        );
        const layerState = systemLayers.map((object: any) => ({
          object,
          visible: object.visible,
          excludeFromExport: object.excludeFromExport,
        }));
        const originalBackground = c.backgroundImage;
        const originalBackgroundColor = c.backgroundColor;
        const originalClipPath = c.clipPath;

        // Caja realmente recortada, en porcentaje relativo a la imagen base
        // (mismo marco que `masterPrintArea` en Revisar). Si la opción activa
        // define una zona segura propia, este rectángulo difiere del de la
        // vista base y ReviewStage DEBE dibujar el PNG aquí; usar siempre la
        // caja maestra estiraría el diseño (proporción distinta) y "no
        // coincidiría" con lo diseñado.
        const referenceBounds = activeMockupBounds.width > 0 && activeMockupBounds.height > 0
          ? activeMockupBounds
          : { left: 0, top: 0, ...logicalCanvasSize() };
        const areaPercent = printArea.width > 0 && printArea.height > 0
          ? {
              xPercent: ((printArea.x - referenceBounds.left) * 100) / referenceBounds.width,
              yPercent: ((printArea.y - referenceBounds.top) * 100) / referenceBounds.height,
              widthPercent: (printArea.width * 100) / referenceBounds.width,
              heightPercent: (printArea.height * 100) / referenceBounds.height,
              // La forma viajando con la caja le dice a Revisar si debe recortar
              // el compuesto con curva (óvalo/redondeado) o no. Se lee del área
              // resuelta (opción activa o vista base), no del objeto guía.
              ...(() => {
                const resolvedArea = getRenderedPrintArea(targetView);
                return {
                  ...(resolvedArea.shape ? { shape: resolvedArea.shape } : {}),
                  ...(resolvedArea.radius !== undefined ? { radius: resolvedArea.radius } : {}),
                };
              })(),
            }
          : undefined;

        let designPNG = '';
        // true si el export falló por canvas "tainted" (imagen externa sin
        // CORS): ReviewStage lo traduce a un mensaje de error claro.
        let tainted = false;
        try {
          if (printArea.width > 0 && printArea.height > 0) {
            // Las capas técnicas se ocultan, PERO el relleno de la zona
            // segura (isDesignBackground) es parte del diseño imprimible:
            // viaja en el PNG para que el taller reciba el color elegido.
            systemLayers.forEach((object: any) => {
              if (object.isDesignBackground) return;
              object.set({ visible: false, excludeFromExport: true });
            });
            c.backgroundImage = null;
            c.backgroundColor = '';
            c.clipPath = undefined;
            c.getObjects().forEach((object: any) => object.setCoords());
            c.renderAll();
            // PNG transparente con resolución determinista (~1400 px en el
            // lado mayor, entre 2× y 4×): nitidez suficiente para el visor de
            // la pestaña Revisar sin inflar la memoria. Las coordenadas se
            // convierten al espacio de pantalla que espera el recorte de
            // Fabric (ver `buildCropExportOptions`).
            const pxPerLogical = Math.min(4, Math.max(2, 1400 / Math.max(printArea.width, printArea.height)));
            designPNG = c.toDataURL(buildCropExportOptions(c, printArea, pxPerLogical));
          }
        } catch (exportError) {
          // Un mockup cross-origin sin cabeceras CORS "contamina" (taints) el
          // lienzo y toDataURL lanza SecurityError ("The operation is
          // insecure."). El error NO debe escapar como rejection sin manejar
          // (el listener de EditorShell nadie lo espera y Next tumbaría la
          // página): respondemos PNG vacío + tainted, y ReviewStage muestra la
          // explicación en su propia tarjeta de error.
          console.error('❌ [REVIEW] El lienzo no pudo exportar el diseño:', exportError);
          designPNG = '';
          tainted = exportError instanceof DOMException
            ? exportError.name === 'SecurityError'
            : /insecure|tainted/i.test(String(exportError));
        } finally {
          c.backgroundImage = originalBackground;
          c.backgroundColor = originalBackgroundColor;
          c.clipPath = originalClipPath;
          layerState.forEach(({ object, visible, excludeFromExport }: {
            object: any;
            visible: boolean;
            excludeFromExport: boolean;
          }) => object.set({ visible, excludeFromExport }));
          if (mustRestore) {
            await loadViewObjects(getView(originalViewId));
            historyRef.current = [snapshotCurrentObjects()];
            redoStackRef.current = [];
            updateHistoryButtons();
          }
          c.renderAll();
        }

        window.dispatchEvent(
          new CustomEvent('editor:design-render', {
            detail: { requestId: detail.requestId, viewId: targetView.id, designPNG, tainted, area: areaPercent },
          }),
        );
      };

      // Exporta sólo el arte del usuario, recortado al área imprimible de la
      // cara actual. El canvas vuelve exactamente a su estado visual previo
      // incluso si la generación del PNG falla.
      const exportToPrint = () => {
        const c = fabricCanvasRef.current;
        if (!c || !activeView) return;

        // La guía es la fuente visual de verdad: tomar sus coordenadas evita
        // diferencias entre la zona segura visible, el mockup y el zoom.
        const safeZone = safeZoneRef.current;
        const printArea = safeZone
          ? {
              x: safeZone.left ?? 0,
              y: safeZone.top ?? 0,
              width: safeZone.getScaledWidth?.() ?? safeZone.width ?? 0,
              height: safeZone.getScaledHeight?.() ?? safeZone.height ?? 0,
            }
          : getRenderedPrintArea(activeView);
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

          // Recorte en el espacio de pantalla que espera Fabric 5: así el PNG
          // de imprenta coincide exactamente con la zona segura visible,
          // independientemente del fitZoom del contenedor (3 px por unidad
          // lógica como antes, pero ya sin el desfase 1/zoom).
          const highResDataUrl = c.toDataURL(buildCropExportOptions(c, printArea, 3));

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

      const exportDesignFiles = async (): Promise<ExportedDesignFiles | null> => {
        const c = fabricCanvasRef.current;
        if (!c || !activeView) return null;
        const printArea = getRenderedPrintArea(activeView);
        if (printArea.width <= 0 || printArea.height <= 0) return null;

        const systemLayers = c.getObjects().filter((object: any) =>
          object.isMockup || object.isGuide || object.isGuideLine || object.isCropOverlay || object.isDesignBackground,
        );
        const layerState = systemLayers.map((object: any) => ({
          object,
          visible: object.visible,
          excludeFromExport: object.excludeFromExport,
        }));
        const originalBackground = c.backgroundImage;
        const originalBackgroundColor = c.backgroundColor;
        const originalClipPath = c.clipPath;
        try {
          // Preview HD: sólo se ocultan las guías. El mockup se incluye de
          // manera explícita aunque Fabric lo marque excludeFromExport.
          systemLayers.forEach((object: any) => {
            if (object.isGuide || object.isGuideLine || object.isCropOverlay) object.set('visible', false);
            if (object.isMockup) object.set({ visible: true, excludeFromExport: false });
          });
          c.renderAll();
          const previewImage = c.toDataURL({ format: 'png', quality: 1, multiplier: 2 });

          // Producción: las capas técnicas nunca llegan al archivo plano,
          // salvo el relleno de la zona segura (isDesignBackground), que es
          // diseño imprimible y debe llevar el color elegido por el cliente.
          systemLayers.forEach((object: any) => {
            if (object.isDesignBackground) return;
            object.set({ visible: false, excludeFromExport: true });
          });
          c.backgroundImage = null;
          c.backgroundColor = '';
          // Los clipPaths individuales de los objetos se mantienen para que
          // ningún arte fuera del área imprimible llegue al taller.
          c.clipPath = undefined;
          c.renderAll();
          const printSVG = c.toSVG();

          const widthCm = activeProduct.printWidthCm ?? 20;
          const heightCm = activeProduct.printHeightCm ?? 20;
          // Píxeles deseados por unidad LÓGICA para alcanzar los 300 dpi
          // físicos; `buildCropExportOptions` ya reparte esa resolución entre
          // el multiplicador y el fitZoom vigente.
          const pxPerLogical = Math.max(
            4,
            Math.ceil(((widthCm / 2.54) * 300) / printArea.width),
            Math.ceil(((heightCm / 2.54) * 300) / printArea.height),
          );
          const printPNG = c.toDataURL(buildCropExportOptions(c, printArea, pxPerLogical));

          const designJSON = c.toJSON(['id', 'label', 'layerName', 'isLock']) as Record<string, any>;
          designJSON.objects = c.getObjects()
            .filter(isDraftDesignObject)
            .map((object: any) => object.toJSON(['id', 'label', 'layerName', 'isLock']));

          return { previewImage, printSVG, printPNG, designJSON };
        } finally {
          c.backgroundImage = originalBackground;
          c.backgroundColor = originalBackgroundColor;
          c.clipPath = originalClipPath;
          layerState.forEach(({ object, visible, excludeFromExport }: {
            object: any;
            visible: boolean;
            excludeFromExport: boolean;
          }) => object.set({ visible, excludeFromExport }));
          c.renderAll();
        }
      };

      const getNormalizedPrintArea = (view: ProductView): PrintArea => getPercentPrintArea(view);

      handleSaveDesign = async (): Promise<SavedDesignPayload | null> => {
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
          return null;
        }

        const originalViewId = currentViewIdRef.current;
        const views: SavedDesignPayload['views'] = [];
        setIsExporting(true);
        try {
          for (const view of activeProduct.views) {
            await loadViewObjects(view);
            const files = await exportDesignFiles();
            if (!files) throw new Error(`No se pudieron exportar los archivos de ${view.name || view.id}.`);
            views.push({
              id: view.id,
              name: view.name || view.label || view.id,
              printArea: getNormalizedPrintArea(view),
              printAreaUnit: 'percent',
              canvasJson: JSON.stringify(files.designJSON),
              printFile: files.printPNG,
              preview: files.previewImage,
              files,
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
          setIsExporting(false);
        }

        if (errors.length || views.some((view) => !view.printFile)) {
          if (!errors.length) errors.push('Una o más vistas no pudieron generar su archivo de impresión.');
          window.dispatchEvent(new CustomEvent<SaveDesignResult>('editor:save-result', {
            detail: { valid: false, errors },
          }));
          return null;
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
          addons: addonOrderRef.current.addons,
          basePrice: addonOrderRef.current.basePrice,
          totalPrice: addonOrderRef.current.totalPrice,
          views,
        };
        // Punto de integración para API, carrito o base de datos.
        window.dispatchEvent(new CustomEvent<SavedDesignPayload>('editor:design-saved', { detail: payload }));
        window.dispatchEvent(new CustomEvent<SaveDesignResult>('editor:save-result', {
          detail: { valid: true, errors: [], payload },
        }));
        return payload;
      };

      handleAddToCart = async (event: Event) => {
        const cartDetail = (event as CustomEvent<{
          productId?: string;
          price?: number;
          basePrice?: number;
          totalPrice?: number;
          addons?: Array<{ id: string; name: string; price: number; userText?: string }>;
          selections?: Record<string, unknown>;
          quantity?: number;
        }>).detail ?? {};
        const payload = await handleSaveDesign();
        if (!payload) {
          window.dispatchEvent(new CustomEvent('editor:cart-design-error'));
          return;
        }
        const cartItem = {
          id: crypto.randomUUID(),
          productId: activeProduct.id,
          price: cartDetail.price ?? activeProduct.price,
          basePrice: cartDetail.basePrice ?? activeProduct.price,
          totalPrice: cartDetail.totalPrice ?? cartDetail.price ?? activeProduct.price,
          addons: cartDetail.addons ?? addonOrderRef.current.addons,
          selections: cartDetail.selections ?? {},
          design: { ...payload, quantity: Math.max(1, Number(cartDetail.quantity) || 1) },
          addedAt: Date.now(),
        };
        useCartStore.getState().addDesignItem(cartItem);
        // Punto de enlace para un POST /api/checkout o una UI de carrito.
        window.dispatchEvent(new CustomEvent('editor:cart-item-ready', { detail: cartItem }));
        handleClearDraft();
      };

      handleAddonsChanged = (event: Event) => {
        const detail = (event as CustomEvent<{ addons?: Array<{ id: string; name: string; price: number; userText?: string }>; basePrice?: number; totalPrice?: number }>).detail;
        addonOrderRef.current = { addons: detail?.addons ?? [], basePrice: detail?.basePrice ?? activeProduct.price, totalPrice: detail?.totalPrice ?? activeProduct.price };
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

        // La guía ya se calcula sobre el mockup renderizado y coincide con el
        // clipPath. Usarla evita centrar respecto al canvas completo.
        const safeZone = safeZoneRef.current;
        const printArea = safeZone
          ? {
              x: safeZone.left ?? 0,
              y: safeZone.top ?? 0,
              width: safeZone.getScaledWidth?.() ?? safeZone.width ?? 0,
              height: safeZone.getScaledHeight?.() ?? safeZone.height ?? 0,
            }
          : getRenderedPrintArea(activeView);

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

        // `true` calcula en coordenadas lógicas de Fabric y no en píxeles de
        // pantalla; con zoom manual el resultado sin este flag se desfasaba.
        const objBounds = obj.getBoundingRect(true);
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

      // Helper eliminado a propósito: la carga por familia vive en
      // lib/googleFonts.ts (loadGoogleFonts), que pide a css2 SÓLO los pesos
      // que cada familia sirve (el antiguo inline pedía wght@400;700 siempre
      // y devolvía 400 en monopeso como Anton o Bungee).

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

        // Esperar a que el navegador cargue la fuente (con los pesos reales
        // declarados en la biblioteca) antes de aplicarla.
        try {
          await loadGoogleFonts([{ family: fontFamily, weights: libraryFontWeights(fontFamily) }]);
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
        const newText = makeObjectInteractive(new fabric.IText(text || 'Texto', {
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
        // Centrar SIEMPRE en el punto medio visible del área de trabajo
        // (nunca en coordenadas fijas de esquina).
        fabricCanvasRef.current.centerObject(newText);
        fabricCanvasRef.current.setActiveObject(newText);
        fabricCanvasRef.current.bringToFront(newText);
        fabricCanvasRef.current.requestRenderAll();
      };

      // ── Presets tipográficos (galería "Agregar Título / Agregar Párrafo") ──
      // Recibe el id del preset elegido en TypographyPresetsPanel. Un preset de
      // una sola capa se inserta como fabric.IText editable; uno de varias capas
      // se apila verticalmente (gap px) dentro de un fabric.Group, manteniendo
      // cada línea como IText independiente con sus propias fuentes/estilos.
      handleAddTextPreset = (e: Event) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        const detail = (e as CustomEvent).detail as { presetId?: string } | undefined;
        const preset = TYPOGRAPHY_PRESETS.find((item) => item.id === detail?.presetId);
        if (!preset) return;

        void (async () => {
          // Requisito de carga dinámica: inyectar el stylesheet de Google Fonts
          // y ESPERAR la fuente antes de crear los objetos. Fabric mide los
          // textos con el contexto del canvas: si el objeto se construye con la
          // fallback aún activa, las métricas (ancho/altura del Group) quedan
          // mal calculadas aunque la tipografía llegue después.
          await loadGoogleFonts(presetFontRequests(preset));

          const printArea = getRenderedPrintArea(activeView);
          // Tope inicial: 90% del ancho imprimible, para que el preset entre
          // completo dentro de la zona segura sin recortarse.
          const maxTextWidth = Math.max(60, (printArea?.width ?? canvas.getWidth()) * 0.9);
          const gap = preset.gap ?? 8;
          const align = preset.align ?? 'center';

          const texts = preset.layers.map(
            (layer) =>
              new fabric.IText(layer.text, {
                left: 0,
                top: 0,
                originX: 'left',
                originY: 'top',
                fontFamily: layer.fontFamily,
                fontSize: layer.fontSize,
                fontWeight: layer.fontWeight ?? 400,
                fontStyle: layer.fontStyle ?? 'normal',
                fill: layer.fill,
                stroke: layer.stroke,
                strokeWidth: layer.strokeWidth ?? 0,
                paintFirst: layer.paintFirst ?? 'fill',
                shadow: layer.shadow,
                charSpacing: layer.charSpacing ?? 0,
                lineHeight: layer.lineHeight ?? 1.16,
                textAlign: layer.textAlign ?? 'center',
                textBackgroundColor: layer.textBackgroundColor ?? '',
                // Inclinación/sesgo por capa (efectos de distorsión tipo "Salud"
                // neón o sellos torcidos); dentro de un Group Fabric los conserva.
                angle: layer.rotation ?? 0,
                skewX: layer.skewX ?? 0,
                editable: true,
              }),
          );

          // Apilar capas: cada línea baja (altura + gap); centradas sobre la
          // más ancha cuando el preset pide alineación de bloque centrada.
          const widest = Math.max(1, ...texts.map((text) => text.width || 0));
          let cursorY = 0;
          texts.forEach((text) => {
            text.set({
              left: align === 'center' ? (widest - (text.width || 0)) / 2 : 0,
              top: cursorY,
            });
            cursorY += (text.height || 0) + gap;
          });

          const designObject =
            texts.length > 1
              ? new fabric.Group(texts, { originX: 'center', originY: 'center' })
              : texts[0].set({ originX: 'center', originY: 'center' });

          // Encoger (nunca agrandar) para caber en el área imprimible.
          const naturalWidth = (designObject.width || 1) * (designObject.scaleX || 1);
          const fitScale = Math.min(1, maxTextWidth / naturalWidth);
          if (fitScale < 1) designObject.set({ scaleX: fitScale, scaleY: fitScale });

          // Nombre visible en LayersPanel y en los objetos exportados.
          (designObject as any).set('layerName', preset.name);
          // makeObjectInteractive reafirma interactividad y aplica el clipPath
          // de la zona segura (el preset completo viaja a los archivos de print).
          makeObjectInteractive(designObject);
          canvas.add(designObject);
          canvas.centerObject(designObject);
          canvas.setActiveObject(designObject);
          canvas.bringToFront(designObject);
          canvas.requestRenderAll();
          saveState();
        })();
      };

      // ── Fuente suelta de la biblioteca ("Todas las fuentes" de la galería) ─
      // Clic en una tarjeta de fuente: si hay un texto seleccionado se le
      // aplica la familia (mismo efecto que el combo del TextToolbar); si no
      // hay ninguno, se inserta un IText nuevo editable. En ambos casos se
      // ESPERA la carga de la tipografía antes de tocar el objeto para que
      // Fabric capture las métricas correctas.
      handleApplyLibraryFont = (e: Event) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        const detail = (e as CustomEvent).detail as { family?: string } | undefined;
        const family = detail?.family?.trim();
        if (!family) return;

        void (async () => {
          await loadGoogleFonts([{ family, weights: libraryFontWeights(family) }]);

          const active = canvas.getActiveObject();
          if (active && (active.type === 'i-text' || active.type === 'text')) {
            active.set('fontFamily', family);
            canvas.requestRenderAll();
            saveState();
            return;
          }

          const newText = makeObjectInteractive(new fabric.IText('Escribe tu texto...', {
            originX: 'center',
            originY: 'center',
            fontFamily: family,
            fontSize: 30,
            fill: '#1e293b',
            editable: true,
            ...defaultObjectProps,
          }));
          canvas.add(newText);
          canvas.centerObject(newText);
          canvas.setActiveObject(newText);
          canvas.bringToFront(newText);
          canvas.requestRenderAll();
          saveState();
        })();
      };

      // Listener para agregar imagen vía CustomEvent
      handleAddImage = (e: Event) => {
        if (!fabricCanvasRef.current) return;
        const customEvent = e as CustomEvent<{ dataUrl: string }>;
        const { dataUrl } = customEvent.detail || {};
        if (!dataUrl) return;

        // Crear un elemento img HTML oculto para precargar la imagen Base64
        const imgElement = document.createElement('img');
        imgElement.crossOrigin = 'anonymous';
        imgElement.src = resolveImageUrl(dataUrl);

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
        // Nunca eliminar las capas del sistema (mockup, guías, fondo de diseño):
        // solo objetos reales del usuario.
        const activeObjects = canvas
          .getActiveObjects()
          .filter(
            (obj: any) =>
              !obj.isMockup &&
              !obj.isGuide &&
              !obj.isGuideLine &&
              !obj.isCropOverlay &&
              !obj.isDesignBackground,
          );
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
        // Mantener zona segura y mockup base; eliminar sólo objetos del usuario
        const userObjects = objects.filter(
          (obj: any) => obj !== safeZoneRef.current && !obj.isGuide && !obj.isMockup,
        );
        userObjects.forEach((obj: any) => fabricCanvasRef.current.remove(obj));
        fabricCanvasRef.current.discardActiveObject();
        fabricCanvasRef.current.renderAll();
        saveState();
      };

      const restoreUserObjects = (jsonString: string) => {
        if (!fabricCanvasRef.current || !jsonString) return;
        const canvas = fabricCanvasRef.current;

        // 1. Remove only user objects
        const userObjects = canvas.getObjects().filter((obj: any) => !obj.isGuide && !obj.isMockup);
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

        const target = e.target as HTMLElement | null;
        const activeEl = (
          typeof document !== 'undefined' ? document.activeElement : null
        ) as HTMLElement | null;
        const isFormField = (el: HTMLElement | null | undefined) =>
          !!el &&
          (el.tagName === 'INPUT' ||
            el.tagName === 'TEXTAREA' ||
            el.tagName === 'SELECT' ||
            el.isContentEditable);

        // Ignorar atajos de teclado cuando el foco está en un campo de texto de
        // la interfaz (sidebar, toolbar, panel de edición rápida, etc.).
        if (isFormField(target) || isFormField(activeEl)) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
          // Sólo se borran objetos cuando el usuario está realmente sobre el
          // lienzo. Si el foco está en cualquier control de la UI (botón
          // "Reemplazar", chips de categoría, miniaturas, etc.) la tecla no
          // debe eliminar la selección del canvas: así el panel de edición
          // rápida nunca borra el texto que se está personalizando.
          const el = target as HTMLElement | null;
          const focusIsOnCanvas =
            !el ||
            el === document.body ||
            el === document.documentElement ||
            el.tagName === 'CANVAS' ||
            !!el.closest?.('.canvas-container');
          if (!focusIsOnCanvas) return;
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
          const safeCenter = safeZoneRef.current?.getCenterPoint?.();
          const centerX = safeCenter?.x ?? canvas.width / 2;
          const centerY = safeCenter?.y ?? canvas.height / 2;

          const defaultProps = {
            left: centerX,
            top: centerY,
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
          } else if (type === 'roundedRect') {
            shape = new fabric.Rect({ ...defaultProps, width: 130, height: 82, rx: 18, ry: 18 });
          } else if (type === 'circle') {
            shape = new fabric.Circle({ ...defaultProps, radius: 50 });
          } else if (type === 'ellipse') {
            shape = new fabric.Ellipse({ ...defaultProps, rx: 64, ry: 40 });
          } else if (type === 'triangle') {
            shape = new fabric.Triangle({ ...defaultProps, width: 100, height: 100 });
          } else if (['diamond', 'pentagon', 'hexagon', 'octagon'].includes(type)) {
            const sides = type === 'diamond' ? 4 : type === 'pentagon' ? 5 : type === 'hexagon' ? 6 : 8;
            const points = Array.from({ length: sides }, (_, index) => {
              const angle = (Math.PI * 2 * index) / sides - Math.PI / 2;
              return { x: 60 + Math.cos(angle) * 58, y: 60 + Math.sin(angle) * 58 };
            });
            shape = new fabric.Polygon(points, defaultProps);
          } else if (type === 'arrow') {
            shape = new fabric.Polygon([
              { x: 0, y: 28 }, { x: 74, y: 28 }, { x: 74, y: 4 },
              { x: 124, y: 52 }, { x: 74, y: 100 }, { x: 74, y: 76 }, { x: 0, y: 76 },
            ], defaultProps);
          } else if (type === 'line') {
            shape = new fabric.Line([centerX - 70, centerY, centerX + 70, centerY], {
              ...defaultObjectProps, fill: 'transparent',
              stroke: '#1E293B', strokeWidth: 8, strokeLineCap: 'round',
            });
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
          } else if (type === 'speech') {
            shape = new fabric.Path('M 14 12 Q 14 0 28 0 L 112 0 Q 126 0 126 14 L 126 58 Q 126 72 112 72 L 54 72 L 28 94 L 34 72 Q 14 70 14 56 Z', defaultProps);
          } else if (type === 'cloud') {
            shape = new fabric.Path('M 29 88 C 9 88 0 74 0 58 C 0 42 13 30 31 30 C 37 10 54 0 75 0 C 101 0 117 17 120 39 C 138 42 150 54 150 69 C 150 83 138 92 122 92 L 29 92 Z', defaultProps);
          } else if (type === 'lightning') {
            shape = new fabric.Polygon([
              { x: 70, y: 0 }, { x: 18, y: 70 }, { x: 54, y: 70 },
              { x: 37, y: 130 }, { x: 105, y: 48 }, { x: 68, y: 48 },
            ], defaultProps);
          } else if (type === 'moon') {
            shape = new fabric.Path('M 98 8 C 53 10 22 43 22 82 C 22 121 53 151 92 151 C 112 151 131 143 145 129 C 112 129 87 102 87 69 C 87 43 101 20 122 10 C 114 8 106 7 98 8 Z', defaultProps);
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
      // `detail.size` (opcional) es el lado mayor deseado en px: lo envían las
      // ilustraciones a color para insertarse en un tamaño usable. Si se omite
      // se conserva el escalado histórico (1.5) del buscador de iconos.
      handleAddSVG = async (e: Event) => {
        const customEvent = e as CustomEvent<{ svgUrl?: string; size?: number }>;
        const url = customEvent.detail?.svgUrl;
        const requestedSize = customEvent.detail?.size;
        const canvas = fabricCanvasRef.current;
        if (!url || !canvas) return;

        try {
          // Los recursos Iconify usan el proxy same-origin de Next.js, que ya
          // realiza el reintento entre los hosts upstream disponibles.
          const iconifyHosts = url.startsWith('/api/iconify/')
            ? [window.location.origin]
            : ['api.iconify.design', 'api.simplesvg.com', 'api.unisvg.com'];
          let svgText = '';
          let lastError: unknown;
          for (const host of iconifyHosts) {
            try {
              const candidateUrl = host === window.location.origin
                ? new URL(url, window.location.origin).toString()
                : url.replace(/^https:\/\/[^/]+/, `https://${host}`);
              const response = await fetch(candidateUrl);
              if (!response.ok) throw new Error(`Iconify respondió ${response.status}`);
              const text = await response.text();
              if (!text.includes('<svg')) throw new Error('El recurso no contiene un SVG válido.');
              svgText = text;
              break;
            } catch (error) {
              lastError = error;
            }
          }
          if (!svgText) throw lastError instanceof Error ? lastError : new Error('No se pudo cargar el recurso gráfico.');

          const targetCanvas = fabricCanvasRef.current;
          if (!targetCanvas) return;

          fabric.loadSVGFromString(svgText, (objects: any, options: any) => {
            try {
            if (!fabricCanvasRef.current) return;
            if (!Array.isArray(objects) || objects.length === 0) throw new Error('El SVG no contiene elementos compatibles con Fabric.');
            const svgGroup = fabric.util.groupSVGElements(objects, options);

            // El SVG de Iconify ya trae su tamaño natural (p. ej. height=200).
            // Si el emisor pidió un tamaño, escalamos para alcanzarlo; si no,
            // aplicamos el 1.5 de siempre. Los colores originales del SVG se
            // conservan: aquí nunca se sobrescribe `fill`.
            const naturalSize = Math.max(Number(svgGroup.width) || 0, Number(svgGroup.height) || 0);
            const scale = requestedSize && naturalSize > 0 ? requestedSize / naturalSize : 1.5;
            const safeCenter = safeZoneRef.current?.getCenterPoint?.();

            svgGroup.set({
              left: safeCenter?.x ?? targetCanvas.width / 2,
              top: safeCenter?.y ?? targetCanvas.height / 2,
              originX: 'center',
              originY: 'center',
              scaleX: scale,
              scaleY: scale,
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
            } catch (error) {
              console.error('No se pudo insertar el SVG en el lienzo:', error);
            }
          });
        } catch (err) {
          console.error('Error cargando el SVG:', err);
        }
      };

      // Plantillas prediseñadas: sustituye los objetos del diseño mediante
      // canvas.loadFromJSON, preservando el mockup (backgroundImage) y las
      // guías de la zona segura del producto activo.
      handleApplyTemplate = (e: Event) => {
        const detail = (e as CustomEvent<{ objects?: Record<string, unknown>[]; force?: boolean }>).detail;
        const canvas = fabricCanvasRef.current;
        const incomingObjects = detail?.objects;
        if (!canvas || !Array.isArray(incomingObjects)) return;

        // Confirmación: si el usuario ya tiene elementos en el canvas, pedir
        // consentimiento antes de reemplazar su diseño por la plantilla.
        // EXCEPCIÓN: el flujo de EDICIÓN del admin (force:true, botón ✏️)
        // carga el JSON directamente sin preguntar al cliente.
        const hasUserDesign = canvas
          .getObjects()
          .some((object: any) => !object.isGuide && !object.isDesignBackground);
        if (hasUserDesign && !detail?.force && !window.confirm('¿Deseas reemplazar tu diseño actual por esta plantilla?')) {
          return;
        }

        // loadFromJSON limpia TODO el lienzo: guardar la base para restaurarla
        // inmediatamente después de la carga. El mockup NO es backgroundImage:
        // es un objeto Image con flag `isMockup` anclado al fondo del escenario,
        // así que también se preserva y se re-inserta (siempre sendToBack). Los
        // objetos de diseño previos sí se descartan aquí.
        const preservedBase = canvas
          .getObjects()
          .filter((object: any) => object.isGuide || object.isDesignBackground || object.isMockup);

        // Normalización defensiva: los IText/Textbox sin la propiedad `styles`
        // hacen que enlivenObjects explote con "styles[i] undefined". Fabric
        // serializa siempre `styles`, pero JSONs hechos a mano pueden omitirlo.
        const normalizedObjects = incomingObjects.map((object: Record<string, any>) => {
          const objectType = String(object?.type ?? '').toLowerCase();
          if (objectType === 'itext' || objectType === 'i-text' || objectType === 'textbox') {
            return { ...object, styles: object.styles ?? {} };
          }
          return object;
        });

        canvas.loadFromJSON({ objects: normalizedObjects }, () => {
          if (fabricCanvasRef.current !== canvas) return;
          // Re-insertar la base (mockup + guías); el mockup SIEMPRE al fondo,
          // por debajo de cualquier objeto de la plantilla.
          preservedBase.forEach((baseObject: any) => {
            canvas.add(baseObject);
            if (baseObject.isMockup) canvas.sendToBack(baseObject);
          });
          canvas.getObjects().forEach((object: any) => {
            if (object.isGuide || object.isDesignBackground || object.isMockup) return;
            // Los textos de la plantilla nacen listos para doble clic.
            const objectType = String(object.type ?? '').toLowerCase();
            if (objectType === 'itext' || objectType === 'i-text' || objectType === 'textbox') {
              object.set({ editable: true });
            }
            makeObjectInteractive(object);
            // Controles visuales limpios: esquinas circulares compactas,
            // borde definido y rotación suave (mtr visible al seleccionar).
            object.set({
              cornerStyle: 'circle',
              cornerSize: 10,
              cornerColor: '#ffffff',
              cornerStrokeColor: '#0f172a',
              transparentCorners: false,
              borderScaleFactor: 1.5,
              padding: 4,
              objectCaching: false,
            });
            object.setCoords();
            clampToPrintArea(object);
          });
          canvas.renderAll();
          window.dispatchEvent(
            new CustomEvent('editor:selection-changed', { detail: { selectedObject: null } }),
          );
                    if (typeof saveState === 'function') saveState();
          // Refresca el panel de textos de la sidebar para que aparezcan los
          // inputs de reemplazo rápido de los textos cargados por la plantilla.
          emitSmartInputs();
        });
      };

      // Guardar como Plantilla (modo Administrador): serializa el diseño del
      // canvas actual (sin el mockup ni las guías) junto a una miniatura.
      handleExportTemplate = (e: Event) => {
        const detail = (e as CustomEvent<{ name?: string; category?: string; updateId?: string }>).detail;
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const templateName = detail?.name?.trim();
        if (!templateName) {
          console.warn('⚠️ [PLANTILLA] Nombre requerido para guardar la plantilla');
          return;
        }

        // 1. Capturar primero el producto compuesto con el diseño. Esta es la
        // miniatura fotorrealista de la galería de plantillas: contiene el
        // mockup seleccionado y el arte ya aplicado, pero no las guías.
        const isTechnicalLayer = (obj: unknown) => {
          const candidate = obj as { isGuide?: boolean; isGuideLine?: boolean; isCropOverlay?: boolean };
          return Boolean(candidate?.isGuide || candidate?.isGuideLine || candidate?.isCropOverlay);
        };
        const hiddenTechnicalLayers: { object: fabric.Object; wasVisible: boolean }[] = [];
        canvas.getObjects().forEach((object: fabric.Object) => {
          if (isTechnicalLayer(object)) {
            hiddenTechnicalLayers.push({ object, wasVisible: object.visible ?? true });
            object.visible = false;
          }
        });
        // Fabric puede exportar transparencias como negro en algunos navegadores
        // al serializar el JPEG. Forzamos un fondo pastel claro exclusivamente
        // para la preview y restauramos el color real al final.
        const originalBackgroundColor = canvas.backgroundColor;
        canvas.backgroundColor = '#eef2ff';
        canvas.renderAll();
        const PREVIEW_MAX_CHARS = 350_000;
        const generateProductPreview = (multiplier: number, quality: number) =>
          canvas.toDataURL({ format: 'jpeg', multiplier, quality, backgroundColor: '#eef2ff' });
        // Se intenta primero una captura 4× (3200 px en el canvas lógico de
        // 800 px), perfecta para pantallas Retina. Se reduce sólo si excede
        // la cuota razonable de localStorage.
        let productPreview = generateProductPreview(4, 0.9);
        if (productPreview.length > PREVIEW_MAX_CHARS) {
          productPreview = generateProductPreview(2.5, 0.86);
        }
        if (productPreview.length > PREVIEW_MAX_CHARS) {
          productPreview = generateProductPreview(1.5, 0.82);
        }

        // 2. Ocultar temporalmente la capa del mockup (imagen base del
        //    producto / fondo) para que no aparezca ni en la miniatura ni en
        //    el JSON de la plantilla.
        const isMockupLayer = (obj: unknown) => {
          const candidate = obj as { isMockup?: boolean; isProductImage?: boolean; excludeFromExport?: boolean };
          return Boolean(candidate?.isMockup || candidate?.isProductImage || candidate?.excludeFromExport);
        };
        const hiddenLayers: { object: fabric.Object; wasVisible: boolean }[] = [];
        canvas.getObjects().forEach((object: fabric.Object) => {
          if (isMockupLayer(object)) {
            hiddenLayers.push({ object, wasVisible: object.visible ?? true });
            object.visible = false;
          }
        });
        // Además, si el mockup vive como backgroundImage del canvas, ocultarlo
        // también para la captura.
        const backgroundImage = canvas.backgroundImage as fabric.Object | undefined;
        const hideBackgroundImage = Boolean(backgroundImage && isMockupLayer(backgroundImage));
        if (hideBackgroundImage && backgroundImage) backgroundImage.visible = false;

        // 3. Fondo blanco temporal para la captura (evita negros en JPEG en
        //    zonas transparentes y da una miniatura limpia).
        canvas.backgroundColor = '#ffffff';

        // 4. Generar miniatura limpia (sin mockup, sobre fondo blanco).
        //    Calidad adaptativa para cuidar la cuota de localStorage:
        //    se intenta primero PNG 2x (retina nítido) y, si pesa demasiado,
        //    se degrada a JPEG de alta calidad antes de persistir.
        const THUMBNAIL_MAX_CHARS = 180_000; // ~135KB por imagen Base64
        const generateThumbnail = (
          format: 'png' | 'jpeg',
          multiplier: number,
          quality: number,
        ) =>
          canvas.toDataURL({
            format,
            multiplier,
            quality,
            backgroundColor: '#ffffff',
          });

        let thumbnail = generateThumbnail('png', 2, 1);
        if (thumbnail.length > THUMBNAIL_MAX_CHARS) {
          thumbnail = generateThumbnail('jpeg', 1.5, 0.85);
          if (thumbnail.length > THUMBNAIL_MAX_CHARS) {
            thumbnail = generateThumbnail('jpeg', 1, 0.8);
          }
        }

        // 2. JSON de Fabric. IMPORTANTE: los flags personalizados (isMockup,
        //    isGuide, etc.) NO se serializan por defecto — hay que pedirlos
        //    explícitamente via propertiesToInclude para poder filtrarlos
        //    después. Sin esto, el mockup se colaba en el JSON de la plantilla.
        const TEMPLATE_EXCLUDED_FLAGS = [
          'isMockup',
          'isProductImage',
          'isGuide',
          'isGuideLine',
          'isDesignBackground',
          'isCropOverlay',
        ];
        const canvasJSON = canvas.toJSON([...TEMPLATE_EXCLUDED_FLAGS]);

        // 4. Restaurar el estado original del canvas: visibilidad del mockup,
        //    fondo original y re-render. El usuario/admin no nota ningún
        //    parpadeo y puede seguir editando normalmente.
        hiddenLayers.forEach(({ object, wasVisible }) => {
          object.visible = wasVisible;
        });
        hiddenTechnicalLayers.forEach(({ object, wasVisible }) => {
          object.visible = wasVisible;
        });
        if (hideBackgroundImage && backgroundImage) backgroundImage.visible = true;
        canvas.backgroundColor = originalBackgroundColor;
        canvas.renderAll();

        // 3. Excluir del JSON de la plantilla:
        //    - el mockup del producto (isMockup / isProductImage / excludeFromExport,
        //      cubre también el caso backgroundImage),
        //    - las guías de la zona segura y capas de diseño de fondo,
        //    - los overlays de recorte.
        //    Sólo quedan los vectores, formas y textos añadidos por el usuario.
        const designObjects = ((canvasJSON.objects ?? []) as Record<string, unknown>[]).filter(
          (object) =>
            !object.isMockup &&
            !object.isProductImage &&
            !object.isGuide &&
            !object.isGuideLine &&
            !object.isDesignBackground &&
            !object.isCropOverlay &&
            !object.excludeFromExport,
        );
        if (!designObjects.length) {
          console.warn('⚠️ [PLANTILLA] No hay elementos de diseño para guardar');
          window.dispatchEvent(new CustomEvent('editor:template-saved', { detail: { ok: false, reason: 'empty' } }));
          return;
        }

        // TODO: Reemplazar localStorage por POST /api/templates (o PUT
        // /api/templates/:id cuando venga updateId, edición de plantilla) —
        // el payload (nombre, categoría, miniatura, templateJSON) ya es lo que
        // recibiría el endpoint; basta con subir esta misma estructura.
        // Si el evento trae updateId, se ACTUALIZA la plantilla existente
        // (conservando su fecha de creación) en lugar de crear una nueva.
        const existing = detail?.updateId
          ? listSavedTemplates().find((item) => item.id === detail.updateId)
          : undefined;
        // Guardado con reintento: si la cuota se agota, se reintenta una vez
        // con una miniatura mínima (JPEG 1x). Si aún así falla, el problema
        // son los datos embebidos del JSON (p.ej. imágenes del usuario muy
        // grandes) o la cuota global agotada — se notifica a la UI.
        const basePayload = {
          id: detail?.updateId ?? crypto.randomUUID(),
          name: templateName,
          category: detail?.category?.trim() || 'General',
          // Ícono representativo de la categoría (ej. '🎂' Cumpleaños): se usa
          // directamente como vista previa de la tarjeta en la sidebar.
          icon: getCategoryIcon(detail?.category?.trim()),
          // Tipo de producto activo: la plantilla sólo será visible/aplicable
          // en el editor para productos de este mismo tipo.
          productType: activeProduct.category || activeProduct.id,
          createdAt: existing?.createdAt ?? Date.now(),
          previewUrl: productPreview,
          previewVersion: 2 as const,
          templateJSON: { version: canvasJSON.version, objects: designObjects },
        };
        let saved = existing
          ? updateTemplateInStorage({ ...basePayload, thumbnail })
          : saveTemplateToStorage({ ...basePayload, thumbnail });

        if (!saved) {
          console.warn('⚠️ [PLANTILLA] Cuota agotada; reintentando con miniatura mínima');
          thumbnail = generateThumbnail('jpeg', 1, 0.7);
          saved = existing
            ? updateTemplateInStorage({ ...basePayload, thumbnail })
            : saveTemplateToStorage({ ...basePayload, thumbnail });
        }

        if (!saved) {
          const jsonChars = JSON.stringify(basePayload.templateJSON).length;
          console.error(
            `❌ [PLANTILLA] No se pudo guardar ni con miniatura mínima. ` +
              `Tamaño del JSON de diseño: ~${Math.round(jsonChars / 1024)}KB. ` +
              `Considere eliminar plantillas antiguas o migrar a un endpoint /api/templates.`,
          );
        }

        // 4. Notificar a la barra lateral para refrescar la lista.
        window.dispatchEvent(
          new CustomEvent('editor:template-saved', { detail: { ok: saved, name: templateName } }),
        );
      };

      window.addEventListener('editor:add-text', handleAddText);
      window.addEventListener('editor:add-text-preset', handleAddTextPreset);
      window.addEventListener('editor:apply-library-font', handleApplyLibraryFont);

      window.addEventListener('editor:change-color', handleColorChange);
      window.addEventListener('editor:product-color', handleProductColor);
      window.addEventListener('editor:design-background', handleDesignBackground);
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
      window.addEventListener('editor:design-render-request', handleDesignRender);
      window.addEventListener('editor:align', handleAlign);
      window.addEventListener('editor:zoom', handleZoom);
      window.addEventListener('editor:save-design', handleSaveDesign);
      window.addEventListener('editor:option-mockup', handleOptionMockup);
      window.addEventListener('editor:options-changed', handleOptionsChanged);
      window.addEventListener('editor:addons-changed', handleAddonsChanged);
      window.addEventListener('editor:apply-template', handleApplyTemplate);
      window.addEventListener('editor:replace-text', handleReplaceText);
      window.addEventListener('editor:clear-draft', handleClearDraft);
      window.addEventListener('editor:add-to-cart', handleAddToCart);
      window.addEventListener('editor:buy-now', handleAddToCart);
      window.addEventListener('editor:purchase-completed', handleClearDraft);
      // Lista inicial de textos para la sidebar.
      emitSmartInputs();
      window.addEventListener('editor:save-as-template', handleExportTemplate);

      canvas.on('object:added', saveState);
      canvas.on('object:modified', saveState);
      canvas.on('object:removed', saveState);
      // Auto-guardado con debounce: incluye trazos libres creados por Fabric.
      canvas.on('object:added', scheduleDraftSave);
      canvas.on('object:modified', scheduleDraftSave);
      canvas.on('object:removed', scheduleDraftSave);
      canvas.on('path:created', scheduleDraftSave);
      // Panel de textos: refrescar la lista de la sidebar al añadir/eliminar
      // objetos o al escribir directamente sobre un texto en el lienzo.
      canvas.on('object:added', emitSmartInputs);
      canvas.on('object:removed', emitSmartInputs);
      canvas.on('text:changed', emitSmartInputs);
      // Un texto que quede vacío al terminar de editarlo se restaura para que
      // el objeto no pierda su caja (y siga siendo seleccionable/editable).
      canvas.on('text:editing:exited', preserveEmptyText);

      // Mantiene la tarjeta de la vista activa al día sin renderizar una imagen
      // por cada píxel de un arrastre: `captureViewThumbnail` agrupa cambios
      // rápidos en una única captura al terminar el siguiente instante visual.
      canvas.on('object:added', () => captureViewThumbnail());
      canvas.on('object:removed', () => captureViewThumbnail());
      canvas.on('object:moving', () => captureViewThumbnail());
      canvas.on('object:scaling', () => captureViewThumbnail());
      canvas.on('object:rotating', () => captureViewThumbnail());
      canvas.on('object:modified', () => captureViewThumbnail());
      canvas.on('text:changed', () => captureViewThumbnail());
      canvas.on('path:created', () => captureViewThumbnail());
    });

    return () => {
      isMounted = false;
      if (handleAddText) {
        window.removeEventListener('editor:add-text', handleAddText);
      }
      if (handleAddTextPreset) {
        window.removeEventListener('editor:add-text-preset', handleAddTextPreset);
      }
      if (handleApplyLibraryFont) {
        window.removeEventListener('editor:apply-library-font', handleApplyLibraryFont);
      }
      if (handleColorChange) {
        window.removeEventListener('editor:change-color', handleColorChange);
      }
      if (handleFontChange) {
        window.removeEventListener('editor:change-font', handleFontChange);
      }
      if (handleProductColor) {
        window.removeEventListener('editor:product-color', handleProductColor);
      }
      if (handleDesignBackground) {
        window.removeEventListener('editor:design-background', handleDesignBackground);
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
      if (handleApplyTemplate) {
        window.removeEventListener('editor:apply-template', handleApplyTemplate);
      }
      if (handleClearDraft) window.removeEventListener('editor:clear-draft', handleClearDraft);
      if (handleAddToCart) window.removeEventListener('editor:add-to-cart', handleAddToCart);
      if (handleAddToCart) window.removeEventListener('editor:buy-now', handleAddToCart);
      if (handleClearDraft) window.removeEventListener('editor:purchase-completed', handleClearDraft);
      if (handleExportTemplate) {
        window.removeEventListener('editor:save-as-template', handleExportTemplate);
      }
            if (handleReplaceText) {
        window.removeEventListener('editor:replace-text', handleReplaceText);
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
      if (handleDesignRender) {
        window.removeEventListener('editor:design-render-request', handleDesignRender);
      }
      if (handleAlign) {
        window.removeEventListener('editor:align', handleAlign);
      }
      if (handleZoom) {
        window.removeEventListener('editor:zoom', handleZoom);
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
      window.removeEventListener('editor:addons-changed', handleAddonsChanged);
      if (fabricCanvasRef.current) {
        if ((window as any).__editorFabricCanvas === fabricCanvasRef.current) {
          delete (window as any).__editorFabricCanvas;
          delete (window as any).__editorPrintArea;
        }
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      delete (window as any).__openEditor3DPreview;
      setupProductRef.current = null;
      window.removeEventListener('resize', handleWindowResize);
      if (containerObserver) {
        containerObserver.disconnect();
        containerObserver = null;
      }
      clearTimeout(resizeTimer);
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
      if (thumbnailTimerRef.current) clearTimeout(thumbnailTimerRef.current);
      thumbnailTimerRef.current = null;
      fitOnResize = null;
    };
  }, []);

  return (
    <div
      ref={canvasAreaRef}
      className="flex-1 h-full w-full flex items-center justify-center p-6 relative overflow-hidden bg-slate-100/50 mx-auto"
    >
      <canvas ref={canvasRef} className="block select-none" style={{ pointerEvents: 'auto' }} />

      {draftStatus !== 'idle' && (
        <div className="pointer-events-none absolute bottom-3 left-4 z-20 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur" aria-live="polite">
          {draftStatus === 'saving' ? 'Guardando...' : 'Guardado en borrador'}
        </div>
      )}

      {isExporting && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/20 backdrop-blur-[1px]" role="status" aria-live="assertive">
          <div className="flex items-center gap-3 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-xl">
            <Loader2 size={18} className="animate-spin" />
            Preparando archivos de alta resolución...
          </div>
        </div>
      )}

      {/* Vistas del producto: cada tarjeta conserva una miniatura del diseño
          propio de esa cara, para que frente, espalda y vistas adicionales se
          distingan sin cubrir el centro del diseño. */}
      {productViews.length > 1 && (
        <div className="absolute right-3 top-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-row gap-2 overflow-x-auto rounded-2xl bg-white/85 p-1.5 shadow-lg shadow-slate-900/10 backdrop-blur-md sm:right-4 sm:top-4 sm:gap-2.5 sm:p-2">
          {productViews.map((view) => {
            const isActive = view.id === currentViewId;
            const thumbnailUrl = viewThumbnails[view.id]
              || (isActive ? currentMockupUrl : view.mockupUrl)
              || initialProduct.views.find((item) => item.id === view.id)?.mockupUrl;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => switchViewRef.current?.(view.id)}
                aria-pressed={isActive}
                aria-label={`Cambiar a la vista ${view.label || view.name || view.id}`}
                className={`group w-[68px] shrink-0 overflow-hidden rounded-xl border-2 bg-white text-left shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:w-[78px] ${
                  isActive
                    ? 'border-blue-700 ring-1 ring-blue-700/20'
                    : 'border-transparent hover:border-slate-300 hover:shadow-md'
                }`}
              >
                <div className="aspect-square w-full overflow-hidden bg-slate-100">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt=""
                      className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-2 text-center text-[10px] text-slate-400">
                      Sin vista previa
                    </div>
                  )}
                </div>
                <span className={`block truncate px-2 py-2 text-center text-xs font-semibold ${isActive ? 'text-blue-800' : 'text-slate-700'}`}>
                  {view.label || view.name || view.id}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {false ? (
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
                <img
                  key={view.id === currentViewId ? currentMockupUrl : view.mockupUrl}
                  src={view.id === currentViewId ? currentMockupUrl : view.mockupUrl}
                  alt=""
                  className="mx-auto mb-0.5 h-8 w-8 object-contain"
                />
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
                <p className="mb-1.5 text-[10px] leading-normal text-gray-400">
                  El fondo cubre TODO el fondo del producto y se mantiene al exportar.
                  Elige un color o un degradado, o pulsa “Transparente” para quitarlo.
                </p>
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
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Sólidos
                  </span>
                  <div className="grid grid-cols-7 gap-1.5">
                  {SOLID_BACKGROUND_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => handleDesignBgColorChangeRef.current?.(hex)}
                      className={`h-6 w-full rounded-md border shadow-sm transition-all ${
                        designBackgroundColor.toLowerCase() === hex ? 'scale-105 ring-2 ring-blue-600' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex, borderColor: hex === '#ffffff' ? '#cbd5e1' : 'transparent' }}
                      title={`Fondo ${hex}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={activeSolidHex}
                    onChange={(event) => handleDesignBgColorChangeRef.current?.(event.target.value)}
                    className="h-6 w-full cursor-pointer rounded-md border bg-transparent p-0"
                    title="Elegir color personalizado"
                  />
                  </div>
                  {/*
                    Degradados "aesthetic": tiñen el fondo COMPLETO del mockup
                    (no sólo la zona segura) igual que los sólidos. Un clic los
                    aplica; la muestra muestra el desvanecido real.
                  */}
                  <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Degradados
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {GRADIENT_BACKGROUND_PRESETS.map((preset) => {
                      const spec = gradientPresetToBackground(preset);
                      const encoded = encodeDesignBackground(spec);
                      const isSelected = designBackgroundColor === encoded;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleDesignBgColorChangeRef.current?.(encoded)}
                          className={`h-6 w-full rounded-md border border-transparent shadow-sm transition-all ${
                            isSelected ? 'scale-105 ring-2 ring-blue-600' : 'hover:scale-105'
                          }`}
                          style={{ background: designBackgroundToCss(spec) }}
                          title={`Degradado ${preset.name}`}
                          aria-label={`Fondo degradado ${preset.name}`}
                        />
                      );
                    })}
                  </div>
                  {/* Degradado personalizado: dos colores + dirección. */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={customGradient.from}
                      onChange={(event) => setCustomGradient((prev) => ({ ...prev, from: event.target.value }))}
                      className="h-6 w-7 cursor-pointer rounded-md border bg-transparent p-0"
                      title="Color inicial del degradado"
                    />
                    <input
                      type="color"
                      value={customGradient.to}
                      onChange={(event) => setCustomGradient((prev) => ({ ...prev, to: event.target.value }))}
                      className="h-6 w-7 cursor-pointer rounded-md border bg-transparent p-0"
                      title="Color final del degradado"
                    />
                    <select
                      value={customGradient.angle}
                      onChange={(event) => setCustomGradient((prev) => ({ ...prev, angle: Number(event.target.value) }))}
                      className="h-6 flex-1 cursor-pointer rounded-md border border-gray-200 bg-white px-1 text-[10px] text-gray-600 outline-none"
                      title="Dirección del degradado"
                    >
                      {GRADIENT_DIRECTIONS.map((direction) => (
                        <option key={direction.angle} value={direction.angle}>
                          {direction.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        handleDesignBgColorChangeRef.current?.(
                          encodeDesignBackground(
                            makeLinearBackground(customGradient.angle, [customGradient.from, customGradient.to]),
                          )
                        )
                      }
                      className="h-6 flex-1 rounded-md border border-gray-200 text-[10px] font-semibold text-gray-600 transition hover:border-blue-400 hover:text-blue-600"
                      style={{
                        background: designBackgroundToCss(
                          makeLinearBackground(customGradient.angle, [customGradient.from, customGradient.to]),
                        ),
                      }}
                      title="Aplicar degradado personalizado a todo el fondo del producto"
                    >
                      <span className="rounded bg-white/70 px-1">Aplicar</span>
                    </button>
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
      ) : null}
      {/* Las acciones contextuales viven en TextToolbar; el canvas queda libre. */}
      {false ? (
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
      ) : null}
      <Product3DModal
        open={is3DModalOpen}
        textureUrl={threeDTextureUrl}
        views={threeDViews}
        onClose={() => setIs3DModalOpen(false)}
      />
    </div>
  );
}
