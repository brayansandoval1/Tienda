'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Box, Check, ChevronRight, Minus, PackageCheck, PencilRuler, Plus, Sparkles } from 'lucide-react';
import CartDrawer from '@/components/editor/CartDrawer';
import StorefrontHeader from '@/components/StorefrontHeader';
import type { FabricCanvasLike, PrintAreaBounds, PrintViewSnapshot } from '@/components/editor/Product3DViewer';
import { useCartStore } from '@/src/store/useCartStore';
import { useProductStore, type Product } from '@/src/store/useProductStore';
import type { Draft3DViewPose } from '@/src/utils/designDraftStorage';
import { getProductDesignTemplate } from '@/src/utils/templateStorage';

const Product3DViewer = dynamic(() => import('@/components/editor/Product3DViewer'), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[420px] place-items-center text-sm text-slate-500">Preparando el modelo 3D…</div>,
});

type PreviewDesign = {
  canvas: FabricCanvasLike;
  snapshots: PrintViewSnapshot[];
  pose?: Draft3DViewPose;
};

const PREVIEW_CANVAS_SIZE = 800;
const PRODUCT_COLOR_PALETTE = [
  { name: 'Turquesa', color: '#128b91' }, { name: 'Azul marino', color: '#172b54' },
  { name: 'Gris', color: '#a6a6a6' }, { name: 'Amarillo', color: '#ffdc55' },
  { name: 'Negro', color: '#111111' }, { name: 'Azul cielo', color: '#78b3d0' },
  { name: 'Aqua', color: '#4bb8b4' }, { name: 'Morado', color: '#9275ad' },
  { name: 'Verde', color: '#4e9d59' }, { name: 'Coral', color: '#f58b82' },
  { name: 'Azul', color: '#146da7' }, { name: 'Rosa', color: '#f35d91' },
  { name: 'Verde lima', color: '#8cc63e' }, { name: 'Rojo', color: '#ed1c24' },
];

function makeDesignSnapshots(product: Product, objectsByView: Record<string, any[]>): PrintViewSnapshot[] {
  return product.views.map((view, index) => {
    const printArea = view.printArea;
    const isPercent = view.printAreaUnit === 'percent';
    const scale = isPercent ? PREVIEW_CANVAS_SIZE / 100 : 1;
    const left = Number(printArea.x ?? printArea.left ?? 0) * scale;
    const top = Number(printArea.y ?? printArea.top ?? 0) * scale;
    const area3D = view.printArea3D;
    const projectionArea: PrintAreaBounds | undefined = area3D ? {
      left: Number(area3D.x ?? area3D.left ?? 0),
      top: Number(area3D.y ?? area3D.top ?? 0),
      width: Number(area3D.width),
      height: Number(area3D.height),
      shape: area3D.shape,
      radius: area3D.radius,
      polygon: area3D.nodes ?? area3D.polygon,
    } : undefined;

    return {
      viewId: view.id,
      viewName: view.name,
      viewIndex: index,
      viewCount: product.views.length,
      area: {
        left,
        top,
        width: Number(printArea.width) * scale,
        height: Number(printArea.height) * scale,
        canvasWidth: PREVIEW_CANVAS_SIZE,
        canvasHeight: PREVIEW_CANVAS_SIZE,
        shape: printArea.shape,
        radius: printArea.radius,
        polygon: printArea.polygon?.map((point) => ({ x: point.x * scale, y: point.y * scale })),
        viewId: view.id,
        viewName: view.name,
        viewIndex: index,
        viewCount: product.views.length,
      },
      projectionArea,
      objects: objectsByView[view.id] ?? [],
    };
  });
}

