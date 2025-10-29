import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ContactForm } from './ContactForm'
import { toast } from 'react-hot-toast'
import {
  Plus,
  Search,
  Download,
  Upload,
  Filter,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  FileText,
  Users,
  UserCheck,
  UserX,
  Calendar,
  Euro,
  CreditCard,
  Globe,
  Clock,
  Package,
  TrendingUp,
  Loader2,
  Archive,
  ArchiveRestore
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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

export function ContactManagement() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [editingContact, setEditingContact] = useState<any>(null)
  const [viewingContact, setViewingContact] = useState<any>(null)
  const [searchInput, setSearchInput] = useState('')  // User input (not debounced)
  const [searchTerm, setSearchTerm] = useState('')     // Debounced search term
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('not_archived')  // Default to non-archived contacts

  // Get auth token
  const token = localStorage.getItem('access_token')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput)
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [searchInput])

  // Fetch contacts from API
  const { data: contactsData, isLoading, error } = useQuery({
    queryKey: ['contacts', searchTerm, filterType, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (filterType !== 'all') params.append('type', filterType)

      // Handle filter status - backend only understands is_active filter
      // We'll filter by has_active_business on the frontend
      if (filterStatus === 'not_archived') {
        params.append('is_active', 'true')
      } else if (filterStatus === 'archived') {
        params.append('is_active', 'false')
      }
      // For 'all', 'has_business', 'no_business' - fetch all and filter on frontend

      const response = await fetch(`${API_URL}/contacts?${params.toString()}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })

      if (!response.ok) {
        throw new Error('Failed to fetch contacts')
      }

      const data = await response.json()
      return data
    },
    enabled: !!token,
  })

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (contactData: any) => {
      const response = await fetch(`${API_URL}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(contactData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create contact')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Contact créé avec succès')
      setShowForm(false)
      setEditingContact(null)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la création du contact')
    },
  })

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`${API_URL}/contacts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update contact')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Contact modifié avec succès')
      setShowForm(false)
      setEditingContact(null)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la modification du contact')
    },
  })

  // Delete contact mutation (archive)
  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_URL}/contacts/${id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete contact')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Contact archivé avec succès')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de l\'archivage du contact')
    },
  })

  // Restore contact mutation (unarchive)
  const restoreContactMutation = useMutation({
    mutationFn: async (contact: any) => {
      // Only send the necessary fields, excluding calculated fields and timestamps
      const { has_active_business, quotation_count, total_revenue, potential_revenue, created_at, updated_at, ...contactData } = contact

      const response = await fetch(`${API_URL}/contacts/${contact.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...contactData, is_active: true }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to restore contact')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Contact désarchivé avec succès')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la restauration du contact')
    },
  })

  // Get contacts from API response and apply frontend filters
  const allContacts = contactsData?.contacts || []

  // Apply frontend filters for business activity
  const contacts = useMemo(() => {
    if (filterStatus === 'has_business') {
      return allContacts.filter((c: any) => c.has_active_business === true)
    } else if (filterStatus === 'no_business') {
      return allContacts.filter((c: any) => c.has_active_business === false && c.is_active === true)
    }
    return allContacts
  }, [allContacts, filterStatus])

  const handleSaveContact = (data: any) => {
    if (editingContact) {
      updateContactMutation.mutate({ id: editingContact.id, data })
    } else {
      createContactMutation.mutate(data)
    }
  }

  const handleEditContact = (contact: any) => {
    setEditingContact(contact)
    setShowForm(true)
  }

  const handleViewContact = (contact: any) => {
    setViewingContact(contact)
    setShowDetails(true)
  }

  const handleDeleteContact = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir archiver ce contact ?')) {
      deleteContactMutation.mutate(id)
    }
  }

  const handleRestoreContact = (contact: any) => {
    if (confirm('Êtes-vous sûr de vouloir désarchiver ce contact ?')) {
      restoreContactMutation.mutate(contact)
    }
  }

  const handleExport = () => {
    toast.success('Export des contacts en cours...')
    // Implement CSV export logic here
  }

  const handleImport = () => {
    toast('Fonctionnalité d\'import à venir')
    // Implement import logic here
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'client':
        return <UserCheck className="h-4 w-4" />
      case 'other':
        return <User className="h-4 w-4" />
      case 'supplier':
        return <Building2 className="h-4 w-4" />
      case 'partner':
        return <Users className="h-4 w-4" />
      default:
        return <Users className="h-4 w-4" />
    }
  }

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'client':
        return 'Client'
      case 'other':
        return 'Prospect'
      case 'supplier':
        return 'Fournisseur'
      case 'partner':
        return 'Partenaire'
      default:
        return type
    }
  }

  const getTypeBadgeVariant = (type: string): any => {
    switch (type) {
      case 'client':
        return 'default'
      case 'other':
        return 'secondary'
      case 'supplier':
        return 'outline'
      case 'partner':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Contacts</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Gérez vos clients, prospects et fournisseurs
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => {
            setEditingContact(null)
            setShowForm(true)
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau contact
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Rechercher par nom, email, ville..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="client">Clients</SelectItem>
                <SelectItem value="other">Prospects</SelectItem>
                <SelectItem value="supplier">Fournisseurs</SelectItem>
                <SelectItem value="partner">Partenaires</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="has_business">Actifs</SelectItem>
                <SelectItem value="no_business">Inactifs</SelectItem>
                <SelectItem value="not_archived">Non archivés</SelectItem>
                <SelectItem value="archived">Archivés</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : contacts.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients Actifs</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : contacts.filter((c: any) => c.type === 'client' && c.has_active_business === true).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prospects</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : contacts.filter((c: any) => c.type === 'other').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fournisseurs</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : contacts.filter((c: any) => c.type === 'supplier').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contacts List */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des contacts ({isLoading ? '...' : contacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8 flex items-center justify-center gap-2 text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin" />
                Chargement des contacts...
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                Erreur lors du chargement des contacts
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucun contact trouvé
              </div>
            ) : (
              contacts.map((contact: any) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      {getTypeIcon(contact.type)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">
                          {contact.company_name || `${contact.first_name} ${contact.last_name}`}
                        </h4>
                        <Badge variant={getTypeBadgeVariant(contact.type)}>
                          {getTypeLabel(contact.type)}
                        </Badge>
                        {!contact.is_active ? (
                          <Badge variant="destructive">Archivé</Badge>
                        ) : contact.has_active_business ? (
                          <Badge className="bg-green-500 text-white hover:bg-green-600">Actif</Badge>
                        ) : (
                          <Badge variant="secondary">Inactif</Badge>
                        )}
                        {contact.tags && Array.isArray(contact.tags) && contact.tags.map((tag: string) => (
                          <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        {contact.company_name && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {contact.first_name} {contact.last_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {contact.address_city}
                        </span>
                      </div>
                      {contact.type === 'client' && contact.quotation_count > 0 && (
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-600">
                            {contact.quotation_count} devis
                          </span>
                          {contact.total_revenue > 0 && (
                            <span className="font-medium text-green-600">
                              CA réalisé: {formatCurrency(contact.total_revenue || 0)}
                            </span>
                          )}
                          {contact.potential_revenue > 0 && (
                            <span className="text-gray-600">
                              Potentiel: {formatCurrency(contact.potential_revenue || 0)}
                            </span>
                          )}
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
                      <DropdownMenuItem onClick={() => handleEditContact(contact)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleViewContact(contact)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Voir détails
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <FileText className="mr-2 h-4 w-4" />
                        Historique
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {contact.is_active ? (
                        <DropdownMenuItem
                          onClick={() => handleDeleteContact(contact.id)}
                          className="text-orange-600"
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archiver
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => handleRestoreContact(contact)}
                          className="text-green-600"
                        >
                          <ArchiveRestore className="mr-2 h-4 w-4" />
                          Désarchiver
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? 'Modifier le contact' : 'Nouveau contact'}
            </DialogTitle>
          </DialogHeader>
          <ContactForm
            contact={editingContact}
            onSave={handleSaveContact}
            onClose={() => {
              setShowForm(false)
              setEditingContact(null)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Contact Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Détails du contact</DialogTitle>
          </DialogHeader>
          {viewingContact && (
            <div className="space-y-6">
              {/* Header Section */}
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      {getTypeIcon(viewingContact.type)}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{viewingContact.company_name}</h3>
                      <div className="text-sm text-muted-foreground">
                        {viewingContact.first_name} {viewingContact.last_name}
                        {viewingContact.job_title && ` - ${viewingContact.job_title}`}
                      </div>
                      {viewingContact.customer_type && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {viewingContact.customer_type === 'individual' ? 'Particulier' : 'Société'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getTypeBadgeVariant(viewingContact.type)}>
                      {getTypeLabel(viewingContact.type)}
                    </Badge>
                    {!viewingContact.is_active ? (
                      <Badge variant="destructive">Archivé</Badge>
                    ) : viewingContact.has_active_business ? (
                      <Badge className="bg-green-500 text-white hover:bg-green-600">Actif</Badge>
                    ) : (
                      <Badge variant="secondary">Inactif</Badge>
                    )}
                    {viewingContact.tags && Array.isArray(viewingContact.tags) && viewingContact.tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </div>
                {viewingContact.type === 'client' && (
                  <div className="text-right space-y-1">
                    <div>
                      <div className="text-2xl font-bold text-green-600">{formatCurrency(viewingContact.total_revenue || 0)}</div>
                      <div className="text-xs text-muted-foreground">CA réalisé (factures payées)</div>
                    </div>
                    {viewingContact.potential_revenue > 0 && (
                      <div>
                        <div className="text-lg font-semibold">{formatCurrency(viewingContact.potential_revenue || 0)}</div>
                        <div className="text-xs text-muted-foreground">CA potentiel (devis envoyés)</div>
                      </div>
                    )}
                    <div className="text-sm mt-2">{viewingContact.quotation_count || 0} devis au total</div>
                  </div>
                )}
              </div>

              {/* Main Information Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Informations de contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{viewingContact.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{viewingContact.phone}</span>
                      </div>
                      {viewingContact.mobile && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{viewingContact.mobile} (Mobile)</span>
                        </div>
                      )}
                      {viewingContact.website && (
                        <div className="flex items-center gap-2 text-sm">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <a href={viewingContact.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {viewingContact.website}
                          </a>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Address */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Adresse
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <address className="text-sm not-italic space-y-1">
                      {viewingContact.address_street && <div>{viewingContact.address_street}</div>}
                      {(viewingContact.address_zip || viewingContact.address_city) && (
                        <div>{viewingContact.address_zip} {viewingContact.address_city}</div>
                      )}
                      {viewingContact.address_state && <div>{viewingContact.address_state}</div>}
                      {viewingContact.address_country && <div className="font-medium">{viewingContact.address_country}</div>}
                    </address>
                  </CardContent>
                </Card>
              </div>

              {/* Commercial Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Informations commerciales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    {viewingContact.tax_id && (
                      <div>
                        <div className="text-sm text-muted-foreground">ID Fiscal / SIRET</div>
                        <div className="font-medium">{viewingContact.tax_id}</div>
                      </div>
                    )}
                    {viewingContact.payment_terms !== null && viewingContact.payment_terms !== undefined && (
                      <div>
                        <div className="text-sm text-muted-foreground">Conditions de paiement</div>
                        <div className="font-medium">{viewingContact.payment_terms} jours</div>
                      </div>
                    )}
                    {viewingContact.credit_limit !== null && viewingContact.credit_limit !== undefined && (
                      <div>
                        <div className="text-sm text-muted-foreground">Limite de crédit</div>
                        <div className="font-medium">{formatCurrency(viewingContact.credit_limit)}</div>
                      </div>
                    )}
                    {viewingContact.discount_rate && viewingContact.discount_rate > 0 && (
                      <div>
                        <div className="text-sm text-muted-foreground">Taux de remise</div>
                        <div className="font-medium">{viewingContact.discount_rate}%</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              {viewingContact.type === 'client' && viewingContact.quotation_count > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Activité récente
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Nombre total de devis</span>
                        <span className="font-medium">{viewingContact.quotation_count}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Chiffre d'affaires accepté</span>
                        <span className="font-medium">
                          {formatCurrency(viewingContact.total_revenue || 0)}
                        </span>
                      </div>
                      {viewingContact.quotation_count > 0 && viewingContact.total_revenue > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Montant moyen par devis accepté</span>
                          <span className="font-medium">
                            {formatCurrency((viewingContact.total_revenue || 0) / (viewingContact.quotation_count || 1))}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              {viewingContact.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Notes internes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {viewingContact.notes}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Metadata */}
              {(viewingContact.created_at || viewingContact.updated_at) && (
                <div className="flex gap-4 text-xs text-muted-foreground border-t pt-4">
                  {viewingContact.created_at && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Créé le {new Date(viewingContact.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    </div>
                  )}
                  {viewingContact.updated_at && viewingContact.updated_at !== viewingContact.created_at && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Modifié le {new Date(viewingContact.updated_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDetails(false)}>
                  Fermer
                </Button>
                <Button onClick={() => {
                  setEditingContact(viewingContact)
                  setShowDetails(false)
                  setShowForm(true)
                }}>
                  <Edit className="mr-2 h-4 w-4" />
                  Modifier
                </Button>
                {viewingContact.type === 'client' && (
                  <Button variant="default" onClick={() => {
                    setShowDetails(false)
                    toast('Redirection vers les devis...')
                  }}>
                    <FileText className="mr-2 h-4 w-4" />
                    Créer un devis
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}