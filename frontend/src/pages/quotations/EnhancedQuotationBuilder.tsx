import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { toast } from 'react-hot-toast'
import {
  FileText,
  User,
  Calendar,
  Plus,
  Trash2,
  Copy,
  Save,
  Send,
  Package,
  Euro,
  Percent,
  Calculator,
  Settings,
  ChevronDown,
  ChevronUp,
  GripVertical,
  PlusCircle,
  Search,
  AlertTriangle,
  Image,
  Upload,
  Eye,
  Edit2,
  Layers,
  ShoppingCart,
  Info,
  Building2,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Truck
} from 'lucide-react'

interface QuotationBuilderProps {
  quotation?: any
  onSave: (data: any) => void
  onClose: () => void
}

interface MaterialOption {
  id: string
  materialId: string
  materialName: string
  finishId: string
  finishName: string
  extraCost: number
}

interface LineItem {
  id: string
  type: 'catalog' | 'custom'
  product_id?: string
  product_name: string
  product_sku?: string
  description: string
  quantity: number
  unit_price: number
  base_price: number
  materials?: MaterialOption[]
  selectedMaterials?: string[]
  discount_type: 'percent' | 'amount'
  discount_value: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  subtotal: number
  total: number
  stock_quantity?: number
  lead_time?: number
  image_url?: string
  notes?: string
  is_customizable?: boolean
}

interface Section {
  id: string
  title: string
  items: LineItem[]
  collapsed: boolean
}

// Mock products with materials and stock info
const mockProducts = [
  {
    id: '1',
    name: 'Canapé 3 places Confort',
    sku: 'CNP-001',
    price: 1500,
    stock_quantity: 5,
    lead_time: 14,
    is_customizable: true,
    allows_custom_materials: true,
    image_url: '/images/canape.jpg',
    materials: [
      {
        partName: 'Structure',
        materialId: 'mat-1',
        materialName: 'Bois de hêtre',
        finishId: 'fin-1',
        finishName: 'Vernis naturel',
        extraCost: 0
      },
      {
        partName: 'Assise',
        materialId: 'mat-2',
        materialName: 'Tissu coton',
        finishId: 'fin-2',
        finishName: 'Traitement anti-taches',
        extraCost: 50
      }
    ]
  },
  {
    id: '2',
    name: 'Table à manger extensible',
    sku: 'TAB-002',
    price: 1200,
    stock_quantity: 0,
    lead_time: 21,
    is_customizable: true,
    allows_custom_materials: true,
    image_url: '/images/table.jpg',
    materials: []
  }
]

// Mock contacts with full details
const mockContacts = [
  {
    id: '1',
    type: 'company',
    name: 'Meubles Modernes SARL',
    email: 'contact@meublesmodernes.fr',
    phone: '+33 1 23 45 67 89',
    address: '123 Rue du Commerce, 75001 Paris',
    tax_id: 'FR12345678901',
    payment_terms: '30',
    discount_rate: 10
  },
  {
    id: '2',
    type: 'individual',
    name: 'Marie Dupont',
    email: 'marie.dupont@gmail.com',
    phone: '+33 6 12 34 56 78',
    address: '45 Avenue Victor Hugo, 69002 Lyon',
    tax_id: '',
    payment_terms: 'immediate',
    discount_rate: 0
  }
]

