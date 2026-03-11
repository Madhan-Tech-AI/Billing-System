/**
 * productLookupService.ts
 *
 * Fetches product info for a barcode via the consolidated Vercel API.
 * This solves CORS issues and keeps API keys on the server.
 */

export interface ExternalProductInfo {
  name: string
  brand: string
  category: string
  price: number     // 0 when no source has a price
  imageUrl: string
}

async function lookupViaVercelApi(barcode: string): Promise<ExternalProductInfo | null> {
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

    return {
      name: (p.title || p.brand || '').trim(),
      brand: (p.brand || '').trim(),
      category: (p.category || '').trim(),
      price: typeof p.price === 'number' ? p.price : parseFloat(p.price || '0'),
      imageUrl: p.images?.[0] ?? '',
    }
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
): Promise<ExternalProductInfo | null> {
  console.info(`[productLookup] Starting lookup for barcode: ${barcode}`)
  
  const result = await lookupViaVercelApi(barcode)

  if (!result || !result.name) {
    console.warn('[productLookup] Product not found for barcode:', barcode)
    return null
  }

  console.info('[productLookup] Result →', {
    name: result.name,
    price: result.price,
    sources: (result as any)._metadata?.sources
  })

  return result
}
