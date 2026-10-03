'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, OrbitControls, Stage } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

function PreviewScene({ scene }: { scene: THREE.Object3D }) {
  const normalizedScene = useMemo(() => {
    const clone = scene.clone(true);
    const bounds = new THREE.Box3().setFromObject(clone);
    const size = bounds.getSize(new THREE.Vector3());
    const maxExtent = Math.max(size.x, size.y, size.z);
    if (maxExtent > 0) {
      const scale = 2.2 / maxExtent;
      const center = bounds.getCenter(new THREE.Vector3());
      clone.scale.setScalar(scale);
      clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    }
    return clone;
  }, [scene]);

  return <primitive object={normalizedScene} />;
}

export default function GLBModelPreview({ url, file }: { url: string; file: File | null }) {
  const [scene, setScene] = useState<THREE.Object3D | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;
    let loadedScene: THREE.Object3D | null = null;
    if (!file && !url.trim()) {
      setScene(null);
      setStatus('idle');
      return;
    }
    setScene(null);
    setStatus('loading');
    const loader = new GLTFLoader();
    const load = async () => {
      try {
        let gltf;
        if (file) {
          const buffer = await file.arrayBuffer();
          gltf = await loader.parseAsync(buffer, '');
        } else {
          gltf = await loader.loadAsync(url.trim());
        }
        loadedScene = gltf.scene;
        if (!cancelled) {
          setScene(gltf.scene);
          setStatus('ready');
        }
      } catch (error) {
        console.warn('[ADMIN] No se pudo preparar la vista previa del GLB:', error);
        if (!cancelled) setStatus('error');
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (loadedScene) {
        // La vista usa una copia de la escena; libera sólo recursos asociados
        // al modelo ya cargado al cambiar URL o desmontar el formulario.
        const geometries = new Set<THREE.BufferGeometry>();
        const materials = new Set<THREE.Material>();
        const textures = new Set<THREE.Texture>();
        loadedScene.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (!mesh.isMesh) return;
          geometries.add(mesh.geometry);
          (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => {
            materials.add(material);
            Object.values(material).forEach((value) => {
              if (value && typeof value === 'object' && 'isTexture' in value && (value as THREE.Texture).isTexture) textures.add(value as THREE.Texture);
            });
          });
        });
        geometries.forEach((geometry) => geometry.dispose());
        textures.forEach((texture) => texture.dispose());
        materials.forEach((material) => material.dispose());
      }
    };
  }, [file, url]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-slate-300">
        <span>Vista previa del modelo</span>
        <span>{status === 'loading' ? 'Cargando…' : status === 'ready' ? 'Arrastra para girar · rueda para acercar' : status === 'error' ? 'No se pudo cargar la vista 3D' : 'Selecciona un GLB para previsualizarlo'}</span>
      </div>
      {scene && status === 'ready' ? (
        <div className="h-64">
          <Canvas dpr={[1, 1.5]} camera={{ position: [3.5, 2.5, 4.5], fov: 38 }} gl={{ antialias: true, alpha: false }}>
            <color attach="background" args={['#0f172a']} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[4, 6, 5]} intensity={2} />
            <Suspense fallback={null}>
              <Stage environment="city" intensity={0.35} adjustCamera={false}>
                <Bounds fit clip observe margin={1.25}><PreviewScene scene={scene} /></Bounds>
              </Stage>
            </Suspense>
            <OrbitControls makeDefault enableDamping />
          </Canvas>
        </div>
      ) : (
        <div className="grid h-40 place-items-center px-5 text-center text-xs text-slate-400">
          {status === 'loading' ? 'Leyendo geometría y materiales del archivo…' : status === 'error' ? 'Revisa que la URL sea accesible o vuelve a seleccionar el archivo.' : 'La vista permite revisar la malla desde varios ángulos.'}
        </div>
      )}
    </div>
  );
}