function ProductModelPreview({ product, componentColors, enabledMeshNames }: { product: Product; componentColors: Record<string, string>; enabledMeshNames: string[] }) {
  const [preview, setPreview] = useState<PreviewDesign | null>(null);
  const [status, setStatus] = useState('Cargando diseño base…');

  useEffect(() => {
    let cancelled = false;
    let canvas: any;
    setPreview(null);

    const load = async () => {
      try {
        const firstViewId = product.views[0]?.id;
        const assigned = Boolean(firstViewId && product.designTemplate?.viewIds.includes(firstViewId));
        const template = assigned ? await getProductDesignTemplate(product.id) : null;
        const objectsByView = Object.fromEntries(product.views.map((view) => {
          let objects: any[] = [];
          try {
            const serialized = template?.views[view.id];
            const parsed = serialized ? JSON.parse(serialized) : [];
            if (Array.isArray(parsed)) objects = parsed;
          } catch { /* Ignora una vista dañada; el modelo sigue siendo navegable. */ }
          return [view.id, objects];
        }));
        const fabricModule = await import('fabric');
        if (cancelled) return;
        const fabric: any = (fabricModule as any).fabric || fabricModule;
        canvas = new fabric.StaticCanvas(document.createElement('canvas'), {
          width: PREVIEW_CANVAS_SIZE,
          height: PREVIEW_CANVAS_SIZE,
          backgroundColor: 'transparent',
          renderOnAddRemove: false,
        });
        await new Promise<void>((resolve) => canvas.loadFromJSON({ version: '5.3.0', objects: objectsByView[firstViewId ?? ''] ?? [] }, resolve));
        if (cancelled) { canvas.dispose(); return; }
        canvas.renderAll();
        const snapshots = makeDesignSnapshots(product, objectsByView);
        const hasAssignedDesign = Boolean(assigned && template && Object.values(objectsByView).some((objects) => objects.length));
        setPreview({
          canvas: canvas as FabricCanvasLike,
          snapshots,
          pose: firstViewId ? template?.modelPoses?.[firstViewId] : undefined,
        });
        setStatus(hasAssignedDesign ? 'Diseño base aplicado al modelo.' : 'Modelo listo. Este producto todavía no tiene un diseño base asignado.');
      } catch (error) {
        console.error('[product-detail] No se pudo cargar el diseño base en el modelo 3D.', { productId: product.id, error });
        setStatus('No se pudo cargar el diseño base. El modelo 3D sigue disponible.');
      }
    };

    void load();
    return () => { cancelled = true; canvas?.dispose?.(); };
  }, [product]);

  const activeView = product.views[0];
  const area = activeView?.printArea;
  const area3D = activeView?.printArea3D;
  const isPercent = activeView?.printAreaUnit === 'percent';
  const unitScale = isPercent ? 8 : 1;
  const safeArea: PrintAreaBounds = {
    left: Number(area?.x ?? area?.left ?? 0) * unitScale,
    top: Number(area?.y ?? area?.top ?? 0) * unitScale,
    width: Number(area?.width ?? 100) * unitScale,
    height: Number(area?.height ?? 100) * unitScale,
    canvasWidth: PREVIEW_CANVAS_SIZE,
    canvasHeight: PREVIEW_CANVAS_SIZE,
    shape: area?.shape,
    radius: area?.radius,
    polygon: area?.polygon?.map((point) => ({ x: point.x * unitScale, y: point.y * unitScale })),
    viewId: activeView?.id,
    viewName: activeView?.name,
    viewIndex: 0,
    viewCount: product.views.length,
    printArea3D: area3D ? {
      x: Number(area3D.x ?? area3D.left ?? 0),
      y: Number(area3D.y ?? area3D.top ?? 0),
      width: Number(area3D.width),
      height: Number(area3D.height),
      shape: area3D.shape,
      radius: area3D.radius,
      polygon: area3D.nodes ?? area3D.polygon,
      nodes: area3D.nodes ?? area3D.polygon,
    } : undefined,
  };

  const hasModel = Boolean(product.model3dUrl?.trim() || product.id === 'termo-acero-inoxidable');
  if (!hasModel) return <div className="grid h-[430px] place-items-center rounded-[1.75rem] border border-dashed border-violet-200 bg-violet-50/60 p-8 text-center sm:h-[560px]"><div><Box className="mx-auto text-violet-400" size={34} /><p className="mt-4 font-semibold text-slate-800">Modelo 3D no configurado</p><p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">Agrega el archivo GLB de este producto desde administración para mostrarlo aquí.</p></div></div>;

  return <div className="relative h-[430px] overflow-hidden rounded-[1.75rem] border border-violet-100 bg-[#f3f1f8] shadow-inner sm:h-[560px] lg:h-[min(68vw,720px)] lg:min-h-[560px]">
    <Product3DViewer
      product={product}
      componentColors={componentColors}
      enabledMeshNames={enabledMeshNames}
      showSafeAreaGuide
      safeArea={safeArea}
      activeViewIndex={0}
      activeViewName={activeView?.name}
      designCanvas={preview?.canvas}
      designViewSnapshots={preview?.snapshots}
      viewPose={preview?.pose}
    />
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/80 bg-white/85 px-4 py-2 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">Arrastra el producto para girarlo</div>
    <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-full border border-white/80 bg-white/85 px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-sm backdrop-blur">{status}</div>
  </div>;
}

