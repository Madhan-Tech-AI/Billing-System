import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  const barcode = String(req.query.barcode ?? '').trim()
  if (!barcode || !/^[0-9]{7,14}$/.test(barcode)) {
    return res.status(400).json({ error: 'Missing or invalid barcode parameter', received: barcode })
  }

  console.info(`[api/barcode] Processing lookup for: ${barcode}`)

  try {
    // STEP 2: Check Supabase products table first
    const { data: existingProduct, error: dbError } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle()

    if (existingProduct) {
      console.info(`[api/barcode] Found in database: ${existingProduct.name}`)
      return res.status(200).json({ products: [existingProduct], _source: 'database' })
    }

    // STEP 4: Query multiple barcode APIs if not in DB
    const API_KEY = process.env.VITE_BARCODE_LOOKUP_API_KEY || "wj91jwdfzr08flv2fdhu39bzd0khto"

    // 1. BarcodeLookup.com
    const lookupBarcodeInfo = async () => {
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
            const rawPrice = store.price || store.sale_price || store.msrp
            const val = typeof rawPrice === 'string' ? parseFloat(rawPrice.replace(/[^0-9.]/g, '')) : parseFloat(rawPrice)
            if (!isNaN(val) && val > 0) { price = val; break }
          }
        }

        return {
          name: (p.title || p.brand || '').trim(),
          brand: (p.brand || '').trim(),
          category: (p.category || '').trim(),
          image: p.images?.[0] || '',
          price,
          source: 'barcodelookup'
        }
      } catch (e) {
        console.error('[api/barcode] BarcodeLookup error:', e)
        return null
      }
    }

    // 2. UPCItemDB
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
            if (!isNaN(val) && val > 0) { price = val; break }
          }
        }

        return {
          name: (item.title || '').trim(),
          brand: (item.brand || '').trim(),
          category: (item.category || '').trim(),
          image: item.images?.[0] || '',
          price,
          source: 'upcitemdb'
        }
      } catch (e) {
        console.error('[api/barcode] UPCItemDB error:', e)
        return null
      }
    }

    // 3. OpenFoodFacts
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
          image: p.image_url || '',
          price: 0,
          source: 'openfoodfacts'
        }
      } catch (e) {
        console.error('[api/barcode] OpenFoodFacts error:', e)
        return null
      }
    }

    let results = await Promise.all([
      lookupBarcodeInfo(),
      lookupUPCItemDB(),
      lookupOpenFoodFacts()
    ])

    let validResults = results.filter(r => r !== null) as any[]
    let finalInfo: any = null

    if (validResults.length > 0) {
      // Merge results
      const bestName = validResults.find(r => r.name)?.name || ''
      const bestPrice = validResults.find(r => r.price > 0)?.price || 0
      const bestBrand = validResults.find(r => r.brand)?.brand || ''
      const bestCategory = validResults.find(r => r.category)?.category || 'Uncategorised'
      const bestImage = validResults.find(r => r.image)?.image || ''

      finalInfo = {
        name: bestName,
        brand: bestBrand,
        category: bestCategory,
        price: bestPrice,
        image: bestImage,
        source: 'barcode-apis'
      }
    }

    // STEP 5: If no barcode API matches, perform SerpAPI internet search
    if (!finalInfo) {
      console.info(`[api/barcode] No results from barcode APIs, falling back to SerpAPI for: ${barcode}`)
      const SERPAPI_KEY = process.env.SERPAPI_API_KEY
      if (SERPAPI_KEY) {
        try {
          const serpRes = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(`${barcode} product`)}&api_key=${SERPAPI_KEY}`)
          if (serpRes.ok) {
            const serpData = await serpRes.json()
            const snippets = serpData.organic_results?.slice(0, 5).map((r: any) => `${r.title}: ${r.snippet}`).join('\n') || ''

            // STEP 6: Use AI (Gemini) to extract product info from snippets
            const GEMINI_KEY = process.env.GEMINI_API_KEY
            if (GEMINI_KEY && snippets) {
              console.info(`[api/barcode] Snippets found, using Gemini AI to extract info...`)
              const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{
                    parts: [{
                      text: `Extract product info for barcode "${barcode}" from these Google search results snippets. Return ONLY a valid JSON object with fields: name, brand, category, price (as a number), and image (URL). If unknown, use logical guesses or reasonable defaults.
                      Snippets:
                      ${snippets}`
                    }]
                  }]
                })
              })

              if (geminiRes.ok) {
                const geminiData = await geminiRes.json()
                const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
                const jsonMatch = text.match(/\{[\s\S]*\}/)
                if (jsonMatch) {
                  const extracted = JSON.parse(jsonMatch[0])
                  finalInfo = {
                    ...extracted,
                    source: 'ai-serpapi'
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error('[api/barcode] SerpAPI/AI error:', e)
        }
      }
    }

    if (!finalInfo || !finalInfo.name) {
      const missingKeys = []
      if (!process.env.VITE_BARCODE_LOOKUP_API_KEY) missingKeys.push('BARCODE_LOOKUP_API_KEY')
      if (!process.env.SERPAPI_API_KEY) missingKeys.push('SERPAPI_API_KEY')
      if (!process.env.GEMINI_API_KEY) missingKeys.push('GEMINI_API_KEY')

      console.warn(`[api/barcode] Product not discovered for barcode ${barcode}. Missing keys: ${missingKeys.join(', ')}`)
      return res.status(404).json({ 
        error: 'Product not discovered', 
        barcode,
        _diagnostics: {
          missingKeys,
          apisAttempted: ['barcodelookup', 'upcitemdb', 'openfoodfacts', 'serpapi', 'gemini']
        }
      })
    }

    // STEP 7: Insert the new product into Supabase products table
    console.info(`[api/barcode] Discovered product: ${finalInfo.name}. Inserting into database...`)
    const { data: newProduct, error: insertError } = await supabase
      .from('products')
      .insert([{
        barcode,
        name: finalInfo.name,
        brand: finalInfo.brand,
        category: finalInfo.category || 'Uncategorised',
        price: finalInfo.price || 0,
        image: finalInfo.image || '',
        gst: 18, // Default GST
        stock: 100 // Default stock for newly discovered items
      }])
      .select()
      .single()

    if (insertError) {
      console.error('[api/barcode] Database insertion error:', insertError)
      // Return the info anyway even if DB insert failed (cache will still have it temporarily)
      return res.status(200).json({ 
        products: [{
          ...finalInfo,
          title: finalInfo.name, // compatibility
          barcode
        }], 
        _warning: 'Failed to save to database',
        _source: finalInfo.source 
      })
    }

    // STEP 8 & 9 are handled by the frontend adding the returned product to cache and cart
    return res.status(201).json({ 
      products: [newProduct], 
      _source: finalInfo.source 
    })

  } catch (error: any) {
    console.error('[api/barcode] Fatal error:', error)
    return res.status(500).json({ error: 'Internal server error', message: error.message })
  }
}
