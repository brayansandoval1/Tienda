'use client';

import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { Product } from '@/src/store/useProductStore';
import { DEFAULT_MESH_SETTINGS, type MeshSettings, type ProductVariant } from '@/src/config/products';

type FabricCanvasLike = {
  getElement: () => HTMLCanvasElement;
  getObjects: () => Array<any>;
  on: (eventName: string, handler: () => void) => void;
  off: (eventName: string, handler: () => void) => void;
};
export type PrintAreaBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
  canvasWidth?: number;
  canvasHeight?: number;
  surface3D?: { x: number; y: number; width: number; height: number };
  surface3DMode?: 'automatic' | 'custom';
  shape?: 'rect' | 'rounded' | 'ellipse';
  radius?: number;
  polygon?: Array<{ x: number; y: number }>;
  viewIndex?: number;
  viewCount?: number;
  viewId?: string;
  viewName?: string;
  printArea3D?: {
    x?: number;
    y?: number;
    left?: number;
    top?: number;
    width: number;
    height: number;
    shape?: 'rect' | 'rounded' | 'ellipse';
    radius?: number;
    polygon?: Array<{ x: number; y: number }>;
    nodes?: Array<{ x: number; y: number }>;
  };
  /** Zona de destino calibrada en porcentajes de la cara desplegada. */
  projectionArea?: PrintAreaBounds;
};
type PrintViewSnapshot = {
  viewId: string;
  viewName?: string;
  viewIndex: number;
  viewCount: number;
  area: PrintAreaBounds;
  projectionArea?: PrintAreaBounds;
  objects: any[];
};
const CYLINDER_RADIUS = 0.86;
const CYLINDER_HEIGHT = 2.55;
const CYLINDER_TEXTURE_HEIGHT = 1200;
const CYLINDER_TEXTURE_ASPECT = (2 * Math.PI * CYLINDER_RADIUS) / CYLINDER_HEIGHT;
const DEFAULT_PRINT_TEXTURE_SIZE = {
  width: Math.round(CYLINDER_TEXTURE_HEIGHT * CYLINDER_TEXTURE_ASPECT),
  height: CYLINDER_TEXTURE_HEIGHT,
};
const projectionDiagnosticTimes = new Map<string, number>();
type ProductPartColors = {
  body: string;
  ring: { enabled: boolean; color: string };
  interior: { enabled: boolean; color: string };
  handle: { enabled: boolean; color: string };
};
type ComponentColors = Record<string, string>;
const neutralPartColors: Omit<ProductPartColors, 'body'> = {
  ring: { enabled: false, color: '#cbd5e1' },
  interior: { enabled: false, color: '#e2e8f0' },
  handle: { enabled: false, color: '#f8fafc' },
};

function matchesMeshName(meshName: string, expectedName: string) {
  const normalizedName = meshName.trim().toLocaleLowerCase();
  return normalizedName === expectedName
    || normalizedName.startsWith(`${expectedName}.`)
    || normalizedName.startsWith(`${expectedName}_`)
    || normalizedName.startsWith(`${expectedName}-`);
}

function useFabricCanvas() {
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvasLike | null>(null);
  useEffect(() => {
    const attach = (event?: Event) => {
      const canvas = (event as CustomEvent<{ canvas?: FabricCanvasLike }> | undefined)?.detail?.canvas
        ?? (window as Window & { __editorFabricCanvas?: FabricCanvasLike }).__editorFabricCanvas;
      if (canvas) setFabricCanvas(canvas);
    };
    attach();
    window.addEventListener('editor:canvas-ready', attach);
    return () => window.removeEventListener('editor:canvas-ready', attach);
  }, []);
  return fabricCanvas;
}

function usePrintAreaBounds() {
  const [printArea, setPrintArea] = useState<PrintAreaBounds | null>(null);
  useEffect(() => {
    const initial = (window as Window & { __editorPrintArea?: PrintAreaBounds }).__editorPrintArea;
    if (initial) setPrintArea(initial);
    const handleChange = (event: Event) => {
      const next = (event as CustomEvent<PrintAreaBounds>).detail;
      if (next && next.width > 0 && next.height > 0) setPrintArea(next);
    };
    window.addEventListener('editor:print-area-changed', handleChange);
    return () => window.removeEventListener('editor:print-area-changed', handleChange);
  }, []);
  return printArea;
}

function WebGLDiagnostics() {
  const { gl } = useThree();
  useEffect(() => {
    const context = gl.getContext();
    console.info('[Product3DViewer] Canvas WebGL inicializado:', {
      vendor: context.getParameter(context.VENDOR),
      renderer: context.getParameter(context.RENDERER),
    });
    const handleContextLost = (event: Event) => {
      console.error('[Product3DViewer] Se perdió el contexto WebGL mientras el visor estaba activo.', event);
    };
    const handleContextRestored = () => console.info('[Product3DViewer] Contexto WebGL restaurado.');
    gl.domElement.addEventListener('webglcontextlost', handleContextLost);
    gl.domElement.addEventListener('webglcontextrestored', handleContextRestored);
    return () => {
      // El renderer se desmonta al ir a Opciones/Revisar; no dejamos listeners
      // colgados que interpreten el cierre normal del canvas como un fallo.
      gl.domElement.removeEventListener('webglcontextlost', handleContextLost);
      gl.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [gl]);
  return null;
}

function ZoomableOrbitControls() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const zoomRef = useRef(1);
  const baseDistance = 5;
  const minZoom = 0.5;
  const maxZoom = 2;

  useEffect(() => {
    const handleZoom = (event: Event) => {
      const detail = (event as CustomEvent<{ delta?: number; zoom?: number }>).detail;
      const requestedZoom = typeof detail?.zoom === 'number'
        ? detail.zoom
        : zoomRef.current + (detail?.delta ?? 0);
      const nextZoom = Math.min(maxZoom, Math.max(minZoom, requestedZoom));
      const controls = controlsRef.current;
      if (!controls) return;
      const direction = camera.position.clone().sub(controls.target);
      if (direction.lengthSq() === 0) direction.set(0, 0, 1);
      direction.setLength(baseDistance / nextZoom);
      camera.position.copy(controls.target).add(direction);
      camera.updateProjectionMatrix();
      controls.update();
      zoomRef.current = nextZoom;
    };
    window.addEventListener('editor:zoom', handleZoom);
    return () => window.removeEventListener('editor:zoom', handleZoom);
  }, [camera]);

  const syncZoomFromOrbit = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    const distance = camera.position.distanceTo(controls.target);
    if (distance > 0) zoomRef.current = Math.min(maxZoom, Math.max(minZoom, baseDistance / distance));
  };

  return <OrbitControls
    ref={controlsRef}
    target={[0, 0, 0]}
    enablePan={false}
    enableDamping
    dampingFactor={0.08}
    minDistance={baseDistance / maxZoom}
    maxDistance={baseDistance / minZoom}
    minPolarAngle={Math.PI / 3.2}
    maxPolarAngle={Math.PI / 1.7}
    onChange={syncZoomFromOrbit}
  />;
}

