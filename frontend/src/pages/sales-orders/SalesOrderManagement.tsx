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
  Download
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

export function SalesOrderManagement() {
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [statusUpdateDialog, setStatusUpdateDialog] = useState<{
    open: boolean
    orderId: string | null
    newStatus: string | null
  }>({ open: false, orderId: null, newStatus: null })

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Fetch sales orders
  const { data: ordersData, isLoading, error } = useQuery({
    queryKey: ['sales-orders', { search: searchTerm, status: filterStatus === 'all' ? undefined : filterStatus }],
    queryFn: () => salesOrdersApi.getAll({
      search: searchTerm || undefined,
      status: filterStatus === 'all' ? undefined : filterStatus
    })
  })

  const orders = ordersData?.sales_orders || []

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
        items: (fullOrder.items || []).map((item: any) => ({
          id: item.id,
          description: item.product_name + (item.description ? `\n${item.description}` : ''),
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unit_price),
          discount: parseFloat(item.discount_percent) || 0,
          discountType: 'percent' as const,
          tax: parseFloat(item.tax_rate) || 20,
          total: parseFloat(item.line_total),
        })),
        subtotal: parseFloat(fullOrder.subtotal),
        totalDiscount: parseFloat(fullOrder.discount_amount) || 0,
        shippingCost: parseFloat(fullOrder.shipping_cost) || 0,
        installationCost: parseFloat(fullOrder.installation_cost) || 0,
        totalTax: parseFloat(fullOrder.tax_amount) || 0,
        total: parseFloat(fullOrder.total_amount),
        notes: fullOrder.notes || undefined,
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
            <div className="text-2xl font-bold">{formatCurrency(stats.completedRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Commandes terminées
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
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

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
    </div>
  )
}
