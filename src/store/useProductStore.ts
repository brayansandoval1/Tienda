import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { type Product, PRODUCTS as initialProducts } from '@/src/config/products';

export type { ColorVariant, Product, ProductOption, ProductOptionValue, ProductOptionView, ProductView } from '@/src/config/products';

export interface ProductState {
  products: Product[];
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  removeProduct: (productId: string) => void;
  getProductById: (productId: string) => Product | undefined;
}

/**
 * Store global de productos personalizables con persistencia en localStorage
 * (mientras conectamos Supabase).
 */
export const useProductStore = create<ProductState>()(
  persist(
    (set, get) => ({
      products: initialProducts,
      setProducts: (products) => set({ products }),
      addProduct: (product) =>
        set((state) => ({ products: [...state.products, { ...product, updatedAt: Date.now() }] })),
      updateProduct: (updatedProduct) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.id === updatedProduct.id ? { ...updatedProduct, updatedAt: Date.now() } : p,
          ),
        })),
      removeProduct: (productId) =>
        set((state) => ({
          products: state.products.filter((p) => p.id !== productId),
        })),
      getProductById: (productId: string) => {
        return get().products.find((p) => p.id === productId);
      },
    }),
    {
      // Admin y Editor comparten la misma clave. Se consulta primero esta
      // fuente y se lee la clave anterior sólo como migración transparente.
      name: 'custom_products',
      storage: createJSONStorage(() => ({
        getItem: (name) => localStorage.getItem(name) ?? localStorage.getItem('product-storage'),
        setItem: (name, value) => localStorage.setItem(name, value),
        removeItem: (name) => localStorage.removeItem(name),
      })),
      partialize: (state) => ({ products: state.products }),
      // Sólo se siembra el catálogo cuando no existe ningún estado persistido.
      // Una lista vacía es válida: significa que el usuario eliminó todos los
      // productos y no debe volver a mostrar los mocks al recargar.
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ProductState> | undefined;
        if (!persisted || !Array.isArray(persisted.products)) return currentState;
        const merged = {
          ...currentState,
          ...persisted,
        };
        if (merged.products.length) {
          // Los productos guardados antes de añadir variantes no incluyen
          // `colors`. Conservamos las personalizaciones persistidas, pero les
          // completamos las variantes actuales del catálogo por su mismo id.
          merged.products = merged.products.map((persistedProduct) => {
            const catalogProduct = initialProducts.find((product) => product.id === persistedProduct.id);
            if (!catalogProduct) return persistedProduct;

            return {
              ...persistedProduct,
              colors: persistedProduct.colors?.length ? persistedProduct.colors : catalogProduct.colors,
              options: persistedProduct.options?.length ? persistedProduct.options : catalogProduct.options,
              views: persistedProduct.views.map((persistedView) => {
                const catalogView = catalogProduct.views.find((view) => view.id === persistedView.id);
                return {
                  ...persistedView,
                  colorVariants: persistedView.colorVariants?.length
                    ? persistedView.colorVariants
                    : catalogView?.colorVariants,
                };
              }),
            };
          });
        }
        return merged;
      },
    },
  ),
);
