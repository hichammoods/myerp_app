import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Users, FileText, Euro, Loader2, TrendingUp, TrendingDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { inventoryApi, contactsApi, quotationsApi, invoicesApi } from '@/services/api'

export function Dashboard() {
  // Fetch stats from APIs
  const { data: inventoryStats, isLoading: loadingInventory } = useQuery({
    queryKey: ['inventory-stats'],
    queryFn: inventoryApi.getStats,
  })

  const { data: contactStats, isLoading: loadingContacts } = useQuery({
    queryKey: ['contact-stats'],
    queryFn: contactsApi.getStats,
  })

  const { data: quotationStats, isLoading: loadingQuotations } = useQuery({
    queryKey: ['quotation-stats'],
    queryFn: quotationsApi.getStats,
  })

  const { data: invoiceStats, isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoice-stats'],
    queryFn: invoicesApi.getStats,
  })

  const isLoading = loadingInventory || loadingContacts || loadingQuotations || loadingInvoices

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  // Prepare stats data
  const stats = [
    {
      title: 'Produits en Stock',
      value: inventoryStats?.stats?.total_products?.toString() || '0',
      icon: Package,
      subtext: `${inventoryStats?.stats?.critical_alerts || 0} alertes stock faible`,
      loading: loadingInventory,
    },
    {
      title: 'Clients Actifs',
      value: contactStats?.active_contacts?.toString() || '0',
      icon: Users,
      subtext: `${contactStats?.new_this_month || 0} nouveaux ce mois`,
      loading: loadingContacts,
    },
    {
      title: 'Devis ce Mois',
      value: quotationStats?.total_quotations?.toString() || '0',
      icon: FileText,
      subtext: `Taux conversion: ${parseFloat(quotationStats?.conversion_rate || 0).toFixed(1)}%`,
      loading: loadingQuotations,
    },
    {
      title: 'Chiffre d\'Affaires',
      value: formatCurrency(parseFloat(invoiceStats?.paid_revenue || 0)),
      icon: Euro,
      subtext: `${formatCurrency(parseFloat(invoiceStats?.outstanding_amount || 0))} en attente`,
      loading: loadingInvoices,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Tableau de Bord</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Vue d'ensemble de votre entreprise de mobilier
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {stat.loading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Chargement...</span>
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.subtext}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <RecentQuotations />
        <RecentInvoices />
      </div>
    </div>
  )
}

// Recent Quotations Component
function RecentQuotations() {
  const { data: quotations, isLoading } = useQuery({
    queryKey: ['quotations', { limit: 5 }],
    queryFn: () => quotationsApi.getAll({ limit: 5 }),
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'Brouillon',
      sent: 'Envoyé',
      accepted: 'Accepté',
      rejected: 'Rejeté',
      expired: 'Expiré',
      cancelled: 'Annulé',
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'text-gray-600',
      sent: 'text-blue-600',
      accepted: 'text-green-600',
      rejected: 'text-red-600',
      expired: 'text-orange-600',
      cancelled: 'text-gray-500',
    }
    return colors[status] || 'text-gray-600'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Derniers Devis</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : quotations?.quotations?.length > 0 ? (
          <div className="space-y-4">
            {quotations.quotations.slice(0, 5).map((quote: any) => (
              <div key={quote.id} className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{quote.quotation_number}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      quote.status === 'accepted' ? 'bg-green-100 text-green-700' :
                      quote.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                      quote.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {getStatusLabel(quote.status)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {quote.contact_first_name} {quote.contact_last_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(quote.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">
                    {formatCurrency(parseFloat(quote.total_amount || 0))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucun devis récent
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// Recent Invoices Component
function RecentInvoices() {
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', { limit: 5 }],
    queryFn: () => invoicesApi.getAll({ limit: 5 }),
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      brouillon: 'Brouillon',
      envoyee: 'Envoyée',
      payee: 'Payée',
      en_retard: 'En retard',
      annulee: 'Annulée',
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      brouillon: 'text-gray-600',
      envoyee: 'text-blue-600',
      payee: 'text-green-600',
      en_retard: 'text-red-600',
      annulee: 'text-gray-500',
    }
    return colors[status] || 'text-gray-600'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dernières Factures</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : invoices?.invoices?.length > 0 ? (
          <div className="space-y-4">
            {invoices.invoices.slice(0, 5).map((invoice: any) => (
              <div key={invoice.id} className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{invoice.invoice_number}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      invoice.status === 'payee' ? 'bg-green-100 text-green-700' :
                      invoice.status === 'envoyee' ? 'bg-blue-100 text-blue-700' :
                      invoice.status === 'en_retard' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {getStatusLabel(invoice.status)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {invoice.contact_first_name} {invoice.contact_last_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(invoice.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">
                    {formatCurrency(parseFloat(invoice.total_amount || 0))}
                  </p>
                  {invoice.status === 'en_retard' && invoice.amount_due && (
                    <p className="text-xs text-red-600 mt-0.5">
                      Dû: {formatCurrency(parseFloat(invoice.amount_due || 0))}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucune facture récente
          </p>
        )}
      </CardContent>
    </Card>
  )
}