export function EnhancedQuotationBuilder({ quotation, onSave, onClose }: QuotationBuilderProps) {
  const [formData, setFormData] = useState({
    quotation_number: quotation?.quotation_number || generateQuotationNumber(),
    date: quotation?.date || new Date().toISOString().split('T')[0],
    validity_date: quotation?.validity_date || getDefaultValidityDate(),
    contact_id: quotation?.contact_id || '',
    contact_name: quotation?.contact_name || '',
    contact_details: quotation?.contact_details || null,
    status: quotation?.status || 'draft',
    payment_terms: quotation?.payment_terms || '30',
    delivery_time: quotation?.delivery_time || '2-4 semaines',
    delivery_address: quotation?.delivery_address || '',
    installation_included: quotation?.installation_included || false,
    notes: quotation?.notes || '',
    internal_notes: quotation?.internal_notes || '',
    terms_conditions: quotation?.terms_conditions || getDefaultTerms(),
    global_discount_type: quotation?.global_discount_type || 'percent',
    global_discount_value: quotation?.global_discount_value || 0,
    shipping_cost: quotation?.shipping_cost || 0,
    installation_cost: quotation?.installation_cost || 0,
    tax_rate: quotation?.tax_rate || 20,
    include_tax: quotation?.include_tax ?? true
  })

  const [sections, setSections] = useState<Section[]>(
    quotation?.sections || [{
      id: '1',
      title: 'Mobilier',
      items: [],
      collapsed: false
    }]
  )

  const [showProductDialog, setShowProductDialog] = useState(false)
  const [showMaterialDialog, setShowMaterialDialog] = useState(false)
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [editingItem, setEditingItem] = useState<LineItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [totals, setTotals] = useState({
    items_subtotal: 0,
    global_discount: 0,
    subtotal_after_discount: 0,
    shipping: 0,
    installation: 0,
    subtotal_before_tax: 0,
    tax: 0,
    total: 0
  })

  function generateQuotationNumber() {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `DEV-${year}${month}-${random}`
  }

  function getDefaultValidityDate() {
    const date = new Date()
    date.setDate(date.getDate() + 30)
    return date.toISOString().split('T')[0]
  }

  function getDefaultTerms() {
    return `Conditions générales de vente:
• Validité du devis : 30 jours
• Acompte de 30% à la commande
• Solde à la livraison
• Livraison comprise en France métropolitaine (hors Corse et DOM-TOM)
• Garantie 2 ans pièces et main d'œuvre
• Les délais de livraison sont donnés à titre indicatif
• Tout devis signé vaut bon de commande`
  }

  useEffect(() => {
    calculateTotals()
  }, [sections, formData.global_discount_type, formData.global_discount_value,
      formData.shipping_cost, formData.installation_cost, formData.tax_rate])

  const calculateTotals = () => {
    let items_subtotal = 0

    sections.forEach(section => {
      section.items.forEach(item => {
        items_subtotal += item.subtotal
      })
    })

    // Calculate global discount
    let global_discount = 0
    if (formData.global_discount_type === 'percent') {
      global_discount = items_subtotal * (formData.global_discount_value / 100)
    } else {
      global_discount = formData.global_discount_value
    }

    const subtotal_after_discount = items_subtotal - global_discount
    const shipping = parseFloat(formData.shipping_cost.toString()) || 0
    const installation = parseFloat(formData.installation_cost.toString()) || 0
    const subtotal_before_tax = subtotal_after_discount + shipping + installation

    const tax = formData.include_tax ? subtotal_before_tax * (formData.tax_rate / 100) : 0
    const total = subtotal_before_tax + tax

    setTotals({
      items_subtotal,
      global_discount,
      subtotal_after_discount,
      shipping,
      installation,
      subtotal_before_tax,
      tax,
      total
    })
  }

  const handleAddProduct = (product: any, customOptions?: any) => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      type: 'catalog',
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      description: product.description || '',
      quantity: 1,
      base_price: product.price,
      unit_price: product.price,
      materials: product.materials || [],
      selectedMaterials: [],
      discount_type: 'percent',
      discount_value: 0,
      discount_amount: 0,
      tax_rate: formData.tax_rate,
      tax_amount: 0,
      subtotal: product.price,
      total: product.price,
      stock_quantity: product.stock_quantity,
      lead_time: product.lead_time,
      image_url: product.image_url,
      is_customizable: product.is_customizable
    }

    // Apply contact discount if exists
    if (formData.contact_details?.discount_rate) {
      newItem.discount_type = 'percent'
      newItem.discount_value = formData.contact_details.discount_rate
    }

    // Recalculate item totals
    recalculateLineItem(newItem)

    setSections(sections.map(section =>
      section.id === selectedSectionId
        ? { ...section, items: [...section.items, newItem] }
        : section
    ))

    setShowProductDialog(false)
    setSelectedProduct(null)
  }

  const handleAddCustomProduct = (data: any) => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      type: 'custom',
      product_name: data.name,
      description: data.description,
      quantity: data.quantity || 1,
      base_price: data.price,
      unit_price: data.price,
      discount_type: 'percent',
      discount_value: 0,
      discount_amount: 0,
      tax_rate: formData.tax_rate,
      tax_amount: 0,
      subtotal: data.price * (data.quantity || 1),
      total: data.price * (data.quantity || 1),
      notes: data.notes
    }

    recalculateLineItem(newItem)

    setSections(sections.map(section =>
      section.id === selectedSectionId
        ? { ...section, items: [...section.items, newItem] }
        : section
    ))

    setShowProductDialog(false)
  }

  const recalculateLineItem = (item: LineItem) => {
    const baseTotal = item.quantity * item.unit_price

    // Calculate discount
    if (item.discount_type === 'percent') {
      item.discount_amount = baseTotal * (item.discount_value / 100)
    } else {
      item.discount_amount = item.discount_value
    }

    item.subtotal = baseTotal - item.discount_amount

    // Calculate tax
    if (formData.include_tax) {
      item.tax_amount = item.subtotal * (item.tax_rate / 100)
      item.total = item.subtotal + item.tax_amount
    } else {
      item.tax_amount = 0
      item.total = item.subtotal
    }
  }

  const handleUpdateLineItem = (sectionId: string, itemId: string, field: string, value: any) => {
    setSections(sections.map(section => {
      if (section.id !== sectionId) return section

      return {
        ...section,
        items: section.items.map(item => {
          if (item.id !== itemId) return item

          const updatedItem = { ...item, [field]: value }
          recalculateLineItem(updatedItem)
          return updatedItem
        })
      }
    }))
  }

  const handleDeleteLineItem = (sectionId: string, itemId: string) => {
    setSections(sections.map(section =>
      section.id === sectionId
        ? { ...section, items: section.items.filter(item => item.id !== itemId) }
        : section
    ))
  }

  const handleDuplicateLineItem = (sectionId: string, item: LineItem) => {
    const newItem = { ...item, id: Date.now().toString() }
    setSections(sections.map(section =>
      section.id === sectionId
        ? { ...section, items: [...section.items, newItem] }
        : section
    ))
  }

  const handleAddSection = () => {
    const newSection: Section = {
      id: Date.now().toString(),
      title: 'Nouvelle section',
      items: [],
      collapsed: false
    }
    setSections([...sections, newSection])
  }

  const handleDeleteSection = (sectionId: string) => {
    if (sections.length > 1) {
      setSections(sections.filter(s => s.id !== sectionId))
    } else {
      toast.error('Vous devez conserver au moins une section')
    }
  }

  const handleContactChange = (contactId: string) => {
    const contact = mockContacts.find(c => c.id === contactId)
    if (contact) {
      setFormData({
        ...formData,
        contact_id: contactId,
        contact_name: contact.name,
        contact_details: contact,
        payment_terms: contact.payment_terms,
        delivery_address: contact.address
      })

      // Apply contact discount to all items
      if (contact.discount_rate > 0) {
        setSections(sections.map(section => ({
          ...section,
          items: section.items.map(item => {
            const updatedItem = {
              ...item,
              discount_type: 'percent' as const,
              discount_value: contact.discount_rate
            }
            recalculateLineItem(updatedItem)
            return updatedItem
          })
        })))
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.contact_id) {
      toast.error('Veuillez sélectionner un client')
      return
    }

    const hasItems = sections.some(s => s.items.length > 0)
    if (!hasItems) {
      toast.error('Veuillez ajouter au moins un produit')
      return
    }

    const quotationData = {
      ...formData,
      sections,
      totals
    }

    onSave(quotationData)
    toast.success('Devis enregistré avec succès')
    onClose()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const filteredProducts = mockProducts.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header with summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{formData.quotation_number}</h2>
            <p className="text-sm text-gray-600 mt-1">
              Créé le {new Date(formData.date).toLocaleDateString('fr-FR')}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-indigo-600">
              {formatCurrency(totals.total)}
            </div>
            <p className="text-sm text-gray-600">Total TTC</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="items" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="client">
            <User className="mr-2 h-4 w-4" />
            Client
          </TabsTrigger>
          <TabsTrigger value="items">
            <Package className="mr-2 h-4 w-4" />
            Articles
          </TabsTrigger>
          <TabsTrigger value="pricing">
            <Calculator className="mr-2 h-4 w-4" />
            Tarification
          </TabsTrigger>
          <TabsTrigger value="conditions">
            <Settings className="mr-2 h-4 w-4" />
            Conditions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="client" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Informations client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contact">Client *</Label>
                <Select
                  value={formData.contact_id}
                  onValueChange={handleContactChange}
                >
                  <SelectTrigger>
                    <User className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockContacts.map(contact => (
                      <SelectItem key={contact.id} value={contact.id}>
                        <div className="flex items-center gap-2">
                          {contact.type === 'company' ?
                            <Building2 className="h-4 w-4" /> :
                            <User className="h-4 w-4" />
                          }
                          <span>{contact.name}</span>
                          <span className="text-muted-foreground">- {contact.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.contact_details && (
                <Card className="bg-gray-50">
                  <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{formData.contact_details.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{formData.contact_details.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 md:col-span-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{formData.contact_details.address}</span>
                      </div>
                      {formData.contact_details.tax_id && (
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">TVA: {formData.contact_details.tax_id}</span>
                        </div>
                      )}
                      {formData.contact_details.discount_rate > 0 && (
                        <div className="flex items-center gap-2">
                          <Percent className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600 font-medium">
                            Remise client: {formData.contact_details.discount_rate}%
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="delivery_address">Adresse de livraison</Label>
                  <textarea
                    id="delivery_address"
                    className="w-full px-3 py-2 border rounded-md min-h-[80px]"
                    placeholder="Si différente de l'adresse du client..."
                    value={formData.delivery_address}
                    onChange={(e) => setFormData({...formData, delivery_address: e.target.value})}
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="installation"
                      checked={formData.installation_included}
                      onCheckedChange={(checked) =>
                        setFormData({...formData, installation_included: checked})
                      }
                    />
                    <Label htmlFor="installation">
                      Installation incluse
                    </Label>
                  </div>
                  {formData.installation_included && (
                    <div className="space-y-2">
                      <Label htmlFor="installation_cost">Coût installation (€)</Label>
                      <Input
                        id="installation_cost"
                        type="number"
                        step="0.01"
                        value={formData.installation_cost}
                        onChange={(e) =>
                          setFormData({...formData, installation_cost: parseFloat(e.target.value) || 0})
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="space-y-4 mt-4">
          {sections.map((section, sectionIndex) => (
            <Card key={section.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSections(sections.map(s =>
                        s.id === section.id ? {...s, collapsed: !s.collapsed} : s
                      ))}
                    >
                      {section.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </Button>
                    <Input
                      value={section.title}
                      onChange={(e) => setSections(sections.map(s =>
                        s.id === section.id ? {...s, title: e.target.value} : s
                      ))}
                      className="font-semibold max-w-xs"
                    />
                    <Badge variant="secondary">{section.items.length} article(s)</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedSectionId(section.id)
                        setShowProductDialog(true)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter
                    </Button>
                    {sections.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteSection(section.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {!section.collapsed && (
                <CardContent>
                  {section.items.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>Aucun article dans cette section</p>
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => {
                          setSelectedSectionId(section.id)
                          setShowProductDialog(true)
                        }}
                      >
                        Ajouter un article
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {section.items.map((item) => (
                        <Card key={item.id} className="overflow-hidden">
                          <div className="p-4">
                            <div className="flex gap-4">
                              {/* Product Image */}
                              {item.image_url && (
                                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                                  <Image className="h-8 w-8 text-gray-400" />
                                </div>
                              )}

                              {/* Product Details */}
                              <div className="flex-1 space-y-3">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="font-semibold">{item.product_name}</h4>
                                    {item.product_sku && (
                                      <p className="text-sm text-gray-500">SKU: {item.product_sku}</p>
                                    )}
                                    {item.description && (
                                      <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                                    )}
                                  </div>

                                  {/* Stock Alert */}
                                  {item.stock_quantity !== undefined && item.stock_quantity < item.quantity && (
                                    <Badge variant="destructive" className="ml-2">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Stock insuffisant
                                    </Badge>
                                  )}
                                </div>

                                {/* Materials */}
                                {item.is_customizable && item.materials && item.materials.length > 0 && (
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium flex items-center gap-1">
                                        <Layers className="h-4 w-4" />
                                        Matériaux et finitions
                                      </span>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingItem(item)
                                          setShowMaterialDialog(true)
                                        }}
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    <div className="space-y-1">
                                      {item.materials.slice(0, 2).map((mat: any, idx: number) => (
                                        <div key={idx} className="text-xs text-gray-600">
                                          • {mat.materialName} - {mat.finishName}
                                          {mat.extraCost > 0 && (
                                            <span className="text-green-600 ml-1">
                                              (+{formatCurrency(mat.extraCost)})
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                      {item.materials.length > 2 && (
                                        <div className="text-xs text-gray-500">
                                          +{item.materials.length - 2} autre(s)...
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Pricing Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                  <div>
                                    <Label className="text-xs">Quantité</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => handleUpdateLineItem(
                                        section.id,
                                        item.id,
                                        'quantity',
                                        parseInt(e.target.value) || 1
                                      )}
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Prix unit. (€)</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={item.unit_price}
                                      onChange={(e) => handleUpdateLineItem(
                                        section.id,
                                        item.id,
                                        'unit_price',
                                        parseFloat(e.target.value) || 0
                                      )}
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Remise</Label>
                                    <div className="flex gap-1">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={item.discount_value}
                                        onChange={(e) => handleUpdateLineItem(
                                          section.id,
                                          item.id,
                                          'discount_value',
                                          parseFloat(e.target.value) || 0
                                        )}
                                        className="h-8"
                                      />
                                      <Select
                                        value={item.discount_type}
                                        onValueChange={(value) => handleUpdateLineItem(
                                          section.id,
                                          item.id,
                                          'discount_type',
                                          value
                                        )}
                                      >
                                        <SelectTrigger className="h-8 w-16">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="percent">%</SelectItem>
                                          <SelectItem value="amount">€</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div>
                                    <Label className="text-xs">TVA (%)</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={item.tax_rate}
                                      onChange={(e) => handleUpdateLineItem(
                                        section.id,
                                        item.id,
                                        'tax_rate',
                                        parseFloat(e.target.value) || 0
                                      )}
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Total</Label>
                                    <div className="h-8 px-3 py-1 border rounded-md bg-gray-50 font-semibold">
                                      {formatCurrency(item.total)}
                                    </div>
                                  </div>
                                </div>

                                {/* Notes */}
                                {item.notes && (
                                  <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                                    <p className="text-xs text-yellow-800">
                                      <Info className="h-3 w-3 inline mr-1" />
                                      {item.notes}
                                    </p>
                                  </div>
                                )}

                                {/* Actions */}
                                <div className="flex justify-end gap-2 pt-2 border-t">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDuplicateLineItem(section.id, item)}
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    Dupliquer
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteLineItem(section.id, item.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Supprimer
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={handleAddSection}
            className="w-full"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Ajouter une section
          </Button>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres de tarification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Remise globale</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.global_discount_value}
                      onChange={(e) => setFormData({
                        ...formData,
                        global_discount_value: parseFloat(e.target.value) || 0
                      })}
                    />
                    <Select
                      value={formData.global_discount_type}
                      onValueChange={(value) => setFormData({
                        ...formData,
                        global_discount_type: value as 'percent' | 'amount'
                      })}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="amount">€</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shipping">Frais de livraison (€)</Label>
                  <Input
                    id="shipping"
                    type="number"
                    step="0.01"
                    value={formData.shipping_cost}
                    onChange={(e) => setFormData({
                      ...formData,
                      shipping_cost: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_rate">Taux de TVA (%)</Label>
                  <Select
                    value={formData.tax_rate.toString()}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      tax_rate: parseFloat(value)
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0% (Exonéré)</SelectItem>
                      <SelectItem value="5.5">5.5% (Taux réduit)</SelectItem>
                      <SelectItem value="10">10% (Taux intermédiaire)</SelectItem>
                      <SelectItem value="20">20% (Taux normal)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="include_tax"
                      checked={formData.include_tax}
                      onCheckedChange={(checked) =>
                        setFormData({...formData, include_tax: checked})
                      }
                    />
                    <Label htmlFor="include_tax">
                      Inclure la TVA dans le total
                    </Label>
                  </div>
                </div>
              </div>

              {/* Total Breakdown */}
              <Card className="bg-gray-50">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Sous-total articles</span>
                      <span className="font-medium">{formatCurrency(totals.items_subtotal)}</span>
                    </div>
                    {totals.global_discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Remise globale</span>
                        <span>-{formatCurrency(totals.global_discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Sous-total après remise</span>
                      <span>{formatCurrency(totals.subtotal_after_discount)}</span>
                    </div>
                    {totals.shipping > 0 && (
                      <div className="flex justify-between">
                        <span>Livraison</span>
                        <span>{formatCurrency(totals.shipping)}</span>
                      </div>
                    )}
                    {totals.installation > 0 && (
                      <div className="flex justify-between">
                        <span>Installation</span>
                        <span>{formatCurrency(totals.installation)}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t">
                      <div className="flex justify-between">
                        <span>Total HT</span>
                        <span className="font-medium">{formatCurrency(totals.subtotal_before_tax)}</span>
                      </div>
                    </div>
                    {formData.include_tax && (
                      <div className="flex justify-between">
                        <span>TVA ({formData.tax_rate}%)</span>
                        <span>{formatCurrency(totals.tax)}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total {formData.include_tax ? 'TTC' : 'HT'}</span>
                        <span className="text-indigo-600">{formatCurrency(totals.total)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conditions" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Conditions et informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="payment_terms">Conditions de paiement</Label>
                  <Select
                    value={formData.payment_terms}
                    onValueChange={(value) => setFormData({...formData, payment_terms: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Comptant</SelectItem>
                      <SelectItem value="30">30 jours</SelectItem>
                      <SelectItem value="45">45 jours</SelectItem>
                      <SelectItem value="60">60 jours</SelectItem>
                      <SelectItem value="30_60">30% à la commande, solde à 60 jours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery_time">Délai de livraison</Label>
                  <Select
                    value={formData.delivery_time}
                    onValueChange={(value) => setFormData({...formData, delivery_time: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stock">En stock - 48h</SelectItem>
                      <SelectItem value="1-2">1-2 semaines</SelectItem>
                      <SelectItem value="2-4">2-4 semaines</SelectItem>
                      <SelectItem value="4-6">4-6 semaines</SelectItem>
                      <SelectItem value="6-8">6-8 semaines</SelectItem>
                      <SelectItem value="custom">Sur mesure - à définir</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes client (visibles sur le devis)</Label>
                <textarea
                  id="notes"
                  className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                  placeholder="Informations complémentaires pour le client..."
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="internal_notes">Notes internes (non visibles)</Label>
                <textarea
                  id="internal_notes"
                  className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                  placeholder="Notes internes pour l'équipe..."
                  value={formData.internal_notes}
                  onChange={(e) => setFormData({...formData, internal_notes: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="terms">Conditions générales de vente</Label>
                <textarea
                  id="terms"
                  className="w-full px-3 py-2 border rounded-md min-h-[150px]"
                  value={formData.terms_conditions}
                  onChange={(e) => setFormData({...formData, terms_conditions: e.target.value})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <Button type="button" variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <div className="flex gap-2">
          <Button type="submit" variant="outline">
            <Save className="h-4 w-4 mr-2" />
            Enregistrer comme brouillon
          </Button>
          <Button type="submit">
            <Send className="h-4 w-4 mr-2" />
            Enregistrer et envoyer
          </Button>
        </div>
      </div>

      {/* Product Selection Dialog */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Ajouter un article</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="catalog" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="catalog">Depuis le catalogue</TabsTrigger>
              <TabsTrigger value="custom">Article personnalisé</TabsTrigger>
            </TabsList>

            <TabsContent value="catalog" className="mt-4">
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher un produit..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                  {filteredProducts.map((product) => (
                    <Card
                      key={product.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleAddProduct(product)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-3">
                            <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                              <Image className="h-8 w-8 text-gray-400" />
                            </div>
                            <div>
                              <h4 className="font-semibold">{product.name}</h4>
                              <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                              <div className="flex items-center gap-4 mt-2">
                                <span className="font-medium">{formatCurrency(product.price)}</span>
                                {product.stock_quantity > 0 ? (
                                  <Badge variant="success">En stock ({product.stock_quantity})</Badge>
                                ) : (
                                  <Badge variant="warning">Sur commande</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button size="sm">
                            <Plus className="h-4 w-4 mr-1" />
                            Ajouter
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="custom" className="mt-4">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nom de l'article *</Label>
                    <Input
                      id="custom-name"
                      placeholder="Ex: Table sur mesure"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prix unitaire (€) *</Label>
                    <Input
                      id="custom-price"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantité</Label>
                    <Input
                      id="custom-quantity"
                      type="number"
                      min="1"
                      defaultValue="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Délai de fabrication</Label>
                    <Input
                      id="custom-lead-time"
                      placeholder="Ex: 4 semaines"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    id="custom-description"
                    className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                    placeholder="Description détaillée de l'article..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <textarea
                    id="custom-notes"
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Notes additionnelles..."
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      const name = (document.getElementById('custom-name') as HTMLInputElement)?.value
                      const price = parseFloat((document.getElementById('custom-price') as HTMLInputElement)?.value) || 0
                      const quantity = parseInt((document.getElementById('custom-quantity') as HTMLInputElement)?.value) || 1
                      const description = (document.getElementById('custom-description') as HTMLTextAreaElement)?.value
                      const notes = (document.getElementById('custom-notes') as HTMLTextAreaElement)?.value

                      if (name && price > 0) {
                        handleAddCustomProduct({
                          name,
                          price,
                          quantity,
                          description,
                          notes
                        })
                      } else {
                        toast.error('Veuillez remplir les champs obligatoires')
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter l'article
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </form>
  )
}