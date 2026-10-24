'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import EditorShell from '@/components/editor/EditorShell';
import { useProductStore } from '@/src/store/useProductStore';
import type { Producto } from '@/types/product';

export default function StoreEditorPage({ productId }: { productId: string }) {
  const product = useProductStore((state) => state.products.find((item) => item.id === productId));
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useProductStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useProductStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  const legacyProduct = useMemo<Producto | undefined>(() => product && ({
    id: product.id,
    nombre: product.name,
    descripcion: `Personaliza tu ${product.name.toLowerCase()} y revisa cada detalle antes de confirmar tu pedido.`,
    imagenUrl: product.views[0]?.mockupUrl ?? '',
    precio: product.price,
    variantes: product.colors?.map((color) => ({ id: color.id, nombre: color.name, color: color.name, imageUrl: color.mockupUrl, sku: `${product.id}-${color.id}` })) ?? [],
    zonasEdicion: product.views.map((view) => ({ id: view.id, nombre: view.name, top: view.printArea.y, left: view.printArea.x, width: view.printArea.width, height: view.printArea.height })),
  }), [product]);

  if (!hydrated) return <main className="grid min-h-screen place-items-center bg-[#fcfbff] text-sm text-slate-500"><div className="flex items-center gap-3 rounded-full border border-violet-100 bg-white px-5 py-3 shadow-sm"><span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />Preparando tu diseño…</div></main>;
  if (!product || !legacyProduct) return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-bold text-slate-950">Producto no disponible</h1><p className="mt-2 text-sm text-slate-600">Es posible que este producto ya no esté en el catálogo.</p><Link href="/#catalogo" className="mt-5 inline-flex rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white">Volver al catálogo</Link></div></main>;
  return <EditorShell producto={legacyProduct} initialProduct={product} />;
}
