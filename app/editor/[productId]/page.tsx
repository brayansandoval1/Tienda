import StoreEditorPage from '@/components/editor/StoreEditorPage';

export default async function ProductEditorRoute({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  return <StoreEditorPage productId={productId} />;
}
