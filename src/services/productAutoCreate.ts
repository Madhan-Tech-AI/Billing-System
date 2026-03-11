/**
 * productAutoCreate.ts
 *
 * Given a barcode, fetches product info from external APIs (Barcode Lookup →
 * UPCItemDB → OpenFoodFacts), inserts a new product into the Supabase
 * `products` table, and returns the created Product row.
 */

import { addProduct } from './productService'
import { fetchProductFromAPI } from './productLookupService'
import type { Product } from '../supabase/types'

/**
 * Looks up barcode via external APIs, creates the product in Supabase,
 * and returns the inserted Product row.
 *
 * Field precedence:
 *  - name    → API title (prepended with brand if not already included)
 *  - price   → API store price (converted from USD/raw; stays 0 if unavailable)
 *  - category→ API category
 *  - gst     → always 18 (default for Indian GST)
 *  - stock   → always 100 (placeholder)
 */
export async function createProductFromBarcode(barcode: string): Promise<Product> {
  const apiInfo = await fetchProductFromAPI(barcode)

  // ── Name ─────────────────────────────────────────────────────────────────
  let name = apiInfo?.name?.trim() || `Product ${barcode}`

  // Prepend brand if it's not already part of the name
  const brand = apiInfo?.brand?.trim() ?? ''
  if (brand && !name.toLowerCase().includes(brand.toLowerCase())) {
    name = `${brand} ${name}`
  }

  // ── Price ─────────────────────────────────────────────────────────────────
  // Use API price if > 0; otherwise keep 0 so admin can update it later.
  const price = (apiInfo?.price && apiInfo.price > 0) ? apiInfo.price : 0

  // ── Category ──────────────────────────────────────────────────────────────
  const category = apiInfo?.category?.trim() || 'Uncategorised'

  const productData: Omit<Product, 'id' | 'created_at'> = {
    barcode,
    name,
    price,
    gst: 18,
    stock: 100,
    category,
  }

  console.info('[productAutoCreate] Inserting product:', productData)

  const inserted = await addProduct(productData)
  return inserted
}
