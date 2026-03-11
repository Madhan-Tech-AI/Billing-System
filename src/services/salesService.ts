import { supabase } from '../supabase/client'
import type { CartItem, Sale, SaleItem } from '../supabase/types'

export async function createSale(
  total: number,
  paymentMethod: string,
  cashierName: string
): Promise<Sale> {
  const { data, error } = await supabase
    .from('sales')
    .insert([{ total, payment_method: paymentMethod, cashier_name: cashierName }])
    .select()
    .single()

  if (error) throw new Error(`Failed to create sale: ${error.message}`)
  return data
}

export async function insertSaleItems(
  saleId: string,
  items: CartItem[]
): Promise<SaleItem[]> {
  const saleItems = items.map((item) => ({
    sale_id: saleId,
    product_id: item.product_id,
    quantity: item.quantity,
    price: item.price,
  }))

  const { data, error } = await supabase
    .from('sale_items')
    .insert(saleItems)
    .select()

  if (error) throw new Error(`Failed to insert sale items: ${error.message}`)
  return data ?? []
}

export async function updateStock(
  productId: string,
  quantitySold: number
): Promise<void> {
  // Use RPC or manual decrement
  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('stock')
    .eq('id', productId)
    .single()

  if (fetchError) throw new Error(`Failed to fetch stock: ${fetchError.message}`)

  const newStock = Math.max(0, (product.stock ?? 0) - quantitySold)

  const { error: updateError } = await supabase
    .from('products')
    .update({ stock: newStock })
    .eq('id', productId)

  if (updateError) throw new Error(`Failed to update stock: ${updateError.message}`)
}

export async function updateStockBatch(
  items: { product_id: string; quantity: number }[]
): Promise<void> {
  await Promise.all(
    items.map((item) => updateStock(item.product_id, item.quantity))
  )
}

interface DailySale {
  day: string
  total: number
  count: number
}

export async function getTodaySales(): Promise<{ total: number; count: number }> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('sales')
    .select('total')
    .gte('created_at', today.toISOString())

  if (error) throw new Error(`Failed to fetch today's sales: ${error.message}`)

  const total = data?.reduce((sum, sale) => sum + Number(sale.total), 0) ?? 0
  return { total, count: data?.length ?? 0 }
}

export async function getWeeklySales(): Promise<DailySale[]> {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const { data, error } = await supabase
    .from('sales')
    .select('total, created_at')
    .gte('created_at', weekAgo.toISOString())
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch weekly sales: ${error.message}`)

  // Group by day
  const grouped: Record<string, DailySale> = {}
  data?.forEach((sale) => {
    const day = new Date(sale.created_at).toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    if (!grouped[day]) {
      grouped[day] = { day, total: 0, count: 0 }
    }
    grouped[day].total += Number(sale.total)
    grouped[day].count += 1
  })

  return Object.values(grouped)
}

export async function getMonthlySales(): Promise<DailySale[]> {
  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)

  const { data, error } = await supabase
    .from('sales')
    .select('total, created_at')
    .gte('created_at', monthAgo.toISOString())
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch monthly sales: ${error.message}`)

  const grouped: Record<string, DailySale> = {}
  data?.forEach((sale) => {
    const day = new Date(sale.created_at).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
    })
    if (!grouped[day]) {
      grouped[day] = { day, total: 0, count: 0 }
    }
    grouped[day].total += Number(sale.total)
    grouped[day].count += 1
  })

  return Object.values(grouped)
}

export async function getTopProducts(
  limit = 5
): Promise<{ name: string; quantity: number; revenue: number }[]> {
  const { data, error } = await supabase
    .from('sale_items')
    .select('product_id, quantity, price, products(name)')
    .order('quantity', { ascending: false })
    .limit(100) // Fetch a batch and aggregate client-side

  if (error) throw new Error(`Failed to fetch top products: ${error.message}`)

  const aggregated: Record<
    string,
    { name: string; quantity: number; revenue: number }
  > = {}

  data?.forEach((item: any) => {
    const name = item.products?.name ?? 'Unknown'
    if (!aggregated[name]) {
      aggregated[name] = { name, quantity: 0, revenue: 0 }
    }
    aggregated[name].quantity += item.quantity
    aggregated[name].revenue += item.quantity * Number(item.price)
  })

  return Object.values(aggregated)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit)
}

export async function getAllSales(): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(`Failed to fetch sales: ${error.message}`)
  return data ?? []
}