function renderFullTexture360(fabricCanvas: FabricCanvasLike, area: PrintAreaBounds | null, targetCanvas: HTMLCanvasElement, baseColor: string, panoramic: boolean, objectsOverride?: any[], outlineColor = '#22c55e', projectionArea?: PrintAreaBounds) {
  // Si falta el área publicada por el editor, recorta una faja panorámica
  // centrada en el espacio lógico cuadrado de Fabric. El buffer conserva la
  // resolución/aspecto de la plantilla de impresión.
  const sourceCanvas = fabricCanvas.getElement();
  const logicalWidth = Math.max(1, sourceCanvas.width || 800);
  const logicalHeight = Math.max(1, sourceCanvas.height || 800);
  const fallbackHeight = panoramic
    ? Math.min(logicalHeight, logicalWidth * DEFAULT_PRINT_TEXTURE_SIZE.height / DEFAULT_PRINT_TEXTURE_SIZE.width)
    : logicalHeight;
  const bounds = area ?? {
    left: 0,
    top: (logicalHeight - fallbackHeight) / 2,
    width: logicalWidth,
    height: fallbackHeight,
  };
  const target = targetCanvas;
  const context = targetCanvas.getContext('2d');
  if (!context) return;
  // El tamaño del canvas origen de CanvasTexture se mantiene fijo mientras
  // Three.js lo tiene enlazado a WebGL.
  const viewCount = Math.max(1, Math.floor(Number(area?.viewCount) || 1));
  const viewIndex = Math.min(viewCount - 1, Math.max(0, Math.floor(Number(area?.viewIndex) || 0)));
  const segmentIndex = (viewCount - viewIndex) % viewCount;
  const sideWidth = panoramic ? target.width / viewCount : target.width;
  const sideLeft = panoramic ? sideWidth * segmentIndex : 0;
  const canvasWidth = Math.max(1, Number(area?.canvasWidth) || logicalWidth);
  const canvasHeight = Math.max(1, Number(area?.canvasHeight) || logicalHeight);
  const autoSurfaceHeight = (bounds.height / canvasHeight) * 100;
  const autoSurfaceWidth = Math.min(
    100,
    autoSurfaceHeight
      * (bounds.width / Math.max(1, bounds.height))
      * (target.height / Math.max(1, sideWidth)),
  );
  const autoSurfaceCenterX = ((bounds.left + bounds.width / 2) / canvasWidth) * 100;
  const hasCustomSurface = area?.surface3DMode === 'custom' && Boolean(area.surface3D);
  const targetBounds = projectionArea ?? area;
  const hasCalibratedTarget = Boolean(projectionArea);
  const automaticSurface3D = panoramic
    ? {
      x: (bounds.left / canvasWidth) * 100,
      y: (bounds.top / canvasHeight) * 100,
      width: (bounds.width / canvasWidth) * 100,
      height: (bounds.height / canvasHeight) * 100,
    }
    : {
      x: Math.min(100 - autoSurfaceWidth, Math.max(0, autoSurfaceCenterX - autoSurfaceWidth / 2)),
      y: (bounds.top / canvasHeight) * 100,
      width: autoSurfaceWidth,
      height: autoSurfaceHeight,
    };
  const surface3D = hasCalibratedTarget && targetBounds
    ? {
      x: (Number(targetBounds.left ?? 0) / 100) * 100,
      y: (Number(targetBounds.top ?? 0) / 100) * 100,
      width: (Number(targetBounds.width) / 100) * 100,
      height: (Number(targetBounds.height) / 100) * 100,
    }
    : hasCustomSurface && area?.surface3D
    ? area.surface3D
    : automaticSurface3D;
  const surfaceX = Math.min(100, Math.max(0, Number(surface3D.x) || 0));
  const surfaceY = Math.min(100, Math.max(0, Number(surface3D.y) || 0));
  const surfaceWidth = Math.min(100 - surfaceX, Math.max(1, Number(surface3D.width) || 100));
  const surfaceHeight = Math.min(100 - surfaceY, Math.max(1, Number(surface3D.height) || 100));
  const panelLeft = sideLeft + (surfaceX / 100) * sideWidth;
  const panelTop = (surfaceY / 100) * target.height;
  const panelWidth = (surfaceWidth / 100) * sideWidth;
  const panelHeight = (surfaceHeight / 100) * target.height;
  // Las cajas panorámicas automáticas y los ajustes personalizados usan el
  // ancho/alto del panel activo en cada eje. Así, el porcentaje horizontal de
  // la vista 2D ocupa ese mismo porcentaje del arco UV asignado a esa cara.
  // Con un destino 3D calibrado, la altura define la escala global. Mantener
  // el mismo factor en ambos ejes evita deformar textos, círculos e imágenes;
  // cualquier excedente horizontal se recorta al contorno calibrado.
  const uniformScale = hasCalibratedTarget || panoramic
    ? panelHeight / Math.max(1, bounds.height)
    : Math.min(
      panelWidth / Math.max(1, bounds.width),
      panelHeight / Math.max(1, bounds.height),
    );
  const mapsAreaDirectly = !hasCalibratedTarget && panoramic;
  const scaleX = mapsAreaDirectly
    ? panelWidth / Math.max(1, bounds.width)
    : uniformScale;
  const scaleY = mapsAreaDirectly
    ? panelHeight / Math.max(1, bounds.height)
    : uniformScale;
  const safeLeft = mapsAreaDirectly
    ? panelLeft
    : panelLeft + (panelWidth - bounds.width * scaleX) / 2;
  const safeTop = mapsAreaDirectly
    ? panelTop
    : panelTop + (panelHeight - bounds.height * scaleY) / 2;
  const offsetX = safeLeft - bounds.left * scaleX;
  const offsetY = safeTop - bounds.top * scaleY;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = 'source-over';
  context.clearRect(sideLeft, 0, sideWidth, target.height);
  context.fillStyle = baseColor || '#ffffff';
  context.fillRect(sideLeft, 0, sideWidth, target.height);

  // En el editor final, la zona 2D es el origen lógico del diseño y la zona
  // calibrada 3D es su destino. Se transforma el lienzo completo como una
  // unidad para conservar la colocación relativa y la forma de cada objeto.
  // Sólo se recorta por el segmento UV de la vista; el contorno seguro no
  // recorta las figuras que crucen su borde.
  if (projectionArea) {
    const targetLeft = Math.min(100, Math.max(0, Number(projectionArea.left) || 0));
    const targetTop = Math.min(100, Math.max(0, Number(projectionArea.top) || 0));
    const targetWidth = Math.min(100 - targetLeft, Math.max(0.01, Number(projectionArea.width) || 100));
    const targetHeight = Math.min(100 - targetTop, Math.max(0.01, Number(projectionArea.height) || 100));
    const destX = sideLeft + (sideWidth * targetLeft) / 100;
    const destY = (target.height * targetTop) / 100;
    const destW = (sideWidth * targetWidth) / 100;
    const destH = (target.height * targetHeight) / 100;
    const visibleObjects = (objectsOverride ?? fabricCanvas.getObjects()).filter((object) =>
      object && object.visible !== false && !object.isMockup && !object.isGuide && !object.isGuideLine && !object.isCropOverlay && !object.isDesignBackground,
    );
    const objectBounds = visibleObjects.reduce((combined, object) => {
      const objectBounds = typeof object.getBoundingRect === 'function'
        ? object.getBoundingRect(true)
        : { left: Number(object.left) || 0, top: Number(object.top) || 0, width: Number(object.width) || 0, height: Number(object.height) || 0 };
      const left = Number(objectBounds.left) || 0;
      const top = Number(objectBounds.top) || 0;
      const right = left + (Number(objectBounds.width) || 0);
      const bottom = top + (Number(objectBounds.height) || 0);
      return {
        left: Math.min(combined.left, left),
        top: Math.min(combined.top, top),
        right: Math.max(combined.right, right),
        bottom: Math.max(combined.bottom, bottom),
      };
    }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    const objectWidth = Number.isFinite(objectBounds.left) ? objectBounds.right - objectBounds.left : 0;
    const objectHeight = Number.isFinite(objectBounds.top) ? objectBounds.bottom - objectBounds.top : 0;
    // Ajuste caja a caja: cada eje ocupa exactamente la dimensión calibrada.
    // El usuario controla estas proporciones desde el editor 3D del Admin.
    const scaleX = destW / Math.max(1, bounds.width);
    const scaleY = destH / Math.max(1, bounds.height);
    const offsetX = destX - bounds.left * scaleX;
    const offsetY = destY - bounds.top * scaleY;
    const diagnosticKey = `${area?.viewId ?? area?.viewIndex ?? 'view'}:${targetLeft}:${targetTop}:${targetWidth}:${targetHeight}:${bounds.left}:${bounds.top}:${bounds.width}:${bounds.height}`;
    const now = Date.now();
    if (now - (projectionDiagnosticTimes.get(diagnosticKey) ?? 0) > 1000) {
      projectionDiagnosticTimes.set(diagnosticKey, now);
      console.log('[Product3DViewer] Diagnóstico de proyección segura 2D → UV:', JSON.stringify({
        viewId: area?.viewId,
        viewName: area?.viewName,
        viewIndex,
        viewCount,
        segmentIndex,
        texture: { width: target.width, height: target.height, segmentWidth: sideWidth, segmentLeft: sideLeft },
        sourceArea2D: {
          left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height,
          canvasWidth, canvasHeight,
          relative: { left: bounds.left / canvasWidth * 100, top: bounds.top / canvasHeight * 100, width: bounds.width / canvasWidth * 100, height: bounds.height / canvasHeight * 100 },
        },
        destinationArea3D: { left: targetLeft, top: targetTop, width: targetWidth, height: targetHeight, x: destX, y: destY, widthPx: destW, heightPx: destH },
        transform: { scaleX, scaleY, offsetX, offsetY, sourceBounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height } },
        designObjects: { count: visibleObjects.length, bounds: Number.isFinite(objectBounds.left) ? { left: objectBounds.left, top: objectBounds.top, width: objectWidth, height: objectHeight } : null, projectedSize: { width: objectWidth * scaleX, height: objectHeight * scaleY } },
        targetFit: { horizontal: destW / Math.max(1, objectWidth * scaleX), vertical: destH / Math.max(1, objectHeight * scaleY) },
      }));
    }

    context.save();
    context.setTransform(scaleX, 0, 0, scaleY, offsetX, offsetY);
    visibleObjects.forEach((object) => {
      const clipPath = object.clipPath;
      try {
        // El editor añade clipPaths para la exportación 2D. La proyección 3D
        // usa su propio contenedor calibrado y no debe cortar objetos en el
        // límite 2D; restauramos la referencia inmediatamente después.
        if (clipPath) object.clipPath = undefined;
        object.render(context);
      } finally {
        if (clipPath) object.clipPath = clipPath;
      }
    });
    context.restore();

    context.save();
    context.strokeStyle = outlineColor;
    context.lineWidth = 2;
    context.setLineDash([6, 6]);
    context.strokeRect(destX, destY, destW, destH);
    context.restore();
    return;
  }

  const safeWidth = hasCalibratedTarget ? panelWidth : bounds.width * scaleX;
  const safeHeight = hasCalibratedTarget ? panelHeight : bounds.height * scaleY;
  const pathLeft = hasCalibratedTarget ? panelLeft : safeLeft;
  const pathTop = hasCalibratedTarget ? panelTop : safeTop;
  const safePathArea = hasCalibratedTarget ? targetBounds : area;

  const traceSafeAreaPath = () => {
    context.beginPath();
    if (safePathArea?.polygon && safePathArea.polygon.length >= 3) {
      safePathArea.polygon.forEach((point, index) => {
        const x = hasCalibratedTarget
          ? panelLeft + ((point.x - Number(targetBounds?.left ?? 0)) / 100) * sideWidth
          : safeLeft + (point.x - bounds.left) * scaleX;
        const y = hasCalibratedTarget
          ? panelTop + ((point.y - Number(targetBounds?.top ?? 0)) / 100) * target.height
          : safeTop + (point.y - bounds.top) * scaleY;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
    } else if (safePathArea?.shape === 'ellipse') {
      context.ellipse(pathLeft + safeWidth / 2, pathTop + safeHeight / 2, safeWidth / 2, safeHeight / 2, 0, 0, Math.PI * 2);
    } else if (safePathArea?.shape === 'rounded') {
      const radius = Math.min(50, Math.max(0, Number(safePathArea.radius) || 0)) / 100;
      const radiusX = Math.min(safeWidth / 2, safeWidth * radius);
      const radiusY = Math.min(safeHeight / 2, safeHeight * radius);
      context.moveTo(pathLeft + radiusX, pathTop);
      context.lineTo(pathLeft + safeWidth - radiusX, pathTop);
      context.quadraticCurveTo(pathLeft + safeWidth, pathTop, pathLeft + safeWidth, pathTop + radiusY);
      context.lineTo(pathLeft + safeWidth, pathTop + safeHeight - radiusY);
      context.quadraticCurveTo(pathLeft + safeWidth, pathTop + safeHeight, pathLeft + safeWidth - radiusX, pathTop + safeHeight);
      context.lineTo(pathLeft + radiusX, pathTop + safeHeight);
      context.quadraticCurveTo(pathLeft, pathTop + safeHeight, pathLeft, pathTop + safeHeight - radiusY);
      context.lineTo(pathLeft, pathTop + radiusY);
      context.quadraticCurveTo(pathLeft, pathTop, pathLeft + radiusX, pathTop);
      context.closePath();
    } else {
      context.rect(pathLeft, pathTop, safeWidth, safeHeight);
    }
  };

  context.save();
  context.setTransform(scaleX, 0, 0, scaleY, offsetX, offsetY);
  try {
    (objectsOverride ?? fabricCanvas.getObjects()).forEach((object) => {
      if (!object || object.visible === false || object.isMockup || object.isGuide || object.isGuideLine || object.isCropOverlay) return;
      // Dibuja en un canvas auxiliar: no se toca el viewport ni se solicita un
      // render del canvas interactivo. Los clipPath de Fabric siguen activos.
      object.render(context);
    });
  } finally {
    context.restore();
  }

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.strokeStyle = outlineColor;
  context.lineWidth = Math.max(2, target.height / 300);
  context.setLineDash([6, 6]);
  traceSafeAreaPath();
  context.stroke();
  context.restore();

  if (area) {
    context.save();
    context.globalCompositeOperation = 'source-over';
    context.strokeStyle = outlineColor;
    context.lineWidth = Math.max(8, target.height / 150);
    context.setLineDash([Math.max(20, target.height / 40), Math.max(10, target.height / 100)]);
    traceSafeAreaPath();
    context.stroke();
    context.restore();
  }
}

async function enlivenDesignObjects(serializedObjects: any[]) {
  if (!serializedObjects.length) return [];
  const fabricModule = await import('fabric');
  const fabric = (fabricModule as any).fabric ?? fabricModule;
  return new Promise<any[]>((resolve) => {
    fabric.util.enlivenObjects(serializedObjects, resolve);
  });
}

function FabricTextureSurface({ fabricCanvas, phoneCase, panoramic, printAspectRatio, modelUrl, meshSettings, partColors, componentColors, enabledMeshNames, adminArea }: { fabricCanvas: FabricCanvasLike; phoneCase: boolean; panoramic: boolean; printAspectRatio: number; modelUrl: string; meshSettings: MeshSettings; partColors: ProductPartColors; componentColors: ComponentColors; enabledMeshNames: string[]; adminArea?: PrintAreaBounds }) {
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUpdatingTexture = useRef(false);
  const designViewsRef = useRef<PrintViewSnapshot[]>([]);
  const [designViews, setDesignViews] = useState<PrintViewSnapshot[]>([]);
  const editorPrintArea = usePrintAreaBounds();
  const printArea = adminArea ?? editorPrintArea;
  const viewCount = Math.max(1, Math.floor(Number(printArea?.viewCount) || 1));
  const [surfaceAspectRatio, setSurfaceAspectRatio] = useState(printAspectRatio);
  const [frontTextureOffset, setFrontTextureOffset] = useState(0.5 / viewCount);
  useEffect(() => setSurfaceAspectRatio(printAspectRatio), [modelUrl, printAspectRatio]);
  useEffect(() => setFrontTextureOffset(panoramic ? 0.5 / viewCount : 0), [modelUrl, panoramic, viewCount]);
  const handleSurfaceAspectChange = useCallback((aspectRatio: number) => {
    if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return;
    setSurfaceAspectRatio((current) => Math.abs(current - aspectRatio) > 0.001 ? aspectRatio : current);
  }, []);
  const handleTextureOffsetChange = useCallback((offset: number) => {
    if (!Number.isFinite(offset)) return;
    setFrontTextureOffset((current) => Math.abs(current - offset) > 0.001 ? offset : current);
  }, []);
  useEffect(() => {
    const initialViews = (window as Window & { __editor3DViews?: PrintViewSnapshot[] }).__editor3DViews ?? [];
    designViewsRef.current = initialViews;
    setDesignViews(initialViews);
    const handleViewsChanged = (event: Event) => {
      const next = (event as CustomEvent<{ views?: PrintViewSnapshot[] }>).detail?.views ?? [];
      designViewsRef.current = next;
      setDesignViews(next);
    };
    window.addEventListener('editor:3d-views-changed', handleViewsChanged);
    return () => window.removeEventListener('editor:3d-views-changed', handleViewsChanged);
  }, []);
  const printCanvas = useMemo(() => {
    const canvas = document.createElement('canvas');
    const textureAspectRatio = Number.isFinite(surfaceAspectRatio) && surfaceAspectRatio > 0
      ? surfaceAspectRatio
      : meshSettings.textureWidth / Math.max(1, meshSettings.textureHeight);
    canvas.width = Math.max(1, Math.round(meshSettings.textureWidth));
    canvas.height = panoramic
      ? Math.max(1, Math.round(meshSettings.textureHeight))
      : Math.max(1, Math.round(canvas.width / textureAspectRatio));
    console.log('[Product3DViewer] printArea real:', {
      left: printArea?.left ?? 0,
      top: printArea?.top ?? 0,
      width: printArea?.width ?? 800,
      height: printArea?.height ?? 800,
      aspectRatio: (printArea?.width ?? 800) / Math.max(1, printArea?.height ?? 800),
    });
    console.log('[Product3DViewer] printCanvas buffer:', {
      width: canvas.width,
      height: canvas.height,
      aspectRatio: canvas.width / Math.max(1, canvas.height),
    });
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#f8fafc';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    return canvas;
  }, [fabricCanvas, meshSettings.textureHeight, meshSettings.textureWidth, panoramic, surfaceAspectRatio]);
  const texture = useMemo(() => {
    const canvasTexture = new THREE.CanvasTexture(printCanvas);
    canvasTexture.colorSpace = THREE.SRGBColorSpace;
    canvasTexture.flipY = false;
    resetTextureUvTransform(canvasTexture, panoramic, frontTextureOffset);
    canvasTexture.anisotropy = 8;
    canvasTexture.needsUpdate = true;
    return canvasTexture;
  }, [fabricCanvas, frontTextureOffset, panoramic, printCanvas]);

  useEffect(() => {
    textureRef.current = texture;
    const updateTexture = () => {
      if (isUpdatingTexture.current) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        isUpdatingTexture.current = true;
        const renderTexture = async () => {
          isUpdatingTexture.current = true;
          try {
            const snapshots = adminArea ? [] : designViewsRef.current;
            if (!snapshots.length) {
              const liveArea3D = !adminArea ? printArea?.printArea3D : undefined;
              const liveProjection = liveArea3D ? {
                left: Number(liveArea3D.x ?? liveArea3D.left ?? 0),
                top: Number(liveArea3D.y ?? liveArea3D.top ?? 0),
                width: Number(liveArea3D.width),
                height: Number(liveArea3D.height),
                shape: liveArea3D.shape,
                radius: liveArea3D.radius,
                polygon: liveArea3D.nodes ?? liveArea3D.polygon,
              } : undefined;
              renderFullTexture360(fabricCanvas, printArea, printCanvas, partColors.body, panoramic, undefined, adminArea ? '#0284c7' : '#22c55e', liveProjection);
            } else {
              const context = printCanvas.getContext('2d');
              if (!context) return;
              context.setTransform(1, 0, 0, 1, 0, 0);
              context.globalCompositeOperation = 'source-over';
              context.clearRect(0, 0, printCanvas.width, printCanvas.height);
              context.fillStyle = partColors.body || '#ffffff';
              context.fillRect(0, 0, printCanvas.width, printCanvas.height);

              for (const snapshot of snapshots) {
                let objects: any[];
                if (snapshot.viewId === printArea?.viewId) {
                  objects = fabricCanvas.getObjects();
                } else {
                  const serializedObjects = snapshot.objects.map((object) => {
                    const copy = { ...object };
                    delete copy.clipPath;
                    return copy;
                  });
                  objects = await enlivenDesignObjects(serializedObjects);
                }
                const isActiveSnapshot = snapshot.viewId === printArea?.viewId;
                const livePrintArea3D = isActiveSnapshot ? printArea?.printArea3D : undefined;
                const activeProjection = livePrintArea3D ? {
                  left: Number(livePrintArea3D.x ?? livePrintArea3D.left ?? 0),
                  top: Number(livePrintArea3D.y ?? livePrintArea3D.top ?? 0),
                  width: Number(livePrintArea3D.width),
                  height: Number(livePrintArea3D.height),
                  shape: livePrintArea3D.shape,
                  radius: livePrintArea3D.radius,
                  polygon: livePrintArea3D.nodes ?? livePrintArea3D.polygon,
                } : snapshot.projectionArea;
                renderFullTexture360(fabricCanvas, isActiveSnapshot ? printArea : snapshot.area, printCanvas, partColors.body, panoramic, objects, adminArea ? '#0284c7' : '#22c55e', activeProjection);
                if (snapshot.viewId !== printArea?.viewId) objects.forEach((object) => object.dispose?.());
              }
            }
            if (textureRef.current) textureRef.current.needsUpdate = true;
          } catch (error) {
            console.error('[Product3DViewer] No se pudo actualizar la textura de impresión:', error);
          } finally {
            isUpdatingTexture.current = false;
            debounceRef.current = null;
          }
        };
        void renderTexture();
      }, 100);
    };
    const fabricEvents = ['object:modified', 'object:moving', 'object:scaling', 'object:rotating', 'object:added', 'object:removed', 'path:created', 'after:render'];
    fabricEvents.forEach((eventName) => fabricCanvas.on(eventName, updateTexture));
    updateTexture();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      fabricEvents.forEach((eventName) => fabricCanvas.off(eventName, updateTexture));
      textureRef.current = null;
    };
  }, [adminArea, designViews, fabricCanvas, panoramic, partColors.body, printArea, printCanvas, texture]);

  useEffect(() => () => texture.dispose(), [texture]);

  const fallback = phoneCase
    ? <PhoneCase texture={texture} bodyColor={partColors.body} />
    : <Drinkware texture={texture} partColors={partColors} />;
  if (modelUrl) return <ModelLoadBoundary key={modelUrl} fallback={fallback}>
    <Suspense fallback={fallback}><GLBModel url={modelUrl} texture={texture} panoramic={panoramic} viewCount={viewCount} frontTextureOffset={frontTextureOffset} onSurfaceAspectChange={handleSurfaceAspectChange} onTextureOffsetChange={handleTextureOffsetChange} partColors={partColors} componentColors={componentColors} enabledMeshNames={enabledMeshNames} /></Suspense>
  </ModelLoadBoundary>;
  if (phoneCase) return fallback;
  return <Drinkware texture={texture} partColors={partColors} />;
}

