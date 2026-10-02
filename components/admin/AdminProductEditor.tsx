'use client';

import { FormEvent, type InputHTMLAttributes, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Eye, Info, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useProductStore, type CustomizablePart, type Product, type ProductOption } from '@/src/store/useProductStore';
import type { Addon } from '@/types/addon';
import { getAddons, updateAddon } from '@/services/addonsService.js';
import { compressImageFileToDataUrl } from '@/src/utils/imageCompression';
import AdminProductOptionsForm from '@/components/admin/AdminProductOptionsForm';
import MockupAreaPicker, { normalizePrintArea, type PrintArea } from '@/components/admin/MockupAreaPicker';
import type { SafeAreaPoint, SafeAreaShape } from '@/src/config/products';

type ProductViewForm = { id: string; name: string; mockupUrl: string; x: string; y: string; width: string; height: string; shape: SafeAreaShape; radius: string; /** Nodos del contorno libre serializados ('' = forma paramétrica). */ polygon: string };
type ProductForm = { name: string; price: string; category: string; printWidthCm: string; printHeightCm: string; model3dUrl: string; hasMultipleSides: boolean; extraSidePrice: string; fullWrapPrice: string; sidesPricingMode: 'per_side' | 'wrap'; setupFee: string; minimumQuantity: string; volumeDiscounts: Array<{ minQty: string; discountPercentage: string }>; availableAddonIds: string[]; customizableParts: CustomizablePart[]; options: ProductOption[]; views: ProductViewForm[] };
type MeshInspectionState = { status: 'idle' | 'loading' | 'success' | 'error'; message: string; names: string[] };

const REFERENCE_WIDTH = 800;
const REFERENCE_HEIGHT = 800;
const normalizePercentage = (value: number | undefined | null, fallback = 0) => !Number.isFinite(value) ? fallback : value && value > 0 && value <= 1 ? value * 100 : value ?? fallback;
const cleanPercentage = (value: number) => Number(Math.min(100, Math.max(0, value)).toFixed(2));
/** Radio 0-50 % con dos decimales; 25 % por defecto si el campo viene vacío. */
const cleanRadius = (value: number) => Number(Math.min(50, Math.max(0, Number.isFinite(value) ? value : 25)).toFixed(2));
/** El polígono viaja en el formulario como JSON de nodos; '' = forma paramétrica. */
const parsePolygonForm = (raw: string): SafeAreaPoint[] | undefined => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length >= 3 ? parsed as SafeAreaPoint[] : undefined;
  } catch {
    return undefined;
  }
};
const getGLBMeshNames = (scene: THREE.Object3D) => {
  const names = new Set<string>();
  scene.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh && mesh.name.trim()) names.add(mesh.name.trim());
  });
  return [...names];
};
const disposeInspectedGLB = (scene: THREE.Object3D) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  scene.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value && typeof value === 'object' && 'isTexture' in value && (value as THREE.Texture).isTexture) (value as THREE.Texture).dispose();
    });
    material.dispose();
  });
};
const createViewForm = (index: number): ProductViewForm => ({ id: index === 0 ? 'front' : `view-${crypto.randomUUID()}`, name: index === 0 ? 'Frente' : 'Espalda', mockupUrl: '', x: '25', y: '25', width: '50', height: '50', shape: 'rect', radius: '25', polygon: '' });
const emptyForm = (): ProductForm => ({ name: '', price: '', category: '', printWidthCm: '', printHeightCm: '', model3dUrl: '', hasMultipleSides: false, extraSidePrice: '0', fullWrapPrice: '0', sidesPricingMode: 'per_side', setupFee: '0', minimumQuantity: '1', volumeDiscounts: [], availableAddonIds: [], customizableParts: [], options: [], views: [createViewForm(0)] });

const normalizeViewIds = (views: ProductViewForm[]): ProductViewForm[] => {
  const usedIds = new Set<string>();
  return views.map((view, index) => {
    const originalId = view.id.trim();
    let id = originalId || (index === 0 ? 'front' : `view-${crypto.randomUUID()}`);
    if (usedIds.has(id)) id = `view-${crypto.randomUUID()}`;
    usedIds.add(id);
    return { ...view, id };
  });
};

