import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { type Product, PRODUCTS as initialProducts } from '@/src/config/products';

export type { Product, ProductView } from '@/src/config/products';

export interface ProductState {
  products: Product[];
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
      addProduct: (product) =>
        set((state) => ({ products: [...state.products, product] })),
      updateProduct: (updatedProduct) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.id === updatedProduct.id ? updatedProduct : p,
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
      name: 'product-storage', // Nombre de la clave en localStorage
      storage: createJSONStorage(() => localStorage),
      // Fusiona el estado persistido con el inicial, sembrando el catálogo
      // por defecto cuando el almacenamiento está ausente o vacío.
      // En zustand v5 el estado rehidratado está congelado (Immer), así que la
      // semilla debe hacerse dentro de `merge` (en `set`) y no mediante
      // mutación directa en `onRehydrateStorage`.
      merge: (persistedState, currentState) => {
        const merged = {
          ...currentState,
          ...(persistedState as Partial<ProductState>),
        };
        if (!merged.products?.length) {
          merged.products = initialProducts;
        }
        return merged;
      },
    },
  ),
);
