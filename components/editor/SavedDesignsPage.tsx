'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock3, Package, Sparkles } from 'lucide-react';
import { getDraft, type DesignDraft } from '@/src/utils/designDraftStorage';
import { useProductStore } from '@/src/store/useProductStore';

type SavedDraft = { draft: DesignDraft; name: string; image: string };

export default function SavedDesignsPage() {
  const products = useProductStore((state) => state.products);
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);

  useEffect(() => {
    try {
      const productIds = new Set(products.map((product) => product.id));
      const saved: SavedDraft[] = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith('design_draft_')) continue;
        const productId = key.slice('design_draft_'.length);
        if (!productIds.has(productId)) continue;
        const draft = getDraft(productId);
        if (!draft) continue;
        const hasObjects = Object.values(draft.views).some((serialized) => {
          try { return JSON.parse(serialized).length > 0; } catch { return false; }
        });
        if (!hasObjects) continue;
        const product = products.find((item) => item.id === productId);
        if (!product) continue;
        const viewImage = draft.thumbnails?.[draft.currentViewId] || product.views.find((view) => view.id === draft.currentViewId)?.mockupUrl || product.views[0]?.mockupUrl || '';
        saved.push({ draft, name: product.name, image: viewImage });
      }
      setDrafts(saved.sort((a, b) => b.draft.updatedAt - a.draft.updatedAt));
    } catch {
      setDrafts([]);
    }
  }, [products]);

  return <main className="min-h-screen bg-[#f8f5fb] px-5 py-10 text-slate-900 sm:px-8">
    <div className="mx-auto max-w-5xl">
      <Link href="/#catalogo" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-violet-700"><ArrowLeft size={17} /> Volver al catálogo</Link>
      <div className="mt-8 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Sparkles size={21} /></span><div><h1 className="text-2xl font-bold">Mis diseños guardados</h1><p className="mt-1 text-sm text-slate-600">Tus borradores se guardan automáticamente en este navegador.</p></div></div>
      {drafts.length ? <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{drafts.map(({ draft, name, image }) => <article key={draft.productId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="grid aspect-[4/3] place-items-center bg-slate-50 p-4">{image ? <img src={image} alt={`Vista previa de ${name}`} className="h-full w-full object-contain" /> : <Package size={38} className="text-slate-300" />}</div><div className="p-4"><h2 className="truncate font-semibold">{name}</h2><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 size={13} /> Guardado {new Date(draft.updatedAt).toLocaleString('es-MX')}</p><p className="mt-1 text-xs text-slate-500">{Object.keys(draft.views).length} vistas</p><Link href={`/editor/${draft.productId}`} className="mt-4 inline-flex w-full justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">Continuar diseño</Link></div></article>)}</div> : <section className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white/80 px-6 py-14 text-center"><Sparkles className="mx-auto text-violet-500" size={30} /><h2 className="mt-3 font-semibold">Todavía no tienes diseños guardados</h2><p className="mt-1 text-sm text-slate-500">Cuando empieces un diseño, aparecerá aquí automáticamente.</p><Link href="/#catalogo" className="mt-5 inline-flex rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white">Explorar catálogo</Link></section>}
    </div>
  </main>;
}