const toForm = (product: Product): ProductForm => ({
  name: product.name,
  price: String(product.basePrice ?? product.price),
  category: product.category,
  printWidthCm: product.printWidthCm ? String(product.printWidthCm) : '',
  printHeightCm: product.printHeightCm ? String(product.printHeightCm) : '',
  model3dUrl: product.model3dUrl ?? '',
  hasMultipleSides: product.pricingRules?.hasMultipleSides ?? (product.views.length > 1),
  extraSidePrice: String(product.pricingSchema?.sidesPricing?.pricePerAdditionalSide ?? product.pricingRules?.extraSidePrice ?? 0),
  fullWrapPrice: String(product.pricingSchema?.sidesPricing?.wrapPrice ?? product.pricingRules?.fullWrapPrice ?? 0),
  sidesPricingMode: product.pricingSchema?.sidesPricing?.mode ?? 'per_side',
  setupFee: String(product.pricingSchema?.setupFee ?? 0),
  minimumQuantity: String(product.pricingSchema?.minimumQuantity ?? 1),
  volumeDiscounts: (product.pricingSchema?.volumeDiscounts ?? []).map((tier) => ({ minQty: String(tier.minQty), discountPercentage: String(tier.discountPercentage) })),
  availableAddonIds: product.availableAddonIds ?? [],
  customizableParts: product.customizableParts?.map((part) => ({ ...part, defaultColor: part.defaultColor || '#cbd5e1', enabled: part.enabled !== false })) ?? [],
  options: product.options?.map((option) => ({ ...option, displayType: option.displayType ?? option.type, values: option.values.map((value) => ({ ...value, priceModifier: product.pricingSchema?.variantModifiers?.find((modifier) => modifier.variantId === value.id)?.priceDelta ?? value.priceModifier })) })) ?? [],
  views: normalizeViewIds(product.views.map((view, index) => {
    const percent = view.printAreaUnit === 'percent';
    return {
      id: view.id, name: view.name || view.label || `Vista ${index + 1}`, mockupUrl: view.mockupUrl,
      x: String(cleanPercentage(normalizePercentage(percent ? view.printArea.x : (view.printArea.x * 100) / REFERENCE_WIDTH, 25))),
      y: String(cleanPercentage(normalizePercentage(percent ? view.printArea.y : (view.printArea.y * 100) / REFERENCE_HEIGHT, 25))),
      width: String(cleanPercentage(normalizePercentage(percent ? view.printArea.width : (view.printArea.width * 100) / REFERENCE_WIDTH, 50))),
      height: String(cleanPercentage(normalizePercentage(percent ? view.printArea.height : (view.printArea.height * 100) / REFERENCE_HEIGHT, 50))),
      // Zona redondeada: 'rect' (o ausente) sigue funcionando igual que antes.
      shape: view.printArea.shape === 'rounded' || view.printArea.shape === 'ellipse' ? view.printArea.shape : 'rect',
      radius: String(view.printArea.radius ?? 25),
      polygon: Array.isArray(view.printArea.polygon) && view.printArea.polygon.length >= 3 ? JSON.stringify(view.printArea.polygon) : '',
    };
  })),
});

