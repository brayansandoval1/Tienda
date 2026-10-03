'use client';

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { Product } from '@/src/store/useProductStore';

type FabricCanvasLike = {
  getElement: () => HTMLCanvasElement;
  getObjects: () => Array<any>;
  on: (eventName: string, handler: () => void) => void;
  off: (eventName: string, handler: () => void) => void;
};
type PrintAreaBounds = { left: number; top: number; width: number; height: number; viewId?: string; viewName?: string };
const DEFAULT_PRINT_TEXTURE_SIZE = { width: 2598, height: 472 };
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

function renderPrintArea(fabricCanvas: FabricCanvasLike, area: PrintAreaBounds | null, target: HTMLCanvasElement, baseColor: string, panoramic: boolean) {
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
  const context = target.getContext('2d');
  if (!context) return;
  // El tamaño del canvas origen de CanvasTexture se mantiene fijo mientras
  // Three.js lo tiene enlazado a WebGL.
  const normalizedView = `${area?.viewId ?? ''} ${area?.viewName ?? ''}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const isBackView = /back|rear|espalda|reverso|trasera/.test(normalizedView);
  const sideLeft = panoramic ? (isBackView ? target.width / 2 : 0) : 0;
  const sideWidth = panoramic ? target.width / 2 : target.width;
  const scale = panoramic
    ? Math.min(sideWidth / Math.max(1, bounds.width), target.height / Math.max(1, bounds.height))
    : Math.min(target.width / Math.max(1, bounds.width), target.height / Math.max(1, bounds.height));
  const offsetX = sideLeft + (sideWidth - bounds.width * scale) / 2 - bounds.left * scale;
  const offsetY = (target.height - bounds.height * scale) / 2 - bounds.top * scale;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, target.width, target.height);
  context.fillStyle = baseColor || '#ffffff';
  context.fillRect(0, 0, target.width, target.height);
  context.save();
  context.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  try {
    fabricCanvas.getObjects().forEach((object) => {
      if (!object || object.visible === false || object.isMockup || object.isGuide || object.isGuideLine || object.isCropOverlay) return;
      // Dibuja en un canvas auxiliar: no se toca el viewport ni se solicita un
      // render del canvas interactivo. Los clipPath de Fabric siguen activos.
      object.render(context);
    });
  } finally {
    context.restore();
  }
}

function FabricTextureSurface({ fabricCanvas, phoneCase, panoramic, modelUrl, partColors, componentColors, enabledMeshNames }: { fabricCanvas: FabricCanvasLike; phoneCase: boolean; panoramic: boolean; modelUrl: string; partColors: ProductPartColors; componentColors: ComponentColors; enabledMeshNames: string[] }) {
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUpdatingTexture = useRef(false);
  const printArea = usePrintAreaBounds();
  const printCanvas = useMemo(() => {
    const canvas = document.createElement('canvas');
    const bounds = panoramic
      ? DEFAULT_PRINT_TEXTURE_SIZE
      : printArea ?? { left: 0, top: 0, width: 800, height: 800 };
    const scale = Math.min(3, Math.max(1, 1400 / Math.max(bounds.width, bounds.height)));
    canvas.width = Math.max(1, Math.ceil(bounds.width * scale));
    canvas.height = Math.max(1, Math.ceil(bounds.height * scale));
    console.log('[Product3DViewer] printArea real:', {
      left: printArea?.left ?? 0,
      top: printArea?.top ?? 0,
      width: bounds.width,
      height: bounds.height,
      aspectRatio: bounds.width / Math.max(1, bounds.height),
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
  }, [fabricCanvas, panoramic, printArea]);
  const texture = useMemo(() => {
    const canvasTexture = new THREE.CanvasTexture(printCanvas);
    canvasTexture.colorSpace = THREE.SRGBColorSpace;
    canvasTexture.flipY = false;
    resetTextureUvTransform(canvasTexture, panoramic);
    canvasTexture.anisotropy = 8;
    canvasTexture.needsUpdate = true;
    return canvasTexture;
  }, [fabricCanvas, panoramic, printCanvas]);

  useEffect(() => {
    textureRef.current = texture;
    const updateTexture = () => {
      if (isUpdatingTexture.current) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        isUpdatingTexture.current = true;
        try {
          // Se renderizan solo los objetos imprimibles en el buffer auxiliar;
          // el canvas de edición nunca se redimensiona ni se vuelve a renderizar.
          renderPrintArea(fabricCanvas, printArea, printCanvas, partColors.body, panoramic);
          if (textureRef.current) textureRef.current.needsUpdate = true;
        } catch (error) {
          console.error('[Product3DViewer] No se pudo actualizar la textura de impresión:', error);
        } finally {
          isUpdatingTexture.current = false;
          debounceRef.current = null;
        }
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
  }, [fabricCanvas, panoramic, partColors.body, printArea, printCanvas, texture]);

  useEffect(() => () => texture.dispose(), [texture]);

  const fallback = phoneCase
    ? <PhoneCase texture={texture} bodyColor={partColors.body} />
    : <Drinkware texture={texture} partColors={partColors} />;
  if (modelUrl) return <ModelLoadBoundary key={modelUrl} fallback={fallback}>
    <Suspense fallback={fallback}><GLBModel url={modelUrl} texture={texture} panoramic={panoramic} partColors={partColors} componentColors={componentColors} enabledMeshNames={enabledMeshNames} /></Suspense>
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

function resetTextureUvTransform(texture: THREE.CanvasTexture, panoramic: boolean) {
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

  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(repeatX, 1.0);
  texture.offset.set((1.0 - repeatX) / 2, 0);
  texture.center.set(0, 0);
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
    wrapS: texture.wrapS,
  });
}

function GLBModel({ url, texture, panoramic, partColors, componentColors, enabledMeshNames }: { url: string; texture: THREE.CanvasTexture; panoramic: boolean; partColors: ProductPartColors; componentColors: ComponentColors; enabledMeshNames: string[] }) {
  const gltf = useGLTF(url);
  useEffect(() => {
    const meshes: Array<Record<string, unknown>> = [];
    gltf.scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
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
    console.info(`[Product3DViewer] GLB cargado: ${url}`);
    if (meshes.length) console.table(meshes);
    else console.error(`[Product3DViewer] El GLB no contiene mallas: ${url}`);
  }, [gltf.scene, url]);
  const scene = useMemo(() => {
    const clonedScene = gltf.scene.clone(true);
    const meshes: THREE.Mesh[] = [];
    clonedScene.traverse((object) => { if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh); });
    const normalizedMeshName = (name: string) => name.trim().toLocaleLowerCase();
    const findExactMesh = (name: string) => meshes.find((mesh) => normalizedMeshName(mesh.name) === name);
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
        resetTextureUvTransform(texture, panoramic);
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
          material.map = texture;
          texture.needsUpdate = true;
          if ('roughness' in material) material.roughness = 0.42;
          if ('metalness' in material) material.metalness = 0.02;
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
  }, [gltf.scene, partColors, texture, url, componentColors, enabledMeshNames, panoramic]);
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

function ProductModel({ product, fabricCanvas, partColors, componentColors, enabledMeshNames }: { product: Product; fabricCanvas: FabricCanvasLike | null; partColors: ProductPartColors; componentColors: ComponentColors; enabledMeshNames: string[] }) {
  const phoneCase = /funda|iphone|phone|case/i.test(`${product.id} ${product.name}`);
  const printAspect = (product.printWidthCm ?? 0) / Math.max(0.01, product.printHeightCm ?? 0);
  const panoramic = !phoneCase && (
    /termo|taza|mug|botella|vaso|bottle|travel.?mug/i.test(`${product.id} ${product.name}`)
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
  const modelUrl = product.model3dUrl?.trim();
  if (!modelUrl) {
    console.error('[Product3DViewer] El producto llegó al Canvas sin model3dUrl.', { productId: product.id });
    return fallback;
  }
  return <FabricTextureSurface key={product.id} fabricCanvas={fabricCanvas} phoneCase={phoneCase} panoramic={panoramic} modelUrl={modelUrl} partColors={partColors} componentColors={componentColors} enabledMeshNames={enabledMeshNames} />;
}

export default function Product3DViewer({ product, componentColors, enabledMeshNames }: { product: Product; componentColors: ComponentColors; enabledMeshNames: string[] }) {
  const fabricCanvas = useFabricCanvas();
  const model3dUrl = product.model3dUrl?.trim();
  const defaultBodyColor = product.colors?.[0]?.hexColor ?? '#f8fafc';
  const [partColors, setPartColors] = useState<ProductPartColors>({ body: product.colors?.[0]?.hexColor ?? '#f8fafc', ...neutralPartColors });
  useEffect(() => {
    console.info('[Product3DViewer] Producto activo:', { id: product.id, name: product.name, model3dUrl: model3dUrl || '(vacío)' });
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
    window.addEventListener('editor:product-color', handleProductColor);
    window.addEventListener('editor:3d-part-color', handlePartColor);
    return () => {
      window.removeEventListener('editor:product-color', handleProductColor);
      window.removeEventListener('editor:3d-part-color', handlePartColor);
    };
  }, [product.id, product.name, model3dUrl, defaultBodyColor]);
  if (!model3dUrl) return <section className="flex h-full min-h-[250px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-8 text-center shadow-inner" aria-label={`Vista 3D no disponible para ${product.name}`}>
    <div className="max-w-xs"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-2xl shadow-sm">◈</span><h2 className="mt-4 text-sm font-semibold text-slate-800">Vista 3D no disponible para este producto</h2><p className="mt-1 text-xs leading-5 text-slate-500">Este producto aún no tiene un modelo 3D asignado.</p></div>
  </section>;
  return <section key={product.id} className="relative flex h-full min-h-[250px] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#eef2f7] shadow-inner" aria-label={`Visor 3D de ${product.name}`}>
    <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl border border-white/80 bg-white/75 px-3 py-2 shadow-sm backdrop-blur"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Vista 3D · 360°</p><p className="mt-0.5 text-sm font-semibold text-slate-800">{product.name}</p></div>
    {!fabricCanvas && <p className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/80 px-3 py-1.5 text-xs text-slate-500 shadow-sm">Conectando con el lienzo…</p>}
    <Canvas key={`${product.id}:${model3dUrl}`} shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 1.5]} camera={{ position: [0, 0, 5], fov: 35 }} gl={{ antialias: true, alpha: true }}>
      <WebGLDiagnostics />
      <color attach="background" args={['#eef2f7']} />
      <ambientLight intensity={1.05} />
      <directionalLight castShadow position={[3, 5, 4]} intensity={2} />
      <directionalLight position={[-4, 1, 2]} intensity={0.7} color="#c4b5fd" />
      <ProductModel product={product} fabricCanvas={fabricCanvas} partColors={partColors} componentColors={componentColors} enabledMeshNames={enabledMeshNames} />
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
