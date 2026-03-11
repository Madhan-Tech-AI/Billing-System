// @ts-nocheck — This file runs on Supabase's Deno runtime, not Node/Vite.
//               VS Code TypeScript errors here can be safely ignored.
// Deploy: supabase functions deploy barcode-lookup
// Secret:  supabase secrets set BARCODE_LOOKUP_API_KEY=wj91jwdfzr08flv2fdhu39bzd0khto

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const url = new URL(req.url)
  const barcode = url.searchParams.get('barcode')

  if (!barcode || !/^[0-9]{8,14}$/.test(barcode)) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid barcode parameter' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  const apiKey = Deno.env.get('BARCODE_LOOKUP_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'API key not configured on server' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  try {
    const apiRes = await fetch(
      `https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(barcode)}&key=${apiKey}`
    )

    const data = await apiRes.json()

    // Pass through non-200 status codes so the client can handle 404 / 429 etc.
    return new Response(JSON.stringify(data), {
      status: apiRes.status,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  } catch (err) {
    console.error('[barcode-lookup] upstream fetch failed:', err)
    return new Response(
      JSON.stringify({ error: 'Upstream API request failed' }),
      { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
