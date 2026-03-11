import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

import BillingApp from './apps/billing/BillingApp'
import ScannerApp from './apps/scanner/ScannerApp'
import AdminApp from './apps/admin/AdminApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Default → billing */}
        <Route path="/" element={<Navigate to="/billing" replace />} />

        {/* Cashier POS */}
        <Route path="/billing" element={<BillingApp />} />

        {/* Mobile barcode scanner (requires ?session=UUID) */}
        <Route path="/scanner" element={<ScannerApp />} />

        {/* Admin dashboard */}
        <Route path="/admin" element={<AdminApp />} />
        <Route path="/admin/*" element={<AdminApp />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/billing" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
