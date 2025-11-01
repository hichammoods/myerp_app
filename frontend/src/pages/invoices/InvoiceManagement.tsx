import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'react-hot-toast'
import { invoicesApi, settingsApi } from '@/services/api'
import { generateInvoicePDF, formatPaymentTerms } from '@/services/pdfGenerator'
import type { Invoice, Company } from '@/services/pdfGenerator'
import {
  FileText,
  Search,
  Filter,
  Calendar,
  Euro,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  DollarSign,
  User,
  MoreHorizontal,
  Send,
  CreditCard,
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

export function InvoiceManagement() {
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [paymentData, setPaymentData] = useState({
    amount_paid: '',
    payment_method: 'virement' as 'virement' | 'cheque' | 'carte' | 'especes',
  })

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices', { search: searchTerm, status: filterStatus === 'all' ? undefined : filterStatus }],
    queryFn: () => invoicesApi.getAll({
      search: searchTerm || undefined,
      status: filterStatus === 'all' ? undefined : filterStatus
    })
  })

  const invoices = invoicesData?.invoices || []

  const { data: statsData } = useQuery({
    queryKey: ['invoice-stats'],
    queryFn: () => invoicesApi.getStats()
  })

  const stats = useMemo(() => {
    if (statsData) {
      return {
        totalInvoices: parseInt(statsData.total_invoices) || 0,
        paidCount: parseInt(statsData.paid_count) || 0,
        sentCount: parseInt(statsData.sent_count) || 0,
        overdueCount: parseInt(statsData.overdue_count) || 0,
        paidRevenue: parseFloat(statsData.paid_revenue) || 0,
        outstandingAmount: parseFloat(statsData.outstanding_amount) || 0,
      }
    }
    return { totalInvoices: 0, paidCount: 0, sentCount: 0, overdueCount: 0, paidRevenue: 0, outstandingAmount: 0 }
  }, [statsData])

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => invoicesApi.updateStatus(id, status as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] })
      toast.success('Statut mis à jour')
    },
    onError: () => toast.error('Erreur lors de la mise à jour')
  })

  const recordPaymentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => invoicesApi.recordPayment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] })
      toast.success('Paiement enregistré')
      setShowPaymentDialog(false)
      setPaymentData({ amount_paid: '', payment_method: 'virement' })
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement')
  })

  const handleRecordPayment = async (invoice: any) => {
    try {
      // Fetch full invoice details to get down payment info
      const fullInvoice = await invoicesApi.getById(invoice.id)
      setSelectedInvoice(fullInvoice)

      // Calculate remaining balance (total - down payment already made)
      const downPayment = parseFloat(fullInvoice.down_payment_amount || 0)
      const totalAmount = parseFloat(fullInvoice.total_amount || 0)
      const remainingBalance = totalAmount - downPayment

      setPaymentData({
        ...paymentData,
        amount_paid: remainingBalance.toString()
      })
      setShowPaymentDialog(true)
    } catch (error) {
      toast.error('Erreur lors du chargement des détails')
    }
  }

  const handleViewDetails = async (invoice: any) => {
    try {
      const fullInvoice = await invoicesApi.getById(invoice.id)
      setSelectedInvoice(fullInvoice)
      setShowDetailDialog(true)
    } catch (error) {
      toast.error('Erreur lors du chargement des détails')
    }
  }

  const submitPayment = () => {
    if (!selectedInvoice) return
    const amount = parseFloat(paymentData.amount_paid)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Montant invalide')
      return
    }
    recordPaymentMutation.mutate({
      id: selectedInvoice.id,
      data: { amount_paid: amount, payment_method: paymentData.payment_method }
    })
  }

  const handleDownloadPDF = async (invoice: any) => {
    try {
      const companyData = await settingsApi.getCompany()
      const fullInvoice = await invoicesApi.getById(invoice.id)

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

      const invoiceData: Invoice = {
        id: fullInvoice.id,
        invoiceNumber: fullInvoice.invoice_number,
        invoiceDate: new Date(fullInvoice.invoice_date),
        dueDate: fullInvoice.due_date ? new Date(fullInvoice.due_date) : undefined,
        quotationNumber: fullInvoice.quotation_number || undefined,
        orderNumber: fullInvoice.order_number || undefined,
        client: {
          name: fullInvoice.contact_name || 'Client',
          address: fullInvoice.contact_address || '',
          city: fullInvoice.contact_city || '',
          postalCode: fullInvoice.contact_postal_code || '',
          country: fullInvoice.contact_country || 'France',
          email: fullInvoice.contact_email || '',
          phone: fullInvoice.contact_phone || '',
        },
        items: (fullInvoice.items || []).map((item: any) => ({
          id: item.id,
          description: item.product_name + (item.description ? '\n' + item.description : ''),
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unit_price),
          discount: parseFloat(item.discount_percent || 0),
          discountType: 'percent' as const,
          tax: parseFloat(item.tax_rate || 0),
          total: parseFloat(item.line_total),
        })),
        subtotal: parseFloat(fullInvoice.subtotal || 0),
        totalDiscount: parseFloat(fullInvoice.discount_amount || 0),
        shippingCost: fullInvoice.shipping_cost ? parseFloat(fullInvoice.shipping_cost) : undefined,
        installationCost: fullInvoice.installation_cost ? parseFloat(fullInvoice.installation_cost) : undefined,
        totalTax: parseFloat(fullInvoice.tax_amount || 0),
        total: parseFloat(fullInvoice.total_amount || 0),
        downPaymentAmount: fullInvoice.down_payment_amount ? parseFloat(fullInvoice.down_payment_amount) : undefined,
        downPaymentMethod: fullInvoice.down_payment_method || undefined,
        downPaymentDate: fullInvoice.down_payment_date ? new Date(fullInvoice.down_payment_date) : undefined,
        downPaymentNotes: fullInvoice.down_payment_notes || undefined,
        amountPaid: fullInvoice.amount_paid ? parseFloat(fullInvoice.amount_paid) : undefined,
        amountDue: fullInvoice.amount_due ? parseFloat(fullInvoice.amount_due) : undefined,
        notes: fullInvoice.notes || undefined,
        termsAndConditions: fullInvoice.terms_conditions || undefined,
        paymentTerms: fullInvoice.payment_terms || undefined,
        status: fullInvoice.status,
      }

      generateInvoicePDF(company, invoiceData)
      toast.success('PDF téléchargé avec succès')
    } catch (error) {
      console.error('PDF generation error:', error)
      toast.error('Erreur lors de la génération du PDF')
    }
  }

  const getStatusBadgeVariant = (status: string): any => {
    const variants: Record<string, any> = {
      'brouillon': 'secondary',
      'envoyee': 'default',
      'payee': 'success',
      'en_retard': 'destructive',
      'annulee': { className: 'bg-gray-100 text-gray-800 border-gray-300' }
    }
    return variants[status] || 'outline'
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Factures</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Gérez vos factures clients</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalInvoices}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.paidCount} payées</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sentCount}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.overdueCount} en retard</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA Encaissé</CardTitle>
            <Euro className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.paidRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.outstandingAmount)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="brouillon">Brouillon</SelectItem>
                <SelectItem value="envoyee">Envoyée</SelectItem>
                <SelectItem value="payee">Payée</SelectItem>
                <SelectItem value="en_retard">En retard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste des factures</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Chargement...</div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Aucune facture</div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice: any) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1 grid grid-cols-5 gap-4">
                    <div>
                      <div className="font-semibold">{invoice.invoice_number}</div>
                      <div className="text-sm text-gray-600">{invoice.order_number || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4" />
                        {invoice.contact_name}
                      </div>
                    </div>
                    <div>
                      <Badge variant={getStatusBadgeVariant(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-4 w-4" />
                      {formatDate(invoice.invoice_date)}
                    </div>
                    <div className="text-right font-bold">
                      {formatCurrency(parseFloat(invoice.total_amount))}
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
                      <DropdownMenuItem onClick={() => handleViewDetails(invoice)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Voir détails
                      </DropdownMenuItem>
                      {invoice.status === 'brouillon' && (
                        <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: 'envoyee' })}>
                          <Send className="mr-2 h-4 w-4" />
                          Envoyer
                        </DropdownMenuItem>
                      )}
                      {(invoice.status === 'envoyee' || invoice.status === 'en_retard') && (
                        <DropdownMenuItem onClick={() => handleRecordPayment(invoice)} className="text-green-600">
                          <CreditCard className="mr-2 h-4 w-4" />
                          Enregistrer paiement
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDownloadPDF(invoice)}>
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer un paiement</DialogTitle>
            <DialogDescription>
              {selectedInvoice && `Facture ${selectedInvoice.invoice_number}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Show down payment info if exists */}
            {selectedInvoice && parseFloat(selectedInvoice.down_payment_amount || 0) > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-green-900 text-sm">💰 Acompte déjà versé</h4>
                <div className="text-sm space-y-1">
                  <p><strong>Montant:</strong> {formatCurrency(parseFloat(selectedInvoice.down_payment_amount))}</p>
                  {selectedInvoice.down_payment_method && (
                    <p><strong>Mode de paiement:</strong> {
                      selectedInvoice.down_payment_method === 'especes' ? 'Espèces' :
                      selectedInvoice.down_payment_method === 'carte' ? 'Carte bancaire' :
                      selectedInvoice.down_payment_method === 'virement' ? 'Virement' :
                      selectedInvoice.down_payment_method === 'cheque' ? 'Chèque' :
                      selectedInvoice.down_payment_method
                    }</p>
                  )}
                  {selectedInvoice.down_payment_date && (
                    <p><strong>Date:</strong> {formatDate(selectedInvoice.down_payment_date)}</p>
                  )}
                </div>
              </div>
            )}

            {/* Payment summary */}
            {selectedInvoice && (
              <div className="bg-gray-50 border rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total facture:</span>
                    <span className="font-medium">{formatCurrency(parseFloat(selectedInvoice.total_amount || 0))}</span>
                  </div>
                  {parseFloat(selectedInvoice.down_payment_amount || 0) > 0 && (
                    <>
                      <div className="flex justify-between text-green-700">
                        <span>Acompte versé:</span>
                        <span className="font-medium">-{formatCurrency(parseFloat(selectedInvoice.down_payment_amount))}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-bold">
                        <span>Solde à payer:</span>
                        <span>{formatCurrency(
                          parseFloat(selectedInvoice.total_amount || 0) - parseFloat(selectedInvoice.down_payment_amount || 0)
                        )}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Montant du paiement (€)</label>
              <Input
                type="number"
                step="0.01"
                value={paymentData.amount_paid}
                onChange={(e) => setPaymentData({ ...paymentData, amount_paid: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Méthode de paiement</label>
              <Select
                value={paymentData.payment_method}
                onValueChange={(value: any) => setPaymentData({ ...paymentData, payment_method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="virement">Virement</SelectItem>
                  <SelectItem value="cheque">Chèque</SelectItem>
                  <SelectItem value="carte">Carte</SelectItem>
                  <SelectItem value="especes">Espèces</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Annuler</Button>
            <Button onClick={submitPayment}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Details Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails de la facture {selectedInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Informations client</h4>
                  <div className="text-sm space-y-1">
                    <p><strong>Nom:</strong> {selectedInvoice.contact_name}</p>
                    {selectedInvoice.company_name && <p><strong>Société:</strong> {selectedInvoice.company_name}</p>}
                    <p><strong>Email:</strong> {selectedInvoice.contact_email}</p>
                    <p><strong>Téléphone:</strong> {selectedInvoice.contact_phone}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Informations facture</h4>
                  <div className="text-sm space-y-1">
                    <p><strong>Date:</strong> {formatDate(selectedInvoice.invoice_date)}</p>
                    <p><strong>Statut:</strong> {selectedInvoice.status}</p>
                    {selectedInvoice.due_date && (
                      <p><strong>Date d'échéance:</strong> {formatDate(selectedInvoice.due_date)}</p>
                    )}
                    {selectedInvoice.payment_date && (
                      <p><strong>Payée le:</strong> {formatDate(selectedInvoice.payment_date)}</p>
                    )}
                    {selectedInvoice.quotation_number && (
                      <p><strong>Devis:</strong> {selectedInvoice.quotation_number}</p>
                    )}
                    {selectedInvoice.order_number && (
                      <p><strong>Commande:</strong> {selectedInvoice.order_number}</p>
                    )}
                  </div>
                </div>
              </div>

              {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Articles</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="text-left p-2">Produit</th>
                          <th className="text-right p-2">Qté</th>
                          <th className="text-right p-2">Prix unit.</th>
                          <th className="text-right p-2">TVA</th>
                          <th className="text-right p-2">Total HT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.items.map((item: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">
                              <div>{item.product_name}</div>
                              {item.product_sku && (
                                <div className="text-xs text-gray-500">SKU: {item.product_sku}</div>
                              )}
                              {item.description && (
                                <div className="text-xs text-gray-500">{item.description}</div>
                              )}
                            </td>
                            <td className="text-right p-2">{item.quantity}</td>
                            <td className="text-right p-2">{formatCurrency(parseFloat(item.unit_price))}</td>
                            <td className="text-right p-2">{item.tax_rate}%</td>
                            <td className="text-right p-2">{formatCurrency(parseFloat(item.line_total))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 dark:bg-gray-800 font-semibold">
                        <tr>
                          <td colSpan={4} className="text-right p-2">Sous-total HT:</td>
                          <td className="text-right p-2">{formatCurrency(parseFloat(selectedInvoice.subtotal || 0))}</td>
                        </tr>
                        {parseFloat(selectedInvoice.discount_amount || 0) > 0 && (
                          <tr>
                            <td colSpan={4} className="text-right p-2">Remise:</td>
                            <td className="text-right p-2">-{formatCurrency(parseFloat(selectedInvoice.discount_amount || 0))}</td>
                          </tr>
                        )}
                        {parseFloat(selectedInvoice.tax_amount || 0) > 0 && (
                          <tr>
                            <td colSpan={4} className="text-right p-2">TVA:</td>
                            <td className="text-right p-2">{formatCurrency(parseFloat(selectedInvoice.tax_amount || 0))}</td>
                          </tr>
                        )}
                        <tr>
                          <td colSpan={4} className="text-right p-2">Total TTC:</td>
                          <td className="text-right p-2">{formatCurrency(parseFloat(selectedInvoice.total_amount || 0))}</td>
                        </tr>
                        {/* Show down payment if exists */}
                        {parseFloat(selectedInvoice.down_payment_amount || 0) > 0 && (
                          <tr className="text-green-600">
                            <td colSpan={4} className="text-right p-2">Acompte versé:</td>
                            <td className="text-right p-2">-{formatCurrency(parseFloat(selectedInvoice.down_payment_amount))}</td>
                          </tr>
                        )}
                        {/* Show final payment if exists */}
                        {selectedInvoice.amount_paid && parseFloat(selectedInvoice.amount_paid) > 0 && (
                          <tr className="text-green-600">
                            <td colSpan={4} className="text-right p-2">Solde payé:</td>
                            <td className="text-right p-2">-{formatCurrency(parseFloat(selectedInvoice.amount_paid))}</td>
                          </tr>
                        )}
                        {/* Show remaining balance if unpaid */}
                        {selectedInvoice.status !== 'payee' && selectedInvoice.amount_due && parseFloat(selectedInvoice.amount_due) > 0 && (
                          <tr className="text-orange-600 font-bold">
                            <td colSpan={4} className="text-right p-2">Reste à payer:</td>
                            <td className="text-right p-2">{formatCurrency(parseFloat(selectedInvoice.amount_due))}</td>
                          </tr>
                        )}
                        {/* Show paid status */}
                        {selectedInvoice.status === 'payee' && (
                          <tr className="text-green-600 font-bold">
                            <td colSpan={4} className="text-right p-2">Statut:</td>
                            <td className="text-right p-2">✓ PAYÉE</td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Payment History */}
              {(parseFloat(selectedInvoice.down_payment_amount || 0) > 0 || (selectedInvoice.amount_paid && parseFloat(selectedInvoice.amount_paid) > 0)) && (
                <div>
                  <h4 className="font-semibold mb-2">Historique des paiements</h4>
                  <div className="space-y-3">
                    {/* Down payment */}
                    {parseFloat(selectedInvoice.down_payment_amount || 0) > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-green-900">💰 Acompte versé</p>
                            <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                              {selectedInvoice.down_payment_method && (
                                <p><strong>Mode:</strong> {
                                  selectedInvoice.down_payment_method === 'especes' ? 'Espèces' :
                                  selectedInvoice.down_payment_method === 'carte' ? 'Carte bancaire' :
                                  selectedInvoice.down_payment_method === 'virement' ? 'Virement' :
                                  selectedInvoice.down_payment_method === 'cheque' ? 'Chèque' :
                                  selectedInvoice.down_payment_method
                                }</p>
                              )}
                              {selectedInvoice.down_payment_date && (
                                <p><strong>Date:</strong> {formatDate(selectedInvoice.down_payment_date)}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-lg font-bold text-green-700">
                            {formatCurrency(parseFloat(selectedInvoice.down_payment_amount))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Final payment */}
                    {selectedInvoice.amount_paid && parseFloat(selectedInvoice.amount_paid) > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-green-900">✓ Solde payé</p>
                            <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                              {selectedInvoice.payment_method && (
                                <p><strong>Mode:</strong> {
                                  selectedInvoice.payment_method === 'virement' ? 'Virement' :
                                  selectedInvoice.payment_method === 'cheque' ? 'Chèque' :
                                  selectedInvoice.payment_method === 'carte' ? 'Carte bancaire' :
                                  selectedInvoice.payment_method === 'especes' ? 'Espèces' :
                                  selectedInvoice.payment_method
                                }</p>
                              )}
                              {selectedInvoice.payment_date && (
                                <p><strong>Date:</strong> {formatDate(selectedInvoice.payment_date)}</p>
                              )}
                              {selectedInvoice.payment_reference && (
                                <p><strong>Référence:</strong> {selectedInvoice.payment_reference}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-lg font-bold text-green-700">
                            {formatCurrency(parseFloat(selectedInvoice.amount_paid))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedInvoice.notes && (
                <div>
                  <h4 className="font-semibold mb-2">Notes</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedInvoice.notes}</p>
                </div>
              )}

              {selectedInvoice.payment_terms && (
                <div>
                  <h4 className="font-semibold mb-2">Conditions de paiement</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{formatPaymentTerms(selectedInvoice.payment_terms)}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
