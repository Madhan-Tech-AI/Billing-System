export interface Product {
  id: string
  barcode: string
  name: string
  price: number
  gst: number
  stock: number
  category: string
  created_at: string
}

export interface CartItem {
  product_id: string
  name: string
  barcode: string
  price: number
  gst: number
  quantity: number
  subtotal: number
  gstAmount: number
}

export interface ScanEvent {
  id: string
  session_id: string
  barcode: string
  created_at: string
}

export interface Sale {
  id: string
  total: number
  payment_method: string
  cashier_name: string
  created_at: string
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  price: number
}

export interface PosSession {
  id: string
  cashier_name: string
  status: string
  created_at: string
}

export type PaymentMethod = 'Cash' | 'UPI' | 'Card'
