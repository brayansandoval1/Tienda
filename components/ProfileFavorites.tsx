'use client';

import Link from 'next/link';
import { Heart, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useProductStore } from '@/src/store/useProductStore';

const FAVORITES_KEY = 'stylecute:favorites';

export default function ProfileFavorites() {
  const products = useProductStore((state) => state.products);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? '[]');
      if (Array.isArray(stored)) setFavoriteIds(stored.filter((id): id is string => typeof id === 'string'));
    } catch { /* Una lista dañada se muestra como vacía sin interrumpir el perfil. */ }
    setLoaded(true);
  }, []);

  const favorites = useMemo(() => products.filter((product) => product.isActive !== false && favoriteIds.includes(product.id)), [favoriteIds, products]);

  const removeFavorite = (productId: string) => {
    const next = favoriteIds.filter((id) => id !== productId);
    setFavoriteIds(next);
    try { window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { /* El estado de esta visita sigue actualizado. */ }
  };

  return <section aria-labelledby="profile-favorites-title">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-rose-500">Tu colección</p><h2 id="profile-favorites-title" className="mt-2 text-2xl font-semibold tracking-[-.045em] text-slate-900">Mis favoritos <span className="ml-1 text-lg font-medium text-slate-400">{loaded ? favorites.length : '—'}</span></h2><p className="mt-1 text-sm text-slate-500">Los productos que guardas en el catálogo aparecen aquí.</p></div><Heart className="text-rose-400" size={23} /></div>
    {!loaded ? <div className="mt-5 h-32 animate-pulse rounded-2xl bg-slate-100" /> : favorites.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2">{favorites.map((product) => {
      const image = [product.catalogCoverUrl, ...product.views.map((view) => view.mockupUrl), ...(product.colors ?? []).map((color) => color.mockupUrl)].find((url) => Boolean(url)) ?? '';
      return <article key={product.id} className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition hover:border-violet-200 hover:shadow-md">
        <Link href={`/producto/${product.id}`} className="block">
          <div className="grid aspect-[1.6] place-items-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_18%,rgba(221,214,254,.8),transparent_36%),linear-gradient(145deg,#fff9fc,#f2eeff_62%,#e9f4ff)]">{image ? <img src={image} alt={product.name} className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.03]" /> : <ImageIcon size={28} className="text-violet-300" />}</div>
          <div className="flex items-start justify-between gap-3 px-1 pt-3"><div><h3 className="text-sm font-semibold text-slate-800">{product.name}</h3><p className="mt-1 text-xs text-slate-500">{product.category}</p></div><span className="shrink-0 text-sm font-bold text-violet-700">${product.price.toFixed(2)}</span></div>
        </Link>
        <button type="button" onClick={() => removeFavorite(product.id)} aria-label={`Quitar ${product.name} de favoritos`} title="Quitar de favoritos" className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full border border-white bg-white/95 text-rose-500 shadow-sm transition hover:bg-rose-50"><Trash2 size={16} /></button>
      </article>;
    })}</div> : <div className="mt-5 rounded-2xl border border-dashed border-rose-200 bg-rose-50/45 px-5 py-8 text-center"><p className="text-sm font-semibold text-slate-700">Todavía no guardas favoritos</p><p className="mt-1 text-xs text-slate-500">En el catálogo, pulsa el corazón de un producto para añadirlo a tu colección.</p><Link href="/#catalogo" className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-700">Ir al catálogo</Link></div>}
  </section>;
}
