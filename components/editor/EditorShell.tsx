'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import type { Producto, TextOptions } from '@/types/product';
import FloatingFooter from '@/components/editor/FloatingFooter';
import Header, { type EditorStep } from '@/components/editor/Header';
import SidebarPanel from '@/components/editor/SidebarPanel';
import TextToolbar from '@/components/editor/TextToolbar';
import { useProductStore, type Product } from '@/src/store/useProductStore';
import ViewSelector from '@/components/editor/ViewSelector';
import ReviewStage from '@/components/editor/ReviewStage';
import CartDrawer from '@/components/editor/CartDrawer';
import { getDraft, saveDraft } from '@/src/utils/designDraftStorage';
import { isLikelyPrintSurfaceMesh } from '@/src/config/products';


const EditorCanvas = dynamic(() => import('@/components/editor/EditorCanvas'), { ssr: false });
const Product3DViewer = dynamic(() => import('@/components/editor/Product3DViewer'), { ssr: false });

export default function EditorShell({ producto, initialProduct }: { producto: Producto; initialProduct?: Product }) {
  const pathname = usePathname();
  // El editor interno (/editor/...) administra el catálogo. La ruta pública de
  // personalización solo permite elegir plantillas ya preparadas.
  const canManageTemplates = pathname?.startsWith('/editor/') ?? false;
  const products = useProductStore((state) => state.products);
  // Estado para el producto actualmente seleccionado en el editor
  const [currentProduct, setCurrentProduct] = useState<Product>(
    initialProduct || products.find((p) => p.id === producto.id) || products[0],
  );
  const [componentColors, setComponentColors] = useState<Record<string, string>>({});
  const initialMeshColorApplied = useRef(false);
  const [enabledComponentMeshes, setEnabledComponentMeshes] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState<EditorStep>('design');
  const [isPanoramaActive, setIsPanoramaActive] = useState(false);
  const [isUnrestrictedDesign, setIsUnrestrictedDesign] = useState(false);
  const allowPanorama = currentProduct.allowPanorama360 ?? currentProduct.views.length > 1;
  const minimumQuantity = Math.max(1, currentProduct.pricingSchema?.minimumQuantity ?? 1);
  const [quantityValid, setQuantityValid] = useState(minimumQuantity <= 1);

  useEffect(() => {
    setQuantityValid(minimumQuantity <= 1);
    const handleQuantityValidity = (event: Event) => {
      const detail = (event as CustomEvent<{ productId?: string; valid?: boolean }>).detail;
      if (detail?.productId === currentProduct.id) setQuantityValid(Boolean(detail.valid));
    };
    window.addEventListener('editor:quantity-validity', handleQuantityValidity);
    return () => window.removeEventListener('editor:quantity-validity', handleQuantityValidity);
  }, [currentProduct.id, minimumQuantity]);

  useEffect(() => {
    const resetProductColors = (event: Event) => {
      const productId = (event as CustomEvent<{ productId?: string }>).detail?.productId;
      if (productId !== currentProduct.id) return;
      const parts = currentProduct.customizableParts ?? [];
      setComponentColors(Object.fromEntries(parts.map((part) => [part.meshName, part.defaultColor || '#cbd5e1'])));
      setEnabledComponentMeshes([]);
    };
    window.addEventListener('editor:reset-component-colors', resetProductColors);
    return () => window.removeEventListener('editor:reset-component-colors', resetProductColors);
  }, [currentProduct.id, currentProduct.customizableParts]);

  useEffect(() => {
    const restoreProductColors = (event: Event) => {
      const detail = (event as CustomEvent<{
        productId?: string;
        colors?: Record<string, string>;
        enabledMeshNames?: string[];
      }>).detail;
      if (detail?.productId !== currentProduct.id) return;
      if (detail.colors) setComponentColors(detail.colors);
      if (detail.enabledMeshNames) setEnabledComponentMeshes(detail.enabledMeshNames);
    };
    window.addEventListener('editor:restore-component-colors', restoreProductColors);
    return () => window.removeEventListener('editor:restore-component-colors', restoreProductColors);
  }, [currentProduct.id]);

  useEffect(() => {
    const syncPanoramaMode = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      setIsPanoramaActive(Boolean(enabled));
      // Al volver al modo individual, también hay que volver a recortar cada
      // objeto con el área segura de la vista actual.
      if (!enabled) setIsUnrestrictedDesign(false);
    };
    window.addEventListener('editor:panorama-mode-changed', syncPanoramaMode);
    return () => window.removeEventListener('editor:panorama-mode-changed', syncPanoramaMode);
  }, []);

  const handleStepChange = (step: EditorStep) => {
    if (step === 'review' && !quantityValid) return;
    setIsPanoramaActive(false);
    setIsUnrestrictedDesign(false);
    setActiveStep(step);
  };

  const handlePanoramaToggle = () => {
    setIsPanoramaActive((active) => {
      if (active) setIsUnrestrictedDesign(false);
      return !active;
    });
  };

  useEffect(() => {
    setIsPanoramaActive(false);
    setIsUnrestrictedDesign(false);
    let initialColoredMesh: string | null = null;
    let initialColor: string | null = null;
    const shouldApplyUrlColor = !initialMeshColorApplied.current && currentProduct.id === producto.id;
    if (shouldApplyUrlColor) {
      const params = new URLSearchParams(window.location.search);
      const requestedMesh = params.get('mesh');
      const requestedColor = params.get('color');
      const requestedPart = (currentProduct.customizableParts ?? []).find((part) =>
        part.meshName === requestedMesh && part.enabled !== false
        && (part.includeInPrint ?? isLikelyPrintSurfaceMesh(part.meshName)),
      );
      if (requestedPart && requestedColor && /^#[0-9a-f]{6}$/i.test(requestedColor)) {
        initialColoredMesh = requestedPart.meshName;
        initialColor = requestedColor;
      }
      initialMeshColorApplied.current = true;
    }
    setComponentColors((current) => Object.fromEntries((currentProduct.customizableParts ?? []).map((part) => [
      part.meshName,
      shouldApplyUrlColor && initialColoredMesh === part.meshName
        ? initialColor || part.defaultColor || '#cbd5e1'
        : current[part.meshName] ?? part.defaultColor ?? '#cbd5e1',
    ])));
    if (shouldApplyUrlColor) setEnabledComponentMeshes(initialColoredMesh ? [initialColoredMesh] : []);
  }, [currentProduct.id, currentProduct.customizableParts]);

  useEffect(() => {
    const matchingProduct = products.find((p) => p.id === producto.id);
    // El store actualizado tiene prioridad para que los cambios del Admin
    // lleguen al editor sin recargar la página ni reconstruir el producto.
    if (matchingProduct) setCurrentProduct(matchingProduct);
    else if (initialProduct) setCurrentProduct(initialProduct);
    else if (products.length) setCurrentProduct(products[0]);
  }, [initialProduct, products, producto.id]);

  // Listener para el evento de cambio de producto desde ViewSelector
  useEffect(() => {
    const handleSwitchProduct = (e: Event) => {
      const customEvent = e as CustomEvent<{ product: Product }>;
      const nextProduct = customEvent.detail.product;
      if (!nextProduct || nextProduct.id === currentProduct.id) return;

      // Pedir al canvas actual que cierre su debounce y guarde la vista activa
      // antes de leer el borrador para transferirlo al producto siguiente.
      window.dispatchEvent(new Event('editor:flush-draft'));
      const sourceDraft = getDraft(currentProduct.id);
      if (sourceDraft) {
        const targetDraft = getDraft(nextProduct.id);
        const targetViews = { ...(targetDraft?.views ?? {}) };
        const sourceViewIds = new Set<string>();
        const normalize = (value?: string) => value?.trim().toLocaleLowerCase() ?? '';

        currentProduct.views.forEach((sourceView, sourceIndex) => {
          const serialized = sourceDraft.views[sourceView.id];
          if (typeof serialized !== 'string') return;
          const matchingView = nextProduct.views.find((view) => normalize(view.name) === normalize(sourceView.name))
            ?? nextProduct.views[sourceIndex];
          if (!matchingView) return;
          // Un diseño vacío no borra el trabajo que el destino ya tenía.
          try {
            if (!JSON.parse(serialized || '[]').length) return;
          } catch {
            return;
          }
          targetViews[matchingView.id] = serialized;
          sourceViewIds.add(sourceView.id);
        });

        const sourceCurrentView = currentProduct.views.find((view) => view.id === sourceDraft.currentViewId);
        const mappedCurrentView = sourceCurrentView
          ? nextProduct.views.find((view) => normalize(view.name) === normalize(sourceCurrentView.name))
            ?? nextProduct.views[currentProduct.views.indexOf(sourceCurrentView)]
          : undefined;
        const targetCurrentViewId = mappedCurrentView && sourceViewIds.has(sourceDraft.currentViewId)
          ? mappedCurrentView.id
          : targetDraft?.currentViewId && nextProduct.views.some((view) => view.id === targetDraft.currentViewId)
            ? targetDraft.currentViewId
            : nextProduct.views[0]?.id;
        if (targetCurrentViewId) {
          const canvasJSON = sourceViewIds.has(sourceDraft.currentViewId)
            ? sourceDraft.canvasJSON
            : targetDraft?.canvasJSON ?? sourceDraft.canvasJSON;
          saveDraft({
            ...(targetDraft ?? sourceDraft),
            productId: nextProduct.id,
            updatedAt: Date.now(),
            currentViewId: targetCurrentViewId,
            views: targetViews,
            canvasJSON,
          });
        }
      }
      setCurrentProduct(nextProduct);
    };
    window.addEventListener('editor:switch-product', handleSwitchProduct);
    return () => {
      window.removeEventListener('editor:switch-product', handleSwitchProduct);
    };
  }, [currentProduct]);

  return (
    <div className="flex h-screen w-screen min-h-0 flex-col overflow-hidden bg-[#f8f5fb] text-slate-900">
      <CartDrawer />
      <header className="z-40 h-14 shrink-0 px-5 lg:px-7">
        <Header activeStep={activeStep} onStepChange={handleStepChange} canContinue={quantityValid} productId={currentProduct.id} />
      </header>

      {/* Franja de herramientas contextual: barra blanca de ancho completo y fija,
          justo debajo de la navegación. Está FUERA del área del canvas, por lo que
          nunca tapa ni empuja el producto. */}
      {activeStep === 'design' && <TextToolbar isPanoramaActive={isPanoramaActive} onTogglePanorama={handlePanoramaToggle} allowPanorama={allowPanorama} isUnrestrictedDesign={isUnrestrictedDesign} onToggleUnrestrictedDesign={(enabled) => { setIsUnrestrictedDesign(enabled); setIsPanoramaActive(enabled); }} />}

      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Panel Izquierdo: herramientas de diseño */}
        <div className={`${activeStep === 'design' ? 'w-[clamp(270px,17vw,340px)]' : 'w-0 border-r-0'} h-full min-w-0 shrink-0 bg-[#fcfaff] border-r border-slate-200 flex flex-col z-10 overflow-hidden transition-[width] duration-200`} aria-hidden={activeStep !== 'design'}>
          <SidebarPanel product={currentProduct} canManageTemplates={canManageTemplates} />
        </div>

        {/* Canvas Central (Lienzo) */}
        <main className={`relative h-full min-w-0 flex-1 overflow-hidden bg-[#f8f5fb] p-2 xl:p-3 ${activeStep === 'design' ? 'grid grid-cols-1 gap-2 xl:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)] xl:gap-3' : 'flex items-center justify-center'}`}>
          {activeStep === 'design' && <div key={currentProduct.id} className="hidden min-h-0 min-w-0 xl:block"><Product3DViewer key={currentProduct.id} product={currentProduct} componentColors={componentColors} enabledMeshNames={enabledComponentMeshes} /></div>}
          <section className={`relative min-h-0 min-w-0 overflow-hidden ${activeStep === 'design' ? '' : 'h-full w-full'}`}>
          <EditorCanvas
            key={`${currentProduct.id}-${currentProduct.updatedAt ?? 0}`}
            product={currentProduct}
            workflowStep={activeStep}
            isPanoramaActive={isPanoramaActive}
            isUnrestrictedDesign={isUnrestrictedDesign}
            componentColors={componentColors}
            enabledComponentMeshes={enabledComponentMeshes}
          />
          {activeStep === 'design' && <FloatingFooter onReset={() => {}} />}
          {/* Revisar: visor de renders sobre el lienzo. El canvas sigue montado
              debajo porque ReviewStage le pide los diseños por eventos. */}
          {activeStep === 'review' && (
              <div className="absolute inset-0 z-20 bg-[#f8f5fb]">
              <ReviewStage product={currentProduct} componentColors={componentColors} enabledMeshNames={enabledComponentMeshes} />
            </div>
          )}
          </section>
        </main>

        {/* Panel Derecho: producto / compra */}
        <div className={`${activeStep === 'design' ? 'w-[clamp(250px,16vw,320px)]' : 'w-[42%] min-w-[400px] max-w-[600px]'} h-full min-w-0 shrink-0 bg-[#fcfaff] border-l border-slate-200 flex flex-col z-10 overflow-hidden transition-[width] duration-200`}>
          <ViewSelector
            product={currentProduct}
            panel={activeStep === 'review' ? 'preview' : 'options'}
            workflowStep={activeStep}
            componentColors={componentColors}
            enabledComponentMeshes={enabledComponentMeshes}
            onComponentToggle={(meshName, enabled) => {
              setEnabledComponentMeshes((current) => enabled ? [...new Set([...current, meshName])] : current.filter((name) => name !== meshName));
              window.dispatchEvent(new CustomEvent('editor:component-color-change', {
                detail: { meshName, color: componentColors[meshName] ?? '#cbd5e1', enabled },
              }));
            }}
            onComponentColorChange={(meshName, color) => {
              setComponentColors((current) => ({ ...current, [meshName]: color }));
              window.dispatchEvent(new CustomEvent('editor:component-color-change', { detail: { meshName, color } }));
            }}
          />
        </div>
      </div>
    </div>
  );
}
