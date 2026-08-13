'use client';

import { useState } from 'react';
import { useProductStore, type Product } from '@/src/store/useProductStore';

interface ProductSelectorProps {
  selectedId?: string;
  onSelect?: (product: Product) => void;
}

/**
 * Panel de selección de productos. Al hacer clic en un producto emite el evento
 * global 'editor:switch-product' para que el canvas se adapte dinámicamente.
 */
export default function ProductSelector({
  selectedId,
  onSelect,
}: ProductSelectorProps) {
  const [internalId, setInternalId] = useState<string | undefined>(selectedId);
  const products = useProductStore((state) => state.products);

  const activeId = selectedId ?? internalId;

  const handleSelect = (product: Product) => {
    if (onSelect) onSelect(product);
    setInternalId(product.id);
    window.dispatchEvent(new CustomEvent('editor:switch-product', { detail: { product } }));
  };

  const preview = (product: Product) => product.views[0]?.mockupUrl ?? '';

  return (
    <div className="grid grid-cols-2 gap-2">
      {products.map((p) => (
        <div
          key={p.id}
          onClick={() => handleSelect(p)}
          className={`aspect-square w-full cursor-pointer overflow-hidden rounded-2xl bg-slate-100 transition hover:border-slate-400 ${
            activeId === p.id ? 'border-2 border-slate-900' : 'border-2 border-transparent'
          }`}
        >
          <img src={preview(p)} alt={p.name} className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}
