import { useState, useEffect, useRef, useCallback } from 'react'
import { useReactToPrint } from 'react-to-print'
import { QRCodeSVG } from 'qrcode.react'
import { ShoppingCart, Scan, User, LogOut, CheckCircle, Plus, Loader2 } from 'lucide-react'
import { CartTable } from '../../components/pos/CartTable'
import { TotalsPanel } from '../../components/pos/TotalsPanel'
import { CheckoutPanel } from '../../components/pos/CheckoutPanel'
import { InvoicePrint } from '../../components/pos/InvoicePrint'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useCartStore } from '../../stores/cartStore'
import { useProductStore } from '../../stores/productStore'
import { useSessionStore } from '../../stores/sessionStore'
import { subscribeToScanEvents, unsubscribeChannel } from '../../services/scannerService'
import { getProductByBarcode } from '../../services/productService'
import { createProductFromBarcode, enrichProductIfPlaceholder } from '../../services/productAutoCreate'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { CartItem } from '../../supabase/types'

interface InvoiceData {
  saleId: string
  items: CartItem[]
  subtotal: number
  totalGST: number
  total: number
  paymentMethod: string
}

export default function BillingApp() {
  const [cashierInput, setCashierInput] = useState('')
  const [sessionStarted, setSessionStarted] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')
  const [notification, setNotification] = useState<string | null>(null)
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [showInvoice, setShowInvoice] = useState(false)
  const [processing, setProcessing] = useState(false)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const invoiceRef = useRef<HTMLDivElement>(null)

  const { addItem, items, getSubtotal, getTotalGST, getTotal, clearCart } = useCartStore()
  const { loadProducts, getByBarcode, addToCache } = useProductStore()
  const { session, startSession, endSession, loading: sessionLoading, error: sessionError } = useSessionStore()

  // Resume persisted session on mount
  useEffect(() => {
    if (session) {
      setSessionStarted(true)
      loadProducts()
    }
  }, [])

  // ─── Core barcode handler ────────────────────────────────────────────────────
  const handleBarcode = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return

    // 1. Check in-memory product cache (fastest path)
    let cached = getByBarcode(barcode)
    if (cached) {
      // Re-enrich if it's a placeholder (inserted before API was working)
      if (cached.price === 0 && cached.name.startsWith(`Product ${barcode}`)) {
        showNotification(`🔄 Looking up product info…`)
        try {
          const enriched = await enrichProductIfPlaceholder(cached)
          addToCache(enriched)
          addItem(enriched)
          const priceNote = enriched.price > 0 ? ` — ₹${enriched.price.toFixed(2)}` : ' — set price in Admin'
          showNotification(`✅ ${enriched.name} added${priceNote}`)
        } catch {
          addItem(cached)
          showNotification(`✅ ${cached.name} added — set price in Admin`)
        }
        return
      }
      addItem(cached)
      const priceNote = cached.price > 0 ? ` — ₹${cached.price.toFixed(2)}` : ' — price: ₹0'
      showNotification(`✅ ${cached.name} added${priceNote}`)
      return
    }

    setProcessing(true)

    try {
      // 2. Query Supabase products table
      const found = await getProductByBarcode(barcode)
      if (found) {
        // Re-enrich placeholder products before adding to cart
        const product = await enrichProductIfPlaceholder(found)
        addToCache(product)
        addItem(product)
        const priceNote = product.price > 0 ? ` — ₹${product.price.toFixed(2)}` : ' — set price in Admin'
        showNotification(`✅ ${product.name} added${priceNote}`)
        return
      }

      // 3. Not in DB — call external API and auto-create
      showNotification(`🔍 Looking up barcode ${barcode}…`)
      const created = await createProductFromBarcode(barcode)
      addToCache(created)
      addItem(created)
      const priceNote = created.price > 0 ? ` — ₹${created.price.toFixed(2)}` : ' — set price in Admin'
      showNotification(`🆕 ${created.name} added${priceNote}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      showNotification(`⚠️ Failed to process barcode: ${msg}`)
    } finally {
      setProcessing(false)
    }
  }, [getByBarcode, addItem, addToCache])

  // Subscribe to realtime scan events when session is active
  useEffect(() => {
    if (!session) return

    channelRef.current = subscribeToScanEvents(session.id, (barcode) => {
      handleBarcode(barcode)
    })

    return () => {
      if (channelRef.current) {
        unsubscribeChannel(channelRef.current)
      }
    }
  }, [session?.id, handleBarcode])

  function showNotification(msg: string) {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3500)
  }

  async function handleStartSession() {
    if (!cashierInput.trim()) return
    try {
      await startSession(cashierInput.trim())
      await loadProducts()
      setSessionStarted(true)
    } catch {
      // error handled in store
    }
  }

  async function handleEndSession() {
    if (channelRef.current) {
      unsubscribeChannel(channelRef.current)
      channelRef.current = null
    }
    clearCart()
    await endSession()
    setSessionStarted(false)
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const barcode = manualBarcode.trim()
    if (!barcode || processing) return
    setManualBarcode('')
    handleBarcode(barcode)
  }

  const handlePrint = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: `Invoice-${invoiceData?.saleId.slice(0, 8)}`,
  })

  function handleCheckoutComplete(saleId: string) {
    const data: InvoiceData = {
      saleId,
      items: [...items],
      subtotal: getSubtotal(),
      totalGST: getTotalGST(),
      total: getTotal(),
      paymentMethod: 'Paid',
    }
    setInvoiceData(data)
    setShowInvoice(true)
  }

  const scannerUrl = session
    ? `${window.location.origin}/scanner?session=${session.id}`
    : ''

  // ─── Login Screen ─────────────────────────────────────────────────────────
  if (!sessionStarted) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm glass-dark rounded-2xl p-8 border border-white/10 animate-fade-in">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-900/50">
              <ShoppingCart className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">SuperMart POS</h1>
            <p className="text-surface-400 text-sm mt-1">Enter cashier name to start a session</p>
          </div>

          <div className="space-y-4">
            <Input
              id="cashier-name-input"
              label="Cashier Name"
              placeholder="e.g. Priya Sharma"
              value={cashierInput}
              onChange={(e) => setCashierInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartSession()}
              icon={<User className="w-4 h-4" />}
            />

            {sessionError && (
              <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{sessionError}</p>
            )}

            <Button
              id="start-session-btn"
              variant="primary"
              className="w-full"
              loading={sessionLoading}
              onClick={handleStartSession}
              disabled={!cashierInput.trim()}
            >
              Start POS Session
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Main POS Interface ───────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-surface-950 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 glass-dark flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-600 to-primary-500 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">SuperMart POS</h1>
            <p className="text-xs text-surface-400">
              {session?.cashier_name ?? 'Cashier'} •{' '}
              <span className="text-emerald-400">● Live</span>
            </p>
          </div>
        </div>

        {notification && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-600/20 text-primary-300 text-xs font-medium animate-fade-in">
            {processing && <Loader2 className="w-3 h-3 animate-spin" />}
            {notification}
          </div>
        )}

        <Button
          id="end-session-btn"
          variant="ghost"
          size="sm"
          onClick={handleEndSession}
          icon={<LogOut className="w-4 h-4" />}
        >
          End Session
        </Button>
      </header>

      {/* Mobile notification */}
      {notification && (
        <div className="md:hidden px-4 py-2 bg-primary-600/20 text-primary-300 text-xs font-medium text-center flex items-center justify-center gap-2">
          {processing && <Loader2 className="w-3 h-3 animate-spin" />}
          {notification}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: QR + Manual input */}
        <aside className="w-72 xl:w-80 flex-shrink-0 border-r border-white/10 flex flex-col overflow-auto p-4 gap-4">
          {/* QR Code pairing */}
          <div className="card text-center p-4">
            <div className="flex items-center gap-2 mb-3 justify-center text-surface-300">
              <Scan className="w-4 h-4" />
              <span className="text-sm font-semibold">Phone Scanner Pairing</span>
            </div>
            <div className="flex items-center justify-center p-3 bg-white rounded-xl">
              <QRCodeSVG value={scannerUrl} size={140} />
            </div>
            <p className="text-xs text-surface-500 mt-2">
              Scan with your phone to start sending items
            </p>
            <p className="text-xs font-mono text-surface-600 break-all mt-1">
              Session: {session?.id.slice(0, 12)}...
            </p>
          </div>

          {/* Manual barcode entry */}
          <div className="card p-4">
            <p className="text-sm font-semibold text-surface-300 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Manual Entry
            </p>
            <form onSubmit={handleManualSubmit} className="flex flex-col gap-2">
              <Input
                id="manual-barcode-input"
                placeholder="Type or scan barcode…"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                autoComplete="off"
              />
              <Button
                id="add-manual-btn"
                type="submit"
                variant="outline"
                size="sm"
                disabled={!manualBarcode.trim() || processing}
                loading={processing}
              >
                {processing ? 'Looking up…' : 'Add Item'}
              </Button>
            </form>
            <p className="text-xs text-surface-600 mt-2">
              Unknown barcodes are looked up and auto-added.
            </p>
          </div>

          {/* Session info */}
          <div className="rounded-xl bg-surface-900 border border-white/5 p-3 text-xs text-surface-500">
            <div className="flex justify-between mb-1">
              <span>Session ID</span>
              <span className="font-mono text-surface-400">{session?.id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span>Items in cart</span>
              <span className="text-primary-400 font-semibold">{items.length}</span>
            </div>
          </div>
        </aside>

        {/* Right panel: Cart */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <CartTable />
          </div>
          <div className="flex-shrink-0">
            <TotalsPanel />
            <CheckoutPanel onCheckoutComplete={handleCheckoutComplete} />
          </div>
        </main>
      </div>

      {/* Invoice Modal */}
      <Modal
        isOpen={showInvoice}
        onClose={() => setShowInvoice(false)}
        title="Sale Complete! 🎉"
        size="sm"
      >
        {invoiceData && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Payment recorded successfully</span>
            </div>
            <p className="text-surface-400 text-sm">
              Total: <span className="text-white font-bold">₹{invoiceData.total.toFixed(2)}</span>
            </p>
            <div className="flex gap-2">
              <Button
                id="print-invoice-btn"
                variant="primary"
                className="flex-1"
                onClick={() => handlePrint()}
              >
                Print Receipt
              </Button>
              <Button
                id="new-sale-btn"
                variant="ghost"
                className="flex-1"
                onClick={() => setShowInvoice(false)}
              >
                New Sale
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Hidden print target */}
      {invoiceData && (
        <div style={{ display: 'none' }}>
          <InvoicePrint
            ref={invoiceRef}
            items={invoiceData.items}
            subtotal={invoiceData.subtotal}
            totalGST={invoiceData.totalGST}
            total={invoiceData.total}
            cashierName={session?.cashier_name ?? 'Cashier'}
            saleId={invoiceData.saleId}
            paymentMethod={invoiceData.paymentMethod}
          />
        </div>
      )}
    </div>
  )
}