export default function ProductDetailPage() {
  const params = useParams<{ productId: string }>();
  const productId = params.productId;
  const product = useProductStore((state) => state.products.find((item) => item.id === productId));
  const addCatalogItem = useCartStore((state) => state.addCatalogItem);
  const colorableParts = (product?.customizableParts ?? []).filter((part) => part.enabled !== false);
  const enabledMeshNames = colorableParts.map((part) => part.meshName);
  // El primer render debe coincidir en servidor y navegador. Zustand puede
  // terminar la hidratación de localStorage antes de que este efecto se monte.
  const [hydrated, setHydrated] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [componentColors, setComponentColors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (useProductStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useProductStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  const minimumQuantity = Math.max(1, Math.floor(product?.pricingSchema?.minimumQuantity ?? 1));
  useEffect(() => setQuantity(minimumQuantity), [minimumQuantity, productId]);
  useEffect(() => setAddedToCart(false), [productId]);
  useEffect(() => {
    setSelectedOptions({});
  }, [productId, product?.options]);
  useEffect(() => {
    setComponentColors(Object.fromEntries((product?.customizableParts ?? [])
      .filter((part) => part.enabled !== false)
      .map((part) => [part.meshName, part.defaultColor || '#cbd5e1'])));
  }, [productId, product?.customizableParts]);

  const selectedOptionValues = useMemo(() => (product?.options ?? []).flatMap((option) => {
    const value = option.values.find((item) => item.id === selectedOptions[option.id]);
    return value ? [{ optionId: option.id, optionName: option.name, valueId: value.id, valueLabel: value.label, priceModifier: Number(value.priceModifier) || 0 }] : [];
  }), [product?.options, selectedOptions]);
  const isStandardSelected = selectedOptionValues.length === 0;
  const price = Math.max(0, (product?.basePrice ?? product?.price ?? 0) + selectedOptionValues.reduce((sum, value) => sum + value.priceModifier, 0));
  const total = useMemo(() => price * quantity, [price, quantity]);

  const addProductToCart = () => {
    if (!product) return;
    const modelCanvas = document.querySelector(`[aria-label="Visor 3D de ${CSS.escape(product.name)}"] canvas`) as HTMLCanvasElement | null;
    let modelImage: string | undefined;
    try { modelImage = modelCanvas?.toDataURL('image/webp', 0.78); } catch { /* El artículo sigue pudiendo agregarse aunque no se capture la vista. */ }
    addCatalogItem({
      kind: 'catalog',
      id: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      imageUrl: modelImage,
      price,
      quantity,
      minimumQuantity,
      totalPrice: total,
      selectedOptions: selectedOptionValues,
      selectedColors: colorableParts.map((part) => ({ meshName: part.meshName, label: part.label, color: componentColors[part.meshName] ?? part.defaultColor ?? '#cbd5e1' })),
      addedAt: Date.now(),
    });
    setAddedToCart(true);
    window.dispatchEvent(new CustomEvent('store:open-cart'));
  };

  if (!hydrated) return <main className="grid min-h-screen place-items-center bg-[#fcfbff] text-sm text-slate-500">Cargando producto…</main>;
  if (!product || product.isActive === false) return <main className="min-h-screen bg-[#fcfbff] text-slate-800"><StorefrontHeader /><CartDrawer /><section className="mx-auto grid min-h-[75vh] max-w-3xl place-items-center px-5 pt-24 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-violet-600"><Box /></span><h1 className="mt-5 text-2xl font-semibold">Este producto no está disponible</h1><p className="mt-2 text-sm text-slate-500">Puede que haya sido retirado del catálogo.</p><Link href="/#catalogo" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-semibold text-white">Volver al catálogo <ArrowLeft size={16} /></Link></div></section></main>;

  const description = product.description?.trim() || 'Un producto listo para convertirse en una pieza única. Explora el diseño y ajústalo a tu estilo.';

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <StorefrontHeader />
      <CartDrawer />
      <div className="mx-auto max-w-[1440px] px-4 pb-20 pt-24 sm:px-8 lg:px-12 lg:pt-28">
        <nav aria-label="Ruta de navegación" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="transition hover:text-violet-700">Inicio</Link><ChevronRight size={15} />
          <Link href="/#catalogo" className="transition hover:text-violet-700">Catálogo</Link><ChevronRight size={15} />
          <span className="text-slate-800">{product.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,.85fr)] lg:gap-12">
          <section aria-label="Modelo 3D del producto" className="min-w-0"><ProductModelPreview product={product} componentColors={componentColors} enabledMeshNames={enabledMeshNames} /></section>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-violet-600">{product.category || 'Producto personalizable'}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">${price.toFixed(2)} <span className="text-sm font-normal text-slate-500">por pieza</span></p>
            <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-[-.04em] text-slate-900 sm:text-4xl">{product.name}</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>

            <div className="mt-7 rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
              <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-violet-600 shadow-sm"><PencilRuler size={19} /></span><div><p className="text-sm font-semibold text-slate-800">Tu diseño, a tu manera</p><p className="mt-1 text-sm leading-5 text-slate-600">El modelo muestra el diseño base. Puedes editarlo antes de terminar tu pedido.</p></div></div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <label htmlFor="product-quantity" className="text-sm font-medium text-slate-700">Cantidad</label>
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button type="button" onClick={() => setQuantity((value) => Math.max(minimumQuantity, value - 1))} disabled={quantity <= minimumQuantity} aria-label="Reducir cantidad" className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-white disabled:opacity-35"><Minus size={16} /></button>
                <input id="product-quantity" type="number" min={minimumQuantity} step="1" value={quantity} onChange={(event) => setQuantity(Math.max(minimumQuantity, Math.floor(Number(event.target.value) || minimumQuantity)))} className="h-9 w-16 bg-transparent text-center text-sm font-semibold outline-none" />
                <button type="button" onClick={() => setQuantity((value) => value + 1)} aria-label="Aumentar cantidad" className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-white"><Plus size={16} /></button>
              </div>
            </div>
            {minimumQuantity > 1 && <p className="mt-1 text-right text-xs text-slate-500">Pedido mínimo: {minimumQuantity} piezas</p>}
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm"><span className="text-slate-500">Subtotal estimado</span><strong className="text-slate-900">${total.toFixed(2)}</strong></div>

            <button type="button" onClick={addProductToCart} className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-amber-300 px-6 py-4 text-base font-semibold text-slate-900 shadow-lg shadow-amber-200/50 transition hover:-translate-y-0.5 hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200">
              {addedToCart ? <><Check size={19} /> Agregado al carrito</> : <><PackageCheck size={19} /> Comprar producto</>}
            </button>
            <Link href={`/editor/${product.id}`} className="mt-3 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-indigo-800 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-900/15 transition hover:-translate-y-0.5 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200">
              Personalizar este diseño <ArrowUpRight size={18} />
            </Link>

            {colorableParts.length > 0 && <section className="mt-7 border-t border-slate-200 pt-6" aria-label="Colores del producto">
              <h2 className="text-lg font-semibold text-slate-900">Color del producto</h2>
              <p className="mt-1 text-sm text-slate-500">El color se aplica directamente al modelo 3D.</p>
              <div className="mt-4 space-y-5">
                {colorableParts.map((part) => {
                  const baseColor = part.defaultColor || '#cbd5e1';
                  const palette = PRODUCT_COLOR_PALETTE.some((item) => item.color.toLowerCase() === baseColor.toLowerCase())
                    ? PRODUCT_COLOR_PALETTE
                    : [{ name: 'Original', color: baseColor }, ...PRODUCT_COLOR_PALETTE];
                  return <div key={part.id}>
                    {colorableParts.length > 1 && <h3 className="mb-2 text-sm font-medium text-slate-700">{part.label}</h3>}
                    <div className="flex flex-wrap gap-2.5">
                      {palette.map((item) => {
                        const selected = (componentColors[part.meshName] ?? baseColor).toLowerCase() === item.color.toLowerCase();
                        return <button key={`${part.id}-${item.color}`} type="button" onClick={() => { setComponentColors((current) => ({ ...current, [part.meshName]: item.color })); setAddedToCart(false); }} aria-label={`${part.label}: ${item.name}`} title={item.name} aria-pressed={selected} className={`h-9 w-9 rounded-full border border-white transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${selected ? 'ring-2 ring-indigo-800 ring-offset-1' : 'shadow-sm'}`} style={{ backgroundColor: item.color }} />;
                      })}
                    </div>
                  </div>;
                })}
              </div>
            </section>}

            <section className="mt-6" aria-labelledby="product-model-style">
              <h2 id="product-model-style" className="text-xs font-bold uppercase tracking-[.18em] text-slate-400">Modelo / estilo</h2>
              <button type="button" onClick={() => { setSelectedOptions({}); setAddedToCart(false); }} aria-pressed={isStandardSelected} className={`mt-3 w-full rounded-2xl border-2 px-4 py-3.5 text-left transition ${isStandardSelected ? 'border-blue-500 bg-blue-50/80 ring-1 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-300'}`}>
                <span className={`font-semibold ${isStandardSelected ? 'text-blue-600' : 'text-slate-700'}`}>Estándar</span><span className="ml-2 text-sm text-slate-500">Producto base</span>
              </button>
            </section>

            {(product.options ?? []).filter((option) => option.values.length > 0).map((option) => (
              <section key={option.id} className="mt-6 border-t border-slate-100 pt-5" aria-labelledby={`product-option-${option.id}`}>
                <h2 id={`product-option-${option.id}`} className="text-xs font-bold uppercase tracking-[.18em] text-slate-400">{option.name}</h2>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-2">
                  {option.values.map((value) => {
                    const selected = selectedOptions[option.id] === value.id;
                    const modifier = Number(value.priceModifier) || 0;
                    return <button key={value.id} type="button" onClick={() => { setSelectedOptions((current) => ({ ...current, [option.id]: value.id })); setAddedToCart(false); }} aria-pressed={selected} className={`group rounded-2xl border p-2.5 text-left transition ${selected ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'}`}>
                      {value.thumbnailUrl ? <img src={value.thumbnailUrl} alt="" className="h-20 w-full rounded-xl bg-slate-50 object-contain" loading="lazy" /> : <span className="grid h-20 place-items-center rounded-xl bg-slate-50 text-sm font-semibold text-slate-500">{value.label}</span>}
                      <span className="mt-2 block truncate text-sm font-medium text-slate-800">{value.label}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{modifier > 0 ? `+$${modifier.toFixed(2)}` : modifier < 0 ? `−$${Math.abs(modifier).toFixed(2)}` : 'Incluido'}</span>
                    </button>;
                  })}
                </div>
              </section>
            ))}

            <div className="mt-7 grid gap-3 border-t border-slate-200 pt-6 sm:grid-cols-2">
              <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Box size={17} /></span><div><p className="text-xs font-semibold text-slate-800">Modelo interactivo 3D</p><p className="mt-0.5 text-xs text-slate-500">Gíralo para revisar el diseño</p></div></div>
              <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-50 text-violet-700"><Sparkles size={17} /></span><div><p className="text-xs font-semibold text-slate-800">Diseño base editable</p><p className="mt-0.5 text-xs text-slate-500">Personalízalo cuando quieras</p></div></div>
            </div>
            {addedToCart && <p role="status" className="mt-4 text-center text-sm font-medium text-emerald-700">Agregamos {quantity} {quantity === 1 ? 'pieza' : 'piezas'} al carrito.</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}
