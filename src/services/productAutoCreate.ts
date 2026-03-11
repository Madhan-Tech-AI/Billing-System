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

import { addProduct, updateProduct } from './productService'
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

/** Build product fields from API info + defaults */
async function buildProductFields(
  barcode: string
): Promise<Omit<Product, 'id' | 'created_at'>> {
  const apiInfo = await fetchProductFromAPI(barcode)

  // ── Name ──────────────────────────────────────────────────────────────────
  let name = apiInfo?.name?.trim() || `Product ${barcode}`
  const brand = apiInfo?.brand?.trim() ?? ''
  if (brand && !name.toLowerCase().includes(brand.toLowerCase())) {
    name = `${brand} ${name}`
  }

  // ── Price ─────────────────────────────────────────────────────────────────
  const price = apiInfo?.price && apiInfo.price > 0 ? apiInfo.price : 0

  // ── Category ──────────────────────────────────────────────────────────────
  const category = apiInfo?.category?.trim() || 'Uncategorised'

  const fields: Omit<Product, 'id' | 'created_at'> = {
    barcode,
    name,
    price,
    gst: 18,
    stock: 100,
    category,
  }

  console.info('[productAutoCreate] Product fields from API:', fields)
  return fields
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Looks up barcode via external APIs, inserts into Supabase,
 * and returns the newly created Product.
 */
export async function createProductFromBarcode(barcode: string): Promise<Product> {
  const fields = await buildProductFields(barcode)
  const inserted = await addProduct(fields)
  return inserted
}

/**
 * If the given product is a placeholder (price=0, generic name), re-fetch
 * real product info from the API and update the Supabase row in-place.
 * Returns the enriched product, or the original if the API returns nothing new.
 */
export async function enrichProductIfPlaceholder(product: Product): Promise<Product> {
  if (!isPlaceholder(product)) return product

  console.info('[productAutoCreate] Placeholder detected — re-fetching from API:', product.barcode)

  const fields = await buildProductFields(product.barcode)

  // Only update if we got better data
  const gotBetterName = !fields.name.startsWith(`Product ${product.barcode}`)
  const gotPrice = fields.price > 0

  if (!gotBetterName && !gotPrice) {
    console.warn('[productAutoCreate] API returned no improvement for:', product.barcode)
    return product
  }

  const updated = await updateProduct(product.id, {
    name: fields.name,
    price: fields.price,
    category: fields.category,
  })

  return updated
}
