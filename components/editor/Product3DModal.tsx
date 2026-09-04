'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      roundedBoxGeometry: any;
    }
  }
}

type ProductShape = 'cylinder' | 'phone_case' | 'flat' | 'auto';

function getProductShape(productType?: string): ProductShape {
  const normalized = (productType || '').toLowerCase();
  if (normalized.includes('tel') || normalized.includes('accesor') || normalized.includes('funda') || normalized.includes('case')) {
    return 'phone_case';
  }
  if (normalized.includes('ropa') || normalized.includes('playera') || normalized.includes('camiseta') || normalized.includes('flat')) {
    return 'flat';
  }
  if (normalized.includes('termo') || normalized.includes('taza') || normalized.includes('botella') || normalized.includes('cylinder')) {
    return 'cylinder';
  }
  return 'auto';
}

function Product3DPreview({
  textureUrl,
  productType,
  modelUrl,
}: {
  textureUrl: string;
  productType?: string;
  modelUrl?: string;
}) {
  const texture = useTexture(textureUrl);
  const gltf = modelUrl ? useGLTF(modelUrl) : null;
  const productShape = getProductShape(productType);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
  }, [texture]);

  if (gltf?.scene) {
    return <primitive object={gltf.scene} dispose={null} />;
  }

  if (productShape === 'phone_case') {
    return (
      <mesh rotation={[0, Math.PI / 12, 0]}>
        <roundedBoxGeometry args={[1.35, 2.55, 0.22, 8, 0.12]} />
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.2}
          metalness={0.08}
          map={texture}
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  }

  if (productShape === 'flat') {
    return (
      <mesh rotation={[0, 0, 0]}>
        <boxGeometry args={[2.25, 2.8, 0.12]} />
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.35}
          metalness={0.05}
          map={texture}
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  }

  return (
    <mesh rotation={[0, Math.PI / 2, 0]}>
      <cylinderGeometry args={[1, 1, 2.1, 64, 1, true]} />
      <meshStandardMaterial
        color="#ffffff"
        roughness={0.3}
        metalness={0.1}
        map={texture}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function Product3DModal({
  open,
  textureUrl,
  productType,
  modelUrl,
  onClose,
}: {
  open: boolean;
  textureUrl: string;
  productType?: string;
  modelUrl?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
      <div className="relative h-[min(88vh,920px)] w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Cerrar vista 3D"
        >
          <X size={18} />
        </button>

        <div className="absolute left-6 top-5 z-20">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/50">Vista previa interactiva 3D</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Vista previa interactiva 3D</h2>
        </div>

        <div className="h-full w-full">
          <Canvas camera={{ position: [0, 0.15, 5], fov: 42 }} dpr={[1, 2]}>
            <ambientLight intensity={1.5} />
            <directionalLight position={[10, 10, 10]} intensity={1.2} />
            <directionalLight position={[-10, -10, -10]} intensity={0.5} />
            <directionalLight position={[0, 6, -8]} intensity={0.6} />
            <Environment preset="studio" />
            <Product3DPreview textureUrl={textureUrl} productType={productType} modelUrl={modelUrl} />
            <OrbitControls
              enableZoom
              enablePan={false}
              minPolarAngle={Math.PI / 4}
              maxPolarAngle={Math.PI / 1.8}
            />
          </Canvas>
        </div>
      </div>
    </div>
  );
}

useGLTF.preload('');
