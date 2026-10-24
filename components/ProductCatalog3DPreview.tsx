'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { FabricCanvasLike, PrintAreaBounds, PrintViewSnapshot } from '@/components/editor/Product3DViewer';
import type { Product } from '@/src/store/useProductStore';
import type { Draft3DViewPose } from '@/src/utils/designDraftStorage';
import { getProductDesignTemplate } from '@/src/utils/templateStorage';

const Product3DViewer = dynamic(() => import('@/components/editor/Product3DViewer'), { ssr: false });
const CANVAS_SIZE = 800;

function makeSnapshots(product: Product, objectsByView: Record<string, any[]>): PrintViewSnapshot[] {
  return product.views.map((view, index) => {
    const area = view.printArea;
    const scale = view.printAreaUnit === 'percent' ? CANVAS_SIZE / 100 : 1;
    const area3D = view.printArea3D;
    return {
      viewId: view.id,
      viewName: view.name,
      viewIndex: index,
      viewCount: product.views.length,
      area: {
        left: Number(area.x ?? area.left ?? 0) * scale,
        top: Number(area.y ?? area.top ?? 0) * scale,
        width: Number(area.width) * scale,
        height: Number(area.height) * scale,
        canvasWidth: CANVAS_SIZE,
        canvasHeight: CANVAS_SIZE,
        shape: area.shape,
        radius: area.radius,
        polygon: area.polygon?.map((point) => ({ x: point.x * scale, y: point.y * scale })),
        viewId: view.id,
        viewName: view.name,
        viewIndex: index,
        viewCount: product.views.length,
      },
      projectionArea: area3D ? {
        left: Number(area3D.x ?? area3D.left ?? 0),
        top: Number(area3D.y ?? area3D.top ?? 0),
        width: Number(area3D.width),
        height: Number(area3D.height),
        shape: area3D.shape,
        radius: area3D.radius,
        polygon: area3D.nodes ?? area3D.polygon,
      } : undefined,
      objects: objectsByView[view.id] ?? [],
    };
  });
}

export default function ProductCatalog3DPreview({ product, componentColors, enabledMeshNames }: {
  product: Product;
  componentColors: Record<string, string>;
  enabledMeshNames: string[];
}) {
  const [preview, setPreview] = useState<{ canvas: FabricCanvasLike; snapshots: PrintViewSnapshot[]; pose?: Draft3DViewPose } | null>(null);
  useEffect(() => {
    let cancelled = false;
    let canvas: any;
    const load = async () => {
      try {
        const firstViewId = product.views[0]?.id;
        const hasTemplate = Boolean(firstViewId && product.designTemplate?.viewIds.includes(firstViewId));
        const template = hasTemplate ? await getProductDesignTemplate(product.id) : null;
        const objectsByView = Object.fromEntries(product.views.map((view) => {
          try {
            const serialized = template?.views[view.id];
            const parsed = serialized ? JSON.parse(serialized) : [];
            return [view.id, Array.isArray(parsed) ? parsed : []];
          } catch { return [view.id, []]; }
        }));
        const fabricModule = await import('fabric');
        if (cancelled) return;
        const fabric: any = (fabricModule as any).fabric || fabricModule;
        canvas = new fabric.StaticCanvas(document.createElement('canvas'), {
          width: CANVAS_SIZE, height: CANVAS_SIZE, backgroundColor: 'transparent', renderOnAddRemove: false,
        });
        await new Promise<void>((resolve) => canvas.loadFromJSON({ version: '5.3.0', objects: objectsByView[firstViewId ?? ''] ?? [] }, resolve));
        if (cancelled) { canvas.dispose(); return; }
        canvas.renderAll();
        setPreview({
          canvas: canvas as FabricCanvasLike,
          snapshots: makeSnapshots(product, objectsByView),
          pose: firstViewId ? template?.modelPoses?.[firstViewId] : undefined,
        });
      } catch (error) {
        console.warn('[catalog] No se pudo cargar el diseño base para la tarjeta 3D.', { productId: product.id, error });
      }
    };
    void load();
    return () => { cancelled = true; canvas?.dispose?.(); };
  }, [product]);

  const view = product.views[0];
  const printArea = view?.printArea;
  const scale = view?.printAreaUnit === 'percent' ? CANVAS_SIZE / 100 : 1;
  const safeArea: PrintAreaBounds = {
    left: Number(printArea?.x ?? printArea?.left ?? 0) * scale,
    top: Number(printArea?.y ?? printArea?.top ?? 0) * scale,
    width: Number(printArea?.width ?? 100) * scale,
    height: Number(printArea?.height ?? 100) * scale,
    canvasWidth: CANVAS_SIZE,
    canvasHeight: CANVAS_SIZE,
    shape: printArea?.shape,
    radius: printArea?.radius,
    polygon: printArea?.polygon?.map((point) => ({ x: point.x * scale, y: point.y * scale })),
    viewId: view?.id,
    viewName: view?.name,
    viewIndex: 0,
    viewCount: product.views.length,
  };

  return <Product3DViewer
    product={product}
    componentColors={componentColors}
    enabledMeshNames={enabledMeshNames}
    showSafeAreaGuide
    safeArea={safeArea}
    designCanvas={preview?.canvas}
    designViewSnapshots={preview?.snapshots}
    viewPose={preview?.pose}
    activeViewIndex={0}
    activeViewName={view?.name}
    sceneBackgroundUrl={product.catalogSceneUrl || view?.sceneBackgroundUrl}
    scene3DPlacement={product.catalogModelPlacement}
    staticView
    compact
    hideSafeAreaOverlay
  />;
}
