/**
 * api/barcode.ts
 * Vercel Serverless Function — proxies Barcode Lookup API.
 *
 * Usage: GET /api/barcode?barcode=8901526207480
 *
 * Set the secret in Vercel Dashboard → Project → Settings → Environment Variables:
 *   BARCODE_LOOKUP_API_KEY = wj91jwdfzr08flv2fdhu39bzd0khto
 *
 * The API key is NEVER sent to the browser.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers — allow the same Vercel domain to call this route
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  const barcode = String(req.query.barcode ?? '').trim()

  // Validate — must be 7–14 digits (as per Barcode Lookup API docs)
  if (!barcode || !/^[0-9]{7,14}$/.test(barcode)) {
    return res.status(400).json({ error: 'Missing or invalid barcode parameter' })
  }

  const API_KEY = process.env.BARCODE_LOOKUP_API_KEY
  if (!API_KEY) {
    console.error('[/api/barcode] BARCODE_LOOKUP_API_KEY env var is not set')
    return res.status(500).json({ error: 'API key not configured on server' })
  }

  const url = `https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(barcode)}&key=${API_KEY}`

  try {
    const upstream = await fetch(url, {
      headers: { Accept: 'application/json' },
    })

    const data = await upstream.json()

    // Pass status code through so the client can handle 404 / 429 etc.
    return res.status(upstream.status).json(data)
  } catch (err) {
    console.error('[/api/barcode] upstream fetch failed:', err)
    return res.status(502).json({ error: 'Upstream API request failed' })
  }
}
