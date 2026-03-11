import { create } from 'zustand'
import type { Product } from '../supabase/types'
import { getAllProducts } from '../services/productService'

interface ProductStore {
  products: Product[]
  productMap: Map<string, Product>
  loading: boolean
  error: string | null
  loadProducts: () => Promise<void>
  getByBarcode: (barcode: string) => Product | undefined
  getById: (id: string) => Product | undefined
  addToCache: (product: Product) => void
  updateInCache: (product: Product) => void
  removeFromCache: (id: string) => void
}

export const useProductStore = create<ProductStore>((set, get) => ({
  products: [],
  productMap: new Map(),
  loading: false,
  error: null,

  loadProducts: async () => {
    set({ loading: true, error: null })
    try {
      const products = await getAllProducts()
      const productMap = new Map<string, Product>()
      products.forEach((p) => productMap.set(p.barcode, p))
      set({ products, productMap, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load products'
      set({ error: message, loading: false })
    }
  },

  getByBarcode: (barcode: string) => {
    return get().productMap.get(barcode)
  },

  getById: (id: string) => {
    return get().products.find((p) => p.id === id)
  },

  addToCache: (product: Product) => {
    set((state) => {
      const newMap = new Map(state.productMap)
      newMap.set(product.barcode, product)
      return { products: [...state.products, product], productMap: newMap }
    })
  },

  updateInCache: (product: Product) => {
    set((state) => {
      const newMap = new Map(state.productMap)
      // Remove old barcode mapping if barcode changed
      state.products.forEach((p) => {
        if (p.id === product.id && p.barcode !== product.barcode) {
          newMap.delete(p.barcode)
        }
      })
      newMap.set(product.barcode, product)
      return {
        products: state.products.map((p) => (p.id === product.id ? product : p)),
        productMap: newMap,
      }
    })
  },

  removeFromCache: (id: string) => {
    set((state) => {
      const toRemove = state.products.find((p) => p.id === id)
      const newMap = new Map(state.productMap)
      if (toRemove) newMap.delete(toRemove.barcode)
      return {
        products: state.products.filter((p) => p.id !== id),
        productMap: newMap,
      }
    })
  },
}))
