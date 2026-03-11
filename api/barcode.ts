/**
 * api/barcode.ts
 * Vercel Serverless Function — proxies multiple Barcode Lookup APIs.
 *
 * Consolidates lookups into one server-side call to solve CORS and
 * provide better price/name fallback logic.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  const barcode = String(req.query.barcode ?? '').trim()
  if (!barcode || !/^[0-9]{7,14}$/.test(barcode)) {
    return res.status(400).json({ error: 'Missing or invalid barcode parameter' })
  }

  console.info(`[api/barcode] Looking up: ${barcode}`)

  const API_KEY = process.env.BARCODE_LOOKUP_API_KEY

  // 1. BarcodeLookup.com (Primary)
  const lookupBarcodeInfo = async () => {
    if (!API_KEY) return null
    try {
      const url = `https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(barcode)}&key=${API_KEY}`
      const response = await fetch(url)
      if (!response.ok) return null
      const data = await response.json()
      const p = data?.products?.[0]
      if (!p) return null

      let price = 0
      if (Array.isArray(p.stores)) {
        for (const store of p.stores) {
          const val = parseFloat(store.price || store.sale_price)
          if (val > 0) { price = val; break }
        }
      }

      return {
        name: (p.title || p.brand || '').trim(),
        brand: (p.brand || '').trim(),
        category: (p.category || '').trim(),
        price,
        source: 'barcodelookup'
      }
    } catch (e) {
      console.error('[api/barcode] BarcodeLookup error:', e)
      return null
    }
  }

  // 2. UPCItemDB (Fallback)
  const lookupUPCItemDB = async () => {
    try {
      const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`
      const response = await fetch(url)
      if (!response.ok) return null
      const data = await response.json()
      const item = data?.items?.[0]
      if (!item) return null

      let price = 0
      if (Array.isArray(item.offers)) {
        for (const offer of item.offers) {
          const val = parseFloat(offer.price)
          if (val > 0) { price = val; break }
        }
      }

      return {
        name: (item.title || '').trim(),
        brand: (item.brand || '').trim(),
        category: (item.category || '').trim(),
        price,
        source: 'upcitemdb'
      }
    } catch (e) {
      console.error('[api/barcode] UPCItemDB error:', e)
      return null
    }
  }

  // 3. OpenFoodFacts (Fallback)
  const lookupOpenFoodFacts = async () => {
    try {
      const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`
      const response = await fetch(url)
      if (!response.ok) return null
      const data = await response.json()
      if (data.status !== 1 || !data.product) return null
      const p = data.product
      return {
        name: (p.product_name || p.product_name_en || '').trim(),
        brand: (p.brands || '').split(',')[0].trim(),
        category: (p.categories || '').split(',')[0].trim(),
        price: 0,
        source: 'openfoodfacts'
      }
    } catch (e) {
      console.error('[api/barcode] OpenFoodFacts error:', e)
      return null
    }
  }

  // Parallel lookup
  const results = await Promise.all([
    lookupBarcodeInfo(),
    lookupUPCItemDB(),
    lookupOpenFoodFacts()
  ])

  const validResults = results.filter(r => r !== null) as any[]
  
  if (validResults.length === 0) {
    return res.status(404).json({ error: 'Product not found in any source' })
  }

  // Merge: Priority order for name (api > upc > off), first available price > 0
  const bestName = validResults.find(r => r.name)?.name || ''
  const bestPrice = validResults.find(r => r.price > 0)?.price || 0
  const bestBrand = validResults.find(r => r.brand)?.brand || ''
  const bestCategory = validResults.find(r => r.category)?.category || 'Uncategorised'

  return res.status(200).json({
    products: [{
      title: bestName,
      brand: bestBrand,
      category: bestCategory,
      price: bestPrice,
      // For compatibility with frontend logic expecting p.stores
      stores: bestPrice > 0 ? [{ price: bestPrice.toString() }] : []
    }],
    _metadata: {
      sources: validResults.map(r => r.source)
    }
  })
}
