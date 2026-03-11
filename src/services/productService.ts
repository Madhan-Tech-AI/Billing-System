import { supabase } from '../supabase/client'
import type { Product } from '../supabase/types'

export async function getAllProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw new Error(`Failed to fetch products: ${error.message}`)
  return data ?? []
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('barcode', barcode)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw new Error(`Failed to fetch product: ${error.message}`)
  }
  return data
}

export async function addProduct(
  productData: Omit<Product, 'id' | 'created_at'>
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert([productData])
    .select()
    .single()

  if (error) throw new Error(`Failed to add product: ${error.message}`)
  return data
}

export async function updateProduct(
  id: string,
  updates: Partial<Omit<Product, 'id' | 'created_at'>>
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update product: ${error.message}`)
  return data
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete product: ${error.message}`)
}

export async function bulkInsertProducts(
  rows: Omit<Product, 'id' | 'created_at'>[]
): Promise<number> {
  if (rows.length === 0) return 0

  const { data, error } = await supabase
    .from('products')
    .upsert(rows, { onConflict: 'barcode' })
    .select()

  if (error) throw new Error(`Failed to bulk insert products: ${error.message}`)
  return data?.length ?? 0
}