function Drinkware({ texture, partColors }: { texture: THREE.CanvasTexture; partColors: ProductPartColors }) {
  const { gl } = useThree();
  useEffect(() => { texture.anisotropy = gl.capabilities.getMaxAnisotropy(); }, [gl, texture]);
  return <group position={[0, -0.05, 0]}>
    <mesh name="mesh_body" castShadow receiveShadow>
      <cylinderGeometry args={[0.86, 0.78, 2.55, 72, 1, true]} />
      <meshPhysicalMaterial color={partColors.body} roughness={0.24} metalness={0.03} clearcoat={0.8} clearcoatRoughness={0.18} />
    </mesh>
    <mesh name="mesh_printable" castShadow>
      <cylinderGeometry args={[0.868, 0.788, 2.55, 72, 1, true]} />
      <meshPhysicalMaterial map={texture} transparent depthWrite={false} roughness={0.3} clearcoat={0.45} side={THREE.DoubleSide} />
    </mesh>
    <mesh name="mesh_ring" position={[0, 1.21, 0]} castShadow>
      <torusGeometry args={[0.82, 0.045, 12, 72]} />
      <meshStandardMaterial color={partColors.ring.enabled ? partColors.ring.color : '#e2e8f0'} metalness={0.18} roughness={0.24} />
    </mesh>
    <mesh name="mesh_interior" position={[0, 1.225, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.765, 72]} />
      <meshStandardMaterial color={partColors.interior.enabled ? partColors.interior.color : '#f1f5f9'} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, -1.32, 0]} castShadow>
      <cylinderGeometry args={[0.72, 0.76, 0.1, 72]} />
      <meshStandardMaterial color="#e2e8f0" metalness={0.12} roughness={0.3} />
    </mesh>
    <mesh name="mesh_handle" position={[0.9, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
      <torusGeometry args={[0.58, 0.105, 20, 48, Math.PI]} />
      <meshPhysicalMaterial color={partColors.handle.enabled ? partColors.handle.color : '#f8fafc'} roughness={0.24} clearcoat={0.75} />
    </mesh>
  </group>;
}

function PhoneCase({ texture, bodyColor }: { texture: THREE.CanvasTexture; bodyColor: string }) {
  return <group>
    <mesh castShadow receiveShadow>
      <boxGeometry args={[1.72, 3.25, 0.18, 4, 4, 1]} />
      <meshPhysicalMaterial color={bodyColor || '#202938'} roughness={0.28} metalness={0.12} clearcoat={0.7} />
    </mesh>
    <mesh position={[0, 0, 0.096]} castShadow>
      <planeGeometry args={[1.58, 3.05]} />
      <meshPhysicalMaterial map={texture} roughness={0.32} clearcoat={0.5} />
    </mesh>
    <mesh position={[0, 0, -0.096]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[1.58, 3.05]} />
      <meshPhysicalMaterial map={texture} roughness={0.32} clearcoat={0.5} />
    </mesh>
  </group>;
}

function resetTextureUvTransform(texture: THREE.CanvasTexture, panoramic: boolean, frontTextureOffset: number) {
  const image = texture.image as { width?: number; height?: number };
  const canvasWidth = image.width || DEFAULT_PRINT_TEXTURE_SIZE.width;
  const canvasHeight = image.height || DEFAULT_PRINT_TEXTURE_SIZE.height;
  const canvasAspect = canvasWidth / (canvasHeight || 1);
  const cylinderCircumference = 2 * Math.PI * 0.86;
  const cylinderHeight = 2.55;
  const cylinderAspect = cylinderCircumference / cylinderHeight;
  // En una textura desplegada 360°, U=0..1 ya representa toda la
  // circunferencia; cada cara ocupa media imagen. No hay que comprimirla otra vez.
  const repeatX = panoramic ? 1 : Math.min(1, cylinderAspect / canvasAspect);

  texture.wrapS = panoramic ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  // El UV del GLB está orientado en sentido opuesto al lienzo. Invertimos U
  // alrededor del centro para corregir el espejo sin invertir el eje vertical.
  texture.center.set(0.5, 0.5);
  texture.repeat.set(-Math.abs(repeatX), 1.0);
  texture.offset.set(panoramic ? frontTextureOffset : 0, 0);
  texture.rotation = 0;
  texture.matrixAutoUpdate = true;
  texture.needsUpdate = true;
  console.log('[Product3DViewer] Transformación de textura:', {
    canvasWidth,
    canvasHeight,
    canvasAspect,
    cylinderAspect,
    repeatX: texture.repeat.x,
    offsetX: texture.offset.x,
    center: texture.center.toArray(),
    wrapS: texture.wrapS,
  });
}

function panoramicUvRange(mesh: THREE.Mesh) {
  const uv = mesh.geometry.getAttribute('uv');
  if (!uv?.count) return null;
  let minU = Infinity;
  let maxU = -Infinity;
  for (let index = 0; index < uv.count; index += 1) {
    minU = Math.min(minU, uv.getX(index));
    maxU = Math.max(maxU, uv.getX(index));
  }
  const span = maxU - minU;
  return { uv, minU, maxU, span, hasOpenSeam: minU > 0.001 && maxU >= 0.999 && span > 0.9 };
}

function normalizePanoramicUvSeam(mesh: THREE.Mesh) {
  const range = panoramicUvRange(mesh);
  if (!range?.hasOpenSeam) return;
  const geometry = mesh.geometry.clone();
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  for (let index = 0; index < uv.count; index += 1) {
    uv.setX(index, (uv.getX(index) - range.minU) / range.span);
  }
  uv.needsUpdate = true;
  mesh.geometry = geometry;
  console.info('[Product3DViewer] Costura UV panorámica normalizada:', {
    mesh: mesh.name,
    previousRange: `${range.minU.toFixed(4)}–${range.maxU.toFixed(4)}`,
  });
}

function getPanoramicFrontTextureOffset(mesh: THREE.Mesh, viewCount: number) {
  const positions = mesh.geometry.getAttribute('position');
  const range = panoramicUvRange(mesh);
  if (!positions?.count || !range || positions.count !== range.uv.count) return 0.5 / Math.max(1, viewCount);

  let phaseCos = 0;
  let phaseSin = 0;
  for (let index = 0; index < positions.count; index += 1) {
    const angle = Math.atan2(positions.getZ(index), positions.getX(index));
    const originalU = range.uv.getX(index);
    const u = range.hasOpenSeam ? (originalU - range.minU) / range.span : originalU;
    const phase = angle - 2 * Math.PI * u;
    phaseCos += Math.cos(phase);
    phaseSin += Math.sin(phase);
  }

  const phaseOffset = Math.atan2(phaseSin, phaseCos);
  const frontUv = (((Math.PI / 2 - phaseOffset) / (2 * Math.PI)) % 1 + 1) % 1;
  const mirroredFrontUv = (1 - frontUv + 1) % 1;
  return (0.5 / Math.max(1, viewCount) - mirroredFrontUv + 1) % 1;
}

function GLBModel({ url, texture, panoramic, viewCount, frontTextureOffset, onSurfaceAspectChange, onTextureOffsetChange, partColors, componentColors, enabledMeshNames }: { url: string; texture: THREE.CanvasTexture; panoramic: boolean; viewCount: number; frontTextureOffset: number; onSurfaceAspectChange: (aspectRatio: number) => void; onTextureOffsetChange: (offset: number) => void; partColors: ProductPartColors; componentColors: ComponentColors; enabledMeshNames: string[] }) {
  const gltf = useGLTF(url);
  useEffect(() => {
    const meshes: Array<Record<string, unknown>> = [];
    const meshObjects: THREE.Mesh[] = [];
    gltf.scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      meshObjects.push(mesh);
      mesh.geometry.computeBoundingBox();
      const size = mesh.geometry.boundingBox?.getSize(new THREE.Vector3());
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const uv = mesh.geometry.getAttribute('uv');
      let uvRange = 'sin UV';
      if (uv?.count) {
        let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
        for (let index = 0; index < uv.count; index += 1) {
          minU = Math.min(minU, uv.getX(index)); minV = Math.min(minV, uv.getY(index));
          maxU = Math.max(maxU, uv.getX(index)); maxV = Math.max(maxV, uv.getY(index));
        }
        uvRange = `U ${minU.toFixed(3)}–${maxU.toFixed(3)}, V ${minV.toFixed(3)}–${maxV.toFixed(3)}`;
      }
      meshes.push({
        mesh: mesh.name || '(sin nombre)',
        vertices: mesh.geometry.getAttribute('position')?.count ?? 0,
        uvCoordinates: mesh.geometry.getAttribute('uv')?.count ?? 0,
        uvRange,
        dimensions: size ? `${size.x.toFixed(3)} × ${size.y.toFixed(3)} × ${size.z.toFixed(3)}` : 'sin geometría',
        materials: materials.map((material) => material.name || material.type).join(', '),
        materialGroups: mesh.geometry.groups.length,
      });
    });
    const findMesh = (name: string) => meshObjects.find((mesh) => matchesMeshName(mesh.name, name));
    const printableMesh = findMesh('printable');
    const bodyMesh = findMesh('body');
    const geometryMesh = findMesh('geometry_0');
    const mostDetailedMesh = meshObjects.reduce<THREE.Mesh | null>((best, mesh) => {
      const vertexCount = mesh.geometry.getAttribute('position')?.count ?? 0;
      const bestVertexCount = best?.geometry.getAttribute('position')?.count ?? -1;
      return vertexCount > bestVertexCount ? mesh : best;
    }, null);
    const printMesh = printableMesh ?? bodyMesh ?? geometryMesh ?? mostDetailedMesh ?? meshObjects[0] ?? null;
    const size = printMesh?.geometry.boundingBox?.getSize(new THREE.Vector3());
    if (size && size.x > 0 && size.y > 0 && size.z >= 0) {
      const diameter = (size.x + size.z) / 2;
      const aspectRatio = panoramic
        ? (Math.PI * diameter) / size.y
        : size.x / size.y;
      onSurfaceAspectChange(aspectRatio);
      console.info('[Product3DViewer] Proporción de superficie del GLB:', {
        mesh: printMesh.name,
        dimensions: `${size.x.toFixed(3)} × ${size.y.toFixed(3)} × ${size.z.toFixed(3)}`,
        aspectRatio,
      });
    }
    if (panoramic && printMesh) {
      const textureOffset = getPanoramicFrontTextureOffset(printMesh, viewCount);
      onTextureOffsetChange(textureOffset);
      console.info('[Product3DViewer] Alineación UV del frente:', { textureOffset, viewCount });
    }
    console.info(`[Product3DViewer] GLB cargado: ${url}`);
    if (meshes.length) console.table(meshes);
    else console.error(`[Product3DViewer] El GLB no contiene mallas: ${url}`);
  }, [gltf.scene, onSurfaceAspectChange, onTextureOffsetChange, panoramic, url, viewCount]);
  const scene = useMemo(() => {
    const clonedScene = gltf.scene.clone(true);
    const meshes: THREE.Mesh[] = [];
    clonedScene.traverse((object) => { if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh); });
    const normalizedMeshName = (name: string) => name.trim().toLocaleLowerCase();
    const findExactMesh = (name: string) => meshes.find((mesh) => matchesMeshName(mesh.name, name));
    const printableMesh = findExactMesh('printable');
    const bodyMesh = findExactMesh('body');
    const geometryMesh = findExactMesh('geometry_0');
    const mostDetailedMesh = meshes.reduce<THREE.Mesh | null>((best, mesh) => {
      const vertexCount = mesh.geometry.getAttribute('position')?.count ?? 0;
      const bestVertexCount = best?.geometry.getAttribute('position')?.count ?? -1;
      return vertexCount > bestVertexCount ? mesh : best;
    }, null);
    const printMesh = printableMesh ?? bodyMesh ?? geometryMesh ?? mostDetailedMesh ?? meshes[0] ?? null;
    const normalizeMeshName = (name: string) => name.trim().toLocaleLowerCase();
    const enabledCustomColors = Object.entries(componentColors).filter(([meshName]) => enabledMeshNames.some((enabledName) => normalizeMeshName(enabledName) === normalizeMeshName(meshName)));
    const matchedMeshNames = new Set<string>();
    meshes.forEach((mesh) => {
      const match = enabledCustomColors.find(([meshName]) => normalizeMeshName(meshName) === normalizeMeshName(mesh.name));
      if (match) matchedMeshNames.add(match[0]);
    });
    enabledCustomColors.forEach(([meshName]) => {
      if (!matchedMeshNames.has(meshName)) console.warn(`[Product3DViewer] No existe una malla llamada "${meshName}" en este GLB; revisa el nombre configurado en Admin.`, { url });
    });
    const selectionStrategy = printableMesh ? 'nombre exacto printable'
      : bodyMesh ? 'nombre exacto body'
        : geometryMesh ? 'nombre exacto geometry_0'
          : mostDetailedMesh ? 'malla con más vértices' : meshes[0] ? 'primera malla disponible' : 'sin mallas';
    const selectionDetails = {
      estrategia: selectionStrategy,
      url,
      vertexCount: printMesh?.geometry.getAttribute('position')?.count ?? 0,
      materiales: printMesh ? (Array.isArray(printMesh.material) ? printMesh.material : [printMesh.material]).map((material) => material.name || material.type) : [],
      grupos: printMesh?.geometry.groups.length ?? 0,
    };
    if (printMesh && !printableMesh && !bodyMesh && !geometryMesh) {
      console.warn('[Product3DViewer] No se encontró una malla llamada printable, body o geometry_0; se usará la malla con más vértices.', printMesh.name, selectionDetails);
    } else {
      console.info('[Product3DViewer] Malla elegida para aplicar la textura:', printMesh?.name || '(ninguna)', selectionDetails);
    }
    if (panoramic && printMesh) normalizePanoramicUvSeam(printMesh);
    if (printMesh) {
      const uv = printMesh.geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
      if (uv?.count) {
        let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
        for (let index = 0; index < uv.count; index += 1) {
          const u = uv.getX(index), v = uv.getY(index);
          minU = Math.min(minU, u);
          minV = Math.min(minV, v);
          maxU = Math.max(maxU, u);
          maxV = Math.max(maxV, v);
        }
        console.log('[Product3DViewer] Malla y rango UV de impresión:', {
          printMesh: printMesh.name,
          minU,
          maxU,
          minV,
          maxV,
        });
        resetTextureUvTransform(texture, panoramic, frontTextureOffset);
      } else {
        console.error(`[Product3DViewer] La malla "${printMesh.name}" no tiene UV; no se puede proyectar el diseño.`, { url });
      }
    } else {
      console.error('[Product3DViewer] No se encontró una malla para aplicar la textura.', { url });
    }
    meshes.forEach((mesh) => {
      const name = mesh.name.toLowerCase().replace(/[\s-]+/g, '_');
      const namedPart = name.includes('interior') ? 'interior'
        : name.includes('ring') || name.includes('anillo') ? 'ring'
          : name.includes('handle') || name.includes('asa') ? 'handle'
            : name.includes('body') || name.includes('cuerpo') ? 'body' : null;
      const isPrintMesh = mesh === printMesh;
      const isColorablePart = namedPart === 'ring' || namedPart === 'interior' || namedPart === 'handle' || namedPart === 'body';
      const customColorEntry = enabledCustomColors.find(([meshName]) => normalizeMeshName(meshName) === normalizeMeshName(mesh.name));
      if (!isPrintMesh && !isColorablePart && !customColorEntry) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const nextMaterials = materials.map((original) => {
        const material = original.clone();
        if (isPrintMesh && 'map' in material) {
          // El color de la variante ya está horneado en el fondo del canvas.
          // Mantén el blanco del material para no teñir el arte y conserva
          // roughness/metalness originales para respetar el acabado del GLB.
          material.map = texture;
          texture.needsUpdate = true;
          // Algunos GLB de prueba exportan la única malla con opacidad cero,
          // alphaTest o caras orientadas al lado opuesto. La superficie debe
          // seguir visible mientras usamos el canvas como mapa de impresión.
          if ('transparent' in material) material.transparent = false;
          if ('opacity' in material) material.opacity = 1;
          if ('alphaTest' in material) material.alphaTest = 0;
          if ('side' in material) material.side = THREE.DoubleSide;
          material.needsUpdate = true;
        }
        const part = namedPart ?? (isPrintMesh ? 'body' : null);
        if ((part || customColorEntry) && 'color' in material && material.color instanceof THREE.Color) {
          const color = customColorEntry
            ? customColorEntry[1]
            : isPrintMesh
            ? '#ffffff'
            : part === 'body'
              ? partColors.body
              : part === 'ring' || part === 'interior' || part === 'handle'
                ? partColors[part].enabled
                  ? partColors[part].color
                  : ({ ring: '#e2e8f0', interior: '#f1f5f9', handle: '#f8fafc' } as const)[part]
                : '#ffffff';
          material.color.set(color);
          if (customColorEntry) material.needsUpdate = true;
        }
        return material;
      });
      mesh.material = Array.isArray(mesh.material) ? nextMaterials : nextMaterials[0];
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    // Normaliza modelos exportados en centímetros o milímetros para que
    // entren en el encuadre del visor, conservando sus proporciones.
    const bounds = new THREE.Box3().setFromObject(clonedScene);
    const size = bounds.getSize(new THREE.Vector3());
    const maxExtent = Math.max(size.x, size.y, size.z);
    if (maxExtent > 0) {
      const scale = 2.2 / maxExtent;
      clonedScene.scale.setScalar(scale);
      const center = bounds.getCenter(new THREE.Vector3());
      clonedScene.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    }
    return clonedScene;
  }, [gltf.scene, partColors, texture, url, componentColors, enabledMeshNames, panoramic, frontTextureOffset]);
  return <primitive object={scene} />;
}

class ModelLoadBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('[Product3DViewer] Falló la carga o el render del GLB:', error);
    console.error('[Product3DViewer] Traza de componentes:', info.componentStack);
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function ProductModel({ product, fabricCanvas, meshSettings, partColors, componentColors, enabledMeshNames, adminArea }: { product: Product; fabricCanvas: FabricCanvasLike | null; meshSettings: MeshSettings; partColors: ProductPartColors; componentColors: ComponentColors; enabledMeshNames: string[]; adminArea?: PrintAreaBounds }) {
  const phoneCase = /funda|iphone|phone|case/i.test(`${product.id} ${product.name}`);
  const hasPhysicalPrintSize = (product.printWidthCm ?? 0) > 0 && (product.printHeightCm ?? 0) > 0;
  const printAspect = hasPhysicalPrintSize
    ? (product.printWidthCm ?? 0) / (product.printHeightCm ?? 1)
    : 0;
  const textureAspectRatio = printAspect > 0 ? printAspect : CYLINDER_TEXTURE_ASPECT;
  const panoramic = !phoneCase && (
    Boolean(adminArea)
    || /termo|taza|mug|botella|vaso|bottle|travel.?mug/i.test(`${product.id} ${product.name}`)
    || product.pricingSchema?.sidesPricing?.mode === 'wrap'
    || printAspect >= 2
  );
  const fallback = <mesh>
      <cylinderGeometry args={[0.8, 0.8, 2.3, 48]} />
      <meshStandardMaterial color="#e2e8f0" />
    </mesh>;
  if (!fabricCanvas) {
    console.warn('[Product3DViewer] Esperando el canvas de Fabric; usando modelo provisional.', { productId: product.id });
    return fallback;
  }
  const modelUrl = product.model3dUrl?.trim()
    || (product.id === 'termo-acero-inoxidable' ? '/models/termo0.glb' : '');
  if (!modelUrl) {
    console.error('[Product3DViewer] El producto llegó al Canvas sin model3dUrl.', { productId: product.id });
    return fallback;
  }
  return <FabricTextureSurface key={product.id} fabricCanvas={fabricCanvas} phoneCase={phoneCase} panoramic={panoramic} printAspectRatio={textureAspectRatio} modelUrl={modelUrl} meshSettings={meshSettings} partColors={partColors} componentColors={componentColors} enabledMeshNames={enabledMeshNames} adminArea={adminArea} />;
}

