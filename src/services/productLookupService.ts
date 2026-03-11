/**
 * productLookupService.ts
 *
 * Fetches product info for a barcode from three sources simultaneously,
 * then merges the best name + best price across all results.
 *
 * Priority for name:  /api/barcode (Vercel) → UPCItemDB → OpenFoodFacts
 * Priority for price: first source with price > 0
 */

export interface ExternalProductInfo {
  name: string
  brand: string
  category: string
  price: number     // 0 when no source has a price
  imageUrl: string
}

// ─── 1. Vercel /api/barcode route (primary — API key is server-side) ─────────

async function lookupViaVercelApi(barcode: string): Promise<ExternalProductInfo | null> {
  try {
    const res = await fetch(`/api/barcode?barcode=${encodeURIComponent(barcode)}`)

    console.debug(`[/api/barcode] status=${res.status} for ${barcode}`)

    if (res.status === 404) return null
    if (res.status === 429) { console.warn('[/api/barcode] rate-limited'); return null }
    if (!res.ok) { console.warn(`[/api/barcode] error ${res.status}`); return null }

    const json = await res.json()
    const p = json?.products?.[0]
    if (!p) { console.debug('[/api/barcode] no products in response'); return null }

    // Extract best store price (regular price, then sale price)
    let price = 0
    if (Array.isArray(p.stores)) {
      for (const store of p.stores) {
        const regular  = parseFloat(store.price)
        const sale     = parseFloat(store.sale_price)
        const best     = regular > 0 ? regular : (sale > 0 ? sale : 0)
        if (best > 0) { price = best; break }
      }
      if (price === 0 && p.stores.length > 0) {
        console.debug('[/api/barcode] stores found but all prices are 0 or missing')
      }
    } else {
      console.debug('[/api/barcode] no store listings — price will be 0')
    }

    const result: ExternalProductInfo = {
      name:     (p.title  || p.brand || '').trim(),
      brand:    (p.brand  || '').trim(),
      category: (p.category || '').trim(),
      price,
      imageUrl: p.images?.[0] ?? '',
    }
    console.debug('[/api/barcode] result:', result)
    return result
  } catch (e) {
    console.error('[/api/barcode] fetch error:', e)
    return null
  }
}

// ─── 2. UPCItemDB (free fallback) ────────────────────────────────────────────

async function lookupUPCItemDB(barcode: string): Promise<ExternalProductInfo | null> {
  try {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`
    )
    console.debug(`[UPCItemDB] status=${res.status} for ${barcode}`)
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
      name:     (item.title    || '').trim(),
      brand:    (item.brand    || '').trim(),
      category: (item.category || '').trim(),
      price,
      imageUrl: item.images?.[0] ?? '',
    }
  } catch (e) {
    console.warn('[UPCItemDB] error:', e)
    return null
  }
}

// ─── 3. OpenFoodFacts (free fallback — food & FMCG) ──────────────────────────

async function lookupOpenFoodFacts(barcode: string): Promise<ExternalProductInfo | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`
    )
    console.debug(`[OpenFoodFacts] status=${res.status} for ${barcode}`)
    if (!res.ok) return null

    const json = await res.json()
    if (json.status !== 1 || !json.product) return null

    const p   = json.product
    const name = (
      p.product_name_en          ||
      p.product_name             ||
      p.abbreviated_product_name ||
      p.generic_name_en          ||
      p.generic_name             ||
      ''
    ).trim()

    return {
      name,
      brand:    (p.brands     || '').split(',')[0].trim(),
      category: (p.categories || '').split(',')[0].trim(),
      price:    0,
      imageUrl: p.image_front_url || p.image_url || '',
    }
  } catch (e) {
    console.warn('[OpenFoodFacts] error:', e)
    return null
  }
}

// ─── Public: parallel fetch + smart merge ─────────────────────────────────────

/**
 * Calls all three sources simultaneously and merges the best data:
 *  Name  → /api/barcode → UPCItemDB → OpenFoodFacts
 *  Price → first source with price > 0
 *
 * Returns null if no source has a product name.
 */
export async function fetchProductFromAPI(
  barcode: string
): Promise<ExternalProductInfo | null> {
  console.info(`[productLookup] Starting parallel lookup for barcode: ${barcode}`)

  const [vercelResult, upcResult, offResult] = await Promise.allSettled([
    lookupViaVercelApi(barcode),
    lookupUPCItemDB(barcode),
    lookupOpenFoodFacts(barcode),
  ])

  const vercel = vercelResult.status === 'fulfilled' ? vercelResult.value : null
  const upc    = upcResult.status    === 'fulfilled' ? upcResult.value    : null
  const off    = offResult.status    === 'fulfilled' ? offResult.value    : null

  console.info('[productLookup] Results →', {
    vercel: vercel ? `"${vercel.name}" price=${vercel.price}` : null,
    upc:    upc    ? `"${upc.name}"    price=${upc.price}`    : null,
    off:    off    ? `"${off.name}"    price=${off.price}`    : null,
  })

  // Best name: priority order
  const bestNameSource = [vercel, upc, off].find((r) => r?.name?.trim())
  if (!bestNameSource) {
    console.warn('[productLookup] Product not found in any API for barcode:', barcode)
    return null
  }

  // Best price: take the first source that has a positive price
  const bestPrice = [vercel, upc, off].find((r) => r && r.price > 0)?.price ?? 0
  if (bestPrice === 0) {
    console.warn('[productLookup] Price not available — set manually in Admin dashboard')
  }

  return {
    name:     bestNameSource.name,
    brand:    bestNameSource.brand,
    category: bestNameSource.category,
    price:    bestPrice,
    imageUrl: bestNameSource.imageUrl,
  }
}
