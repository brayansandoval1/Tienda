import EditorShell from '@/components/editor/EditorShell';
import type { Producto } from '@/types/product';
import type { Product } from '@/src/store/useProductStore';

// Datos temporales para probar el flujo Frente/Espalda sin depender de una BD.
// Cada vista conserva por separado los textos, imágenes y formas que el cliente
// agregue desde el editor.
const mockProduct: Product = {
  id: 'mock-product-dos-caras',
  name: 'Producto de prueba (dos caras)',
  category: 'Demo',
  price: 24.99,
  canvasWidth: 800,
  canvasHeight: 800,
  views: [
    {
      id: 'anverso',
      name: 'Anverso',
      label: 'Anverso',
      mockupUrl: 'https://placehold.co/800x800/e0f2fe/0f172a?text=Anverso',
      printArea: { x: 20, y: 18, width: 60, height: 64 },
      printAreaUnit: 'percent',
    },
    {
      id: 'reverso',
      name: 'Reverso',
      label: 'Reverso',
      mockupUrl: 'https://placehold.co/800x800/fef3c7/0f172a?text=Reverso',
      printArea: { x: 20, y: 18, width: 60, height: 64 },
      printAreaUnit: 'percent',
    },
  ],
};

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

  return <EditorShell producto={producto} initialProduct={mockProduct} />;
}