export default function AdminProductEditor() {
  const products = useProductStore((state) => state.products);
  const addProduct = useProductStore((state) => state.addProduct);
  const updateProduct = useProductStore((state) => state.updateProduct);
  const removeProduct = useProductStore((state) => state.removeProduct);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [productQuery, setProductQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelFileInputRef = useRef<HTMLInputElement>(null);
  const meshInspectRequestRef = useRef(0);
  const [meshInspection, setMeshInspection] = useState<MeshInspectionState>({ status: 'idle', message: '', names: [] });
  const [addonCatalog, setAddonCatalog] = useState<Addon[]>([]);
  const [addonCatalogError, setAddonCatalogError] = useState('');
  const activeView = form.views[Math.min(activeTab, form.views.length - 1)];
  const activeIndex = Math.min(activeTab, form.views.length - 1);
  const printWidth = Number(form.printWidthCm) || 0;
  const printHeight = Number(form.printHeightCm) || 0;
  const pixelsWidth = Math.round((printWidth / 2.54) * 300);
  const pixelsHeight = Math.round((printHeight / 2.54) * 300);
  const baseViews = useMemo(() => form.views.map((view) => ({ id: view.id, name: view.name || 'Vista', mockupUrl: view.mockupUrl, printArea: normalizePrintArea({ x: Number(view.x), y: Number(view.y), width: Number(view.width), height: Number(view.height), shape: view.shape, radius: Number(view.radius), polygon: parsePolygonForm(view.polygon) }) })), [form.views]);
  const filteredProducts = useMemo(() => products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(productQuery.trim().toLowerCase())), [products, productQuery]);

  useEffect(() => { if (activeTab >= form.views.length) setActiveTab(Math.max(0, form.views.length - 1)); }, [activeTab, form.views.length]);
  useEffect(() => {
    let active = true;
    getAddons().then((items) => { if (active) { setAddonCatalog(items); setAddonCatalogError(''); } })
      .catch((error) => { console.error('No se pudo cargar el catálogo de extras:', error); if (active) setAddonCatalogError('No se pudo cargar el catálogo de extras.'); });
    return () => { active = false; };
  }, []);
  // Importa relaciones antiguas del catálogo a la lista canónica del producto
  // al abrir una ficha. Así editar otros campos no elimina extras ya asignados.
  useEffect(() => {
    if (!selectedId || addonCatalog.length === 0) return;
    const legacyIds = addonCatalog.filter((addon) => addon.applicableProducts?.includes(selectedId)).map((addon) => addon.id);
    if (!legacyIds.length) return;
    setForm((current) => {
      const mergedIds = [...new Set([...current.availableAddonIds, ...legacyIds])];
      return mergedIds.length === current.availableAddonIds.length ? current : { ...current, availableAddonIds: mergedIds };
    });
  }, [addonCatalog, selectedId]);
  useEffect(() => {
    const url = form.model3dUrl.trim();
    if (!url) {
      setMeshInspection({ status: 'idle', message: 'Sube un archivo .GLB válido para detectar las mallas disponibles.', names: [] });
      return;
    }
    const requestId = ++meshInspectRequestRef.current;
    if (!/\.glb(?:$|[?#])/i.test(url) && !/^data:model\/gltf-binary/i.test(url)) {
      setMeshInspection({ status: 'error', message: 'Sube un archivo .GLB válido para detectar las mallas disponibles.', names: [] });
      return;
    }
    setMeshInspection({ status: 'loading', message: 'Analizando las mallas del modelo…', names: [] });
    const timeout = window.setTimeout(async () => {
      let inspectedScene: THREE.Object3D | null = null;
      try {
        const gltf = await new GLTFLoader().loadAsync(url);
        inspectedScene = gltf.scene;
        if (requestId !== meshInspectRequestRef.current) return;
        const names = getGLBMeshNames(gltf.scene);
        setMeshInspection(names.length
          ? { status: 'success', message: `Se detectaron ${names.length} ${names.length === 1 ? 'malla' : 'mallas'}.`, names }
          : { status: 'error', message: 'El GLB cargó, pero no contiene mallas con nombre. Sube un archivo .GLB válido para detectar las mallas disponibles.', names: [] });
      } catch (error) {
        if (requestId === meshInspectRequestRef.current) {
          console.warn('[ADMIN] No se pudo inspeccionar el GLB indicado:', error);
          setMeshInspection({ status: 'error', message: 'No se pudo leer ese modelo. Verifica la URL y sube un archivo .GLB válido para detectar las mallas disponibles.', names: [] });
        }
      } finally {
        if (inspectedScene) disposeInspectedGLB(inspectedScene);
      }
    }, 500);
    return () => {
      window.clearTimeout(timeout);
      if (meshInspectRequestRef.current === requestId) meshInspectRequestRef.current += 1;
    };
  }, [form.model3dUrl]);

  const inspectLocalGLB = async (file?: File) => {
    if (!file) return;
    const requestId = ++meshInspectRequestRef.current;
    if (!file.name.toLowerCase().endsWith('.glb')) {
      setMeshInspection({ status: 'error', message: 'Selecciona un archivo con extensión .GLB.', names: [] });
      return;
    }
    setMeshInspection({ status: 'loading', message: `Analizando ${file.name}…`, names: [] });
    let inspectedScene: THREE.Object3D | null = null;
    try {
      const buffer = await file.arrayBuffer();
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        new GLTFLoader().parse(buffer, '', resolve, reject);
      });
      inspectedScene = gltf.scene;
      if (requestId !== meshInspectRequestRef.current) return;
      const names = getGLBMeshNames(gltf.scene);
      setMeshInspection(names.length
        ? { status: 'success', message: `${file.name}: ${names.length} ${names.length === 1 ? 'malla detectada' : 'mallas detectadas'}. El archivo solo se inspecciona localmente; configura abajo una URL persistente para usarlo en la tienda.`, names }
        : { status: 'error', message: 'El GLB no contiene mallas con nombre. Sube un archivo .GLB válido para detectar las mallas disponibles.', names: [] });
    } catch (error) {
      console.warn('[ADMIN] No se pudo inspeccionar el archivo GLB local:', error);
      if (requestId === meshInspectRequestRef.current) setMeshInspection({ status: 'error', message: 'No se pudo leer el archivo. Sube un archivo .GLB válido para detectar las mallas disponibles.', names: [] });
    } finally {
      if (inspectedScene) disposeInspectedGLB(inspectedScene);
    }
  };
  const setField = (field: Exclude<keyof ProductForm, 'views' | 'options' | 'customizableParts' | 'availableAddonIds' | 'hasMultipleSides' | 'volumeDiscounts' | 'sidesPricingMode'>, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const updateVolumeDiscount = (index: number, key: 'minQty' | 'discountPercentage', value: string) => setForm((current) => ({ ...current, volumeDiscounts: current.volumeDiscounts.map((tier, tierIndex) => tierIndex === index ? { ...tier, [key]: value } : tier) }));
  const addVolumeDiscount = () => setForm((current) => ({ ...current, volumeDiscounts: [...current.volumeDiscounts, { minQty: '', discountPercentage: '' }] }));
  const removeVolumeDiscount = (index: number) => setForm((current) => ({ ...current, volumeDiscounts: current.volumeDiscounts.filter((_, tierIndex) => tierIndex !== index) }));
  const isAddonSelectedForForm = (addon: Addon) => form.availableAddonIds.includes(addon.id);
  const toggleAvailableAddon = (id: string) => setForm((current) => ({ ...current, availableAddonIds: current.availableAddonIds.includes(id) ? current.availableAddonIds.filter((item) => item !== id) : [...current.availableAddonIds, id] }));
  const updateCustomizablePart = (index: number, patch: Partial<CustomizablePart>) => setForm((current) => ({ ...current, customizableParts: current.customizableParts.map((part, partIndex) => partIndex === index ? { ...part, ...patch } : part) }));
  const addCustomizablePart = () => setForm((current) => ({ ...current, customizableParts: [...current.customizableParts, { id: crypto.randomUUID(), label: '', meshName: '', defaultColor: '#cbd5e1', enabled: true }] }));
  const setViewField = (index: number, field: keyof ProductViewForm, value: string) => setForm((current) => ({ ...current, views: current.views.map((view, viewIndex) => viewIndex === index ? { ...view, [field]: value } : view) }));
  const setViewPrintArea = (index: number, area: PrintArea) => setForm((current) => ({ ...current, views: current.views.map((view, viewIndex) => viewIndex === index ? { ...view, x: String(area.x), y: String(area.y), width: String(area.width), height: String(area.height), shape: area.shape ?? 'rect', radius: String(area.radius ?? 25), polygon: area.polygon && area.polygon.length >= 3 ? JSON.stringify(area.polygon) : '' } : view) }));
  const handleAddView = () => setForm((current) => { const next = [...current.views, createViewForm(current.views.length)]; setActiveTab(next.length - 1); return { ...current, views: next }; });
  const removeView = (index: number) => setForm((current) => ({ ...current, views: current.views.filter((_, viewIndex) => viewIndex !== index) }));
  const resetForm = () => { setSelectedId(null); setForm(emptyForm()); setActiveTab(0); };
  const handleSelect = (product: Product) => { setSelectedId(product.id); setForm(toForm(product)); setActiveTab(0); };
  const handleDeleteProduct = (productId: string) => {
    removeProduct(productId);
    if (selectedId === productId) resetForm();
  };
  const handleMockupFile = (file?: File) => {
    if (!file || !activeView || !file.type.startsWith('image/')) return;
    // Se comprime antes de guardar: los mockups en Base64 sin comprimir
    // agotan la cuota de localStorage y rompen la persistencia.
    compressImageFileToDataUrl(file)
      .then((dataUrl) => setViewField(activeIndex, 'mockupUrl', dataUrl))
      .catch((error) => console.error('❌ [ADMIN] Error al procesar el mockup:', error));
  };
  const handleReplaceMockup = () => fileInputRef.current?.click();
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const setupFee = Number(form.setupFee);
    const minimumQuantity = Number(form.minimumQuantity);
    const volumeDiscounts = form.volumeDiscounts.map((tier) => ({ minQty: Number(tier.minQty), discountPercentage: Number(tier.discountPercentage) }));
    if (!Number.isFinite(setupFee) || setupFee < 0) { alert('El cargo de preparación debe ser un monto igual o mayor a cero.'); return; }
    if (!Number.isInteger(minimumQuantity) || minimumQuantity < 1) { alert('La cantidad mínima debe ser un número entero igual o mayor a uno.'); return; }
    if (volumeDiscounts.some((tier) => !Number.isInteger(tier.minQty) || tier.minQty < 1 || !Number.isFinite(tier.discountPercentage) || tier.discountPercentage < 0 || tier.discountPercentage > 100)) { alert('Revisa los descuentos por volumen: indica una cantidad entera y un descuento entre 0 y 100%.'); return; }
    if (new Set(volumeDiscounts.map((tier) => tier.minQty)).size !== volumeDiscounts.length) { alert('Cada nivel de descuento por volumen debe tener una cantidad mínima distinta.'); return; }
    if (form.views.some((view) => !view.mockupUrl.trim())) { alert('Agrega un mockup para cada vista.'); return; }
    if (form.customizableParts.length > 0 && !form.model3dUrl.trim()) { alert('Configura una ruta pública o URL para el GLB antes de guardar sus mallas personalizables.'); return; }
    if (form.customizableParts.some((part) => !part.label.trim() || !part.meshName.trim())) { alert('Completa la etiqueta y el nombre exacto de malla en cada pieza 3D, o elimina las piezas incompletas.'); return; }
    const meshNames = form.customizableParts.map((part) => part.meshName.trim().toLocaleLowerCase());
    if (new Set(meshNames).size !== meshNames.length) { alert('Cada pieza personalizable debe apuntar a un nombre de malla distinto.'); return; }
    const options = form.options.map((option) => ({ ...option, name: option.name.trim() || 'Opción', displayType: option.displayType ?? option.type, values: option.values.map((value, valueIndex) => ({ ...value, label: value.label.trim() || 'Variante', thumbnailUrl: value.thumbnailUrl?.trim() || undefined, mockupUrl: undefined, printArea: null, views: form.views.map((baseView) => { const configured = value.views?.find((view) => view.viewId === baseView.id); const baseArea = normalizePrintArea({ x: Number(baseView.x), y: Number(baseView.y), width: Number(baseView.width), height: Number(baseView.height), shape: baseView.shape, radius: Number(baseView.radius), polygon: parsePolygonForm(baseView.polygon) }); return { viewId: baseView.id, name: baseView.name.trim() || 'Vista', mockupUrl: configured?.mockupUrl?.trim() || null, printArea: configured?.printArea ? normalizePrintArea(configured.printArea) : valueIndex === 0 ? baseArea : null }; }) })) }));
    const customizableParts = form.customizableParts.map((part) => ({ ...part, label: part.label.trim(), meshName: part.meshName.trim(), defaultColor: part.defaultColor || '#cbd5e1' }));
    const basePrice = Number(form.price);
    const productId = selectedId ?? crypto.randomUUID();
    const extraSidePrice = Math.max(0, Number(form.extraSidePrice) || 0);
    const fullWrapPrice = Math.max(0, Number(form.fullWrapPrice) || 0);
    const variantModifiers = options.flatMap((option) => option.values.map((value) => ({ variantId: value.id, priceDelta: value.priceModifier })));
    const product: Product = { id: productId, name: form.name.trim(), price: basePrice, basePrice, category: form.category.trim(), canvasWidth: REFERENCE_WIDTH, canvasHeight: REFERENCE_HEIGHT, printWidthCm: printWidth || undefined, printHeightCm: printHeight || undefined, model3dUrl: form.model3dUrl.trim() || undefined, pricingRules: { hasMultipleSides: form.hasMultipleSides, extraSidePrice, fullWrapPrice }, pricingSchema: { variantModifiers, setupFee, minimumQuantity, volumeDiscounts, sidesPricing: { mode: form.sidesPricingMode, pricePerAdditionalSide: extraSidePrice, wrapPrice: fullWrapPrice } }, availableAddonIds: form.availableAddonIds, customizableParts, options, views: form.views.map((view) => { const name = view.name.trim() || 'Vista'; const polygon = parsePolygonForm(view.polygon); return { id: view.id, name, label: name, mockupUrl: view.mockupUrl.trim(), printArea: { x: cleanPercentage(Number(view.x) || 0), y: cleanPercentage(Number(view.y) || 0), width: cleanPercentage(Number(view.width) || 0), height: cleanPercentage(Number(view.height) || 0), ...(view.shape !== 'rect' ? { shape: view.shape } : {}), ...(view.shape === 'rounded' ? { radius: cleanRadius(Number(view.radius)) } : {}), ...(polygon ? { polygon } : {}) }, printAreaUnit: 'percent' as const }; }) };
    selectedId ? updateProduct(product) : addProduct(product);
    try {
      await Promise.all(addonCatalog.map((addon) => {
        const nextApplicableProducts = form.availableAddonIds.includes(addon.id)
          ? [...new Set([...(addon.applicableProducts ?? []), productId])]
          : (addon.applicableProducts ?? []).filter((id) => id !== productId);
        if (nextApplicableProducts.length === (addon.applicableProducts ?? []).length && nextApplicableProducts.every((id, index) => id === addon.applicableProducts[index])) return Promise.resolve();
        return updateAddon(addon.id, { ...addon, applicableProducts: nextApplicableProducts });
      }));
    } catch (error) {
      console.error('No se pudieron sincronizar los extras asignados al producto:', error);
    }
    resetForm();
  };

  const activeArea = activeView ? normalizePrintArea({ x: Number(activeView.x), y: Number(activeView.y), width: Number(activeView.width), height: Number(activeView.height), shape: activeView.shape, radius: Number(activeView.radius), polygon: parsePolygonForm(activeView.polygon) }) : null;
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
    <div className="mx-auto max-w-7xl">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Administración de tienda</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Gestión de productos</h1><p className="mt-2 text-slate-600">Organiza el catálogo, las variantes y las zonas de personalización.</p></div>
        <button type="button" onClick={() => { resetForm(); document.getElementById('product-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"><Plus size={18} /> Crear nuevo producto</button>
      </header>
      <section className="mb-6 grid gap-4 sm:grid-cols-3">{[
        { label: 'Productos en catálogo', value: products.length },
        { label: 'Vistas de producto', value: products.reduce((sum, product) => sum + product.views.length, 0) },
        { label: 'Variantes configuradas', value: products.reduce((sum, product) => sum + (product.options ?? []).reduce((count, option) => count + option.values.length, 0), 0) },
      ].map((stat, index) => <article key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{stat.label}</p><p className={`mt-1 text-2xl font-semibold ${index === 0 ? 'text-emerald-700' : 'text-slate-900'}`}>{stat.value}</p></article>)}</section>
      <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6"><div><h2 className="font-semibold text-slate-900">Catálogo de productos</h2><p className="mt-1 text-xs text-slate-500">{filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'}</p></div><label className="relative w-full sm:w-72"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Buscar producto o categoría…" aria-label="Buscar productos" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label></div>
        {filteredProducts.length === 0 ? <div className="px-6 py-14 text-center"><p className="font-semibold text-slate-900">{products.length ? 'No encontramos productos' : 'Aún no hay productos'}</p><p className="mt-1 text-sm text-slate-500">{products.length ? 'Prueba otra búsqueda.' : 'Crea el primer producto para empezar tu catálogo.'}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>{['Producto', 'Categoría', 'Precio base', 'Configuración', 'Acciones'].map((heading) => <th key={heading} className="px-4 py-3 font-semibold first:pl-6 last:pr-6">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filteredProducts.map((product) => { const variantCount = (product.options ?? []).reduce((count, option) => count + option.values.length, 0); return <tr key={product.id} className={`transition hover:bg-slate-50/70 ${selectedId === product.id ? 'bg-emerald-50/60' : ''}`}><td className="px-4 py-3 pl-6"><div className="flex items-center gap-3"><img src={product.views[0]?.mockupUrl} alt="" className="h-12 w-12 rounded-xl border border-slate-200 bg-slate-50 object-contain" /><div className="min-w-0"><p className="max-w-64 truncate font-semibold text-slate-900">{product.name}</p><p className="text-xs text-slate-500">{product.views.length} {product.views.length === 1 ? 'vista' : 'vistas'}</p></div></div></td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{product.category || 'Sin categoría'}</span></td><td className="px-4 py-3 font-semibold tabular-nums text-slate-900">${product.price.toFixed(2)}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-1.5"><span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">{product.views.length} vistas</span><span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">{variantCount} variantes</span></div></td><td className="px-4 py-3 pr-6"><div className="flex items-center gap-1"><button type="button" onClick={() => { handleSelect(product); document.getElementById('product-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} aria-label={`Editar ${product.name}`} title="Editar producto" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-emerald-700"><Pencil size={16} /></button><Link href={`/admin/products/${product.id}/review-gallery`} title="Fotos de la pestaña Revisar" aria-label={`Fotos de revisar de ${product.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"><Camera size={16} /></Link><button type="button" onClick={() => handleDeleteProduct(product.id)} aria-label={`Eliminar ${product.name}`} title="Eliminar producto" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button></div></td></tr>; })}</tbody></table></div>}
      </section>
      <div id="product-form" className="scroll-mt-24"><div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">{selectedId ? 'Edición de producto' : 'Nuevo producto'}</p><h2 className="mt-1 text-xl font-semibold text-slate-900">{selectedId ? form.name || 'Configura el producto' : 'Configura un producto'}</h2></div>{selectedId && <button type="button" onClick={resetForm} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar edición</button>}</div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-lg font-semibold text-slate-900">Datos básicos</h2><p className="mt-1 text-sm text-slate-500">Información que verán tus clientes al elegir el producto.</p></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field className="sm:col-span-2" label="Nombre del producto" value={form.name} onChange={(value) => setField('name', value)} required /><Field label="Precio" type="number" min="0" step="0.01" value={form.price} onChange={(value) => setField('price', value)} required /><Field label="Categoría" value={form.category} onChange={(value) => setField('category', value)} required /><Field label="Ancho físico de impresión (cm)" type="number" min="0.1" step="0.1" value={form.printWidthCm} onChange={(value) => setField('printWidthCm', value)} placeholder="20" /><Field label="Alto físico de impresión (cm)" type="number" min="0.1" step="0.1" value={form.printHeightCm} onChange={(value) => setField('printHeightCm', value)} placeholder="9" /><Field className="sm:col-span-2" label="Modelo 3D (ruta pública o URL .GLB)" value={form.model3dUrl} onChange={(value) => setField('model3dUrl', value)} placeholder="/models/termo.glb" />
              <div className="sm:col-span-2"><input ref={modelFileInputRef} type="file" accept=".glb,model/gltf-binary" className="sr-only" onChange={(event) => { void inspectLocalGLB(event.target.files?.[0]); event.currentTarget.value = ''; }} /><button type="button" onClick={() => modelFileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-violet-300 hover:bg-violet-50"><Upload size={16} /> Seleccionar GLB para detectar mallas</button><p className="mt-1.5 text-xs text-slate-500">El archivo local se analiza en este navegador; para que el modelo se cargue en la tienda, coloca una URL o ruta pública en el campo superior.</p><p role="status" className={`mt-2 text-xs ${meshInspection.status === 'error' ? 'text-red-600' : meshInspection.status === 'success' ? 'text-emerald-700' : meshInspection.status === 'loading' ? 'text-violet-700' : 'text-slate-500'}`}>{meshInspection.message || 'Sube un archivo .GLB válido para detectar las mallas disponibles.'}</p>{meshInspection.names.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{meshInspection.names.map((name) => <span key={name} className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 font-mono text-[10px] text-violet-800">{name}</span>)}</div>}</div>
            </div>
            <div className="mt-4 flex gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2.5 text-xs text-sky-800"><Info className="mt-0.5 shrink-0" size={15} /><span>Salida estimada a 300 DPI: <strong>{printWidth && printHeight ? `${pixelsWidth.toLocaleString()} × ${pixelsHeight.toLocaleString()} px` : 'indica ancho y alto'}</strong>.</span></div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5"><h2 className="text-lg font-semibold text-slate-900">Precios por caras y extras</h2><p className="mt-1 text-sm text-slate-500">Define los cargos adicionales y qué acabados puede elegir el cliente para este producto.</p></div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4"><input type="checkbox" checked={form.hasMultipleSides} onChange={(event) => setForm((current) => ({ ...current, hasMultipleSides: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-emerald-600" /><span><span className="block text-sm font-semibold text-slate-800">Permite impresión en varias caras o cobertura 360°</span><span className="mt-1 block text-xs text-slate-500">Activa esta opción si el cliente puede personalizar más de una cara.</span></span></label>
            <label className="mt-4 block text-sm font-medium text-slate-700">Modo de precios por caras<select value={form.sidesPricingMode} onChange={(event) => setForm((current) => ({ ...current, sidesPricingMode: event.target.value as ProductForm['sidesPricingMode'] }))} disabled={!form.hasMultipleSides} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-100"><option value="per_side">Cobrar cada cara adicional</option><option value="wrap">Priorizar cobertura 360°</option></select></label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Precio por cara adicional ($)" type="number" min="0" step="0.01" value={form.extraSidePrice} onChange={(value) => setField('extraSidePrice', value)} disabled={!form.hasMultipleSides} placeholder="4.00" />
              <Field label="Precio adicional por cobertura 360° ($)" type="number" min="0" step="0.01" value={form.fullWrapPrice} onChange={(value) => setField('fullWrapPrice', value)} disabled={!form.hasMultipleSides} placeholder="6.00" />
            </div>
            <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
              <Field label="Cargo fijo de preparación por pedido ($)" type="number" min="0" step="0.01" value={form.setupFee} onChange={(value) => setField('setupFee', value)} placeholder="15.00" />
              <Field label="Cantidad mínima de pedido" type="number" min="1" step="1" value={form.minimumQuantity} onChange={(value) => setField('minimumQuantity', value)} placeholder="1" />
            </div>
            <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-800">Descuentos por volumen</h3><p className="mt-1 text-xs text-slate-500">El editor aplicará el descuento del nivel más alto alcanzado.</p></div><button type="button" onClick={addVolumeDiscount} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"><Plus size={14} /> Agregar nivel</button></div>
              {form.volumeDiscounts.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-xs text-slate-500">Sin descuentos por cantidad configurados.</p> : <div className="space-y-2">{form.volumeDiscounts.map((tier, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-lg bg-white p-2"><Field label="Desde piezas" type="number" min="1" step="1" value={tier.minQty} onChange={(value) => updateVolumeDiscount(index, 'minQty', value)} placeholder="50" /><Field label="Descuento (%)" type="number" min="0" max="100" step="0.1" value={tier.discountPercentage} onChange={(value) => updateVolumeDiscount(index, 'discountPercentage', value)} placeholder="15" /><button type="button" onClick={() => removeVolumeDiscount(index)} aria-label="Eliminar nivel de descuento" className="mb-1 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button></div>)}</div>}
            </section>
            <fieldset className="mt-6 border-t border-slate-100 pt-5">
              <legend className="text-sm font-semibold text-slate-800">Acabados y extras disponibles</legend>
              <p className="mb-3 mt-1 text-xs text-slate-500">Selecciona los extras del catálogo que se ofrecerán con este producto.</p>
              {addonCatalogError && <p role="alert" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{addonCatalogError}</p>}
              {addonCatalog.length ? <div className="grid gap-2 sm:grid-cols-2">{addonCatalog.map((addon) => <label key={addon.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm ${isAddonSelectedForForm(addon) ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 hover:bg-slate-50'}`}><input type="checkbox" checked={isAddonSelectedForForm(addon)} onChange={() => toggleAvailableAddon(addon.id)} className="mt-0.5 h-4 w-4 accent-emerald-600" /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="font-medium text-slate-800">{addon.name}</span><span className="shrink-0 text-xs font-semibold text-emerald-700">+${addon.price.toFixed(2)}</span></span><span className="mt-1 block text-xs text-slate-500">{addon.appliesTo === 'side' ? 'Por cara' : addon.appliesTo === 'canvas' ? 'Área de diseño' : 'Producto completo'}{addon.perSide ? ' · cargo por cada cara' : ''}{!addon.isActive ? ' · inactivo' : ''}</span></span></label>)}</div> : <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">No hay extras en el catálogo. Puedes crearlos en Administración → Acabados y extras.</p>}
            </fieldset>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Configuración de mallas 3D personalizables</h2><p className="mt-1 max-w-xl text-sm text-slate-500">Agrega una opción por cada malla que el cliente podrá colorear. El nombre debe coincidir exactamente con el nodo Mesh del GLB.</p></div><button type="button" onClick={addCustomizablePart} disabled={!form.model3dUrl.trim() && meshInspection.names.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={15} /> Agregar pieza</button></div>
            {!form.model3dUrl.trim() && meshInspection.names.length === 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Agrega la ruta del GLB o selecciona un archivo local para detectar sus mallas. Para guardar, necesitarás una ruta persistente.</p>}
            {form.customizableParts.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Sin piezas configuradas. El panel de colores se ocultará al cliente.</p> : <div className="space-y-3">{form.customizableParts.map((part, index) => {
              const meshIsDetected = meshInspection.names.includes(part.meshName);
              return <div key={part.id} className="grid grid-cols-1 items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_auto_auto_auto]">
                <Field label="Etiqueta visible" value={part.label} onChange={(value) => updateCustomizablePart(index, { label: value })} placeholder="Color del asa" />
                <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700"><span>Malla del GLB</span><select value={meshIsDetected ? part.meshName : '__manual__'} onChange={(event) => { if (event.target.value !== '__manual__') updateCustomizablePart(index, { meshName: event.target.value }); }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"><option value="__manual__">{meshInspection.names.length ? 'Escribir nombre manualmente…' : 'Sin mallas detectadas · escribir nombre'}</option>{meshInspection.names.map((name) => <option key={name} value={name}>{name}</option>)}</select>{!meshIsDetected && <input value={part.meshName} onChange={(event) => updateCustomizablePart(index, { meshName: event.target.value })} placeholder="Nombre exacto, ej. mesh_handle" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-violet-500" />}</label>
                <label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>Color inicial</span><input type="color" value={part.defaultColor} onChange={(event) => updateCustomizablePart(index, { defaultColor: event.target.value })} aria-label={`Color inicial para ${part.label || 'pieza'}`} className="h-10 w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-1 sm:w-14" /></label>
                <label className="flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={part.enabled !== false} onChange={(event) => updateCustomizablePart(index, { enabled: event.target.checked })} className="h-4 w-4 accent-violet-600" />Permitir al cliente</label>
                <button type="button" onClick={() => setForm((current) => ({ ...current, customizableParts: current.customizableParts.filter((_, partIndex) => partIndex !== index) }))} aria-label={`Eliminar ${part.label || 'pieza'}`} title="Eliminar pieza" className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
              </div>;
            })}</div>}
            <div className="mt-3 flex gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2.5 text-xs text-violet-800"><Info className="mt-0.5 shrink-0" size={15} /><span>Ejemplo: etiqueta “Color del asa” y nombre de malla “mesh_handle”. Si una malla no coincide, el control se mostrará pero no podrá modificarla.</span></div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-lg font-semibold text-slate-900">Vistas del producto</h2><p className="mt-1 text-sm text-slate-500">Carga un mockup y define una zona segura para cada cara.</p></div>
            <div className="mb-5 flex gap-2 overflow-x-auto border-b border-slate-200"><div className="flex min-w-max gap-2">{form.views.map((view, index) => <button key={view.id} type="button" onClick={() => { setActiveTab(index); console.log('🔍 [EDITOR - VISTA ACTIVA]:', { id: view.id, name: view.name }); }} className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${activeIndex === index ? 'border-emerald-600 font-semibold text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{view.name || `Vista ${index + 1}`}</button>)}<button type="button" onClick={handleAddView} className="flex items-center gap-1 px-2 text-xs font-medium text-emerald-600 hover:underline"><Plus size={14} /> Agregar vista</button></div></div>
            {activeView && <div className="space-y-5"><Field label="Nombre de la vista" value={activeView.name} onChange={(value) => setViewField(activeIndex, 'name', value)} required />
              <div><span className="mb-1.5 block text-sm font-medium text-slate-700">Mockup de la vista</span><input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => { handleMockupFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                {activeView.mockupUrl ? <div className="group relative overflow-hidden rounded-lg border border-slate-200"><img src={activeView.mockupUrl} alt="Mockup" className="h-32 w-full bg-slate-50 object-contain" /><div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 opacity-0 transition-opacity group-hover:opacity-100"><button type="button" onClick={handleReplaceMockup} className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow">Cambiar imagen</button></div></div> : <button type="button" onClick={handleReplaceMockup} className="group flex w-full items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40"><span className="flex h-16 w-16 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm"><Camera size={23} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-700">Subir mockup</span><span className="mt-1 block text-xs text-slate-500">PNG, JPG o WebP · se mostrará en la vista previa</span></span><Upload size={18} className="text-emerald-600" /></button>}</div>
              <Field label="O pega una URL o ruta del mockup" value={activeView.mockupUrl.startsWith('data:') ? '' : activeView.mockupUrl} onChange={(value) => setViewField(activeIndex, 'mockupUrl', value)} placeholder="/mockups/playera-frente.png" />
              {form.views.length > 1 && <button type="button" onClick={() => removeView(activeIndex)} className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700"><Trash2 size={16} /> Eliminar esta vista</button>}</div>}
          </section>
          <AdminProductOptionsForm options={form.options} baseViews={baseViews} onChange={(options) => setForm((current) => ({ ...current, options }))} />
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white px-6 pt-1 shadow-sm"><div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-md"><span className="text-xs text-slate-500">Última modificación realizada recientemente</span><div className="flex gap-3"><button type="button" onClick={resetForm} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancelar</button><button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700">Guardar producto</button></div></div></section>
        </div>
        <aside className="lg:col-span-5"><section className="sticky top-6 h-fit rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Eye size={17} className="text-emerald-600" />Configuración visual</div><p className="mt-1 text-xs text-slate-500">{activeView?.name || 'Vista activa'}</p></div><span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">300 DPI | {printWidth || '—'} × {printHeight || '—'} cm</span></div>
          <div className="rounded-xl border border-slate-200 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] p-3">{activeView && activeArea ? <MockupAreaPicker mockupUrl={activeView.mockupUrl} initialPrintArea={activeArea} onChange={(area) => setViewPrintArea(activeIndex, area)} /> : null}</div>
          {activeArea && <p className="mt-4 text-center text-xs text-slate-500">Zona segura: <span className="font-semibold text-slate-700">{activeArea.width}% × {activeArea.height}%</span> del mockup.</p>}
        </section></aside>
      </form>
      </div>
    </div>
  </main>;
}

function Field({ label, className = '', onChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { label: string; onChange: (value: string) => void }) {
  return <label className={`grid gap-1.5 text-sm font-medium text-slate-700 ${className}`}><span>{label}</span><input {...props} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>;
}
