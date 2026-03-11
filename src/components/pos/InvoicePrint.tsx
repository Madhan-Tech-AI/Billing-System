import { forwardRef } from 'react'
import type { CartItem } from '../../supabase/types'

interface InvoicePrintProps {
  items: CartItem[]
  subtotal: number
  totalGST: number
  total: number
  cashierName: string
  saleId: string
  paymentMethod: string
}

export const InvoicePrint = forwardRef<HTMLDivElement, InvoicePrintProps>(
  ({ items, subtotal, totalGST, total, cashierName, saleId, paymentMethod }, ref) => {
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
    const timeStr = now.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit',
    })


    const gstBreakdown = items.reduce<Record<number, number>>((acc, item) => {
      if (item.gst > 0) {
        acc[item.gst] = (acc[item.gst] ?? 0) + item.gstAmount
      }
      return acc
    }, {})

    return (
      <div
        id="thermal-receipt"
        ref={ref}
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: '12px',
          width: '300px',
          margin: '0 auto',
          padding: '12px',
          color: '#000',
          background: '#fff',
          lineHeight: '1.5',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px' }}>
            🛒 SUPERMART POS
          </div>
          <div style={{ fontSize: '11px', color: '#555' }}>
            GST Compliant Receipt
          </div>
          <div style={{ marginTop: '4px', fontSize: '10px' }}>
            {dateStr} | {timeStr}
          </div>
          <div style={{ fontSize: '10px' }}>Cashier: {cashierName}</div>
          <div style={{ fontSize: '9px', color: '#777' }}>Invoice: #{saleId.slice(0, 8).toUpperCase()}</div>
        </div>

        <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

        {/* Items */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontSize: '10px', fontWeight: 'bold' }}>ITEM</th>
              <th style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold' }}>QTY</th>
              <th style={{ textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>AMT</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.product_id}>
                <td style={{ paddingTop: '2px' }}>
                  <div style={{ fontSize: '11px' }}>{item.name}</div>
                  <div style={{ fontSize: '9px', color: '#666' }}>₹{item.price.toFixed(2)} × {item.quantity}</div>
                </td>
                <td style={{ textAlign: 'center', fontSize: '11px' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', fontSize: '11px' }}>₹{item.subtotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
          <span>Subtotal</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>

        {Object.entries(gstBreakdown).map(([rate, amount]) => (
          <div key={rate} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#555' }}>
            <span>GST @{rate}%</span>
            <span>₹{(amount as number).toFixed(2)}</span>
          </div>
        ))}

        {totalGST > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555' }}>
            <span>Total GST</span>
            <span>₹{totalGST.toFixed(2)}</span>
          </div>
        )}

        <div style={{ borderTop: '2px solid #000', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
          <span>TOTAL</span>
          <span>₹{total.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginTop: '4px' }}>
          <span>Payment Method</span>
          <span>{paymentMethod}</span>
        </div>

        <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: '10px', color: '#555' }}>
          <div>Thank you for shopping!</div>
          <div>Please visit again 😊</div>
          <div style={{ marginTop: '4px', fontSize: '9px' }}>
            Goods once sold will not be taken back
          </div>
        </div>
      </div>
    )
  }
)

InvoicePrint.displayName = 'InvoicePrint'
