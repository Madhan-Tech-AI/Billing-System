import { useState } from 'react'
import { Banknote, CreditCard, Smartphone, CheckCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useCartStore } from '../../stores/cartStore'
import { useSessionStore } from '../../stores/sessionStore'
import { createSale, insertSaleItems, updateStockBatch } from '../../services/salesService'
import type { PaymentMethod } from '../../supabase/types'

interface CheckoutPanelProps {
  onCheckoutComplete: (saleId: string) => void
}

const paymentMethods: { method: PaymentMethod; icon: React.ReactNode; label: string; color: string }[] = [
  { method: 'Cash', icon: <Banknote className="w-6 h-6" />, label: 'Cash', color: 'from-emerald-600 to-emerald-500' },
  { method: 'UPI', icon: <Smartphone className="w-6 h-6" />, label: 'UPI / QR', color: 'from-violet-600 to-violet-500' },
  { method: 'Card', icon: <CreditCard className="w-6 h-6" />, label: 'Card / POS', color: 'from-blue-600 to-blue-500' },
]

export function CheckoutPanel({ onCheckoutComplete }: CheckoutPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { items, getTotal, clearCart } = useCartStore()
  const { cashierName } = useSessionStore()

  const total = getTotal()
  const disabled = items.length === 0

  async function handleConfirm() {
    if (!selectedMethod) return
    setLoading(true)
    setError(null)
    try {
      const sale = await createSale(total, selectedMethod, cashierName || 'Cashier')
      await insertSaleItems(sale.id, items)
      await updateStockBatch(
        items.map((item) => ({ product_id: item.product_id, quantity: item.quantity }))
      )
      clearCart()
      setIsOpen(false)
      setSelectedMethod(null)
      onCheckoutComplete(sale.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="p-4 pt-0">
        <Button
          id="checkout-btn"
          variant="success"
          className="w-full btn-lg"
          disabled={disabled}
          onClick={() => setIsOpen(true)}
        >
          <CheckCircle className="w-5 h-5" />
          Proceed to Checkout — ₹{total.toFixed(2)}
        </Button>
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Select Payment Method" size="sm">
        <div className="space-y-3">
          <p className="text-surface-400 text-sm">
            Total: <span className="text-white font-bold text-lg">₹{total.toFixed(2)}</span>
          </p>

          <div className="grid grid-cols-3 gap-2">
            {paymentMethods.map(({ method, icon, label, color }) => (
              <button
                key={method}
                id={`payment-${method.toLowerCase()}`}
                onClick={() => setSelectedMethod(method)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                  selectedMethod === method
                    ? `bg-gradient-to-br ${color} border-transparent text-white`
                    : 'border-white/10 text-surface-300 hover:border-white/30 hover:text-white bg-surface-800/40'
                }`}
              >
                {icon}
                <span className="text-xs font-semibold">{label}</span>
              </button>
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <Button
            id="confirm-payment-btn"
            variant="success"
            className="w-full"
            disabled={!selectedMethod || loading}
            loading={loading}
            onClick={handleConfirm}
          >
            {loading ? 'Processing...' : `Confirm ${selectedMethod ?? ''} Payment`}
          </Button>
        </div>
      </Modal>
    </>
  )
}
