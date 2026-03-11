/**
 * productLookupService.ts
 *
 * Looks up product info from external APIs given a barcode.
 * Primary: UPCItemDB — Fallback: OpenFoodFacts
 */

export interface ExternalProductInfo {
  name: string
  brand: string
  category: string
}

// ─── UPCItemDB ───────────────────────────────────────────────────────────────

async function lookupUPCItemDB(barcode: string): Promise<ExternalProductInfo | null> {
  try {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`
    )
    if (!res.ok) return null

    const json = await res.json()
    const item = json?.items?.[0]
    if (!item) return null

    return {
      name: item.title ?? item.brand ?? '',
      brand: item.brand ?? '',
      category: item.category ?? '',
    }
  } catch {
    return null
  }
}

// ─── OpenFoodFacts ───────────────────────────────────────────────────────────

async function lookupOpenFoodFacts(barcode: string): Promise<ExternalProductInfo | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`
    )
    if (!res.ok) return null

    const json = await res.json()
    if (json.status !== 1 || !json.product) return null

    const p = json.product
    const name =
      p.product_name_en ||
      p.product_name ||
      p.abbreviated_product_name ||
      p.brands ||
      ''

    return {
      name,
      brand: p.brands ?? '',
      category: p.categories ?? '',
    }
  } catch {
    return null
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Attempts to fetch product info for a given barcode.
 * Tries UPCItemDB first; falls back to OpenFoodFacts.
 * Returns null only if both APIs fail — the caller should supply a fallback name.
 */
export async function fetchProductFromAPI(
  barcode: string
): Promise<ExternalProductInfo | null> {
  const fromUPC = await lookupUPCItemDB(barcode)
  if (fromUPC && fromUPC.name) return fromUPC

  const fromOFF = await lookupOpenFoodFacts(barcode)
  if (fromOFF && fromOFF.name) return fromOFF

  return null
}
