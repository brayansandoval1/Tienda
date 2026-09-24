'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import EditorShell from '@/components/editor/EditorShell';
import { useProductStore } from '@/src/store/useProductStore';
import type { Producto } from '@/types/product';

export default function StoreEditorPage({ productId }: { productId: string }) {
  const product = useProductStore((state) => state.products.find((item) => item.id === productId));
  const legacyProduct = useMemo<Producto | undefined>(() => product && ({
    id: product.id,
    nombre: product.name,
    descripcion: `Personaliza tu ${product.name.toLowerCase()} y revisa cada detalle antes de confirmar tu pedido.`,
    imagenUrl: product.views[0]?.mockupUrl ?? '',
    precio: product.price,
    variantes: product.colors?.map((color) => ({ id: color.id, nombre: color.name, color: color.name, imageUrl: color.mockupUrl, sku: `${product.id}-${color.id}` })) ?? [],
    zonasEdicion: product.views.map((view) => ({ id: view.id, nombre: view.name, top: view.printArea.y, left: view.printArea.x, width: view.printArea.width, height: view.printArea.height })),
  }), [product]);

  if (!product || !legacyProduct) return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-bold text-slate-950">Producto no disponible</h1><p className="mt-2 text-sm text-slate-600">Es posible que este producto ya no esté en el catálogo.</p><Link href="/#catalogo" className="mt-5 inline-flex rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white">Volver al catálogo</Link></div></main>;
  return <EditorShell producto={legacyProduct} initialProduct={product} />;
}
