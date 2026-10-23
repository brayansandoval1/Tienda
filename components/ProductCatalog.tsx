'use client';

import Link from 'next/link';
import { Heart, Image as ImageIcon, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useProductStore, type Product } from '@/src/store/useProductStore';

type CatalogProduct = Product & { catalogImages: string[] };

/** Use the composed lifestyle cover first; never guess an asset from the product name. */
export function getProductImage(product: Product) {
  return getProductImages(product)[0] ?? '';
}

function getProductImages(product: Product) {
  return [...new Set([
    product.catalogCoverUrl,
    ...product.views.map((view) => view.mockupUrl),
    ...(product.colors ?? []).map((color) => color.mockupUrl),
  ].filter((url): url is string => Boolean(url)))];
}

function CatalogCard({ product, favorite, onToggleFavorite }: { product: CatalogProduct; favorite: boolean; onToggleFavorite: (id: string) => void }) {
  const [imageIndex, setImageIndex] = useState(0);
  const imageSrc = product.catalogImages[imageIndex] ?? '';
  const isShowingCatalogCover = imageIndex === 0 && Boolean(product.catalogCoverUrl);

  useEffect(() => setImageIndex(0), [product.catalogImages]);

  return (
    <article className="group relative overflow-hidden rounded-[1.6rem] border border-white bg-white/85 p-2 shadow-[0_15px_40px_rgba(109,88,150,.08)] transition duration-300 hover:-translate-y-1.5 hover:border-violet-200 hover:shadow-[0_24px_55px_rgba(139,92,246,.16)]">
      <Link href={`/producto/${product.id}`} aria-label={`Ver detalles de ${product.name}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[1.2rem] bg-[radial-gradient(circle_at_50%_18%,rgba(221,214,254,.9),transparent_34%),linear-gradient(145deg,#fff9fc,#f2eeff_62%,#e9f4ff)] sm:aspect-[1.08]">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={`${product.name}${isShowingCatalogCover ? ' con diseño y fondo de escena' : ''}`}
              loading="lazy"
              decoding="async"
              onError={() => setImageIndex((index) => index + 1)}
              className={`h-full w-full transition duration-700 group-hover:scale-[1.035] ${isShowingCatalogCover ? 'object-cover' : 'object-contain p-5 drop-shadow-[0_22px_18px_rgba(76,55,120,.23)]'}`}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-violet-300">
              <div className="text-center"><ImageIcon className="mx-auto" size={32} strokeWidth={1.4} /><span className="mt-2 block text-xs font-medium text-slate-400">Imagen próximamente</span></div>
            </div>
          )}
          <span className="absolute left-3 top-3 z-[1] rounded-full border border-white/80 bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-700 shadow-sm backdrop-blur">
            {product.category || 'Personalizable'}
          </span>
          {isShowingCatalogCover && <span className="absolute bottom-3 left-3 z-[1] inline-flex items-center gap-1 rounded-full border border-white/70 bg-slate-900/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur"><Sparkles size={12} /> Diseño destacado</span>}
        </div>
      </Link>
      <button type="button" onClick={() => onToggleFavorite(product.id)} aria-label={favorite ? `Quitar ${product.name} de favoritos` : `Agregar ${product.name} a favoritos`} aria-pressed={favorite} className={`absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/90 shadow-md backdrop-blur transition hover:scale-105 ${favorite ? 'bg-rose-500 text-white' : 'bg-white/90 text-slate-600 hover:text-rose-500'}`}><Heart size={19} fill={favorite ? 'currentColor' : 'none'} /></button>
      <div className="px-3 pb-2 pt-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-[15px] font-semibold tracking-[-.02em] text-slate-800">{product.name}</h3>
          <p className="shrink-0 text-sm font-bold text-violet-700">${product.price.toFixed(2)}</p>
        </div>
        <p className="mt-1.5 line-clamp-2 min-h-9 text-xs leading-5 text-slate-500">{product.description || product.category}</p>
      </div>
    </article>
  );
}

export default function ProductCatalog() {
  const products = useProductStore((state) => state.products);
  const [category, setCategory] = useState('Todos');
  const [query, setQuery] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedFavorites = JSON.parse(window.localStorage.getItem('stylecute:favorites') ?? '[]');
      if (Array.isArray(storedFavorites)) setFavoriteIds(storedFavorites.filter((id): id is string => typeof id === 'string'));
    } catch { /* Una preferencia local dañada no debe bloquear el catálogo. */ }
    setFavoritesLoaded(true);
  }, []);

  const categories = useMemo(() => [...new Set(products
    .filter((product) => product.isActive !== false)
    .map((product) => product.category.trim())
    .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es-MX')), [products]);

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es-MX');
    return products
      .filter((product) => product.isActive !== false)
      .filter((product) => category === 'Todos' || product.category.trim() === category)
      .filter((product) => !needle || `${product.name} ${product.category}`.toLocaleLowerCase('es-MX').includes(needle))
      .map((product) => ({ ...product, catalogImages: getProductImages(product) }));
  }, [category, products, query]);

  const favoriteProducts = useMemo(() => products
    .filter((product) => product.isActive !== false && favoriteIds.includes(product.id))
    .map((product) => ({ ...product, catalogImages: getProductImages(product) })), [favoriteIds, products]);

  const toggleFavorite = (productId: string) => {
    const nextFavorites = favoriteIds.includes(productId)
      ? favoriteIds.filter((id) => id !== productId)
      : [...favoriteIds, productId];
    setFavoriteIds(nextFavorites);
    try { window.localStorage.setItem('stylecute:favorites', JSON.stringify(nextFavorites)); } catch { /* La lista se mantiene activa durante esta visita. */ }
  };

  useEffect(() => {
    if (category !== 'Todos' && !categories.includes(category)) setCategory('Todos');
  }, [categories, category]);

  return <>
    <section id="catalogo" className="premium-grid relative scroll-mt-24 overflow-hidden bg-[#fdfaff] px-5 py-24 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-200/35 blur-[110px]" />
      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.24em] text-violet-500">Catálogo de productos</p>
            <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-[-.055em] text-slate-800 sm:text-5xl">Elige el objeto.<br /><span className="text-slate-400">Hazlo irrepetible.</span></h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-500">Explora nuestros productos y personaliza el diseño a tu gusto.</p>
          </div>
          <label className="relative block w-full max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-violet-400" size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar productos" aria-label="Buscar productos" className="w-full rounded-xl border border-white bg-white/90 py-3 pl-11 pr-4 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-4 focus:ring-violet-100" />
          </label>
        </div>

        {categories.length > 0 && <div className="mt-9 flex flex-wrap items-center gap-2" aria-label="Filtrar por categoría">
          <SlidersHorizontal size={15} className="mr-1 text-violet-400" />
          {['Todos', ...categories].map((item) => <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${category === item ? 'border-purple-600 bg-purple-600 text-white shadow-lg shadow-purple-500/25' : 'border-white bg-white/80 text-slate-500 shadow-sm hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700'}`}>{item}</button>)}
        </div>}

        {visibleProducts.length ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visibleProducts.map((product) => <CatalogCard key={product.id} product={product} favorite={favoriteIds.includes(product.id)} onToggleFavorite={toggleFavorite} />)}</div> : (
          <div className="mt-10 rounded-3xl border border-dashed border-violet-200 bg-white/70 py-16 text-center">
            <p className="font-semibold text-slate-700">{products.some((product) => product.isActive !== false) ? 'No encontramos productos con esa búsqueda' : 'Pronto habrá productos disponibles'}</p>
            {products.some((product) => product.isActive !== false) && <button type="button" onClick={() => { setQuery(''); setCategory('Todos'); }} className="mt-2 text-sm font-semibold text-violet-600">Limpiar búsqueda</button>}
          </div>
        )}
      </div>
    </section>
    {favoritesLoaded && <section id="favoritos" className="scroll-mt-24 border-t border-violet-100 bg-white px-5 py-16 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-rose-500">Tu colección</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.045em] text-slate-800">Mis favoritos <span className="ml-1 text-xl font-medium text-slate-400">{favoriteProducts.length}</span></h2><p className="mt-2 text-sm text-slate-500">Guarda aquí los productos que quieras volver a ver.</p></div><Heart className="mb-1 text-rose-400" size={25} /></div>
        {favoriteProducts.length ? <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{favoriteProducts.map((product) => <CatalogCard key={product.id} product={product} favorite onToggleFavorite={toggleFavorite} />)}</div> : <div className="mt-6 rounded-2xl border border-dashed border-rose-200 bg-rose-50/45 px-5 py-8 text-center"><p className="text-sm font-semibold text-slate-700">Todavía no guardas favoritos</p><p className="mt-1 text-xs text-slate-500">Pulsa el corazón de cualquier producto para añadirlo aquí.</p></div>}
      </div>
    </section>}
  </>;
}
