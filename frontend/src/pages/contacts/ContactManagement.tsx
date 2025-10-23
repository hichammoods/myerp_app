import React, { useState, useMemo } from 'react'
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
  TrendingUp
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

export function ContactManagement() {
  const [showForm, setShowForm] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [editingContact, setEditingContact] = useState<any>(null)
  const [viewingContact, setViewingContact] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // Mock data for demonstration
  const [contacts, setContacts] = useState([
    {
      id: 1,
      type: 'client',
      company_name: 'Meubles Modernes SARL',
      first_name: 'Jean',
      last_name: 'Dupont',
      email: 'jean.dupont@meublesmodernes.fr',
      phone: '+33 1 23 45 67 89',
      mobile: '+33 6 12 34 56 78',
      address: '123 rue de la Paix',
      city: 'Paris',
      postal_code: '75001',
      country: 'France',
      is_active: true,
      orders_count: 12,
      total_revenue: 45000,
      last_order_date: '2024-01-15',
      tags: ['VIP', 'Récurrent']
    },
    {
      id: 2,
      type: 'prospect',
      company_name: 'Design Intérieur Pro',
      first_name: 'Marie',
      last_name: 'Martin',
      email: 'marie@designinterieur.fr',
      phone: '+33 1 98 76 54 32',
      mobile: '+33 6 98 76 54 32',
      address: '456 avenue des Champs',
      city: 'Lyon',
      postal_code: '69000',
      country: 'France',
      is_active: true,
      orders_count: 0,
      total_revenue: 0,
      last_order_date: null,
      tags: ['Nouveau']
    },
    {
      id: 3,
      type: 'fournisseur',
      company_name: 'Bois de France SA',
      first_name: 'Pierre',
      last_name: 'Bernard',
      email: 'p.bernard@boisdefrance.com',
      phone: '+33 2 45 67 89 01',
      mobile: '+33 7 45 67 89 01',
      address: '789 zone industrielle',
      city: 'Nantes',
      postal_code: '44000',
      country: 'France',
      is_active: true,
      orders_count: 0,
      total_revenue: 0,
      last_order_date: null,
      tags: ['Matériaux', 'Fiable']
    },
    {
      id: 4,
      type: 'client',
      company_name: 'Hôtel Luxe Palace',
      first_name: 'Sophie',
      last_name: 'Leroy',
      email: 'sleroy@luxepalace.com',
      phone: '+33 1 55 66 77 88',
      mobile: '+33 6 55 66 77 88',
      address: '10 place Vendôme',
      city: 'Paris',
      postal_code: '75001',
      country: 'France',
      is_active: false,
      orders_count: 8,
      total_revenue: 120000,
      last_order_date: '2023-11-20',
      tags: ['Entreprise', 'Grand compte']
    }
  ])

  // Filter contacts based on search and filters
  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      // Search filter
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = !searchTerm ||
        contact.company_name.toLowerCase().includes(searchLower) ||
        contact.first_name.toLowerCase().includes(searchLower) ||
        contact.last_name.toLowerCase().includes(searchLower) ||
        contact.email.toLowerCase().includes(searchLower) ||
        contact.city.toLowerCase().includes(searchLower)

      // Type filter
      const matchesType = filterType === 'all' || contact.type === filterType

      // Status filter
      const matchesStatus = filterStatus === 'all' ||
        (filterStatus === 'active' && contact.is_active) ||
        (filterStatus === 'inactive' && !contact.is_active)

      return matchesSearch && matchesType && matchesStatus
    })
  }, [contacts, searchTerm, filterType, filterStatus])

  const handleSaveContact = (data: any) => {
    if (editingContact) {
      // Update existing contact
      setContacts(prev => prev.map(c =>
        c.id === editingContact.id
          ? { ...editingContact, ...data }
          : c
      ))
    } else {
      // Add new contact
      const newContact = {
        ...data,
        id: contacts.length + 1,
        orders_count: 0,
        total_revenue: 0,
        last_order_date: null
      }
      setContacts(prev => [...prev, newContact])
    }
    setShowForm(false)
    setEditingContact(null)
  }

  const handleEditContact = (contact: any) => {
    setEditingContact(contact)
    setShowForm(true)
  }

  const handleViewContact = (contact: any) => {
    setViewingContact(contact)
    setShowDetails(true)
  }

  const handleDeleteContact = (id: number) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce contact ?')) {
      setContacts(prev => prev.filter(c => c.id !== id))
      toast.success('Contact supprimé avec succès')
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
      case 'prospect':
        return <User className="h-4 w-4" />
      case 'fournisseur':
        return <Building2 className="h-4 w-4" />
      default:
        return <Users className="h-4 w-4" />
    }
  }

  const getTypeBadgeVariant = (type: string): any => {
    switch (type) {
      case 'client':
        return 'default'
      case 'prospect':
        return 'secondary'
      case 'fournisseur':
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
          <Button variant="outline" onClick={handleImport}>
            <Upload className="mr-2 h-4 w-4" />
            Importer
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
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
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                <SelectItem value="prospect">Prospects</SelectItem>
                <SelectItem value="fournisseur">Fournisseurs</SelectItem>
                <SelectItem value="partenaire">Partenaires</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="inactive">Inactifs</SelectItem>
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
            <div className="text-2xl font-bold">{contacts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients Actifs</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {contacts.filter(c => c.type === 'client' && c.is_active).length}
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
              {contacts.filter(c => c.type === 'prospect').length}
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
              {contacts.filter(c => c.type === 'fournisseur').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contacts List */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des contacts ({filteredContacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucun contact trouvé
              </div>
            ) : (
              filteredContacts.map(contact => (
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
                        <h4 className="font-semibold">{contact.company_name}</h4>
                        <Badge variant={getTypeBadgeVariant(contact.type)}>
                          {contact.type}
                        </Badge>
                        {!contact.is_active && (
                          <Badge variant="destructive">Inactif</Badge>
                        )}
                        {contact.tags.map((tag: string) => (
                          <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {contact.first_name} {contact.last_name}
                        </span>
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
                          {contact.city}
                        </span>
                      </div>
                      {contact.type === 'client' && contact.orders_count > 0 && (
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-600">
                            {contact.orders_count} commande(s)
                          </span>
                          <span className="font-medium">
                            CA: {formatCurrency(contact.total_revenue)}
                          </span>
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
                      <DropdownMenuItem
                        onClick={() => handleDeleteContact(contact.id)}
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
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getTypeBadgeVariant(viewingContact.type)}>
                      {viewingContact.type}
                    </Badge>
                    {viewingContact.is_active ? (
                      <Badge variant="success">Actif</Badge>
                    ) : (
                      <Badge variant="destructive">Inactif</Badge>
                    )}
                    {viewingContact.tags?.map((tag: string) => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </div>
                {viewingContact.type === 'client' && (
                  <div className="text-right">
                    <div className="text-2xl font-bold">{formatCurrency(viewingContact.total_revenue)}</div>
                    <div className="text-sm text-muted-foreground">Chiffre d'affaires total</div>
                    <div className="text-sm mt-1">{viewingContact.orders_count} commandes</div>
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
                      <div>{viewingContact.address}</div>
                      <div>{viewingContact.postal_code} {viewingContact.city}</div>
                      <div className="font-medium">{viewingContact.country}</div>
                    </address>
                  </CardContent>
                </Card>
              </div>

              {/* Commercial Information */}
              {(viewingContact.siret || viewingContact.tva_number || viewingContact.payment_terms) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Informations commerciales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      {viewingContact.siret && (
                        <div>
                          <div className="text-sm text-muted-foreground">SIRET</div>
                          <div className="font-medium">{viewingContact.siret}</div>
                        </div>
                      )}
                      {viewingContact.tva_number && (
                        <div>
                          <div className="text-sm text-muted-foreground">N° TVA</div>
                          <div className="font-medium">{viewingContact.tva_number}</div>
                        </div>
                      )}
                      {viewingContact.payment_terms && (
                        <div>
                          <div className="text-sm text-muted-foreground">Conditions de paiement</div>
                          <div className="font-medium">{viewingContact.payment_terms} jours</div>
                        </div>
                      )}
                      {viewingContact.credit_limit && (
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
              )}

              {/* Recent Activity */}
              {viewingContact.type === 'client' && viewingContact.last_order_date && (
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
                        <span className="text-sm text-muted-foreground">Dernière commande</span>
                        <span className="font-medium">{new Date(viewingContact.last_order_date).toLocaleDateString('fr-FR')}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Nombre total de commandes</span>
                        <span className="font-medium">{viewingContact.orders_count}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Panier moyen</span>
                        <span className="font-medium">
                          {formatCurrency(viewingContact.total_revenue / viewingContact.orders_count)}
                        </span>
                      </div>
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