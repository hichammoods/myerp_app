import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { EnhancedQuotationBuilder } from './EnhancedQuotationBuilder'
import { toast } from 'react-hot-toast'
import { generateQuotationPDF } from '@/services/pdfGenerator'
import { quotationsApi, settingsApi, salesOrdersApi } from '@/services/api'
import {
  Plus,
  FileText,
  Download,
  Search,
  Filter,
  Calendar,
  Euro,
  Send,
  Check,
  X,
  Clock,
  AlertCircle,
  Copy,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  User,
  Package
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function QuotationManagement() {
  const queryClient = useQueryClient()
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingQuotation, setEditingQuotation] = useState<any>(null)
  const [searchInput, setSearchInput] = useState('')  // User input (not debounced)
  const [searchTerm, setSearchTerm] = useState('')    // Debounced search term
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [sortBy, setSortBy] = useState('date_desc')
  const [showConvertDialog, setShowConvertDialog] = useState(false)
  const [quotationToConvert, setQuotationToConvert] = useState<any>(null)
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput)
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [searchInput])

  // Fetch quotations from API
  const { data: quotationsData, isLoading, error } = useQuery({
    queryKey: ['quotations', { search: searchTerm, status: filterStatus === 'all' ? undefined : filterStatus }],
    queryFn: () => quotationsApi.getAll({
      search: searchTerm || undefined,
      status: filterStatus === 'all' ? undefined : filterStatus
    })
  })

  const quotations = quotationsData?.quotations || []

  // Fetch statistics from API
  const { data: statsData } = useQuery({
    queryKey: ['quotation-stats'],
    queryFn: () => quotationsApi.getStats()
  })

  // Use statistics from API or calculate from local data as fallback
  const stats = useMemo(() => {
    if (statsData) {
      return {
        totalQuotations: parseInt(statsData.total_quotations) || 0,
        acceptedQuotations: parseInt(statsData.accepted_count) || 0,
        draftCount: parseInt(statsData.draft_count) || 0,
        sentCount: parseInt(statsData.sent_count) || 0,
        rejectedCount: parseInt(statsData.rejected_count) || 0,
        expiredCount: parseInt(statsData.expired_count) || 0,
        potentialRevenue: parseFloat(statsData.potential_revenue) || 0,
        acceptedRevenue: parseFloat(statsData.accepted_revenue) || 0,
        averageValue: parseFloat(statsData.average_quotation_value) || 0,
        conversionRate: parseFloat(statsData.conversion_rate) || 0
      }
    }
    // Fallback to local calculation if API stats not available
    const totalQuotations = quotations.length
    const acceptedQuotations = quotations.filter(q => q.status === 'accepted').length
    const draftCount = quotations.filter(q => q.status === 'draft').length
    const sentCount = quotations.filter(q => q.status === 'sent').length
    const rejectedCount = quotations.filter(q => q.status === 'rejected').length
    const expiredCount = quotations.filter(q => q.status === 'expired').length
    const potentialRevenue = quotations.reduce((sum, q) => sum + (q.total_amount || q.total_ttc || 0), 0)
    const acceptedRevenue = quotations
      .filter(q => q.status === 'accepted')
      .reduce((sum, q) => sum + (q.total_amount || q.total_ttc || 0), 0)
    const averageValue = totalQuotations > 0 ? potentialRevenue / totalQuotations : 0
    const conversionRate = totalQuotations > 0 ? (acceptedQuotations / totalQuotations) * 100 : 0

    return {
      totalQuotations,
      acceptedQuotations,
      draftCount,
      sentCount,
      rejectedCount,
      expiredCount,
      potentialRevenue,
      acceptedRevenue,
      averageValue,
      conversionRate
    }
  }, [quotations, statsData])

  // Create quotation mutation
  const createQuotationMutation = useMutation({
    mutationFn: quotationsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['quotation-stats'] })
      toast.success('Devis créé avec succès')
      setShowBuilder(false)
      setEditingQuotation(null)
    },
    onError: () => {
      toast.error('Erreur lors de la création du devis')
    }
  })

  // Update quotation mutation
  const updateQuotationMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => quotationsApi.update(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['quotation-stats'] })
      // Also invalidate the specific quotation query to ensure fresh data on next edit
      queryClient.invalidateQueries({ queryKey: ['quotation', variables.id] })
      toast.success('Devis mis à jour avec succès')
      setShowBuilder(false)
      setEditingQuotation(null)
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour du devis')
    }
  })

  // Delete quotation mutation
  const deleteQuotationMutation = useMutation({
    mutationFn: quotationsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['quotation-stats'] })
      toast.success('Devis supprimé avec succès')
    },
    onError: () => {
      toast.error('Erreur lors de la suppression du devis')
    }
  })

  // Duplicate quotation mutation
  const duplicateQuotationMutation = useMutation({
    mutationFn: quotationsApi.duplicate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['quotation-stats'] })
      toast.success('Devis dupliqué avec succès')
    },
    onError: () => {
      toast.error('Erreur lors de la duplication du devis')
    }
  })

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => quotationsApi.updateStatus(id, status),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['quotation-stats'] })

      // Show appropriate success message based on status
      const messages: Record<string, string> = {
        'sent': 'Devis envoyé avec succès',
        'accepted': 'Devis accepté avec succès',
        'rejected': 'Devis refusé',
        'draft': 'Devis remis en brouillon',
        'expired': 'Devis marqué comme expiré'
      }
      toast.success(messages[variables.status] || 'Statut mis à jour avec succès')
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour du statut')
    }
  })

  // Convert to sales order mutation
  const convertToOrderMutation = useMutation({
    mutationFn: ({ quotationId, expectedDeliveryDate }: { quotationId: string, expectedDeliveryDate?: string }) =>
      salesOrdersApi.create({
        quotation_id: quotationId,
        expected_delivery_date: expectedDeliveryDate || undefined
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['quotation-stats'] })
      toast.success(`Commande ${data.order_number} créée avec succès`)
      setShowConvertDialog(false)
      setQuotationToConvert(null)
      setExpectedDeliveryDate('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la conversion en commande')
    }
  })

  // Apply client-side filters only for things not handled by backend
  const filteredQuotations = useMemo(() => {
    let filtered = [...quotations]

    // Period filter (not handled by backend, so we do it client-side)
    if (filterPeriod !== 'all') {
      filtered = filtered.filter(quotation => {
        // Use created_at field from backend
        const dateStr = quotation.created_at
        if (!dateStr) return false

        const quotationDate = new Date(dateStr)
        const now = new Date()
        now.setHours(0, 0, 0, 0) // Reset to start of day for accurate comparison

        const quotationDay = new Date(quotationDate)
        quotationDay.setHours(0, 0, 0, 0)

        const daysDiff = Math.floor((now.getTime() - quotationDay.getTime()) / (1000 * 60 * 60 * 24))

        switch (filterPeriod) {
          case 'today':
            return daysDiff === 0
          case 'week':
            return daysDiff >= 0 && daysDiff <= 7
          case 'month':
            return daysDiff >= 0 && daysDiff <= 30
          case 'quarter':
            return daysDiff >= 0 && daysDiff <= 90
          default:
            return true
        }
      })
    }

    // Sort (backend returns sorted by date desc, but we allow client-side re-sorting)
    switch (sortBy) {
      case 'date_desc':
        filtered.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime()
          const dateB = new Date(b.created_at).getTime()
          return dateB - dateA
        })
        break
      case 'date_asc':
        filtered.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime()
          const dateB = new Date(b.created_at).getTime()
          return dateA - dateB
        })
        break
      case 'amount_desc':
        filtered.sort((a, b) => {
          const amountA = parseFloat(a.total_amount) || 0
          const amountB = parseFloat(b.total_amount) || 0
          return amountB - amountA
        })
        break
      case 'amount_asc':
        filtered.sort((a, b) => {
          const amountA = parseFloat(a.total_amount) || 0
          const amountB = parseFloat(b.total_amount) || 0
          return amountA - amountB
        })
        break
      case 'client':
        filtered.sort((a, b) => (a.contact_name || '').localeCompare(b.contact_name || ''))
        break
    }

    return filtered
  }, [quotations, filterPeriod, sortBy])

  const handleSaveQuotation = (data: any) => {
    if (editingQuotation) {
      // Update existing quotation
      updateQuotationMutation.mutate({ id: editingQuotation.id, data })
    } else {
      // Create new quotation
      createQuotationMutation.mutate(data)
    }
  }

  const handleEditQuotation = async (quotation: any) => {
    try {
      // Fetch full quotation details including line_items
      const fullQuotation = await quotationsApi.getById(quotation.id)
      setEditingQuotation(fullQuotation.quotation || fullQuotation)
      setShowBuilder(true)
    } catch (error) {
      toast.error('Erreur lors du chargement du devis')
      console.error('Error loading quotation:', error)
    }
  }

  const handleDuplicateQuotation = (quotation: any) => {
    if (confirm('Voulez-vous dupliquer ce devis ?')) {
      duplicateQuotationMutation.mutate(quotation.id)
    }
  }

  const handleDeleteQuotation = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce devis ?')) {
      deleteQuotationMutation.mutate(id)
    }
  }

  const handleConvertToOrder = (quotation: any) => {
    if (quotation.status !== 'accepted') {
      toast.error('Seuls les devis acceptés peuvent être convertis en commande')
      return
    }

    if (quotation.sales_order_id) {
      toast.error('Ce devis a déjà été converti en commande')
      return
    }

    // Set default delivery date to 2 weeks from now
    const defaultDate = new Date()
    defaultDate.setDate(defaultDate.getDate() + 14)
    setExpectedDeliveryDate(defaultDate.toISOString().split('T')[0])

    setQuotationToConvert(quotation)
    setShowConvertDialog(true)
  }

  const confirmConvertToOrder = () => {
    if (!quotationToConvert) return
    convertToOrderMutation.mutate({
      quotationId: quotationToConvert.id,
      expectedDeliveryDate: expectedDeliveryDate || undefined
    })
  }

  const handleSendQuotation = (quotation: any) => {
    updateStatusMutation.mutate({ id: quotation.id, status: 'sent' })
  }

  const handleDownloadPDF = async (quotation: any) => {
    try {
      // Fetch full quotation data with line items from API
      const fullQuotation = await quotationsApi.getById(quotation.id)
      const quotationData = fullQuotation.quotation || fullQuotation

      // Fetch company information from API
      let company = {
        name: 'MyERP Furniture',
        address: '123 Rue de la République',
        city: 'Paris',
        postalCode: '75001',
        country: 'France',
        phone: '+33 1 23 45 67 89',
        email: 'contact@myerp-furniture.fr',
        website: 'www.myerp-furniture.fr',
        siret: '123 456 789 00012',
        tva: 'FR 12 345678900'
      }

      try {
        const companyData = await settingsApi.getCompany()
        if (companyData?.company) {
          company = {
            name: companyData.company.name || company.name,
            address: companyData.company.address || company.address,
            city: companyData.company.city || company.city,
            postalCode: companyData.company.postal_code || company.postalCode,
            country: companyData.company.country || company.country,
            phone: companyData.company.phone || company.phone,
            email: companyData.company.email || company.email,
            website: companyData.company.website || company.website,
            siret: companyData.company.siret || company.siret,
            tva: companyData.company.tva || company.tva
          }
        }
      } catch (companyError) {
        console.warn('Could not fetch company settings, using defaults:', companyError)
      }

      // Use client contact address from quotation data
      const client = {
        name: quotationData.contact_name || 'Client',
        company: quotationData.company_name || '',
        address: quotationData.contact_address || '',
        city: quotationData.contact_city || '',
        postalCode: quotationData.contact_postal_code || '',
        country: quotationData.contact_country || 'France',
        phone: quotationData.contact_phone || '',
        email: quotationData.contact_email || ''
      }

      // Map line items from quotation data
      const items = (quotationData.line_items || []).map((item: any) => {
        // Calculate item total considering discount
        const subtotal = item.quantity * item.unit_price
        const discountAmount = item.discount_percent
          ? (subtotal * item.discount_percent) / 100
          : (item.discount_amount || 0)
        const afterDiscount = subtotal - discountAmount
        const taxAmount = (afterDiscount * item.tax_rate) / 100
        const total = afterDiscount + taxAmount

        return {
          id: item.id,
          description: `${item.product_name}${item.description ? '\n' + item.description : ''}`,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          discount: item.discount_percent || 0,
          discountType: 'percent' as const,
          tax: item.tax_rate || 20,
          total: item.line_total || total
        }
      })

      // If no items, show error
      if (items.length === 0) {
        toast.error('Aucun article dans ce devis')
        return
      }

      // Calculate totals from the quotation data
      const quotationPdfData = {
        id: quotationData.id,
        number: quotationData.quotation_number,
        date: new Date(quotationData.created_at || quotationData.date),
        validUntil: new Date(quotationData.expiration_date || quotationData.validity_date),
        client,
        items,
        subtotal: parseFloat(quotationData.subtotal) || 0,
        totalDiscount: parseFloat(quotationData.discount_amount) || 0,
        shippingCost: parseFloat(quotationData.shipping_cost) || 0,
        installationCost: parseFloat(quotationData.installation_cost) || 0,
        totalTax: parseFloat(quotationData.tax_amount) || 0,
        total: parseFloat(quotationData.total_amount) || 0,
        notes: quotationData.notes || '',
        termsAndConditions: quotationData.terms_conditions || `Conditions générales de vente:
1. Devis valable ${quotationData.validity_days || 30} jours à compter de la date d'émission.
2. Paiement: ${quotationData.payment_terms || '30'} jours fin de mois.
3. Délai de livraison: ${quotationData.delivery_terms || '2-4 semaines'}.
4. Garantie: Tous nos meubles sont garantis 2 ans pièces et main d'œuvre.
5. Retours: Les produits sur mesure ne sont ni repris ni échangés.`,
        status: quotationData.status as any
      }

      // Generate PDF
      generateQuotationPDF(company, quotationPdfData, true)
      toast.success('PDF téléchargé avec succès')
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la génération du PDF')
      console.error('PDF generation error:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <FileText className="h-4 w-4" />
      case 'sent':
        return <Send className="h-4 w-4" />
      case 'accepted':
        return <Check className="h-4 w-4" />
      case 'rejected':
        return <X className="h-4 w-4" />
      case 'expired':
        return <Clock className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getStatusBadgeVariant = (status: string): any => {
    switch (status) {
      case 'draft':
        return 'secondary'
      case 'sent':
        return 'default'
      case 'accepted':
        return 'success'
      case 'rejected':
        return 'destructive'
      case 'expired':
        return 'warning'
      default:
        return 'outline'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Brouillon'
      case 'sent': return 'Envoyé'
      case 'accepted': return 'Accepté'
      case 'rejected': return 'Refusé'
      case 'expired': return 'Expiré'
      default: return status
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR')
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Devis</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Créez et gérez vos devis clients
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast.info('Export en cours...')}>
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
          <Button onClick={() => {
            setEditingQuotation(null)
            setShowBuilder(true)
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau devis
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devis</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalQuotations}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.draftCount} brouillon(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acceptés</CardTitle>
            <Check className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.acceptedQuotations}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.rejectedCount} refusé(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux conversion</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              30 derniers jours
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenu potentiel</CardTitle>
            <Euro className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.potentialRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Valeur moy: {formatCurrency(stats.averageValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Rechercher par numéro, client..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="sent">Envoyé</SelectItem>
                <SelectItem value="accepted">Accepté</SelectItem>
                <SelectItem value="rejected">Refusé</SelectItem>
                <SelectItem value="expired">Expiré</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les dates</SelectItem>
                <SelectItem value="today">Aujourd'hui</SelectItem>
                <SelectItem value="week">Cette semaine</SelectItem>
                <SelectItem value="month">Ce mois</SelectItem>
                <SelectItem value="quarter">Ce trimestre</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Date (récent)</SelectItem>
                <SelectItem value="date_asc">Date (ancien)</SelectItem>
                <SelectItem value="amount_desc">Montant (décroissant)</SelectItem>
                <SelectItem value="amount_asc">Montant (croissant)</SelectItem>
                <SelectItem value="client">Client (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quotations List */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des devis ({filteredQuotations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              Chargement des devis...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              Erreur lors du chargement des devis
            </div>
          ) : (
            <div className="space-y-4">
              {filteredQuotations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Aucun devis trouvé
                </div>
              ) : (
                filteredQuotations.map(quotation => (
                <div
                  key={quotation.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      {getStatusIcon(quotation.status)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{quotation.quotation_number}</h4>
                        <Badge variant={getStatusBadgeVariant(quotation.status)}>
                          {getStatusLabel(quotation.status)}
                        </Badge>
                        {quotation.version > 1 && (
                          <Badge variant="outline">v{quotation.version}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {quotation.contact_name || 'N/A'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(quotation.created_at || quotation.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {quotation.line_items_count || 0} article(s)
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-medium">
                          Total: {formatCurrency(quotation.total_amount || quotation.total_ttc || 0)}
                        </span>
                        {quotation.status === 'sent' && quotation.expiration_date && new Date(quotation.expiration_date) < new Date() && (
                          <span className="text-orange-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Expire bientôt
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleEditQuotation(quotation)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicateQuotation(quotation)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Dupliquer
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadPDF(quotation)}>
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger PDF
                      </DropdownMenuItem>
                      {quotation.status === 'draft' && (
                        <DropdownMenuItem onClick={() => handleSendQuotation(quotation)}>
                          <Send className="mr-2 h-4 w-4" />
                          Envoyer par email
                        </DropdownMenuItem>
                      )}
                      {quotation.status === 'sent' && (
                        <>
                          <DropdownMenuItem
                            onClick={() => updateStatusMutation.mutate({ id: quotation.id, status: 'accepted' })}
                            className="text-green-600"
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Accepter le devis
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateStatusMutation.mutate({ id: quotation.id, status: 'rejected' })}
                            className="text-orange-600"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Refuser le devis
                          </DropdownMenuItem>
                        </>
                      )}
                      {quotation.status === 'accepted' && !quotation.sales_order_id && (
                        <DropdownMenuItem onClick={() => handleConvertToOrder(quotation)}>
                          <Package className="mr-2 h-4 w-4" />
                          Convertir en commande
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteQuotation(quotation.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quotation Builder Dialog */}
      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuotation ? 'Modifier le devis' : 'Nouveau devis'}
            </DialogTitle>
          </DialogHeader>
          <EnhancedQuotationBuilder
            quotation={editingQuotation}
            onSave={handleSaveQuotation}
            onClose={() => {
              setShowBuilder(false)
              setEditingQuotation(null)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Convert to Order Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convertir en commande</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-900">
                <strong>Devis:</strong> {quotationToConvert?.quotation_number}
              </p>
              <p className="text-sm text-blue-900 mt-1">
                <strong>Client:</strong> {quotationToConvert?.contact_name}
              </p>
              <p className="text-sm text-blue-900 mt-1">
                <strong>Montant:</strong> {quotationToConvert && formatCurrency(parseFloat(quotationToConvert.total_amount || quotationToConvert.total_ttc || 0))}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected_delivery_date">Date de livraison prévue (optionnel)</Label>
              <Input
                id="expected_delivery_date"
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Si vous ne spécifiez pas de date, elle pourra être ajoutée plus tard.
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-900">
                ⚠️ Cette action va déduire automatiquement les produits du stock.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowConvertDialog(false)
                setQuotationToConvert(null)
                setExpectedDeliveryDate('')
              }}
            >
              Annuler
            </Button>
            <Button onClick={confirmConvertToOrder}>
              Convertir en commande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}