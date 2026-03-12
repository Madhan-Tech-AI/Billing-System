/**
 * productAutoCreate.ts
 *
 * Given a barcode, fetches product info from external APIs
 * (via consolidated /api/barcode route),
 * inserts a new product into the Supabase `products` table,
 * and returns the created Product row.
 *
 * Also exports `enrichProductIfPlaceholder` which refreshes a
 * previously-inserted placeholder (name="Product {barcode}", price=0).
 */

import { fetchProductFromAPI } from './productLookupService'
import type { Product } from '../supabase/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true when a product row is a previously-created placeholder */
export function isPlaceholder(product: Product): boolean {
  return (
    product.price === 0 &&
    (product.name === `Product ${product.barcode}` ||
      product.name.startsWith(`Product ${product.barcode}`))
  )
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Looks up barcode via the consolidated Vercel API.
 * The backend now handles searching SerpAPI, AI extraction, and DB insertion.
 */
export async function createProductFromBarcode(barcode: string): Promise<Product> {
  const product = await fetchProductFromAPI(barcode)
  if (!product) {
    throw new Error('Product not discovered after multi-source lookup')
  }
  return product
}

/**
 * If the given product is a placeholder (price=0, generic name), re-fetch
 * real product info from the API. The API will update the DB row in-place.
 */
export async function enrichProductIfPlaceholder(product: Product): Promise<Product> {
  if (!isPlaceholder(product)) return product

  console.info('[productAutoCreate] Placeholder detected — re-fetching from API:', product.barcode)

  const enriched = await fetchProductFromAPI(product.barcode)
  
  if (!enriched || (enriched.price === 0 && enriched.name === product.name)) {
    console.warn('[productAutoCreate] API returned no improvement for:', product.barcode)
    return product
  }

  return enriched
}
