import { Trash2, Minus, Plus } from 'lucide-react'
import { useCartStore } from '../../stores/cartStore'
import type { CartItem } from '../../supabase/types'

interface CartItemRowProps {
  item: CartItem
}

function CartItemRow({ item }: CartItemRowProps) {
  const { updateQuantity, removeItem } = useCartStore()

  function handleQtyChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val)) updateQuantity(item.product_id, val)
  }

  return (
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors group">
      {/* Product name — read-only */}
      <td className="table-cell">
        <div>
          <p className="font-medium text-white text-sm">{item.name}</p>
          <p className="text-xs text-surface-400 font-mono">{item.barcode}</p>
        </div>
      </td>

      {/* Price — read-only */}
      <td className="table-cell text-surface-300 text-right">
        ₹{item.price.toFixed(2)}
      </td>

      {/* Quantity — editable */}
      <td className="table-cell">
        <div className="flex items-center gap-1 justify-center">
          <button
            id={`decrease-${item.product_id}`}
            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
            className="w-7 h-7 rounded-lg bg-surface-800 hover:bg-red-600/20 text-surface-300 hover:text-red-400 flex items-center justify-center transition-all flex-shrink-0"
          >
            <Minus className="w-3 h-3" />
          </button>

          <input
            id={`qty-${item.product_id}`}
            type="number"
            min={1}
            value={item.quantity}
            onChange={handleQtyChange}
            className="w-12 text-center font-semibold text-white text-sm bg-surface-800 border border-white/10 rounded-lg py-1 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />

          <button
            id={`increase-${item.product_id}`}
            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
            className="w-7 h-7 rounded-lg bg-surface-800 hover:bg-primary-600/20 text-surface-300 hover:text-primary-400 flex items-center justify-center transition-all flex-shrink-0"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </td>

      {/* Subtotal — read-only */}
      <td className="table-cell text-right">
        <span className="font-semibold text-primary-300">₹{item.subtotal.toFixed(2)}</span>
      </td>

      {/* Remove */}
      <td className="table-cell">
        <button
          id={`remove-${item.product_id}`}
          onClick={() => removeItem(item.product_id)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  )
}

export function CartTable() {
  const { items } = useCartStore()

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-16 text-surface-500">
        <div className="text-5xl mb-4">🛒</div>
        <p className="font-semibold text-surface-400">Cart is empty</p>
        <p className="text-sm mt-1">Scan a barcode or use manual entry to add items</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-surface-900/90 backdrop-blur-xl border-b border-white/10">
          <tr>
            <th className="table-header text-left">Product</th>
            <th className="table-header text-right">Price</th>
            <th className="table-header text-center">Qty</th>
            <th className="table-header text-right">Subtotal</th>
            <th className="table-header w-10"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <CartItemRow key={item.product_id} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
