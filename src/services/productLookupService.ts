/**
 * productLookupService.ts
 *
 * Fetches product info for a barcode via three sources in priority order:
 *
 *   1. Barcode-Api  (Supabase Edge Function — keeps API key server-side)
 *   2. UPCItemDB    (free, good global coverage)
 *   3. OpenFoodFacts(open-source, excellent for food/FMCG)
 */

export interface ExternalProductInfo {
  name: string
  brand: string
  category: string
  price: number     // 0 when unavailable
  imageUrl: string  // empty string when unavailable
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/** Returns true when the result contains a usable product name */
function hasName(info: ExternalProductInfo | null): info is ExternalProductInfo {
  return !!info?.name?.trim()
}

// ─── 1. Supabase Edge Function (primary — API key is secret, server-side) ───

async function lookupViaEdgeFunction(
  barcode: string
): Promise<ExternalProductInfo | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/Barcode-Api?barcode=${encodeURIComponent(barcode)}`,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (res.status === 404) return null          // product not in Barcode Lookup DB
    if (res.status === 429) {
      console.warn('[productLookup] Edge function rate-limited by Barcode Lookup API')
      return null
    }
    if (!res.ok) {
      console.warn(`[productLookup] Edge function responded ${res.status}`)
      return null
    }

    const json = await res.json()
    const p = json?.products?.[0]
    if (!p) return null

    // Extract the first store price that is a positive number
    let price = 0
    if (Array.isArray(p.stores)) {
      for (const store of p.stores) {
        const raw = parseFloat(store.price)
        if (!isNaN(raw) && raw > 0) { price = raw; break }
      }
    }

    return {
      name:     p.title?.trim()    ?? '',
      brand:    p.brand?.trim()    ?? '',
      category: p.category?.trim() ?? '',
      price,
      imageUrl: p.images?.[0]      ?? '',
    }
  } catch (e) {
    console.error('[productLookup] Edge function error:', e)
    return null
  }
}

// ─── 2. UPCItemDB (first free fallback) ──────────────────────────────────────

async function lookupUPCItemDB(barcode: string): Promise<ExternalProductInfo | null> {
  try {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`
    )
    if (!res.ok) return null

    const json = await res.json()
    const item = json?.items?.[0]
    if (!item) return null

    let price = 0
    if (Array.isArray(item.offers)) {
      for (const offer of item.offers) {
        const raw = parseFloat(offer.price)
        if (!isNaN(raw) && raw > 0) { price = raw; break }
      }
    }

    return {
      name:     item.title?.trim()    ?? '',
      brand:    item.brand?.trim()    ?? '',
      category: item.category?.trim() ?? '',
      price,
      imageUrl: item.images?.[0]      ?? '',
    }
  } catch (e) {
    console.warn('[productLookup] UPCItemDB error:', e)
    return null
  }
}

// ─── 3. OpenFoodFacts (second free fallback — food & FMCG) ───────────────────

async function lookupOpenFoodFacts(barcode: string): Promise<ExternalProductInfo | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`
    )
    if (!res.ok) return null

    const json = await res.json()
    if (json.status !== 1 || !json.product) return null

    const p = json.product
    const name = (
      p.product_name_en ||
      p.product_name   ||
      p.abbreviated_product_name ||
      ''
    ).trim()

    return {
      name,
      brand:    p.brands?.trim()    ?? '',
      category: p.categories?.trim() ?? '',
      price:    0,                          // OpenFoodFacts has no price data
      imageUrl: p.image_url               ?? '',
    }
  } catch (e) {
    console.warn('[productLookup] OpenFoodFacts error:', e)
    return null
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch product info, trying each source in priority order.
 * Returns the first result with a non-empty name.
 * Returns null when all three fail — caller must supply a fallback name.
 */
export async function fetchProductFromAPI(
  barcode: string
): Promise<ExternalProductInfo | null> {
  const fromEdge = await lookupViaEdgeFunction(barcode)
  if (hasName(fromEdge)) return fromEdge

  const fromUPC = await lookupUPCItemDB(barcode)
  if (hasName(fromUPC)) return fromUPC

  const fromOFF = await lookupOpenFoodFacts(barcode)
  if (hasName(fromOFF)) return fromOFF

  return null
}
