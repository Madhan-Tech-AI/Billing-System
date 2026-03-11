import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShoppingCart, Wifi, WifiOff, CheckCircle2 } from 'lucide-react'
import { BarcodeScanner } from '../../components/pos/BarcodeScanner'
import { insertScanEvent } from '../../services/scannerService'
import { getProductByBarcode } from '../../services/productService'
import type { Product } from '../../supabase/types'

export default function ScannerApp() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session') ?? ''

  const [connected, setConnected] = useState(false)
  const [lastProduct, setLastProduct] = useState<Product | null>(null)
  const [scanCount, setScanCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (sessionId) setConnected(true)
  }, [sessionId])

  const handleScan = useCallback(
    async (barcode: string) => {
      if (!sessionId) {
        setError('No session ID found in URL. Please re-scan the QR code from the billing terminal.')
        return
      }
      setError(null)
      try {
        await insertScanEvent(sessionId, barcode)
        setScanCount((c) => c + 1)
        // Optionally show product name
        const product = await getProductByBarcode(barcode)
        setLastProduct(product)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send scan. Check network.')
      }
    },
    [sessionId]
  )

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center p-6 text-center">
        <ShoppingCart className="w-16 h-16 text-surface-500 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">No Session Found</h1>
        <p className="text-surface-400 text-sm">
          Scan the QR code on the billing terminal to start scanning items.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">SuperMart Scanner</h1>
            <p className="text-xs text-surface-500">Mobile Barcode Scanner</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full ${connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {connected ? 'Live' : 'Offline'}
        </div>
      </div>

      {/* Scanner */}
      <div className="flex-1 flex flex-col items-center px-4 py-6">
        <BarcodeScanner onScan={handleScan} sessionId={sessionId} />

        {/* Scan counter */}
        <div className="mt-6 glass-dark rounded-2xl p-4 w-full max-w-sm text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">{scanCount} item{scanCount !== 1 ? 's' : ''} scanned</span>
          </div>
          {lastProduct && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <p className="text-xs text-surface-400 mb-0.5">Last item</p>
              <p className="text-primary-300 font-semibold text-sm">{lastProduct.name}</p>
              <p className="text-surface-400 text-xs">₹{lastProduct.price.toFixed(2)}</p>
            </div>
          )}
          {!lastProduct && scanCount > 0 && (
            <p className="text-xs text-amber-400 mt-1">⚠️ Product not found in database</p>
          )}
        </div>

        {error && (
          <div className="mt-4 w-full max-w-sm p-3 rounded-xl bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
