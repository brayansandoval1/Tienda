'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import type { Producto, TextOptions } from '@/types/product';
import FloatingFooter from '@/components/editor/FloatingFooter';
import Header from '@/components/editor/Header';
import SidebarIcons from '@/components/editor/SidebarIcons';
import SidebarPanel from '@/components/editor/SidebarPanel';
import TextToolbar from '@/components/editor/TextToolbar';
import { PRODUCTS, type ProductConfig } from './products';
import ViewSelector from '@/components/editor/ViewSelector';

const EditorCanvas = dynamic(() => import('@/components/editor/EditorCanvas'), { ssr: false });

export default function EditorShell({ producto }: { producto: Producto }) {
  // Estado para el producto actualmente seleccionado en el editor
  const [currentProduct, setCurrentProduct] = useState(PRODUCTS.find(p => p.id === producto.id) || PRODUCTS[0]);

  // Listener para el evento de cambio de producto desde ViewSelector
  useEffect(() => {
    const handleSwitchProduct = (e: Event) => {
      const customEvent = e as CustomEvent<{ product: ProductConfig }>;
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
          <SidebarIcons /> {/* SidebarIcons ya no necesita onAddImage aquí, usa eventos */}
          <SidebarPanel /> {/* SidebarPanel ya no necesita onAddShape aquí, usa eventos */}
          <main className="relative h-full">
            <div className="flex h-full flex-col gap-4">
              <TextToolbar />
              <EditorCanvas product={currentProduct} />
            </div>
            <FloatingFooter onReset={() => {}} /> {/* FloatingFooter sin props de zoom por ahora */}
          </main>
          <ViewSelector producto={producto} initialProduct={currentProduct} />
        </div>
      </div>
    </div>
  );
}