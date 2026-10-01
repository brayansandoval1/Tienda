'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import type { Producto, TextOptions } from '@/types/product';
import FloatingFooter from '@/components/editor/FloatingFooter';
import Header, { type EditorStep } from '@/components/editor/Header';
import SidebarPanel from '@/components/editor/SidebarPanel';
import TextToolbar from '@/components/editor/TextToolbar';
import { useProductStore, type Product } from '@/src/store/useProductStore';
import ViewSelector from '@/components/editor/ViewSelector';
import ReviewStage from '@/components/editor/ReviewStage';
import CartDrawer from '@/components/editor/CartDrawer';


const EditorCanvas = dynamic(() => import('@/components/editor/EditorCanvas'), { ssr: false });
const Product3DViewer = dynamic(() => import('@/components/editor/Product3DViewer'), { ssr: false });

export default function EditorShell({ producto, initialProduct }: { producto: Producto; initialProduct?: Product }) {
  const products = useProductStore((state) => state.products);
  // Estado para el producto actualmente seleccionado en el editor
  const [currentProduct, setCurrentProduct] = useState<Product>(
    initialProduct || products.find((p) => p.id === producto.id) || products[0],
  );
  const [activeStep, setActiveStep] = useState<EditorStep>('design');

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
      setCurrentProduct(customEvent.detail.product);
    };
    window.addEventListener('editor:switch-product', handleSwitchProduct);
    return () => {
      window.removeEventListener('editor:switch-product', handleSwitchProduct);
    };
  }, []);

  return (
    <div className="flex h-screen w-screen min-h-0 flex-col overflow-hidden bg-slate-50 text-slate-900">
      <CartDrawer />
      <header className="z-40 h-14 shrink-0 px-5 lg:px-7">
        <Header activeStep={activeStep} onStepChange={setActiveStep} />
      </header>

      {/* Franja de herramientas contextual: barra blanca de ancho completo y fija,
          justo debajo de la navegación. Está FUERA del área del canvas, por lo que
          nunca tapa ni empuja el producto. */}
      {activeStep === 'design' && <TextToolbar />}

      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Panel Izquierdo: herramientas de diseño */}
        <div className={`${activeStep === 'design' ? 'w-80' : 'w-0 border-r-0'} h-full bg-white border-r border-slate-200 flex flex-col z-10 overflow-hidden transition-[width] duration-200`} aria-hidden={activeStep !== 'design'}>
          <SidebarPanel product={currentProduct} />
        </div>

        {/* Canvas Central (Lienzo) */}
        <main className={`relative h-full min-w-0 flex-1 overflow-hidden bg-slate-100/50 p-2 ${activeStep === 'design' ? 'grid grid-cols-1 gap-2 lg:grid-cols-2' : 'flex items-center justify-center'}`}>
          {activeStep === 'design' && <div key={currentProduct.id} className="hidden min-h-0 min-w-0 lg:block"><Product3DViewer key={currentProduct.id} product={currentProduct} /></div>}
          <section className={`relative min-h-0 min-w-0 overflow-hidden ${activeStep === 'design' ? '' : 'h-full w-full'}`}>
          <EditorCanvas
            key={`${currentProduct.id}-${currentProduct.updatedAt ?? 0}`}
            product={currentProduct}
            workflowStep={activeStep}
          />
          {activeStep === 'design' && <FloatingFooter onReset={() => {}} />}
          {/* Revisar: visor de renders sobre el lienzo. El canvas sigue montado
              debajo porque ReviewStage le pide los diseños por eventos. */}
          {activeStep === 'review' && (
            <div className="absolute inset-0 z-20 bg-slate-50">
              <ReviewStage product={currentProduct} />
            </div>
          )}
          </section>
        </main>

        {/* Panel Derecho: producto / compra */}
        <div className={`${activeStep === 'design' ? 'w-80' : 'w-[42%] min-w-[400px] max-w-[600px]'} h-full bg-white border-l border-slate-200 flex flex-col z-10 overflow-hidden transition-[width] duration-200`}>
          <ViewSelector product={currentProduct} panel={activeStep === 'review' ? 'preview' : 'options'} workflowStep={activeStep} />
        </div>
      </div>
    </div>
  );
}
