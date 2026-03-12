/**
 * productLookupService.ts
 *
 * Fetches product info for a barcode via the consolidated Vercel API.
 * This solves CORS issues and keeps API keys on the server.
 */

import type { Product } from '../supabase/types'

async function lookupViaVercelApi(barcode: string): Promise<Product | null> {
  try {
    const res = await fetch(`/api/barcode?barcode=${encodeURIComponent(barcode)}`)

    if (res.status === 404) return null
    if (!res.ok) {
      console.warn(`[productLookup] API error ${res.status}`)
      return null
    }

    const json = await res.json()
    const p = json?.products?.[0]
    if (!p) return null

    // The backend now returns the full Product object (either found in DB or newly inserted)
    return p as Product
  } catch (e) {
    console.error('[productLookup] fetch error:', e)
    return null
  }
}

/**
 * Calls the consolidated server API to get product info.
 */
export async function fetchProductFromAPI(
  barcode: string
): Promise<Product | null> {
  console.info(`[productLookup] Starting lookup for barcode: ${barcode}`)
  
  const product = await lookupViaVercelApi(barcode)

  if (!product) {
    console.warn('[productLookup] Product not found for barcode:', barcode)
    return null
  }

  console.info('[productLookup] Result →', {
    name: product.name,
    price: product.price,
    source: (product as any)._source // Optional metadata from backend
  })

  return product
}
