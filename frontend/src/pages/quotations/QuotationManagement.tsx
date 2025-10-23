import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EnhancedQuotationBuilder } from './EnhancedQuotationBuilder'
import { toast } from 'react-hot-toast'
import { generateQuotationPDF } from '@/services/pdfGenerator'
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
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingQuotation, setEditingQuotation] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [sortBy, setSortBy] = useState('date_desc')

  // Mock data for demonstration
  const [quotations, setQuotations] = useState([
    {
      id: 1,
      quotation_number: 'DEV-202401-001',
      date: '2024-01-15',
      validity_date: '2024-02-15',
      contact_name: 'Meubles Modernes SARL',
      contact_email: 'jean.dupont@meublesmodernes.fr',
      status: 'sent',
      items_count: 5,
      total_ht: 8500,
      total_ttc: 10200,
      created_by: 'Admin',
      version: 1
    },
    {
      id: 2,
      quotation_number: 'DEV-202401-002',
      date: '2024-01-18',
      validity_date: '2024-02-18',
      contact_name: 'Hôtel Luxe Palace',
      contact_email: 'sleroy@luxepalace.com',
      status: 'accepted',
      items_count: 12,
      total_ht: 25000,
      total_ttc: 30000,
      created_by: 'Admin',
      version: 3
    },
    {
      id: 3,
      quotation_number: 'DEV-202401-003',
      date: '2024-01-20',
      validity_date: '2024-02-20',
      contact_name: 'Design Intérieur Pro',
      contact_email: 'marie@designinterieur.fr',
      status: 'draft',
      items_count: 3,
      total_ht: 4200,
      total_ttc: 5040,
      created_by: 'Admin',
      version: 1
    },
    {
      id: 4,
      quotation_number: 'DEV-202312-045',
      date: '2023-12-10',
      validity_date: '2024-01-10',
      contact_name: 'Restaurant Le Gourmet',
      contact_email: 'contact@legourmet.fr',
      status: 'expired',
      items_count: 8,
      total_ht: 12000,
      total_ttc: 14400,
      created_by: 'Admin',
      version: 2
    },
    {
      id: 5,
      quotation_number: 'DEV-202401-004',
      date: '2024-01-22',
      validity_date: '2024-02-22',
      contact_name: 'Boutique Chic',
      contact_email: 'info@boutiquechic.fr',
      status: 'rejected',
      items_count: 4,
      total_ht: 6500,
      total_ttc: 7800,
      created_by: 'Admin',
      version: 1
    }
  ])

  // Calculate statistics
  const stats = useMemo(() => {
    const totalQuotations = quotations.length
    const acceptedQuotations = quotations.filter(q => q.status === 'accepted').length
    const totalValue = quotations.reduce((sum, q) => sum + q.total_ttc, 0)
    const acceptedValue = quotations
      .filter(q => q.status === 'accepted')
      .reduce((sum, q) => sum + q.total_ttc, 0)
    const conversionRate = totalQuotations > 0 ? (acceptedQuotations / totalQuotations) * 100 : 0

    return {
      totalQuotations,
      acceptedQuotations,
      totalValue,
      acceptedValue,
      conversionRate
    }
  }, [quotations])

  // Filter and sort quotations
  const filteredQuotations = useMemo(() => {
    let filtered = quotations.filter(quotation => {
      // Search filter
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = !searchTerm ||
        quotation.quotation_number.toLowerCase().includes(searchLower) ||
        quotation.contact_name.toLowerCase().includes(searchLower) ||
        quotation.contact_email.toLowerCase().includes(searchLower)

      // Status filter
      const matchesStatus = filterStatus === 'all' || quotation.status === filterStatus

      // Period filter
      let matchesPeriod = true
      if (filterPeriod !== 'all') {
        const quotationDate = new Date(quotation.date)
        const now = new Date()
        const daysDiff = Math.floor((now.getTime() - quotationDate.getTime()) / (1000 * 60 * 60 * 24))

        switch (filterPeriod) {
          case 'today':
            matchesPeriod = daysDiff === 0
            break
          case 'week':
            matchesPeriod = daysDiff <= 7
            break
          case 'month':
            matchesPeriod = daysDiff <= 30
            break
          case 'quarter':
            matchesPeriod = daysDiff <= 90
            break
        }
      }

      return matchesSearch && matchesStatus && matchesPeriod
    })

    // Sort
    switch (sortBy) {
      case 'date_desc':
        filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        break
      case 'date_asc':
        filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        break
      case 'amount_desc':
        filtered.sort((a, b) => b.total_ttc - a.total_ttc)
        break
      case 'amount_asc':
        filtered.sort((a, b) => a.total_ttc - b.total_ttc)
        break
      case 'client':
        filtered.sort((a, b) => a.contact_name.localeCompare(b.contact_name))
        break
    }

    return filtered
  }, [quotations, searchTerm, filterStatus, filterPeriod, sortBy])

  const handleSaveQuotation = (data: any) => {
    if (editingQuotation) {
      // Update existing quotation
      setQuotations(prev => prev.map(q =>
        q.id === editingQuotation.id
          ? { ...q, ...data, total_ttc: data.totals.total }
          : q
      ))
    } else {
      // Add new quotation
      const newQuotation = {
        id: quotations.length + 1,
        ...data,
        total_ht: data.totals.subtotal,
        total_ttc: data.totals.total,
        items_count: data.sections.reduce((sum: number, s: any) => sum + s.items.length, 0),
        created_by: 'Admin',
        version: 1
      }
      setQuotations(prev => [...prev, newQuotation])
    }
    setShowBuilder(false)
    setEditingQuotation(null)
  }

  const handleEditQuotation = (quotation: any) => {
    setEditingQuotation(quotation)
    setShowBuilder(true)
  }

  const handleDuplicateQuotation = (quotation: any) => {
    const duplicated = {
      ...quotation,
      id: quotations.length + 1,
      quotation_number: generateNewNumber(),
      date: new Date().toISOString().split('T')[0],
      validity_date: getNewValidityDate(),
      status: 'draft',
      version: 1
    }
    setQuotations(prev => [...prev, duplicated])
    toast.success('Devis dupliqué avec succès')
  }

  const handleDeleteQuotation = (id: number) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce devis ?')) {
      setQuotations(prev => prev.filter(q => q.id !== id))
      toast.success('Devis supprimé avec succès')
    }
  }

  const handleConvertToOrder = (quotation: any) => {
    toast.success(`Devis ${quotation.quotation_number} converti en commande`)
    // Implement order conversion logic
  }

  const handleSendQuotation = (quotation: any) => {
    setQuotations(prev => prev.map(q =>
      q.id === quotation.id ? { ...q, status: 'sent' } : q
    ))
    toast.success('Devis envoyé par email')
  }

  const handleDownloadPDF = (quotation: any) => {
    // Company information
    const company = {
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

    // Client information
    const client = {
      name: quotation.contact_name,
      company: quotation.contact_company || '',
      address: '456 Avenue des Champs',
      city: 'Lyon',
      postalCode: '69000',
      country: 'France',
      phone: quotation.contact_phone || '',
      email: quotation.contact_email
    }

    // Sample items for the quotation
    const items = [
      {
        id: '1',
        description: 'Table en chêne massif 200x100cm avec finition vernis mat',
        quantity: 1,
        unitPrice: 2500,
        discount: 10,
        discountType: 'percent' as const,
        tax: 20,
        total: 2250
      },
      {
        id: '2',
        description: 'Chaise ergonomique avec assise en cuir',
        quantity: 6,
        unitPrice: 350,
        discount: 0,
        discountType: 'percent' as const,
        tax: 20,
        total: 2100
      },
      {
        id: '3',
        description: 'Buffet 3 portes en noyer avec étagères intégrées',
        quantity: 1,
        unitPrice: 1800,
        discount: 50,
        discountType: 'amount' as const,
        tax: 20,
        total: 1750
      }
    ]

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.total, 0)
    const totalDiscount = items.reduce((sum, item) => {
      if (item.discountType === 'percent') {
        return sum + (item.unitPrice * item.quantity * item.discount / 100)
      } else {
        return sum + item.discount
      }
    }, 0)
    const totalTax = items.reduce((sum, item) => sum + (item.total * item.tax / 100), 0)
    const total = subtotal + totalTax

    // Format quotation data for PDF
    const quotationData = {
      id: quotation.id.toString(),
      number: quotation.quotation_number,
      date: new Date(quotation.date),
      validUntil: new Date(quotation.validity_date),
      client: client,
      items: items,
      subtotal: subtotal,
      totalDiscount: totalDiscount,
      totalTax: totalTax,
      total: total,
      notes: 'Livraison incluse dans la région parisienne. Installation sur devis.',
      termsAndConditions: `1. Validité: Ce devis est valable 30 jours à compter de sa date d'émission.
2. Paiement: 30% à la commande, 70% à la livraison.
3. Délai de livraison: 4-6 semaines après confirmation de commande.
4. Garantie: Tous nos meubles sont garantis 2 ans pièces et main d'œuvre.
5. Retours: Les produits sur mesure ne sont ni repris ni échangés.`,
      status: quotation.status as any
    }

    try {
      generateQuotationPDF(company, quotationData, true)
      toast.success('PDF téléchargé avec succès')
    } catch (error) {
      toast.error('Erreur lors de la génération du PDF')
      console.error(error)
    }
  }

  const generateNewNumber = () => {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const count = quotations.filter(q => q.quotation_number.startsWith(`DEV-${year}${month}`)).length + 1
    return `DEV-${year}${month}-${String(count).padStart(3, '0')}`
  }

  const getNewValidityDate = () => {
    const date = new Date()
    date.setDate(date.getDate() + 30)
    return date.toISOString().split('T')[0]
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
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devis</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalQuotations}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acceptés</CardTitle>
            <Check className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.acceptedQuotations}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux conversion</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversionRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valeur totale</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA potentiel</CardTitle>
            <Euro className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.acceptedValue)}</div>
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
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                          {quotation.contact_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(quotation.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {quotation.items_count} article(s)
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-medium">
                          Total: {formatCurrency(quotation.total_ttc)}
                        </span>
                        {quotation.status === 'sent' && new Date(quotation.validity_date) < new Date() && (
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
                      {quotation.status === 'accepted' && (
                        <DropdownMenuItem onClick={() => handleConvertToOrder(quotation)}>
                          <FileText className="mr-2 h-4 w-4" />
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
    </div>
  )
}