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

      <div className="min-h-0 flex-1 px-5 pb-5 pt-3 lg:px-7">
        <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[72px_292px_minmax(520px,1fr)_312px]">
          <SidebarIcons onOpenOptions={() => setIsOptionsOpen(true)} />
          {isOptionsOpen ? <OptionsPanel product={currentProduct} onClose={() => setIsOptionsOpen(false)} /> : <SidebarPanel />}
          <main className="relative min-h-0 h-full overflow-hidden rounded-[26px] border border-slate-200/80 bg-[#e9edf2] shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="flex h-full min-h-0 flex-col gap-3 p-3">
              <TextToolbar />
              <EditorCanvas
                key={`${currentProduct.id}-${currentProduct.updatedAt ?? 0}`}
                product={currentProduct}
              />
            </div>
            <FloatingFooter onReset={() => {}} />
          </main>
          <ViewSelector product={currentProduct} />
        </div>
      </div>
    </div>
  );
}
