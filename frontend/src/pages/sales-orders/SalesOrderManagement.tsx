import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'react-hot-toast'
import { salesOrdersApi, invoicesApi, settingsApi } from '@/services/api'
import { generateSalesOrderPDF } from '@/services/pdfGenerator'
import type { SalesOrder, Company } from '@/services/pdfGenerator'
import {
  Package,
  Search,
  Filter,
  Calendar,
  Euro,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  FileText,
  TrendingUp,
  User,
  MoreHorizontal,
  PackageCheck,
  Ban,
  Download,
  Plus,
  Pencil,
  Trash2,
  CreditCard,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { DocumentsModal } from './DocumentsModal'

// Payment type definition
interface Payment {
  id: string;
  amount: number;
  method: 'especes' | 'carte' | 'virement' | 'cheque';
  date: string;
  notes?: string;
}

export function SalesOrderManagement() {
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [statusUpdateDialog, setStatusUpdateDialog] = useState<{
    open: boolean
    orderId: string | null
    newStatus: string | null
  }>({ open: false, orderId: null, newStatus: null })

  // Payment dialog state
  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    orderId: string | null;
    payment: Payment | null;
  }>({ open: false, mode: 'add', orderId: null, payment: null })
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'especes' as 'especes' | 'carte' | 'virement' | 'cheque',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  })

  // Documents modal state
  const [documentsModal, setDocumentsModal] = useState<{
    open: boolean;
    orderId: string | null;
    orderNumber: string | null;
  }>({ open: false, orderId: null, orderNumber: null })

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterStatus])

  // Fetch sales orders with pagination
  const { data: ordersData, isLoading, error } = useQuery({
    queryKey: ['sales-orders', { search: searchTerm, status: filterStatus === 'all' ? undefined : filterStatus, page: currentPage, limit: pageSize }],
    queryFn: () => salesOrdersApi.getAll({
      page: currentPage,
      limit: pageSize,
      search: searchTerm || undefined,
      status: filterStatus === 'all' ? undefined : filterStatus
    })
  })

  const orders = ordersData?.sales_orders || []
  const totalCount = ordersData?.pagination?.total || 0
  const totalPages = ordersData?.pagination?.totalPages || Math.ceil(totalCount / pageSize)

  // Fetch statistics
  const { data: statsData } = useQuery({
    queryKey: ['sales-order-stats'],
    queryFn: () => salesOrdersApi.getStats()
  })

  const stats = useMemo(() => {
    if (statsData) {
      return {
        totalOrders: parseInt(statsData.total_orders) || 0,
        inProgressCount: parseInt(statsData.in_progress_count) || 0,
        preparingCount: parseInt(statsData.preparing_count) || 0,
        shippedCount: parseInt(statsData.shipped_count) || 0,
        deliveredCount: parseInt(statsData.delivered_count) || 0,
        completedCount: parseInt(statsData.completed_count) || 0,
        cancelledCount: parseInt(statsData.cancelled_count) || 0,
        activeRevenue: parseFloat(statsData.active_revenue) || 0,
        realizedRevenue: parseFloat(statsData.realized_revenue) || 0,
        completedRevenue: parseFloat(statsData.completed_revenue) || 0,
        averageOrderValue: parseFloat(statsData.average_order_value) || 0
      }
    }
    return {
      totalOrders: 0,
      inProgressCount: 0,
      preparingCount: 0,
      shippedCount: 0,
      deliveredCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      activeRevenue: 0,
      realizedRevenue: 0,
      completedRevenue: 0,
      averageOrderValue: 0
    }
  }, [statsData])

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => salesOrdersApi.updateStatus(id, data),
    onSuccess: async (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['sales-order-stats'] })

      const messages: Record<string, string> = {
        'en_preparation': 'Commande mise en préparation',
        'expedie': 'Commande expédiée',
        'livre': 'Commande livrée',
        'termine': 'Commande terminée',
        'annule': 'Commande annulée'
      }
      toast.success(messages[variables.data.status] || 'Statut mis à jour')
      setStatusUpdateDialog({ open: false, orderId: null, newStatus: null })

      // Automatically create invoice when order is finished
      if (variables.data.status === 'termine' && response && !response.invoice_id) {
        try {
          const invoiceResponse = await invoicesApi.create({ sales_order_id: variables.id })
          queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
          queryClient.invalidateQueries({ queryKey: ['invoices'] })
          toast.success(`Facture ${invoiceResponse.invoice_number} créée automatiquement`)
        } catch (error: any) {
          console.error('Error auto-creating invoice:', error)
          toast.error('Note: Erreur lors de la création automatique de la facture')
        }
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour du statut')
    }
  })

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: salesOrdersApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['sales-order-stats'] })
      toast.success('Commande annulée - Stock restauré')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'annulation')
    }
  })

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: (salesOrderId: string) => invoicesApi.create({ sales_order_id: salesOrderId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success(`Facture ${data.invoice_number} créée avec succès`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création de la facture')
    }
  })

  // Payment mutations
  const addPaymentMutation = useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: any }) =>
      salesOrdersApi.addPayment(orderId, data),
    onSuccess: async (response) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['sales-order-stats'] })
      toast.success('Paiement ajouté avec succès')
      setPaymentDialog({ open: false, mode: 'add', orderId: null, payment: null })
      // Refresh selected order
      if (selectedOrder) {
        const updated = await salesOrdersApi.getById(selectedOrder.id)
        setSelectedOrder(updated)
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'ajout du paiement')
    }
  })

  const updatePaymentMutation = useMutation({
    mutationFn: ({ orderId, paymentId, data }: { orderId: string; paymentId: string; data: any }) =>
      salesOrdersApi.updatePayment(orderId, paymentId, data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['sales-order-stats'] })
      toast.success('Paiement mis à jour')
      setPaymentDialog({ open: false, mode: 'add', orderId: null, payment: null })
      // Refresh selected order
      if (selectedOrder) {
        const updated = await salesOrdersApi.getById(selectedOrder.id)
        setSelectedOrder(updated)
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour du paiement')
    }
  })

  const deletePaymentMutation = useMutation({
    mutationFn: ({ orderId, paymentId }: { orderId: string; paymentId: string }) =>
      salesOrdersApi.deletePayment(orderId, paymentId),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['sales-order-stats'] })
      toast.success('Paiement supprimé')
      // Refresh selected order
      if (selectedOrder) {
        const updated = await salesOrdersApi.getById(selectedOrder.id)
        setSelectedOrder(updated)
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression du paiement')
    }
  })

  const handleViewDetails = async (order: any) => {
    try {
      const fullOrder = await salesOrdersApi.getById(order.id)
      setSelectedOrder(fullOrder)
      setShowDetailDialog(true)
    } catch (error) {
      toast.error('Erreur lors du chargement des détails')
    }
  }

  const handleUpdateStatus = (orderId: string, newStatus: string) => {
    setStatusUpdateDialog({ open: true, orderId, newStatus })
  }

  const confirmStatusUpdate = () => {
    if (statusUpdateDialog.orderId && statusUpdateDialog.newStatus) {
      const data: any = { status: statusUpdateDialog.newStatus }

      // Add additional fields based on status
      if (statusUpdateDialog.newStatus === 'expedie') {
        data.shipped_date = new Date().toISOString().split('T')[0]
      } else if (statusUpdateDialog.newStatus === 'livre') {
        data.delivered_date = new Date().toISOString().split('T')[0]
      }

      updateStatusMutation.mutate({ id: statusUpdateDialog.orderId, data })
    }
  }

  const handleCancelOrder = (orderId: string) => {
    if (confirm('Êtes-vous sûr de vouloir annuler cette commande ?\n\nLe stock sera automatiquement restauré.')) {
      cancelOrderMutation.mutate(orderId)
    }
  }

  const handleCreateInvoice = (order: any) => {
    if (order.invoice_id) {
      toast.error('Une facture existe déjà pour cette commande')
      return
    }

    if (confirm(`Créer une facture pour la commande ${order.order_number} ?`)) {
      createInvoiceMutation.mutate(order.id)
    }
  }

  // Payment handlers
  const openAddPaymentDialog = (orderId: string) => {
    setPaymentForm({
      amount: '',
      method: 'especes',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    })
    setPaymentDialog({ open: true, mode: 'add', orderId, payment: null })
  }

  const openEditPaymentDialog = (orderId: string, payment: Payment) => {
    setPaymentForm({
      amount: String(payment.amount),
      method: payment.method,
      date: payment.date?.split('T')[0] || new Date().toISOString().split('T')[0],
      notes: payment.notes || ''
    })
    setPaymentDialog({ open: true, mode: 'edit', orderId, payment })
  }

  const handlePaymentSubmit = () => {
    if (!paymentDialog.orderId || !paymentForm.amount) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }

    const data = {
      amount: parseFloat(paymentForm.amount),
      method: paymentForm.method,
      date: paymentForm.date,
      notes: paymentForm.notes || undefined
    }

    if (paymentDialog.mode === 'add') {
      addPaymentMutation.mutate({ orderId: paymentDialog.orderId, data })
    } else if (paymentDialog.payment) {
      updatePaymentMutation.mutate({
        orderId: paymentDialog.orderId,
        paymentId: paymentDialog.payment.id,
        data
      })
    }
  }

  const handleDeletePayment = (orderId: string, paymentId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) {
      deletePaymentMutation.mutate({ orderId, paymentId })
    }
  }

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'especes': return 'Espèces'
      case 'carte': return 'Carte bancaire'
      case 'virement': return 'Virement'
      case 'cheque': return 'Chèque'
      default: return method
    }
  }

  // Calculate total payments for an order
  const calculateTotalPayments = (payments: Payment[] | undefined): number => {
    if (!payments || !Array.isArray(payments)) return 0
    return payments.reduce((sum, p) => sum + parseFloat(String(p.amount)), 0)
  }

  const handleDownloadPDF = async (order: any) => {
    try {
      // Fetch company settings
      const companyData = await settingsApi.getCompany()

      // Fetch full order details if needed
      const fullOrder = selectedOrder?.id === order.id ? selectedOrder : await salesOrdersApi.getById(order.id)

      // Transform data to match PDF generator format
      const company: Company = {
        name: companyData.company?.name || 'Votre Entreprise',
        address: companyData.company?.address || '',
        city: companyData.company?.city || '',
        postalCode: companyData.company?.postal_code || '',
        country: companyData.company?.country || 'France',
        phone: companyData.company?.phone || '',
        email: companyData.company?.email || '',
        siret: companyData.company?.siret || undefined,
        tva: companyData.company?.tva || undefined,
      }

      const salesOrder: SalesOrder = {
        id: fullOrder.id,
        orderNumber: fullOrder.order_number,
        orderDate: new Date(fullOrder.order_date),
        expectedDeliveryDate: fullOrder.expected_delivery_date ? new Date(fullOrder.expected_delivery_date) : undefined,
        quotationNumber: fullOrder.quotation_number || undefined,
        client: {
          name: fullOrder.contact_name,
          company: fullOrder.company_name || undefined,
          address: fullOrder.contact_address || '',
          city: fullOrder.contact_city || '',
          postalCode: fullOrder.contact_postal_code || '',
          country: fullOrder.contact_country || 'France',
          phone: fullOrder.contact_phone || undefined,
          email: fullOrder.contact_email || undefined,
        },
        items: (fullOrder.items || []).map((item: any) => {
          // Build description with custom components if present
          let description = item.product_name

          // Add custom components details if this is a customized product
          if (item.is_customized && item.custom_components && item.custom_components.length > 0) {
            description += '\nPersonnalisation:'
            item.custom_components.forEach((comp: any) => {
              description += `\n  • ${comp.component_name}`
              if (comp.quantity) description += `\n    Quantité: ${comp.quantity}`
              if (comp.material_name) description += `\n    Matériau: ${comp.material_name}`
              if (comp.finish_name) description += `\n    Finition: ${comp.finish_name}`
              if (comp.notes) description += `\n    Note: ${comp.notes}`
            })
          }

          // Add user description if present
          if (item.description && item.description.trim()) {
            description += '\n' + item.description
          }

          return {
            id: item.id,
            description,
            quantity: parseFloat(item.quantity),
            unitPrice: parseFloat(item.unit_price),
            discount: parseFloat(item.discount_percent) || 0,
            discountType: 'percent' as const,
            tax: parseFloat(item.tax_rate) || 20,
            total: parseFloat(item.line_total),
          }
        }),
        subtotal: parseFloat(fullOrder.subtotal),
        totalDiscount: parseFloat(fullOrder.discount_amount) || 0,
        shippingCost: parseFloat(fullOrder.shipping_cost) || 0,
        installationCost: parseFloat(fullOrder.installation_cost) || 0,
        totalTax: parseFloat(fullOrder.tax_amount) || 0,
        total: parseFloat(fullOrder.total_amount),
        // Multiple payments support
        payments: fullOrder.payments || [],
        // Legacy single payment fields (for backwards compatibility)
        downPaymentAmount: fullOrder.down_payment_amount ? parseFloat(fullOrder.down_payment_amount) : undefined,
        downPaymentMethod: fullOrder.down_payment_method || undefined,
        downPaymentDate: fullOrder.down_payment_date ? new Date(fullOrder.down_payment_date) : undefined,
        downPaymentNotes: fullOrder.down_payment_notes || undefined,
        notes: fullOrder.notes || undefined,
        termsAndConditions: fullOrder.terms_conditions || undefined,
        deliveryAddress: fullOrder.delivery_address || undefined,
        status: fullOrder.status,
      }

      generateSalesOrderPDF(company, salesOrder)
      toast.success('PDF téléchargé avec succès')
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Erreur lors de la génération du PDF')
    }
  }

  const handleDownloadPDFNoPrices = async (order: any) => {
    try {
      // Fetch company settings
      const companyData = await settingsApi.getCompany()

      // Fetch full order details if needed
      const fullOrder = selectedOrder?.id === order.id ? selectedOrder : await salesOrdersApi.getById(order.id)

      // Transform data to match PDF generator format (same as handleDownloadPDF)
      const company: Company = {
        name: companyData.company?.name || 'Votre Entreprise',
        address: companyData.company?.address || '',
        city: companyData.company?.city || '',
        postalCode: companyData.company?.postal_code || '',
        country: companyData.company?.country || 'France',
        phone: companyData.company?.phone || '',
        email: companyData.company?.email || '',
        siret: companyData.company?.siret || undefined,
        tva: companyData.company?.tva || undefined,
      }

      const salesOrder: SalesOrder = {
        id: fullOrder.id,
        orderNumber: fullOrder.order_number,
        orderDate: new Date(fullOrder.order_date),
        expectedDeliveryDate: fullOrder.expected_delivery_date ? new Date(fullOrder.expected_delivery_date) : undefined,
        quotationNumber: fullOrder.quotation_number || undefined,
        client: {
          name: fullOrder.contact_name,
          company: fullOrder.company_name || undefined,
          address: fullOrder.contact_address || '',
          city: fullOrder.contact_city || '',
          postalCode: fullOrder.contact_postal_code || '',
          country: fullOrder.contact_country || 'France',
          phone: fullOrder.contact_phone || undefined,
          email: fullOrder.contact_email || undefined,
        },
        items: (fullOrder.items || []).map((item: any) => {
          // Build description with custom components if present
          let description = item.product_name

          // Add custom components details if this is a customized product
          if (item.is_customized && item.custom_components && item.custom_components.length > 0) {
            description += '\nPersonnalisation:'
            item.custom_components.forEach((comp: any) => {
              description += `\n  • ${comp.component_name}`
              if (comp.quantity) description += `\n    Quantité: ${comp.quantity}`
              if (comp.material_name) description += `\n    Matériau: ${comp.material_name}`
              if (comp.finish_name) description += `\n    Finition: ${comp.finish_name}`
              if (comp.notes) description += `\n    Note: ${comp.notes}`
            })
          }

          // Add user description if present
          if (item.description && item.description.trim()) {
            description += '\n' + item.description
          }

          return {
            id: item.id,
            description,
            quantity: parseFloat(item.quantity),
            unitPrice: parseFloat(item.unit_price),
            discount: parseFloat(item.discount_percent) || 0,
            discountType: 'percent' as const,
            tax: parseFloat(item.tax_rate) || 20,
            total: parseFloat(item.line_total),
          }
        }),
        subtotal: parseFloat(fullOrder.subtotal),
        totalDiscount: parseFloat(fullOrder.discount_amount) || 0,
        shippingCost: parseFloat(fullOrder.shipping_cost) || 0,
        installationCost: parseFloat(fullOrder.installation_cost) || 0,
        totalTax: parseFloat(fullOrder.tax_amount) || 0,
        total: parseFloat(fullOrder.total_amount),
        // Multiple payments support
        payments: fullOrder.payments || [],
        // Legacy single payment fields (for backwards compatibility)
        downPaymentAmount: fullOrder.down_payment_amount ? parseFloat(fullOrder.down_payment_amount) : undefined,
        downPaymentMethod: fullOrder.down_payment_method || undefined,
        downPaymentDate: fullOrder.down_payment_date ? new Date(fullOrder.down_payment_date) : undefined,
        downPaymentNotes: fullOrder.down_payment_notes || undefined,
        notes: fullOrder.notes || undefined,
        termsAndConditions: fullOrder.terms_conditions || undefined,
        deliveryAddress: fullOrder.delivery_address || undefined,
        status: fullOrder.status,
      }

      // Generate PDF without prices (showPrices = false)
      generateSalesOrderPDF(company, salesOrder, true, undefined, false)
      toast.success('PDF sans prix téléchargé avec succès')
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Erreur lors de la génération du PDF')
    }
  }

  const getStatusBadgeVariant = (status: string): any => {
    switch (status) {
      case 'en_cours':
        return 'default'
      case 'en_preparation':
        return 'secondary'
      case 'expedie':
        return { className: 'bg-blue-100 text-blue-800 border-blue-300' }
      case 'livre':
        return { className: 'bg-green-100 text-green-800 border-green-300' }
      case 'termine':
        return 'success'
      case 'annule':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'en_cours': return 'En cours'
      case 'en_preparation': return 'En préparation'
      case 'expedie': return 'Expédié'
      case 'livre': return 'Livré'
      case 'termine': return 'Terminé'
      case 'annule': return 'Annulé'
      default: return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'en_cours': return <Clock className="h-4 w-4" />
      case 'en_preparation': return <Package className="h-4 w-4" />
      case 'expedie': return <Truck className="h-4 w-4" />
      case 'livre': return <PackageCheck className="h-4 w-4" />
      case 'termine': return <CheckCircle className="h-4 w-4" />
      case 'annule': return <XCircle className="h-4 w-4" />
      default: return <AlertCircle className="h-4 w-4" />
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
          <h2 className="text-3xl font-bold tracking-tight">Commandes</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Gérez vos commandes clients
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commandes</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.inProgressCount} en cours
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En préparation</CardTitle>
            <Package className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.preparingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.shippedCount} expédié(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Terminées</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.cancelledCount} annulée(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA Actif</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.activeRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              En cours de traitement
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA Réalisé</CardTitle>
            <Euro className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.realizedRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Factures payées
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher par numéro, client..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="en_cours">En cours</SelectItem>
                <SelectItem value="en_preparation">En préparation</SelectItem>
                <SelectItem value="expedie">Expédié</SelectItem>
                <SelectItem value="livre">Livré</SelectItem>
                <SelectItem value="termine">Terminé</SelectItem>
                <SelectItem value="annule">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des commandes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Chargement...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">Erreur lors du chargement</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucune commande trouvée
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order: any) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    <div>
                      <div className="font-semibold text-lg">{order.order_number}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Devis: {order.quotation_number || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4" />
                        {order.contact_name}
                      </div>
                      {order.company_name && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {order.company_name}
                        </div>
                      )}
                    </div>
                    <div>
                      <Badge variant={getStatusBadgeVariant(order.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(order.status)}
                          {getStatusLabel(order.status)}
                        </span>
                      </Badge>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-4 w-4" />
                        {formatDate(order.order_date)}
                      </div>
                      {order.expected_delivery_date && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Livraison: {formatDate(order.expected_delivery_date)}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">
                        {formatCurrency(parseFloat(order.total_amount))}
                      </div>
                      {order.invoice_number && (
                        <div className="text-xs text-blue-600">
                          Facture: {order.invoice_number}
                        </div>
                      )}
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
                      <DropdownMenuItem onClick={() => handleViewDetails(order)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Voir détails
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadPDF(order)}>
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadPDFNoPrices(order)}>
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger PDF sans prix
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDocumentsModal({ open: true, orderId: order.id, orderNumber: order.order_number })}>
                        <FolderOpen className="mr-2 h-4 w-4" />
                        Voir documents
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {order.status === 'en_cours' && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'en_preparation')}>
                          <Package className="mr-2 h-4 w-4" />
                          Mettre en préparation
                        </DropdownMenuItem>
                      )}
                      {order.status === 'en_preparation' && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'expedie')}>
                          <Truck className="mr-2 h-4 w-4" />
                          Marquer comme expédié
                        </DropdownMenuItem>
                      )}
                      {order.status === 'expedie' && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'livre')}>
                          <PackageCheck className="mr-2 h-4 w-4" />
                          Marquer comme livré
                        </DropdownMenuItem>
                      )}
                      {order.status === 'livre' && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'termine')}>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Terminer la commande
                        </DropdownMenuItem>
                      )}
                      {order.status !== 'annule' && !order.invoice_id && (
                        <DropdownMenuItem
                          onClick={() => handleCreateInvoice(order)}
                          className="text-blue-600"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Créer facture
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {order.status !== 'annule' && order.status !== 'termine' && (
                        <DropdownMenuItem
                          onClick={() => handleCancelOrder(order.id)}
                          className="text-red-600"
                        >
                          <Ban className="mr-2 h-4 w-4" />
                          Annuler la commande
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <div className="text-sm text-gray-500">
                    Affichage {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} sur {totalCount} commandes
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm px-3">
                      Page {currentPage} sur {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Update Confirmation Dialog */}
      <Dialog open={statusUpdateDialog.open} onOpenChange={(open) => !open && setStatusUpdateDialog({ open: false, orderId: null, newStatus: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer le changement de statut</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir changer le statut de cette commande ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusUpdateDialog({ open: false, orderId: null, newStatus: null })}
            >
              Annuler
            </Button>
            <Button onClick={confirmStatusUpdate}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails de la commande {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Informations client</h4>
                  <div className="text-sm space-y-1">
                    <p><strong>Nom:</strong> {selectedOrder.contact_name}</p>
                    {selectedOrder.company_name && <p><strong>Société:</strong> {selectedOrder.company_name}</p>}
                    <p><strong>Email:</strong> {selectedOrder.contact_email}</p>
                    <p><strong>Téléphone:</strong> {selectedOrder.contact_phone}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Informations commande</h4>
                  <div className="text-sm space-y-1">
                    <p><strong>Date:</strong> {formatDate(selectedOrder.order_date)}</p>
                    <p><strong>Statut:</strong> {getStatusLabel(selectedOrder.status)}</p>
                    {selectedOrder.expected_delivery_date && (
                      <p><strong>Livraison prévue:</strong> {formatDate(selectedOrder.expected_delivery_date)}</p>
                    )}
                    {selectedOrder.shipped_date && (
                      <p><strong>Expédié le:</strong> {formatDate(selectedOrder.shipped_date)}</p>
                    )}
                    {selectedOrder.delivered_date && (
                      <p><strong>Livré le:</strong> {formatDate(selectedOrder.delivered_date)}</p>
                    )}
                    {selectedOrder.created_by && (
                      <p className="pt-2 border-t"><strong>Créé par:</strong> <span className="text-blue-600">{selectedOrder.created_by}</span></p>
                    )}
                  </div>
                </div>
              </div>

              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Articles</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="text-left p-2">Produit</th>
                          <th className="text-right p-2">Qté</th>
                          <th className="text-right p-2">Prix unit.</th>
                          <th className="text-right p-2">Total HT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items.map((item: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">
                              <div>{item.product_name}</div>
                              {item.product_sku && (
                                <div className="text-xs text-gray-500">SKU: {item.product_sku}</div>
                              )}
                              {item.is_customized && item.custom_components && item.custom_components.length > 0 && (
                                <div className="mt-2 text-xs">
                                  <div className="font-semibold text-blue-600">Personnalisation:</div>
                                  {item.custom_components.map((comp: any, compIdx: number) => (
                                    <div key={compIdx} className="ml-2 mt-1 text-gray-600 dark:text-gray-400">
                                      <div className="font-medium">• {comp.component_name}</div>
                                      {comp.quantity && <div className="ml-4">Quantité: {comp.quantity}</div>}
                                      {comp.material_name && <div className="ml-4">Matériau: {comp.material_name}</div>}
                                      {comp.finish_name && <div className="ml-4">Finition: {comp.finish_name}</div>}
                                      {comp.notes && <div className="ml-4 italic">Note: {comp.notes}</div>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="text-right p-2">{item.quantity}</td>
                            <td className="text-right p-2">{formatCurrency(parseFloat(item.unit_price))}</td>
                            <td className="text-right p-2">{formatCurrency(parseFloat(item.line_total))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 dark:bg-gray-800 font-semibold">
                        <tr>
                          <td colSpan={3} className="text-right p-2">Total HT:</td>
                          <td className="text-right p-2">{formatCurrency(parseFloat(selectedOrder.subtotal))}</td>
                        </tr>
                        {parseFloat(selectedOrder.tax_amount) > 0 && (
                          <tr>
                            <td colSpan={3} className="text-right p-2">TVA:</td>
                            <td className="text-right p-2">{formatCurrency(parseFloat(selectedOrder.tax_amount))}</td>
                          </tr>
                        )}
                        <tr>
                          <td colSpan={3} className="text-right p-2">Total TTC:</td>
                          <td className="text-right p-2">{formatCurrency(parseFloat(selectedOrder.total_amount))}</td>
                        </tr>
                        {calculateTotalPayments(selectedOrder.payments) > 0 && (
                          <>
                            <tr className="bg-green-50">
                              <td colSpan={3} className="text-right p-2 text-green-700">Paiements reçus:</td>
                              <td className="text-right p-2 text-green-700">-{formatCurrency(calculateTotalPayments(selectedOrder.payments))}</td>
                            </tr>
                            <tr className="font-bold bg-gray-100">
                              <td colSpan={3} className="text-right p-2">Solde restant:</td>
                              <td className="text-right p-2">{formatCurrency(parseFloat(selectedOrder.total_amount) - calculateTotalPayments(selectedOrder.payments))}</td>
                            </tr>
                          </>
                        )}
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Payments Section */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-green-900 flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Paiements / Acomptes
                  </h4>
                  {selectedOrder.status !== 'annule' && selectedOrder.status !== 'termine' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAddPaymentDialog(selectedOrder.id)}
                      className="text-green-700 border-green-300 hover:bg-green-100"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  )}
                </div>

                {selectedOrder.payments && selectedOrder.payments.length > 0 ? (
                  <div className="space-y-2">
                    {selectedOrder.payments.map((payment: Payment, idx: number) => (
                      <div key={payment.id || idx} className="flex justify-between items-center bg-white rounded-lg p-3 border border-green-200">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-green-800">
                              {formatCurrency(parseFloat(String(payment.amount)))}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {getPaymentMethodLabel(payment.method)}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {payment.date && formatDate(payment.date)}
                            {payment.notes && ` - ${payment.notes}`}
                          </div>
                        </div>
                        {selectedOrder.status !== 'annule' && selectedOrder.status !== 'termine' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditPaymentDialog(selectedOrder.id, payment)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeletePayment(selectedOrder.id, payment.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Total payments summary */}
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-800 font-medium">Total payé:</span>
                        <span className="font-bold text-green-900">
                          {formatCurrency(calculateTotalPayments(selectedOrder.payments))}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-green-800 font-medium">Solde restant:</span>
                        <span className="font-bold text-green-900">
                          {formatCurrency(parseFloat(selectedOrder.total_amount) - calculateTotalPayments(selectedOrder.payments))}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <p>Aucun paiement enregistré</p>
                    <p className="text-sm mt-1">Solde total: {formatCurrency(parseFloat(selectedOrder.total_amount))}</p>
                  </div>
                )}
              </div>

              {selectedOrder.notes && (
                <div>
                  <h4 className="font-semibold mb-2">Notes</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedOrder.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog
        open={paymentDialog.open}
        onOpenChange={(open) => !open && setPaymentDialog({ open: false, mode: 'add', orderId: null, payment: null })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {paymentDialog.mode === 'add' ? 'Ajouter un paiement' : 'Modifier le paiement'}
            </DialogTitle>
            <DialogDescription>
              {paymentDialog.mode === 'add'
                ? 'Enregistrez un nouveau paiement ou acompte pour cette commande.'
                : 'Modifiez les détails du paiement.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Montant *</Label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-method">Mode de paiement *</Label>
              <Select
                value={paymentForm.method}
                onValueChange={(value: any) => setPaymentForm(prev => ({ ...prev, method: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="especes">Espèces</SelectItem>
                  <SelectItem value="carte">Carte bancaire</SelectItem>
                  <SelectItem value="virement">Virement</SelectItem>
                  <SelectItem value="cheque">Chèque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-date">Date du paiement</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentForm.date}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notes (optionnel)</Label>
              <Input
                id="payment-notes"
                placeholder="Référence, commentaire..."
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentDialog({ open: false, mode: 'add', orderId: null, payment: null })}
            >
              Annuler
            </Button>
            <Button
              onClick={handlePaymentSubmit}
              disabled={addPaymentMutation.isPending || updatePaymentMutation.isPending}
            >
              {addPaymentMutation.isPending || updatePaymentMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Documents Modal */}
      {documentsModal.open && documentsModal.orderId && documentsModal.orderNumber && (
        <DocumentsModal
          orderId={documentsModal.orderId}
          orderNumber={documentsModal.orderNumber}
          onClose={() => setDocumentsModal({ open: false, orderId: null, orderNumber: null })}
        />
      )}
    </div>
  )
}
