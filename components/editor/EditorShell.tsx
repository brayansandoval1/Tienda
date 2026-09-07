'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import type { Producto, TextOptions } from '@/types/product';
import FloatingFooter from '@/components/editor/FloatingFooter';
import Header from '@/components/editor/Header';
import SidebarIcons from '@/components/editor/SidebarIcons';
import SidebarPanel from '@/components/editor/SidebarPanel';
import TextToolbar from '@/components/editor/TextToolbar';
import { useProductStore, type Product } from '@/src/store/useProductStore';
import ViewSelector from '@/components/editor/ViewSelector';


const EditorCanvas = dynamic(() => import('@/components/editor/EditorCanvas'), { ssr: false });

export default function EditorShell({ producto, initialProduct }: { producto: Producto; initialProduct?: Product }) {
  const products = useProductStore((state) => state.products);
  // Estado para el producto actualmente seleccionado en el editor
  const [currentProduct, setCurrentProduct] = useState<Product>(
    initialProduct || products.find((p) => p.id === producto.id) || products[0],
  );

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
      <header className="z-40 h-14 shrink-0 px-5 lg:px-7">
        <Header />
      </header>

      {/* Franja de herramientas contextual: barra blanca de ancho completo y fija,
          justo debajo de la navegación. Está FUERA del área del canvas, por lo que
          nunca tapa ni empuja el producto. */}
      <TextToolbar />

      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Panel Izquierdo: herramientas de diseño */}
        <div className="w-80 h-full bg-white border-r border-slate-200 flex flex-col z-10 overflow-hidden">
          <SidebarPanel product={currentProduct} />
        </div>

        {/* Canvas Central (Lienzo) */}
        <main className="flex-1 h-full bg-slate-100/50 relative flex items-center justify-center p-0 overflow-hidden">
          <EditorCanvas
            key={`${currentProduct.id}-${currentProduct.updatedAt ?? 0}`}
            product={currentProduct}
          />
          <FloatingFooter onReset={() => {}} />
        </main>

        {/* Panel Derecho: producto / compra */}
        <div className="w-80 h-full bg-white border-l border-slate-200 flex flex-col z-10 overflow-hidden">
          <ViewSelector product={currentProduct} />
        </div>
      </div>
    </div>
  );
}
