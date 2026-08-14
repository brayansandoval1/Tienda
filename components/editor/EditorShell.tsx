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
import OptionsPanel from '@/components/editor/OptionsPanel';

const EditorCanvas = dynamic(() => import('@/components/editor/EditorCanvas'), { ssr: false });

export default function EditorShell({ producto, initialProduct }: { producto: Producto; initialProduct?: Product }) {
  const products = useProductStore((state) => state.products);
  // Estado para el producto actualmente seleccionado en el editor
  const [currentProduct, setCurrentProduct] = useState<Product>(
    initialProduct || products.find((p) => p.id === producto.id) || products[0],
  );
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);

  useEffect(() => {
    // La página de demo inyecta datos mock y no debe ser reemplazada durante
    // la rehidratación del store local.
    if (initialProduct) {
      setCurrentProduct(initialProduct);
      return;
    }
    const matchingProduct = products.find((p) => p.id === producto.id);
    if (matchingProduct) setCurrentProduct(matchingProduct);
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
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-40 bg-slate-50/80 p-4 backdrop-blur-sm">
        <Header />
      </header>

      <div className="flex-1 p-4">
        <div className="grid h-full grid-cols-1 gap-4 xl:grid-cols-[80px_280px_1fr_320px]">
          <SidebarIcons onOpenOptions={() => setIsOptionsOpen(true)} />
          {isOptionsOpen ? <OptionsPanel product={currentProduct} onClose={() => setIsOptionsOpen(false)} /> : <SidebarPanel />}
          <main className="relative h-full">
            <div className="flex h-full flex-col gap-4">
              <TextToolbar />
              <EditorCanvas product={currentProduct} />
            </div>
            <FloatingFooter onReset={() => {}} /> {/* FloatingFooter sin props de zoom por ahora */}
          </main>
          <ViewSelector product={currentProduct} />
        </div>
      </div>
    </div>
  );
}
