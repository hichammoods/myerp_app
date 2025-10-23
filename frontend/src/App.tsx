import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/theme-provider'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { ProductManagement } from '@/pages/products/ProductManagement'
import { ContactManagement } from '@/pages/contacts/ContactManagement'
import { QuotationManagement } from '@/pages/quotations/QuotationManagement'
import { InvoiceManagement } from '@/pages/invoices/InvoiceManagement'
import { StockManagement } from '@/pages/inventory/StockManagement'
import { Login } from '@/pages/auth/Login'
import { Settings } from '@/pages/Settings'
import { AuthProvider } from '@/contexts/AuthContext'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="products" element={<ProductManagement />} />
                <Route path="inventory" element={<StockManagement />} />
                <Route path="contacts" element={<ContactManagement />} />
                <Route path="quotations" element={<QuotationManagement />} />
                <Route path="invoices" element={<InvoiceManagement />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </Router>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App