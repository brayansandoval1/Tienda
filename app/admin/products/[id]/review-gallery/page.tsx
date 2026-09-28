import type { Metadata } from 'next';
import AdminReviewGallery from '@/components/admin/AdminReviewGallery';

export const metadata: Metadata = { title: 'Fotos de revisión · Admin' };

/**
 * Administración de la pestaña "Revisar": Zona Segura Maestra + fotos lifestyle
 * con posición de estampado heredada o ajustada por foto. Ver
 * components/admin/AdminReviewGallery y src/utils/reviewGallery.
 */
export default async function AdminReviewGalleryRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminReviewGallery productId={id} />;
}
