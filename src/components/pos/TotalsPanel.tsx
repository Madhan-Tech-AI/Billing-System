import { useCartStore } from '../../stores/cartStore'

export function TotalsPanel() {
  const { items, getSubtotal, getTotalGST, getTotal, getItemCount } = useCartStore()

  const subtotal = getSubtotal()
  const totalGST = getTotalGST()
  const total = getTotal()
  const itemCount = getItemCount()

  const gstBreakdown = items.reduce<Record<number, number>>((acc, item) => {
    if (item.gst > 0) {
      acc[item.gst] = (acc[item.gst] ?? 0) + item.gstAmount
    }
    return acc
  }, {})

  return (
    <div className="border-t border-white/10 p-4 space-y-3">
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-surface-300">
          <span>Items ({itemCount})</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>

        {Object.entries(gstBreakdown).map(([rate, amount]) => (
          <div key={rate} className="flex justify-between text-sm text-surface-400">
            <span>GST @{rate}%</span>
            <span>₹{amount.toFixed(2)}</span>
          </div>
        ))}

        {totalGST > 0 && (
          <div className="flex justify-between text-sm text-amber-400">
            <span>Total GST</span>
            <span>₹{totalGST.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 pt-3 flex justify-between items-center">
        <span className="text-lg font-bold text-white">TOTAL</span>
        <span className="text-2xl font-extrabold gradient-text">₹{total.toFixed(2)}</span>
      </div>
    </div>
  )
}
