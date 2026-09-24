'use client';

import { Suspense, useEffect, useState } from 'react';
import { X, Rotate3D } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';

export type ThreeDViewPreview = { id: string; label: string; textureUrl: string };

function MockupPlane({ textureUrl }: { textureUrl: string }) {
  const texture = useTexture(textureUrl);
  const image = texture.image as { width?: number; height?: number } | undefined;
  const aspect = image?.width && image?.height ? image.width / image.height : 1;
  const height = 3.7;
  const width = Math.min(4.8, Math.max(2, height * aspect));

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);

  return <group rotation={[-0.04, Math.PI / 14, 0]}>
    {/* Un soporte delgado da profundidad al giro sin distorsionar el mockup
        original, que es la representación aprobada de cada producto. */}
    <mesh position={[0, 0, -0.035]} castShadow receiveShadow>
      <boxGeometry args={[width + 0.08, height + 0.08, 0.07]} />
      <meshPhysicalMaterial color="#e2e8f0" roughness={0.32} metalness={0.08} />
    </mesh>
    <mesh castShadow>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  </group>;
}

function LoadingPlane() {
  return <mesh><planeGeometry args={[2.8, 3.7]} /><meshBasicMaterial color="#172033" /></mesh>;
}

export default function Product3DModal({ open, textureUrl, views = [], onClose }: {
  open: boolean;
  textureUrl: string;
  views?: ThreeDViewPreview[];
  onClose: () => void;
}) {
  const [activeViewId, setActiveViewId] = useState('');
  const activeView = views.find((view) => view.id === activeViewId) ?? views[0];
  const activeTexture = activeView?.textureUrl || textureUrl;

  useEffect(() => {
    if (open) setActiveViewId(views[0]?.id || '');
  }, [open, views]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Vista previa interactiva del producto">
    <div className="relative h-[min(88vh,920px)] w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#070b18] shadow-2xl">
      <button type="button" onClick={onClose} className="absolute right-4 top-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20" aria-label="Cerrar vista 3D"><X size={18} /></button>
      <div className="pointer-events-none absolute left-6 top-5 z-20"><p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/50">Vista previa interactiva</p><h2 className="mt-1 text-xl font-semibold text-white">Tu diseño en el producto</h2></div>

      {views.length > 1 && <div className="absolute right-20 top-5 z-30 flex max-w-[55%] gap-2 overflow-x-auto pb-1">
        {views.map((view) => {
          const selected = activeView?.id === view.id;
          return <button key={view.id} type="button" onClick={() => setActiveViewId(view.id)} aria-pressed={selected} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selected ? 'border-sky-300 bg-sky-300 text-slate-950' : 'border-white/15 bg-white/10 text-white/80 hover:bg-white/20'}`}>{view.label}</button>;
        })}
      </div>}

      <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-white/75 backdrop-blur"><Rotate3D size={15} className="text-sky-300" /> Arrastra para inclinar · rueda para acercar</div>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 5.8], fov: 38 }} gl={{ antialias: true, alpha: false }}>
        <color attach="background" args={['#070b18']} />
        <ambientLight intensity={1.25} />
        <directionalLight castShadow position={[3, 5, 4]} intensity={1.8} />
        <directionalLight position={[-4, 0, 2]} intensity={0.55} color="#93c5fd" />
        {activeTexture && <Suspense fallback={<LoadingPlane />}><MockupPlane key={activeView?.id || activeTexture} textureUrl={activeTexture} /></Suspense>}
        <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minDistance={3.5} maxDistance={8} minPolarAngle={Math.PI / 4} maxPolarAngle={Math.PI / 1.55} />
      </Canvas>
    </div>
  </div>;
}
