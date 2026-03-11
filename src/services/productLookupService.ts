/**
 * productLookupService.ts
 *
 * Fetches product info from external APIs given a barcode.
 *
 * Priority:
 *   1. Barcode Lookup API  (has price, brand, images)
 *   2. UPCItemDB           (free, good coverage)
 *   3. OpenFoodFacts       (open-source, food items)
 */

export interface ExternalProductInfo {
  name: string
  brand: string
  category: string
  price: number        // from store listings if available, else 0
  imageUrl: string     // first product image if available
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function hasName(info: ExternalProductInfo | null): info is ExternalProductInfo {
  return !!info?.name?.trim()
}

// ─── 1. Barcode Lookup API (primary) ─────────────────────────────────────────

async function lookupBarcodeLookup(barcode: string): Promise<ExternalProductInfo | null> {
  const apiKey = import.meta.env.VITE_BARCODE_LOOKUP_API_KEY as string
  if (!apiKey) {
    console.warn('[productLookup] VITE_BARCODE_LOOKUP_API_KEY not set — skipping Barcode Lookup API')
    return null
  }

  try {
    const res = await fetch(
      `https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(barcode)}&key=${apiKey}`
    )

    if (res.status === 404) return null          // product genuinely not found
    if (res.status === 429) {
      console.warn('[productLookup] Barcode Lookup API rate limit hit')
      return null
    }
    if (!res.ok) {
      console.warn(`[productLookup] Barcode Lookup API returned ${res.status}`)
      return null
    }

    const json = await res.json()
    const p = json?.products?.[0]
    if (!p) return null

    // Pick the lowest numeric store price that makes sense (> 0)
    let price = 0
    if (Array.isArray(p.stores)) {
      for (const store of p.stores) {
        const raw = parseFloat(store.price)
        if (!isNaN(raw) && raw > 0) {
          price = raw
          break
        }
      }
    }

    return {
      name: p.title?.trim() ?? '',
      brand: p.brand?.trim() ?? '',
      category: p.category?.trim() ?? '',
      price,
      imageUrl: p.images?.[0] ?? '',
    }
  } catch (e) {
    console.error('[productLookup] Barcode Lookup API error:', e)
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
      name: item.title?.trim() ?? '',
      brand: item.brand?.trim() ?? '',
      category: item.category?.trim() ?? '',
      price,
      imageUrl: item.images?.[0] ?? '',
    }
  } catch (e) {
    console.warn('[productLookup] UPCItemDB error:', e)
    return null
  }
}

// ─── 3. OpenFoodFacts (second free fallback, food & FMCG) ────────────────────

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
      p.product_name ||
      p.abbreviated_product_name ||
      ''
    ).trim()

    return {
      name,
      brand: p.brands?.trim() ?? '',
      category: p.categories?.trim() ?? '',
      price: 0,          // OpenFoodFacts has no price data
      imageUrl: p.image_url ?? '',
    }
  } catch (e) {
    console.warn('[productLookup] OpenFoodFacts error:', e)
    return null
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch product info from external APIs, trying each in priority order.
 * Returns the first result that has a non-empty product name.
 * Returns null if all three APIs fail — caller should use a fallback name.
 */
export async function fetchProductFromAPI(
  barcode: string
): Promise<ExternalProductInfo | null> {
  // 1. Barcode Lookup API (best data: has price & images)
  const fromBL = await lookupBarcodeLookup(barcode)
  if (hasName(fromBL)) return fromBL

  // 2. UPCItemDB (good global coverage, free tier)
  const fromUPC = await lookupUPCItemDB(barcode)
  if (hasName(fromUPC)) return fromUPC

  // 3. OpenFoodFacts (excellent for food/FMCG, no price)
  const fromOFF = await lookupOpenFoodFacts(barcode)
  if (hasName(fromOFF)) return fromOFF

  return null
}
