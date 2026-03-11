import { create } from 'zustand'
import type { CartItem, Product } from '../supabase/types'

interface CartStore {
  items: CartItem[]
  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  getSubtotal: () => number
  getTotalGST: () => number
  getTotal: () => number
  getItemCount: () => number
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (product: Product) => {
    set((state) => {
      const existing = state.items.find((item) => item.product_id === product.id)
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.product_id === product.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  subtotal: (item.quantity + 1) * item.price,
                  gstAmount: ((item.quantity + 1) * item.price * item.gst) / 100,
                }
              : item
          ),
        }
      }
      const gstAmount = (product.price * product.gst) / 100
      const newItem: CartItem = {
        product_id: product.id,
        name: product.name,
        barcode: product.barcode,
        price: product.price,
        gst: product.gst,
        quantity: 1,
        subtotal: product.price,
        gstAmount,
      }
      return { items: [...state.items, newItem] }
    })
  },

  removeItem: (productId: string) => {
    set((state) => ({
      items: state.items.filter((item) => item.product_id !== productId),
    }))
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId)
      return
    }
    set((state) => ({
      items: state.items.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              quantity,
              subtotal: quantity * item.price,
              gstAmount: (quantity * item.price * item.gst) / 100,
            }
          : item
      ),
    }))
  },

  clearCart: () => set({ items: [] }),

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.subtotal, 0)
  },

  getTotalGST: () => {
    return get().items.reduce((sum, item) => sum + item.gstAmount, 0)
  },

  getTotal: () => {
    return get().getSubtotal() + get().getTotalGST()
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0)
  },
}))
