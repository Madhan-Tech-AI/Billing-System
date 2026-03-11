/**
 * productAutoCreate.ts
 *
 * Given a barcode, fetches product info from external APIs,
 * inserts a new product into the Supabase `products` table,
 * and returns the created Product.
 */

import { addProduct } from './productService'
import { fetchProductFromAPI } from './productLookupService'
import type { Product } from '../supabase/types'

/** Default field values when API data is unavailable */
const DEFAULTS = {
  price: 0,
  gst: 18,
  stock: 100,
} as const

/**
 * Looks up barcode via external APIs, creates the product in Supabase,
 * and returns the inserted Product row.
 *
 * If both APIs return nothing → name = "Product {barcode}"
 */
export async function createProductFromBarcode(barcode: string): Promise<Product> {
  const apiInfo = await fetchProductFromAPI(barcode)

  const name =
    apiInfo?.name?.trim()
      ? apiInfo.name.trim()
      : `Product ${barcode}`

  const brand = apiInfo?.brand?.trim() ?? ''
  const category = apiInfo?.category?.trim() ?? 'Uncategorised'

  const productData: Omit<Product, 'id' | 'created_at'> = {
    barcode,
    name: brand && !name.toLowerCase().includes(brand.toLowerCase())
      ? `${brand} ${name}`  // prepend brand if not already in name
      : name,
    price: DEFAULTS.price,
    gst: DEFAULTS.gst,
    stock: DEFAULTS.stock,
    category,
  }

  const inserted = await addProduct(productData)
  return inserted
}
