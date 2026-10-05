'use client';

import { FormEvent, type InputHTMLAttributes, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Camera, Copy, Info, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useProductStore, type CustomizablePart, type Product, type ProductOption, type ProductOptionValue } from '@/src/store/useProductStore';
import type { Addon } from '@/types/addon';
import { getAddons, updateAddon } from '@/services/addonsService.js';
import { compressImageFileToDataUrl } from '@/src/utils/imageCompression';
import AdminProductOptionsForm from '@/components/admin/AdminProductOptionsForm';
import MockupAreaPicker, { normalizePrintArea, type PrintArea } from '@/components/admin/MockupAreaPicker';
import PrintArea3DEditor from '@/components/admin/PrintArea3DEditor';
import GLBModelPreview from '@/components/admin/GLBModelPreview';
import { DEFAULT_MESH_SETTINGS, type MeshSettings, type SafeAreaPoint, type SafeAreaShape } from '@/src/config/products';
import { seedSafeAreaPolygon } from '@/src/utils/safeAreaPolygon';

const Product3DViewer = dynamic(() => import('@/components/editor/Product3DViewer'), { ssr: false, loading: () => <div className="grid h-full min-h-[280px] place-items-center text-xs text-slate-500">Cargando visor 3D…</div> });

type ProductViewForm = { id: string; name: string; mockupUrl: string; x: string; y: string; width: string; height: string; shape: SafeAreaShape; radius: string; /** Nodos del contorno libre serializados ('' = forma paramétrica). */ polygon: string; area3D: PrintArea; surfaceX: string; surfaceY: string; surfaceWidth: string; surfaceHeight: string; surfaceCustomized: boolean };
type ProductForm = { name: string; price: string; category: string; printWidthCm: string; printHeightCm: string; model3dUrl: string; textureWidth: string; textureHeight: string; hasMultipleSides: boolean; extraSidePrice: string; fullWrapPrice: string; sidesPricingMode: 'per_side' | 'wrap'; setupFee: string; minimumQuantity: string; volumeDiscounts: Array<{ minQty: string; discountPercentage: string }>; availableAddonIds: string[]; customizableParts: CustomizablePart[]; options: ProductOption[]; views: ProductViewForm[] };
type MeshInspection = { name: string; vertexCount: number; triangleCount: number; dimensions: string; materialNames: string[]; uvCount: number; uvRange: string | null; uvOutsideCount: number; overlappingUvTriangles: number };
type MeshInspectionState = { status: 'idle' | 'loading' | 'success' | 'error'; message: string; meshes: MeshInspection[] };

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
const ensureVariantMeshSettings = (variant: ProductOptionValue, fallback: MeshSettings): ProductOptionValue => {
  const hasPrintArea = Boolean(variant.printArea) || Boolean(variant.views?.some((view) => view.printArea));
  return hasPrintArea ? { ...variant, meshSettings: variant.meshSettings ?? fallback } : variant;
};
const inspectGLBMeshes = (scene: THREE.Object3D): MeshInspection[] => {
  const reports: MeshInspection[] = [];
  scene.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    geometry.computeBoundingBox();
    const size = geometry.boundingBox?.getSize(new THREE.Vector3());
    let uvRange: string | null = null;
    let uvOutsideCount = 0;
    let overlappingUvTriangles = 0;
    if (uv?.count) {
      let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
      for (let index = 0; index < uv.count; index += 1) {
        const u = uv.getX(index), v = uv.getY(index);
        minU = Math.min(minU, u); minV = Math.min(minV, v);
        maxU = Math.max(maxU, u); maxV = Math.max(maxV, v);
        if (u < -0.001 || u > 1.001 || v < -0.001 || v > 1.001) uvOutsideCount += 1;
      }
      uvRange = `U ${minU.toFixed(3)}–${maxU.toFixed(3)} · V ${minV.toFixed(3)}–${maxV.toFixed(3)}`;
      // Detecta triángulos UV idénticos (islas apiladas/mirrored exactas).
      // Es una señal útil para diagnosticar repetición; no pretende reemplazar
      // el análisis completo de solapamientos de Blender.
      const indices = geometry.index;
      const triangleCount = indices ? Math.floor(indices.count / 3) : Math.floor(uv.count / 3);
      const triangleKeys = new Set<string>();
      for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const points = [0, 1, 2].map((corner) => {
          const vertexIndex = indices ? indices.getX(triangle * 3 + corner) : triangle * 3 + corner;
          return `${uv.getX(vertexIndex).toFixed(5)},${uv.getY(vertexIndex).toFixed(5)}`;
        }).sort();
        const key = points.join('|');
        if (triangleKeys.has(key)) overlappingUvTriangles += 1;
        else triangleKeys.add(key);
      }
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    reports.push({
      name: mesh.name.trim() || '(sin nombre)',
      vertexCount: position?.count ?? 0,
      triangleCount: geometry.index ? Math.floor(geometry.index.count / 3) : Math.floor((position?.count ?? 0) / 3),
      dimensions: size ? `${size.x.toFixed(3)} × ${size.y.toFixed(3)} × ${size.z.toFixed(3)}` : '—',
      materialNames: materials.map((material) => material.name || material.type),
      uvCount: uv?.count ?? 0,
      uvRange,
      uvOutsideCount,
      overlappingUvTriangles,
    });
  });
  return reports;
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
const ensureEditableNodes = (area: PrintArea): PrintArea => {
  const normalized = normalizePrintArea(area);
  return {
    ...normalized,
    polygon: normalized.polygon ?? seedSafeAreaPolygon(normalized.shape ?? 'rect', normalized.radius ?? 25, normalized),
  };
};
const createViewForm = (index: number): ProductViewForm => ({ id: index === 0 ? 'front' : `view-${crypto.randomUUID()}`, name: index === 0 ? 'Frente' : 'Espalda', mockupUrl: '', x: '25', y: '25', width: '50', height: '50', shape: 'rect', radius: '25', polygon: '', area3D: ensureEditableNodes({ x: 25, y: 25, width: 50, height: 50 }), surfaceX: '25', surfaceY: '25', surfaceWidth: '50', surfaceHeight: '50', surfaceCustomized: false });
const serializePrintArea3D = (area: PrintArea) => {
  const normalized = ensureEditableNodes(area);
  const nodes = normalized.polygon!;
  return {
    x: normalized.x, y: normalized.y, left: normalized.x, top: normalized.y,
    width: normalized.width, height: normalized.height,
    ...(normalized.shape ? { shape: normalized.shape } : {}),
    ...(normalized.radius !== undefined ? { radius: normalized.radius } : {}),
    polygon: nodes,
    nodes,
  };
};
const emptyForm = (): ProductForm => ({ name: '', price: '', category: '', printWidthCm: '', printHeightCm: '', model3dUrl: '', textureWidth: String(DEFAULT_MESH_SETTINGS.textureWidth), textureHeight: String(DEFAULT_MESH_SETTINGS.textureHeight), hasMultipleSides: false, extraSidePrice: '0', fullWrapPrice: '0', sidesPricingMode: 'per_side', setupFee: '0', minimumQuantity: '1', volumeDiscounts: [], availableAddonIds: [], customizableParts: [], options: [], views: [createViewForm(0)] });

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
  textureWidth: String(product.meshSettings?.textureWidth ?? DEFAULT_MESH_SETTINGS.textureWidth),
  textureHeight: String(product.meshSettings?.textureHeight ?? DEFAULT_MESH_SETTINGS.textureHeight),
  hasMultipleSides: product.pricingRules?.hasMultipleSides ?? (product.views.length > 1),
  extraSidePrice: String(product.pricingSchema?.sidesPricing?.pricePerAdditionalSide ?? product.pricingRules?.extraSidePrice ?? 0),
  fullWrapPrice: String(product.pricingSchema?.sidesPricing?.wrapPrice ?? product.pricingRules?.fullWrapPrice ?? 0),
  sidesPricingMode: product.pricingSchema?.sidesPricing?.mode ?? 'per_side',
  setupFee: String(product.pricingSchema?.setupFee ?? 0),
  minimumQuantity: String(product.pricingSchema?.minimumQuantity ?? 1),
  volumeDiscounts: (product.pricingSchema?.volumeDiscounts ?? []).map((tier) => ({ minQty: String(tier.minQty), discountPercentage: String(tier.discountPercentage) })),
  availableAddonIds: product.availableAddonIds ?? [],
  customizableParts: product.customizableParts?.map((part) => ({ ...part, defaultColor: part.defaultColor || '#cbd5e1', enabled: part.enabled !== false })) ?? [],
  options: product.options?.map((option) => ({
    ...option,
    displayType: option.displayType ?? option.type,
    values: option.values.map((value) => ensureVariantMeshSettings({
      ...value,
      priceModifier: product.pricingSchema?.variantModifiers?.find((modifier) => modifier.variantId === value.id)?.priceDelta ?? value.priceModifier,
    }, product.meshSettings ?? DEFAULT_MESH_SETTINGS)),
  })) ?? [],
  views: normalizeViewIds(product.views.map((view, index) => {
    const areaX = Number(view.printArea.x);
    const areaY = Number(view.printArea.y);
    const areaWidth = Number(view.printArea.width);
    const areaHeight = Number(view.printArea.height);
    const percent = view.printAreaUnit === 'percent'
      && [areaX, areaY, areaWidth, areaHeight].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)
      && areaX + areaWidth <= 100
      && areaY + areaHeight <= 100;
    const safeArea = {
      x: cleanPercentage(normalizePercentage(percent ? areaX : (areaX * 100) / REFERENCE_WIDTH, 25)),
      y: cleanPercentage(normalizePercentage(percent ? areaY : (areaY * 100) / REFERENCE_HEIGHT, 25)),
      width: cleanPercentage(normalizePercentage(percent ? areaWidth : (areaWidth * 100) / REFERENCE_WIDTH, 50)),
      height: cleanPercentage(normalizePercentage(percent ? areaHeight : (areaHeight * 100) / REFERENCE_HEIGHT, 50)),
    };
    const area3D = ensureEditableNodes(view.printArea3D
      ? normalizePrintArea({
        x: Number(view.printArea3D.x ?? view.printArea3D.left ?? safeArea.x),
        y: Number(view.printArea3D.y ?? view.printArea3D.top ?? safeArea.y),
        width: Number(view.printArea3D.width ?? safeArea.width),
        height: Number(view.printArea3D.height ?? safeArea.height),
        shape: view.printArea3D.shape ?? view.printArea.shape,
        radius: view.printArea3D.radius ?? view.printArea.radius,
        polygon: view.printArea3D.nodes ?? view.printArea3D.polygon,
      })
      : normalizePrintArea({
        ...safeArea,
        shape: view.printArea.shape,
        radius: view.printArea.radius,
        polygon: view.printArea.polygon,
      }));
    return {
      id: view.id, name: view.name || view.label || `Vista ${index + 1}`, mockupUrl: view.mockupUrl,
      x: String(safeArea.x), y: String(safeArea.y), width: String(safeArea.width), height: String(safeArea.height),
      // Zona redondeada: 'rect' (o ausente) sigue funcionando igual que antes.
      shape: view.printArea.shape === 'rounded' || view.printArea.shape === 'ellipse' ? view.printArea.shape : 'rect',
      radius: String(view.printArea.radius ?? 25),
      polygon: Array.isArray(view.printArea.polygon) && view.printArea.polygon.length >= 3 ? JSON.stringify(view.printArea.polygon) : '',
      area3D,
      // La proyección 3D parte de la misma zona segura 2D; valores de
      // calibraciones antiguas no deben desplazar el contorno al editar.
      surfaceX: String(safeArea.x), surfaceY: String(safeArea.y),
      surfaceWidth: String(safeArea.width), surfaceHeight: String(safeArea.height),
      surfaceCustomized: false,
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
  const [meshInspection, setMeshInspection] = useState<MeshInspectionState>({ status: 'idle', message: '', meshes: [] });
  const [localGLBFile, setLocalGLBFile] = useState<File | null>(null);
  const [localGLBPreviewUrl, setLocalGLBPreviewUrl] = useState('');
  const [addonCatalog, setAddonCatalog] = useState<Addon[]>([]);
  const [addonCatalogError, setAddonCatalogError] = useState('');
  const activeView = form.views[Math.min(activeTab, form.views.length - 1)];
  const activeIndex = Math.min(activeTab, form.views.length - 1);
  const activeArea3D = activeView ? normalizePrintArea(activeView.area3D) : null;
  const printWidth = Number(form.printWidthCm) || 0;
  const printHeight = Number(form.printHeightCm) || 0;
  const pixelsWidth = Math.round((printWidth / 2.54) * 300);
  const pixelsHeight = Math.round((printHeight / 2.54) * 300);
  const detectedMeshNames = meshInspection.meshes.map((mesh) => mesh.name);
  useEffect(() => {
    if (!localGLBFile) { setLocalGLBPreviewUrl(''); return; }
    const url = URL.createObjectURL(localGLBFile);
    setLocalGLBPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [localGLBFile]);
  const baseViews = useMemo(() => form.views.map((view) => ({ id: view.id, name: view.name || 'Vista', mockupUrl: view.mockupUrl, printArea: normalizePrintArea({ x: Number(view.x), y: Number(view.y), width: Number(view.width), height: Number(view.height), shape: view.shape, radius: Number(view.radius), polygon: parsePolygonForm(view.polygon) }) })), [form.views]);
  const adminPreviewProduct: Product = {
    id: selectedId ?? 'admin-product-preview', name: form.name || 'Vista previa', category: form.category,
    price: Number(form.price) || 0, canvasWidth: REFERENCE_WIDTH, canvasHeight: REFERENCE_HEIGHT,
    printWidthCm: printWidth || undefined, printHeightCm: printHeight || undefined,
    model3dUrl: form.model3dUrl.trim() || localGLBPreviewUrl || undefined,
    meshSettings: { textureWidth: Number(form.textureWidth) || DEFAULT_MESH_SETTINGS.textureWidth, textureHeight: Number(form.textureHeight) || DEFAULT_MESH_SETTINGS.textureHeight },
    pricingSchema: { sidesPricing: { mode: form.sidesPricingMode, pricePerAdditionalSide: Number(form.extraSidePrice) || 0, wrapPrice: Number(form.fullWrapPrice) || 0 } },
    colors: products.find((product) => product.id === selectedId)?.colors,
    customizableParts: form.customizableParts,
    views: form.views.map((view) => ({
      id: view.id, name: view.name || 'Vista', mockupUrl: view.mockupUrl,
      printArea: { x: Number(view.x), y: Number(view.y), left: Number(view.x), top: Number(view.y), width: Number(view.width), height: Number(view.height), ...(view.shape !== 'rect' ? { shape: view.shape } : {}), ...(view.shape === 'rounded' ? { radius: Number(view.radius) } : {}), ...(parsePolygonForm(view.polygon) ? { polygon: parsePolygonForm(view.polygon) } : {}) },
      printAreaUnit: 'percent',
    })),
  };
  const adminArea = activeView && activeArea3D ? {
    left: activeArea3D.x * 8, top: activeArea3D.y * 8,
    width: activeArea3D.width * 8, height: activeArea3D.height * 8,
    canvasWidth: REFERENCE_WIDTH, canvasHeight: REFERENCE_HEIGHT,
    shape: activeArea3D.shape,
    radius: activeArea3D.radius,
    polygon: activeArea3D.polygon?.map((point) => ({ x: point.x * 8, y: point.y * 8 })),
    viewIndex: activeIndex, viewCount: Math.max(1, form.views.length), viewId: activeView.id, viewName: activeView.name,
  } : null;
  const area3DAspectRatio = Number(form.textureWidth) / Math.max(1, Number(form.textureHeight) * Math.max(1, form.views.length));
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
      setMeshInspection({ status: 'idle', message: 'Sube un archivo .GLB válido para inspeccionar el modelo.', meshes: [] });
      return;
    }
    const requestId = ++meshInspectRequestRef.current;
    if (!/\.glb(?:$|[?#])/i.test(url) && !/^data:model\/gltf-binary/i.test(url)) {
      setMeshInspection({ status: 'error', message: 'Sube un archivo .GLB válido para inspeccionar el modelo.', meshes: [] });
      return;
    }
    setMeshInspection({ status: 'loading', message: 'Analizando geometría, materiales y coordenadas UV…', meshes: [] });
    const timeout = window.setTimeout(async () => {
      let inspectedScene: THREE.Object3D | null = null;
      try {
        const gltf = await new GLTFLoader().loadAsync(url);
        inspectedScene = gltf.scene;
        if (requestId !== meshInspectRequestRef.current) return;
        const meshes = inspectGLBMeshes(gltf.scene);
        setMeshInspection(meshes.length
          ? { status: 'success', message: `Se inspeccionaron ${meshes.length} ${meshes.length === 1 ? 'malla' : 'mallas'} del modelo.`, meshes }
          : { status: 'error', message: 'El GLB cargó, pero no contiene mallas. Sube un archivo .GLB válido para inspeccionarlo.', meshes: [] });
      } catch (error) {
        if (requestId === meshInspectRequestRef.current) {
          console.warn('[ADMIN] No se pudo inspeccionar el GLB indicado:', error);
          setMeshInspection({ status: 'error', message: 'No se pudo leer ese modelo. Verifica la URL y vuelve a cargar un archivo .GLB válido.', meshes: [] });
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
    setLocalGLBFile(file);
    const requestId = ++meshInspectRequestRef.current;
    if (!file.name.toLowerCase().endsWith('.glb')) {
      setMeshInspection({ status: 'error', message: 'Selecciona un archivo con extensión .GLB.', meshes: [] });
      return;
    }
    setMeshInspection({ status: 'loading', message: `Analizando ${file.name}…`, meshes: [] });
    let inspectedScene: THREE.Object3D | null = null;
    try {
      const buffer = await file.arrayBuffer();
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        new GLTFLoader().parse(buffer, '', resolve, reject);
      });
      inspectedScene = gltf.scene;
      if (requestId !== meshInspectRequestRef.current) return;
      const meshes = inspectGLBMeshes(gltf.scene);
      setMeshInspection(meshes.length
        ? { status: 'success', message: `${file.name}: ${meshes.length} ${meshes.length === 1 ? 'malla inspeccionada' : 'mallas inspeccionadas'}. El archivo se analiza localmente; configura una URL persistente para usarlo en la tienda.`, meshes }
        : { status: 'error', message: 'El GLB no contiene mallas. Selecciona un archivo válido para inspeccionarlo.', meshes: [] });
    } catch (error) {
      console.warn('[ADMIN] No se pudo inspeccionar el archivo GLB local:', error);
      if (requestId === meshInspectRequestRef.current) setMeshInspection({ status: 'error', message: 'No se pudo leer el archivo. Selecciona un archivo .GLB válido para inspeccionarlo.', meshes: [] });
    } finally {
      if (inspectedScene) disposeInspectedGLB(inspectedScene);
    }
  };
  const setField = (field: Exclude<keyof ProductForm, 'views' | 'options' | 'customizableParts' | 'availableAddonIds' | 'hasMultipleSides' | 'volumeDiscounts' | 'sidesPricingMode'>, value: string) => {
    if (field === 'model3dUrl') setLocalGLBFile(null);
    setForm((current) => ({ ...current, [field]: value }));
  };
  const updateVolumeDiscount = (index: number, key: 'minQty' | 'discountPercentage', value: string) => setForm((current) => ({ ...current, volumeDiscounts: current.volumeDiscounts.map((tier, tierIndex) => tierIndex === index ? { ...tier, [key]: value } : tier) }));
  const addVolumeDiscount = () => setForm((current) => ({ ...current, volumeDiscounts: [...current.volumeDiscounts, { minQty: '', discountPercentage: '' }] }));
  const removeVolumeDiscount = (index: number) => setForm((current) => ({ ...current, volumeDiscounts: current.volumeDiscounts.filter((_, tierIndex) => tierIndex !== index) }));
  const isAddonSelectedForForm = (addon: Addon) => form.availableAddonIds.includes(addon.id);
  const toggleAvailableAddon = (id: string) => setForm((current) => ({ ...current, availableAddonIds: current.availableAddonIds.includes(id) ? current.availableAddonIds.filter((item) => item !== id) : [...current.availableAddonIds, id] }));
  const updateCustomizablePart = (index: number, patch: Partial<CustomizablePart>) => setForm((current) => ({ ...current, customizableParts: current.customizableParts.map((part, partIndex) => partIndex === index ? { ...part, ...patch } : part) }));
  const addCustomizablePart = () => setForm((current) => ({ ...current, customizableParts: [...current.customizableParts, { id: crypto.randomUUID(), label: '', meshName: '', defaultColor: '#cbd5e1', enabled: true }] }));
  const setViewField = (index: number, field: keyof ProductViewForm, value: string) => setForm((current) => ({ ...current, views: current.views.map((view, viewIndex) => viewIndex === index ? { ...view, [field]: value } : view) }));
  const setViewPrintArea = (index: number, area: PrintArea) => setForm((current) => ({ ...current, views: current.views.map((view, viewIndex) => viewIndex !== index ? view : {
    ...view,
    x: String(area.x), y: String(area.y), width: String(area.width), height: String(area.height),
    shape: area.shape ?? 'rect', radius: String(area.radius ?? 25),
    polygon: area.polygon && area.polygon.length >= 3 ? JSON.stringify(area.polygon) : '',
    // La zona 3D sigue la 2D en tiempo real. El ajuste manual vuelve a estar
    // disponible desde este estado después de editar el marco azul.
    surfaceX: String(area.x), surfaceY: String(area.y), surfaceWidth: String(area.width), surfaceHeight: String(area.height),
    surfaceCustomized: false,
  }) }));
  const setViewArea3D = (index: number, area: PrintArea) => setForm((current) => ({
    ...current,
    views: current.views.map((view, viewIndex) => viewIndex === index
      ? { ...view, area3D: normalizePrintArea(area) }
      : view),
  }));
  const resetViewArea3DFrom2D = (index: number) => setForm((current) => ({
    ...current,
    views: current.views.map((view, viewIndex) => viewIndex === index
      ? {
        ...view,
        area3D: ensureEditableNodes({
          x: Number(view.x), y: Number(view.y), width: Number(view.width), height: Number(view.height),
          shape: view.shape, radius: Number(view.radius), polygon: parsePolygonForm(view.polygon),
        }),
      }
      : view),
  }));
  const handleReplicatePrintArea = (sourceViewId: string) => setForm((current) => {
    const sourceView = current.views.find((view) => view.id === sourceViewId);
    if (!sourceView) return current;
    const sourceArea3D = normalizePrintArea(sourceView.area3D);
    return {
      ...current,
      views: current.views.map((view) => view.id === sourceViewId ? view : ({
        ...view,
        x: sourceView.x,
        y: sourceView.y,
        width: sourceView.width,
        height: sourceView.height,
        shape: sourceView.shape,
        radius: sourceView.radius,
        polygon: sourceView.polygon,
        area3D: {
          ...sourceArea3D,
          polygon: sourceArea3D.polygon?.map((point) => ({ ...point })),
        },
      })),
    };
  });
  const handleAddView = () => setForm((current) => { const next = [...current.views, createViewForm(current.views.length)]; setActiveTab(next.length - 1); return { ...current, views: next }; });
  const removeView = (index: number) => setForm((current) => ({ ...current, views: current.views.filter((_, viewIndex) => viewIndex !== index) }));
  const resetForm = () => { setSelectedId(null); setForm(emptyForm()); setLocalGLBFile(null); setMeshInspection({ status: 'idle', message: '', meshes: [] }); setActiveTab(0); };
  const handleSelect = (product: Product) => { setSelectedId(product.id); setForm(toForm(product)); setLocalGLBFile(null); setMeshInspection({ status: 'idle', message: '', meshes: [] }); setActiveTab(0); };
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
    const textureWidth = Number(form.textureWidth);
    const textureHeight = Number(form.textureHeight);
    const volumeDiscounts = form.volumeDiscounts.map((tier) => ({ minQty: Number(tier.minQty), discountPercentage: Number(tier.discountPercentage) }));
    if (!Number.isFinite(setupFee) || setupFee < 0) { alert('El cargo de preparación debe ser un monto igual o mayor a cero.'); return; }
    if (!Number.isInteger(minimumQuantity) || minimumQuantity < 1) { alert('La cantidad mínima debe ser un número entero igual o mayor a uno.'); return; }
    if (!Number.isInteger(textureWidth) || textureWidth < 1 || !Number.isInteger(textureHeight) || textureHeight < 1) { alert('El ancho y alto de textura 3D deben ser enteros positivos.'); return; }
    if (volumeDiscounts.some((tier) => !Number.isInteger(tier.minQty) || tier.minQty < 1 || !Number.isFinite(tier.discountPercentage) || tier.discountPercentage < 0 || tier.discountPercentage > 100)) { alert('Revisa los descuentos por volumen: indica una cantidad entera y un descuento entre 0 y 100%.'); return; }
    if (new Set(volumeDiscounts.map((tier) => tier.minQty)).size !== volumeDiscounts.length) { alert('Cada nivel de descuento por volumen debe tener una cantidad mínima distinta.'); return; }
    if (form.views.some((view) => !view.mockupUrl.trim())) { alert('Agrega un mockup para cada vista.'); return; }
    const invalidSurface = form.views.some((view) => {
      if (!view.surfaceCustomized) return false;
      const x = Number(view.surfaceX), y = Number(view.surfaceY);
      const width = Number(view.surfaceWidth), height = Number(view.surfaceHeight);
      return ![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 100 || y + height > 100;
    });
    if (invalidSurface) { alert('El panel 3D debe quedar dentro de la superficie: ajusta el marco azul.'); return; }
    if (form.customizableParts.length > 0 && !form.model3dUrl.trim()) { alert('Configura una ruta pública o URL para el GLB antes de guardar sus mallas personalizables.'); return; }
    if (form.customizableParts.some((part) => !part.label.trim() || !part.meshName.trim())) { alert('Completa la etiqueta y el nombre exacto de malla en cada pieza 3D, o elimina las piezas incompletas.'); return; }
    const meshNames = form.customizableParts.map((part) => part.meshName.trim().toLocaleLowerCase());
    if (new Set(meshNames).size !== meshNames.length) { alert('Cada pieza personalizable debe apuntar a un nombre de malla distinto.'); return; }
    const options = form.options.map((option) => ({ ...option, name: option.name.trim() || 'Opción', displayType: option.displayType ?? option.type, values: option.values.map((value) => ({ ...value, label: value.label.trim() || 'Variante', thumbnailUrl: value.thumbnailUrl?.trim() || undefined, mockupUrl: undefined, printArea: null, views: form.views.map((baseView) => { const configured = value.views?.find((view) => view.viewId === baseView.id); const baseArea = normalizePrintArea({ x: Number(baseView.x), y: Number(baseView.y), width: Number(baseView.width), height: Number(baseView.height), shape: baseView.shape, radius: Number(baseView.radius), polygon: parsePolygonForm(baseView.polygon) }); const printArea = configured?.printArea ? normalizePrintArea(configured.printArea) : baseArea; const printArea3D = serializePrintArea3D(configured?.printArea3D ?? baseView.area3D); const printSurface3D = configured?.printSurface3D ?? { x: Number(baseView.surfaceX), y: Number(baseView.surfaceY), width: Number(baseView.surfaceWidth), height: Number(baseView.surfaceHeight) }; return { viewId: baseView.id, name: baseView.name.trim() || 'Vista', mockupUrl: configured?.mockupUrl?.trim() || null, printArea, printArea3D, printSurface3D, printSurface3DMode: configured?.printSurface3DMode ?? (baseView.surfaceCustomized ? 'custom' as const : 'automatic' as const) }; }) })) }));
    const meshSettings: MeshSettings = { textureWidth, textureHeight };
    const optionsWithMeshSettings = options.map((option) => ({
      ...option,
      values: option.values.map((value) => {
        const hasPrintArea = Boolean(value.printArea) || Boolean(value.views?.some((view) => view.printArea));
        return hasPrintArea ? { ...value, meshSettings: value.meshSettings ?? meshSettings } : value;
      }),
    }));
    const customizableParts = form.customizableParts.map((part) => ({ ...part, label: part.label.trim(), meshName: part.meshName.trim(), defaultColor: part.defaultColor || '#cbd5e1' }));
    const basePrice = Number(form.price);
    const productId = selectedId ?? crypto.randomUUID();
    const extraSidePrice = Math.max(0, Number(form.extraSidePrice) || 0);
    const fullWrapPrice = Math.max(0, Number(form.fullWrapPrice) || 0);
    const variantModifiers = options.flatMap((option) => option.values.map((value) => ({ variantId: value.id, priceDelta: value.priceModifier })));
    const product: Product = { id: productId, name: form.name.trim(), price: basePrice, basePrice, category: form.category.trim(), canvasWidth: REFERENCE_WIDTH, canvasHeight: REFERENCE_HEIGHT, printWidthCm: printWidth || undefined, printHeightCm: printHeight || undefined, model3dUrl: form.model3dUrl.trim() || undefined, meshSettings, pricingRules: { hasMultipleSides: form.hasMultipleSides, extraSidePrice, fullWrapPrice }, pricingSchema: { variantModifiers, setupFee, minimumQuantity, volumeDiscounts, sidesPricing: { mode: form.sidesPricingMode, pricePerAdditionalSide: extraSidePrice, wrapPrice: fullWrapPrice } }, availableAddonIds: form.availableAddonIds, customizableParts, options: optionsWithMeshSettings, views: form.views.map((view) => { const name = view.name.trim() || 'Vista'; const polygon = parsePolygonForm(view.polygon); const area3D = serializePrintArea3D(view.area3D); const x = cleanPercentage(Number(view.x) || 0); const y = cleanPercentage(Number(view.y) || 0); return { id: view.id, name, label: name, mockupUrl: view.mockupUrl.trim(), printArea: { x, y, left: x, top: y, width: cleanPercentage(Number(view.width) || 0), height: cleanPercentage(Number(view.height) || 0), ...(view.shape !== 'rect' ? { shape: view.shape } : {}), ...(view.shape === 'rounded' ? { radius: cleanRadius(Number(view.radius)) } : {}), ...(polygon ? { polygon } : {}) }, printAreaUnit: 'percent' as const, printArea3D: area3D, printSurface3DMode: view.surfaceCustomized ? 'custom' as const : 'automatic' as const, ...(view.surfaceCustomized ? { printSurface3D: { x: cleanPercentage(Number(view.surfaceX)), y: cleanPercentage(Number(view.surfaceY)), width: cleanPercentage(Number(view.surfaceWidth)), height: cleanPercentage(Number(view.surfaceHeight)) } } : {}) }; }) };
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
    <div className="mx-auto max-w-screen-2xl">
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
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-lg font-semibold text-slate-900">Datos básicos</h2><p className="mt-1 text-sm text-slate-500">Información que verán tus clientes al elegir el producto.</p></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field className="sm:col-span-2" label="Nombre del producto" value={form.name} onChange={(value) => setField('name', value)} required /><Field label="Precio" type="number" min="0" step="0.01" value={form.price} onChange={(value) => setField('price', value)} required /><Field label="Categoría" value={form.category} onChange={(value) => setField('category', value)} required /><Field label="Ancho físico de impresión (cm)" type="number" min="0.1" step="0.1" value={form.printWidthCm} onChange={(value) => setField('printWidthCm', value)} placeholder="20" /><Field label="Alto físico de impresión (cm)" type="number" min="0.1" step="0.1" value={form.printHeightCm} onChange={(value) => setField('printHeightCm', value)} placeholder="9" /><Field className="sm:col-span-2" label="Modelo 3D (ruta pública o URL .GLB)" value={form.model3dUrl} onChange={(value) => setField('model3dUrl', value)} placeholder="/models/termo.glb" />
              <div className="sm:col-span-2 grid grid-cols-2 gap-3"><Field label="Ancho de textura 3D" type="number" min="1" step="1" value={form.textureWidth} onChange={(value) => setField('textureWidth', value)} /><Field label="Alto de textura 3D" type="number" min="1" step="1" value={form.textureHeight} onChange={(value) => setField('textureHeight', value)} /><p className="col-span-2 text-xs text-slate-500">Predeterminado: 2048 × 512 px. El viewer ajusta la altura efectiva a la proporción real de la superficie UV del GLB.</p></div>
              <div className="sm:col-span-2">
                <input ref={modelFileInputRef} type="file" accept=".glb,model/gltf-binary" className="sr-only" onChange={(event) => { void inspectLocalGLB(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                <button type="button" onClick={() => modelFileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-violet-300 hover:bg-violet-50"><Upload size={16} /> Seleccionar GLB para inspeccionar</button>
                <p className="mt-1.5 text-xs text-slate-500">El archivo se analiza localmente. Para usarlo en la tienda, también configura una URL o ruta pública arriba.</p>
                <p role="status" className={`mt-2 text-xs ${meshInspection.status === 'error' ? 'text-red-600' : meshInspection.status === 'success' ? 'text-emerald-700' : meshInspection.status === 'loading' ? 'text-violet-700' : 'text-slate-500'}`}>{meshInspection.message || 'Sube un archivo .GLB válido para inspeccionar sus mallas y UV.'}</p>
                {detectedMeshNames.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{detectedMeshNames.map((name) => <span key={name} className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 font-mono text-[10px] text-violet-800">{name}</span>)}</div>}
              </div>
              <div className="sm:col-span-2"><GLBModelPreview url={form.model3dUrl} file={localGLBFile} /></div>
              {meshInspection.meshes.length > 0 && <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3"><h3 className="text-sm font-semibold text-slate-800">Diagnóstico de mallas y UV</h3><p className="mt-1 text-xs text-slate-500">Las UV convierten la superficie 3D en coordenadas de textura. Islas apiladas pueden repetir el diseño.</p></div>
                <div className="space-y-2">{meshInspection.meshes.map((mesh, index) => <details key={`${mesh.name}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3" open={meshInspection.meshes.length <= 2}>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs font-semibold text-slate-800">{mesh.name}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${mesh.uvCount ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{mesh.uvCount ? 'UV presentes' : 'Sin UV'}</span></summary>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-3">
                    <div><dt className="text-slate-400">Vértices / triángulos</dt><dd className="font-medium text-slate-700">{mesh.vertexCount.toLocaleString()} / {mesh.triangleCount.toLocaleString()}</dd></div>
                    <div><dt className="text-slate-400">Tamaño local de malla</dt><dd className="font-medium text-slate-700">{mesh.dimensions}</dd></div>
                    <div><dt className="text-slate-400">Material</dt><dd className="truncate font-medium text-slate-700" title={mesh.materialNames.join(', ')}>{mesh.materialNames.join(', ') || '—'}</dd></div>
                    <div><dt className="text-slate-400">UV: coordenadas / rango</dt><dd className="font-medium text-slate-700">{mesh.uvCount.toLocaleString()} · {mesh.uvRange ?? '—'}</dd></div>
                    <div><dt className="text-slate-400">UV fuera de 0–1</dt><dd className={`font-semibold ${mesh.uvOutsideCount ? 'text-amber-700' : 'text-emerald-700'}`}>{mesh.uvOutsideCount.toLocaleString()} vértices</dd></div>
                    <div><dt className="text-slate-400">Triángulos UV idénticos</dt><dd className={`font-semibold ${mesh.overlappingUvTriangles ? 'text-amber-700' : 'text-emerald-700'}`}>{mesh.overlappingUvTriangles.toLocaleString()} posibles solapamientos</dd></div>
                  </dl>
                </details>)}</div>
                <p className="mt-3 text-[10px] leading-5 text-slate-500">El detector marca triángulos UV exactamente repetidos como señal de islas apiladas. La revisión definitiva de solapamientos, orientación frontal/trasera y zona física de impresión se realiza en el editor UV de Blender.</p>
              </div>}
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
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Configuración de mallas 3D personalizables</h2><p className="mt-1 max-w-xl text-sm text-slate-500">Agrega una opción por cada malla que el cliente podrá colorear. El nombre debe coincidir exactamente con el nodo Mesh del GLB.</p></div><button type="button" onClick={addCustomizablePart} disabled={!form.model3dUrl.trim() && detectedMeshNames.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={15} /> Agregar pieza</button></div>
            {!form.model3dUrl.trim() && detectedMeshNames.length === 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Agrega la ruta del GLB o selecciona un archivo local para detectar sus mallas. Para guardar, necesitarás una ruta persistente.</p>}
            {form.customizableParts.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Sin piezas configuradas. El panel de colores se ocultará al cliente.</p> : <div className="space-y-3">{form.customizableParts.map((part, index) => {
              const meshIsDetected = detectedMeshNames.includes(part.meshName);
              return <div key={part.id} className="grid grid-cols-1 items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_auto_auto_auto]">
                <Field label="Etiqueta visible" value={part.label} onChange={(value) => updateCustomizablePart(index, { label: value })} placeholder="Color del asa" />
                <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700"><span>Malla del GLB</span><select value={meshIsDetected ? part.meshName : '__manual__'} onChange={(event) => { if (event.target.value !== '__manual__') updateCustomizablePart(index, { meshName: event.target.value }); }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"><option value="__manual__">{detectedMeshNames.length ? 'Escribir nombre manualmente…' : 'Sin mallas detectadas · escribir nombre'}</option>{detectedMeshNames.map((name) => <option key={name} value={name}>{name}</option>)}</select>{!meshIsDetected && <input value={part.meshName} onChange={(event) => updateCustomizablePart(index, { meshName: event.target.value })} placeholder="Nombre exacto, ej. mesh_handle" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-violet-500" />}</label>
                <label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>Color inicial</span><input type="color" value={part.defaultColor} onChange={(event) => updateCustomizablePart(index, { defaultColor: event.target.value })} aria-label={`Color inicial para ${part.label || 'pieza'}`} className="h-10 w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-1 sm:w-14" /></label>
                <label className="flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={part.enabled !== false} onChange={(event) => updateCustomizablePart(index, { enabled: event.target.checked })} className="h-4 w-4 accent-violet-600" />Permitir al cliente</label>
                <button type="button" onClick={() => setForm((current) => ({ ...current, customizableParts: current.customizableParts.filter((_, partIndex) => partIndex !== index) }))} aria-label={`Eliminar ${part.label || 'pieza'}`} title="Eliminar pieza" className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
              </div>;
            })}</div>}
            <div className="mt-3 flex gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2.5 text-xs text-violet-800"><Info className="mt-0.5 shrink-0" size={15} /><span>Ejemplo: etiqueta “Color del asa” y nombre de malla “mesh_handle”. Si una malla no coincide, el control se mostrará pero no podrá modificarla.</span></div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-lg font-semibold text-slate-900">Vistas del producto</h2><p className="mt-1 text-sm text-slate-500">Configura el mockup 2D y calibra de forma independiente la faja UV de cada cara.</p></div>
            <div className="mb-5 flex gap-2 overflow-x-auto border-b border-slate-200"><div className="flex min-w-max gap-2">{form.views.map((view, index) => <button key={view.id} type="button" onClick={() => { setActiveTab(index); console.log('🔍 [EDITOR - VISTA ACTIVA]:', { id: view.id, name: view.name }); }} className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${activeIndex === index ? 'border-emerald-600 font-semibold text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{view.name || `Vista ${index + 1}`}</button>)}<button type="button" onClick={handleAddView} className="flex items-center gap-1 px-2 text-xs font-medium text-emerald-600 hover:underline"><Plus size={14} /> Agregar vista</button></div></div>
            {activeView && <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
              <div className="min-w-0 space-y-4">
                <Field label="Nombre de la vista" value={activeView.name} onChange={(value) => setViewField(activeIndex, 'name', value)} required />
                <div><span className="mb-1.5 block text-sm font-medium text-slate-700">Mockup de la vista</span><input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => { handleMockupFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                  {activeView.mockupUrl ? <div className="group relative overflow-hidden rounded-lg border border-slate-200"><img src={activeView.mockupUrl} alt="Mockup" className="h-32 w-full bg-slate-50 object-contain" /><div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 opacity-0 transition-opacity group-hover:opacity-100"><button type="button" onClick={handleReplaceMockup} className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow">Cambiar imagen</button></div></div> : <button type="button" onClick={handleReplaceMockup} className="group flex w-full items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40"><span className="flex h-16 w-16 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm"><Camera size={23} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-700">Subir mockup</span><span className="mt-1 block text-xs text-slate-500">PNG, JPG o WebP · se mostrará en la vista previa</span></span><Upload size={18} className="text-emerald-600" /></button>}</div>
                <Field label="O pega una URL o ruta del mockup" value={activeView.mockupUrl.startsWith('data:') ? '' : activeView.mockupUrl} onChange={(value) => setViewField(activeIndex, 'mockupUrl', value)} placeholder="/mockups/playera-frente.png" />
                <div className="rounded-xl border border-slate-200 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] p-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">Configuración 2D · Zona segura</p>{form.views.length > 1 && <button type="button" onClick={() => handleReplicatePrintArea(activeView.id)} title="Copiar las dimensiones de esta zona segura (2D y 3D) a las demás vistas" className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"><Copy size={14} />Replicar Zona Segura a todas las vistas</button>}</div>{activeArea ? <MockupAreaPicker mockupUrl={activeView.mockupUrl} initialPrintArea={activeArea} onChange={(area) => setViewPrintArea(activeIndex, area)} /> : null}</div>
                {activeArea && <p className="text-center text-xs text-slate-500">Zona segura: <span className="font-semibold text-slate-700">{activeArea.width}% × {activeArea.height}%</span> del mockup.</p>}
                {form.views.length > 1 && <button type="button" onClick={() => removeView(activeIndex)} className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700"><Trash2 size={16} /> Eliminar esta vista</button>}
              </div>
              <div className="min-w-0 space-y-4">
                {activeArea3D && <div className="space-y-3 rounded-xl border border-sky-200 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-slate-800">Proyección 3D · {activeView.name || `Vista ${activeIndex + 1}`}</h3><p className="mt-1 text-xs text-slate-500">Edita los nodos de la faja plana; esta calibración se guarda por vista.</p></div><button type="button" onClick={() => resetViewArea3DFrom2D(activeIndex)} className="text-xs font-semibold text-sky-700 underline underline-offset-2 hover:text-sky-900">Volver a usar zona 2D</button></div>
                  <div><PrintArea3DEditor viewName={activeView.name || `Vista ${activeIndex + 1}`} area={activeArea3D} aspectRatio={1} mockupUrl={activeView.mockupUrl} onChange={(area) => setViewArea3D(activeIndex, area)} /></div>
                  <div className="h-[380px] min-h-[350px] overflow-hidden rounded-xl border border-slate-200 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] p-2">{adminArea && adminPreviewProduct.model3dUrl ? <Product3DViewer product={adminPreviewProduct} componentColors={Object.fromEntries(form.customizableParts.map((part) => [part.meshName, part.defaultColor]))} enabledMeshNames={form.customizableParts.filter((part) => part.enabled !== false).map((part) => part.meshName)} showSafeAreaGuide safeArea={adminArea} activeViewIndex={activeIndex} activeViewName={activeView.name} /> : <div className="grid h-full place-items-center rounded-lg bg-slate-50 px-6 text-center text-xs text-slate-500">Agrega una ruta de modelo GLB para ver la proyección sobre la malla 3D.</div>}</div>
                </div>}
              </div>
            </div>}
          </section>
          <AdminProductOptionsForm options={form.options} baseViews={baseViews} onChange={(options) => setForm((current) => ({ ...current, options }))} />
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white px-6 pt-1 shadow-sm"><div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-md"><span className="text-xs text-slate-500">Última modificación realizada recientemente</span><div className="flex gap-3"><button type="button" onClick={resetForm} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancelar</button><button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700">Guardar producto</button></div></div></section>
        </div>

      </form>
      </div>
    </div>
  </main>;
}

function Field({ label, className = '', onChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { label: string; onChange: (value: string) => void }) {
  return <label className={`grid gap-1.5 text-sm font-medium text-slate-700 ${className}`}><span>{label}</span><input {...props} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>;
}
