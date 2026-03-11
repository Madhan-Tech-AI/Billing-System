import React, { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import {
  Package, BarChart2, Home, Plus, Edit2, Trash2,
  AlertTriangle, TrendingUp, ShoppingBag, DollarSign, Search,
  ChevronLeft, Save
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { useProductStore } from '../../stores/productStore'
import {
  addProduct, updateProduct, deleteProduct
} from '../../services/productService'
import {
  getTodaySales, getWeeklySales, getMonthlySales, getTopProducts
} from '../../services/salesService'
import type { Product } from '../../supabase/types'

type Tab = 'dashboard' | 'products' | 'inventory' | 'analytics'

const COLORS = ['#0ea5e9', '#d946ef', '#f59e0b', '#10b981', '#ef4444']

// ─── Dashboard Stats ─────────────────────────────────────────────────────────
function DashboardTab() {
  const [todayStats, setTodayStats] = useState({ total: 0, count: 0 })
  const [weeklyData, setWeeklyData] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { products } = useProductStore()

  useEffect(() => {
    async function fetchStats() {
      try {
        const [today, weekly, top] = await Promise.all([
          getTodaySales(),
          getWeeklySales(),
          getTopProducts(5),
        ])
        setTodayStats(today)
        setWeeklyData(weekly)
        setTopProducts(top)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const lowStock = products.filter((p) => p.stock < 10).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-400">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Revenue", value: `₹${todayStats.total.toFixed(2)}`, icon: <DollarSign className="w-5 h-5 text-white" />, color: 'from-emerald-600 to-emerald-500' },
          { label: "Today's Sales", value: todayStats.count, icon: <ShoppingBag className="w-5 h-5 text-white" />, color: 'from-primary-600 to-primary-500' },
          { label: 'Total Products', value: products.length, icon: <Package className="w-5 h-5 text-white" />, color: 'from-violet-600 to-violet-500' },
          { label: 'Low Stock', value: lowStock, icon: <AlertTriangle className="w-5 h-5 text-white" />, color: lowStock > 0 ? 'from-red-600 to-red-500' : 'from-surface-700 to-surface-600' },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
              {stat.icon}
            </div>
            <p className="text-2xl font-extrabold text-white">{stat.value}</p>
            <p className="text-xs text-surface-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly bar */}
        <div className="card p-4">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary-400" />
            Weekly Revenue
          </h3>
          {weeklyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #ffffff15', borderRadius: '12px', color: '#fff' }}
                  formatter={(v: any) => [`₹${Number(v).toFixed(2)}`, 'Revenue']}
                />
                <Bar dataKey="total" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-surface-500 text-sm">No sales data yet</div>
          )}
        </div>

        {/* Top products */}
        <div className="card p-4">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-accent-400" />
            Top Products
          </h3>
          {topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={80} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #ffffff15', borderRadius: '12px', color: '#fff' }}
                  formatter={(v: any) => [v, 'Units Sold']}
                />
                <Bar dataKey="quantity" radius={[0, 6, 6, 0]}>
                  {topProducts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-surface-500 text-sm">No sales data yet</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Product Form ─────────────────────────────────────────────────────────────
function ProductForm({
  product,
  onSave,
  onCancel,
}: {
  product?: Product
  onSave: (p: Product) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    barcode: product?.barcode ?? '',
    name: product?.name ?? '',
    price: product?.price?.toString() ?? '',
    gst: product?.gst?.toString() ?? '0',
    stock: product?.stock?.toString() ?? '0',
    category: product?.category ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = {
        barcode: form.barcode,
        name: form.name,
        price: parseFloat(form.price),
        gst: parseFloat(form.gst),
        stock: parseInt(form.stock, 10),
        category: form.category,
      }
      let saved: Product
      if (product) {
        saved = await updateProduct(product.id, data)
      } else {
        saved = await addProduct(data)
      }
      onSave(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    { key: 'barcode', label: 'Barcode', placeholder: '8901234567890', type: 'text' },
    { key: 'name', label: 'Product Name', placeholder: 'Milk 500ml', type: 'text' },
    { key: 'price', label: 'Price (₹)', placeholder: '45.00', type: 'number' },
    { key: 'gst', label: 'GST (%)', placeholder: '5', type: 'number' },
    { key: 'stock', label: 'Stock', placeholder: '100', type: 'number' },
    { key: 'category', label: 'Category', placeholder: 'Dairy', type: 'text' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {fields.map(({ key, label, placeholder, type }) => (
          <Input
            key={key}
            id={`field-${key}`}
            label={label}
            placeholder={placeholder}
            type={type}
            value={form[key as keyof typeof form]}
            onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
            required={key !== 'category'}
          />
        ))}
      </div>
      {error && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex gap-2 pt-2">
        <Button id="save-product-btn" type="submit" variant="primary" loading={loading} className="flex-1">
          <Save className="w-4 h-4" />
          {product ? 'Update Product' : 'Add Product'}
        </Button>
        <Button id="cancel-product-btn" type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// ─── Products Tab ─────────────────────────────────────────────────────────────
function ProductsTab() {
  const { products, addToCache, updateInCache, removeFromCache } = useProductStore()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | undefined>(undefined)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  )

  function handleSave(product: Product) {
    if (editProduct) {
      updateInCache(product)
    } else {
      addToCache(product)
    }
    setShowForm(false)
    setEditProduct(undefined)
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      await deleteProduct(deleteId)
      removeFromCache(deleteId)
      setDeleteId(null)
    } catch (e) {
      console.error(e)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex gap-3">
        <Input
          id="product-search"
          placeholder="Search by name, barcode, or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="w-4 h-4" />}
          className="flex-1"
        />
        <Button
          id="add-product-btn"
          variant="primary"
          onClick={() => { setEditProduct(undefined); setShowForm(true) }}
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-white/10">
              <tr>
                {['Barcode', 'Name', 'Price', 'GST', 'Stock', 'Category', 'Actions'].map((h) => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="table-cell font-mono text-xs text-surface-400">{p.barcode}</td>
                  <td className="table-cell font-medium text-white">{p.name}</td>
                  <td className="table-cell text-emerald-400">₹{Number(p.price).toFixed(2)}</td>
                  <td className="table-cell text-surface-300">{p.gst}%</td>
                  <td className="table-cell">
                    <span className={`badge ${p.stock < 10 ? 'badge-red' : p.stock < 30 ? 'badge-yellow' : 'badge-green'}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="table-cell text-surface-400 text-xs">{p.category}</td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      <button
                        id={`edit-${p.id}`}
                        onClick={() => { setEditProduct(p); setShowForm(true) }}
                        className="p-1.5 rounded-lg text-surface-400 hover:text-primary-400 hover:bg-primary-500/10 transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`delete-${p.id}`}
                        onClick={() => setDeleteId(p.id)}
                        className="p-1.5 rounded-lg text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-surface-500">
                    {search ? 'No products match your search' : 'No products yet. Add one or import CSV.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditProduct(undefined) }}
        title={editProduct ? 'Edit Product' : 'Add New Product'}
        size="lg"
      >
        <ProductForm
          product={editProduct}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditProduct(undefined) }}
        />
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <p className="text-surface-300 text-sm mb-4">
          Are you sure you want to delete this product? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button id="confirm-delete-btn" variant="danger" loading={deleting} onClick={handleDelete} className="flex-1">
            Delete
          </Button>
          <Button variant="ghost" onClick={() => setDeleteId(null)} className="flex-1">
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  )
}

// ─── CSV Importer Tab ─────────────────────────────────────────────────────────


// ─── Inventory Tab ────────────────────────────────────────────────────────────
function InventoryTab() {
  const { products } = useProductStore()
  const [search, setSearch] = useState('')

  const sorted = [...products]
    .filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode.includes(search)
    )
    .sort((a, b) => a.stock - b.stock)

  return (
    <div className="space-y-4 animate-fade-in">
      <Input
        id="inventory-search"
        placeholder="Search by name or barcode..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        icon={<Search className="w-4 h-4" />}
      />

      <div className="grid gap-2">
        {sorted.map((p) => {
          const isLow = p.stock < 10
          const isMedium = p.stock >= 10 && p.stock < 30
          return (
            <div
              key={p.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                isLow
                  ? 'bg-red-500/5 border-red-500/30'
                  : isMedium
                  ? 'bg-amber-500/5 border-amber-500/20'
                  : 'glass-dark border-white/5'
              }`}
            >
              <div className="flex-1">
                <p className={`font-medium text-sm ${isLow ? 'text-red-300' : 'text-white'}`}>
                  {isLow && <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-red-400" />}
                  {p.name}
                </p>
                <p className="text-xs text-surface-500 font-mono">{p.barcode} · {p.category}</p>
              </div>
              <div className="text-right">
                <span className={`text-lg font-bold ${isLow ? 'text-red-400' : isMedium ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {p.stock}
                </span>
                <p className="text-xs text-surface-500">units</p>
              </div>
            </div>
          )
        })}
        {sorted.length === 0 && (
          <div className="text-center py-16 text-surface-500">No products found</div>
        )}
      </div>
    </div>
  )
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMonthlySales()
      .then(setMonthlyData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card p-6">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-primary-400" />
          30-Day Revenue Trend
        </h3>
        {monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `₹${v}`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #ffffff15', borderRadius: '12px', color: '#fff' }}
                formatter={(v: any) => [`₹${Number(v).toFixed(2)}`, 'Revenue']}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#0ea5e9"
                strokeWidth={2.5}
                dot={{ fill: '#0ea5e9', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-surface-500 text-sm">
            No sales data for the past 30 days
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Admin App Shell ──────────────────────────────────────────────────────────


const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Home className="w-4 h-4" /> },
  { id: 'products', label: 'Products', icon: <Package className="w-4 h-4" /> },
  { id: 'inventory', label: 'Inventory', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-4 h-4" /> },
]

export default function AdminApp() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const { loadProducts, loading: productsLoading } = useProductStore()

  useEffect(() => {
    loadProducts()
  }, [])

  const tabContent: Record<Tab, React.ReactNode> = {
    dashboard: <DashboardTab />,
    products: <ProductsTab />,
    inventory: <InventoryTab />,
    analytics: <AnalyticsTab />,
  }

  return (
    <div className="min-h-screen bg-surface-950 flex">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-white/10 flex flex-col p-4 gap-1 h-screen sticky top-0">
        <div className="flex items-center gap-2.5 px-3 py-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">SuperMart</p>
            <p className="text-xs text-surface-500">Admin Panel</p>
          </div>
        </div>

        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            id={`tab-${id}`}
            onClick={() => setActiveTab(id)}
            className={activeTab === id ? 'nav-item-active' : 'nav-item'}
          >
            {icon}
            <span className="text-sm font-medium">{label}</span>
          </button>
        ))}

        <div className="mt-auto">
          <a
            href="/billing"
            id="back-to-billing-btn"
            className="nav-item text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to POS
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">{tabs.find((t) => t.id === activeTab)?.label}</h2>
            <p className="text-surface-400 text-sm mt-0.5">
              {activeTab === 'dashboard' && 'Overview of today\'s activity'}
              {activeTab === 'products' && 'Manage your product catalog'}
              {activeTab === 'inventory' && 'Stock levels — low stock highlighted in red'}
              {activeTab === 'analytics' && '30-day revenue trends'}
            </p>
          </div>
          {productsLoading && activeTab !== 'dashboard' && (
            <div className="flex items-center gap-2 text-surface-400 text-sm mb-4">
              <div className="animate-spin w-4 h-4 border border-primary-500 border-t-transparent rounded-full" />
              Loading products...
            </div>
          )}
          {tabContent[activeTab]}
        </div>
      </main>
    </div>
  )
}