export default function Product3DViewer({ product, componentColors, enabledMeshNames, showSafeAreaGuide = false, safeArea, activeViewIndex = 0, activeViewName }: { product: Product; componentColors: ComponentColors; enabledMeshNames: string[]; showSafeAreaGuide?: boolean; safeArea?: PrintAreaBounds; activeViewIndex?: number; activeViewName?: string }) {
  const fabricCanvas = useFabricCanvas();
  const editorPrintArea = usePrintAreaBounds();
  const adminArea = showSafeAreaGuide ? safeArea : undefined;
  const printArea = adminArea ?? editorPrintArea;
  const model3dUrl = product.model3dUrl?.trim();
  const viewCount = Math.max(1, Math.floor(Number(printArea?.viewCount) || 1));
  const viewNumber = Math.min(viewCount, Math.max(1, Math.floor(Number(printArea?.viewIndex) || 0) + 1));
  const defaultBodyColor = product.colors?.[0]?.hexColor ?? '#f8fafc';
  const adminFabricCanvas = useMemo<FabricCanvasLike>(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 800;
    return { getElement: () => canvas, getObjects: () => [], on: () => {}, off: () => {} };
  }, []);
  const previewMode = showSafeAreaGuide;
  const resolvedFabricCanvas = previewMode ? adminFabricCanvas : fabricCanvas;
  const previewViewCount = Math.max(1, Number(safeArea?.viewCount) || 1);
  const activeAdminViewIndex = Math.max(0, Math.min(previewViewCount - 1, activeViewIndex));
  const normalizedViewName = (activeViewName ?? safeArea?.viewName ?? '').trim().toLocaleLowerCase();
  const adminViewAngle = /espalda|back|trasera/.test(normalizedViewName)
    ? Math.PI
    : /frente|front|delantera/.test(normalizedViewName)
      ? 0
      : (activeAdminViewIndex / previewViewCount) * Math.PI * 2;
  const adminCameraPosition: [number, number, number] = [5 * Math.sin(adminViewAngle), 0, 5 * Math.cos(adminViewAngle)];
  const [meshSettings, setMeshSettings] = useState<MeshSettings>(product.meshSettings ?? DEFAULT_MESH_SETTINGS);
  const [partColors, setPartColors] = useState<ProductPartColors>({ body: product.colors?.[0]?.hexColor ?? '#f8fafc', ...neutralPartColors });
  useEffect(() => {
    console.info('[Product3DViewer] Producto activo:', { id: product.id, name: product.name, model3dUrl: model3dUrl || '(vacío)' });
    setMeshSettings(product.meshSettings ?? DEFAULT_MESH_SETTINGS);
    setPartColors({ body: defaultBodyColor, ...neutralPartColors });
    const handleProductColor = (event: Event) => {
      const detail = (event as CustomEvent<{ hexColor?: string; variant?: { hexColor?: string } }>).detail;
      const variant = detail?.variant ?? detail;
      if (variant?.hexColor) setPartColors((current) => ({ ...current, body: variant.hexColor! }));
    };
    const handlePartColor = (event: Event) => {
      const detail = (event as CustomEvent<{ part?: keyof Omit<ProductPartColors, 'body'>; color?: string; enabled?: boolean }>).detail;
      if (!detail?.part || !['ring', 'interior', 'handle'].includes(detail.part)) return;
      const part = detail.part;
      setPartColors((current) => ({ ...current, [part]: { enabled: Boolean(detail.enabled), color: detail.color ?? current[part].color } }));
    };
    const handleOptionsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ selections?: Record<string, ProductVariant> }>).detail;
      const selectedSettings = Object.values(detail?.selections ?? {}).find((variant) => variant.meshSettings)?.meshSettings;
      setMeshSettings(selectedSettings ?? product.meshSettings ?? DEFAULT_MESH_SETTINGS);
    };
    window.addEventListener('editor:product-color', handleProductColor);
    window.addEventListener('editor:3d-part-color', handlePartColor);
    window.addEventListener('editor:options-changed', handleOptionsChanged);
    return () => {
      window.removeEventListener('editor:product-color', handleProductColor);
      window.removeEventListener('editor:3d-part-color', handlePartColor);
      window.removeEventListener('editor:options-changed', handleOptionsChanged);
    };
  }, [product.id, product.name, model3dUrl, defaultBodyColor, product.meshSettings]);
  if (!model3dUrl) return <section className="flex h-full min-h-[250px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-8 text-center shadow-inner" aria-label={`Vista 3D no disponible para ${product.name}`}>
    <div className="max-w-xs"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-2xl shadow-sm">◈</span><h2 className="mt-4 text-sm font-semibold text-slate-800">Vista 3D no disponible para este producto</h2><p className="mt-1 text-xs leading-5 text-slate-500">Este producto aún no tiene un modelo 3D asignado.</p></div>
  </section>;
  return <section key={product.id} className="relative flex h-full min-h-[250px] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#eef2f7] shadow-inner" aria-label={`Visor 3D de ${product.name}`}>
    <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl border border-white/80 bg-white/75 px-3 py-2 shadow-sm backdrop-blur"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Vista 3D · 360°</p><p className="mt-0.5 text-sm font-semibold text-slate-800">{product.name}</p><p className="mt-0.5 text-[10px] font-medium text-emerald-700">{printArea ? `${printArea.viewName || 'Vista'} · ${viewNumber}/${viewCount} · zona segura activa` : 'Esperando zona segura…'}</p></div>
    {!resolvedFabricCanvas && !previewMode && <p className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/80 px-3 py-1.5 text-xs text-slate-500 shadow-sm">Conectando con el lienzo…</p>}
    <Canvas key={`${product.id}:${model3dUrl}:${previewMode ? activeAdminViewIndex : 'editor'}`} shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 1.5]} camera={{ position: previewMode ? adminCameraPosition : [0, 0, 5], fov: 35 }} gl={{ antialias: true, alpha: true }}>
      <WebGLDiagnostics />
      <color attach="background" args={['#eef2f7']} />
      <ambientLight intensity={1.05} />
      <directionalLight castShadow position={[3, 5, 4]} intensity={2} />
      <directionalLight position={[-4, 1, 2]} intensity={0.7} color="#c4b5fd" />
      <ProductModel product={product} fabricCanvas={resolvedFabricCanvas} meshSettings={meshSettings} partColors={partColors} componentColors={componentColors} enabledMeshNames={enabledMeshNames} adminArea={adminArea} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.55, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <shadowMaterial opacity={0.12} />
      </mesh>
      <Grid position={[0, -1.54, 0]} rotation={[0, 0, 0]} infiniteGrid cellSize={0.35} sectionSize={1.4} fadeDistance={12} fadeStrength={1.2} cellColor="#cbd5e1" sectionColor="#94a3b8" />
      <ZoomableOrbitControls />
    </Canvas>
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/80 bg-white/75 px-3 py-1.5 text-[10px] font-medium text-slate-500 shadow-sm backdrop-blur">Arrastra para girar · rueda para acercar</div>
  </section>;
}
