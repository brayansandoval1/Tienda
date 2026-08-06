import EditorShell from '@/components/editor/EditorShell';
import type { Producto } from '@/types/product';

interface PageProps {
  params: Promise<{
    productoId: string;
  }>;
}

export default async function PersonalizarProductoPage({ params }: PageProps) {
  const resolvedParams = await params;

  const producto: Producto = {
    id: resolvedParams.productoId,
    nombre: 'Playera personalizada',
    descripcion: 'Diseña tu propia playera y revisa cada detalle antes de finalizar tu pedido.',
    imagenUrl: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80',
    precio: 24.99,
    pesoGramos: 220,
    dimensiones: {
      anchoMm: 350,
      altoMm: 240,
      profundoMm: 2
    },
    variantes: [
      { id: 'v1', nombre: 'Blanco', color: 'Blanco', imageUrl: '', sku: 'TSHIRT-BL' },
      { id: 'v2', nombre: 'Negro', color: 'Negro', imageUrl: '', sku: 'TSHIRT-BK' }
    ],
    zonasEdicion: [
      { id: 'zona1', nombre: 'Frente', top: 50, left: 50, width: 620, height: 400 }
    ]
  };

  return <EditorShell producto={producto} />;
}
