'use client';

import { useState } from 'react';
import type { Producto } from '@/types/product';
import { PRODUCTS, type ProductConfig } from '@/src/config/products';
import ProductSelector from '@/components/editor/ProductSelector';

export default function ViewSelector({ producto, initialProduct }: { producto: Producto; initialProduct?: ProductConfig }) {
  // Usa initialProduct para el estado inicial, pero luego gestiona los cambios internamente
  const [selectedProduct, setSelectedProduct] = useState<ProductConfig>(
    initialProduct || PRODUCTS.find((p) => p.id === producto.id) || PRODUCTS[0],
  );
  
  const handleProductSelect = (product: ProductConfig) => {
    setSelectedProduct(product);
    window.dispatchEvent(new CustomEvent('editor:switch-product', { detail: { product } }));
  };

  const previewImage = selectedProduct.views[0]?.overlayImage ?? '';

  return (
    <aside className="w-full max-w-[320px] space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Vista Rápida</p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          <div className="aspect-square w-full overflow-hidden rounded-2xl bg-slate-100">
            <img src={previewImage} alt={selectedProduct.name} className="h-full w-full object-cover" />
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-slate-900">{selectedProduct.name}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Desde <span className="font-medium text-slate-700">${selectedProduct.price}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Productos</p>
        <ProductSelector selectedId={selectedProduct.id} onSelect={handleProductSelect} />
      </div>
    </aside>
  );
}
