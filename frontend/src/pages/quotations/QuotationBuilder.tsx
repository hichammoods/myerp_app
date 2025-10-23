import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  Search
} from 'lucide-react'

interface QuotationBuilderProps {
  quotation?: any
  onSave: (data: any) => void
  onClose: () => void
}

interface LineItem {
  id: string
  product_id: string
  product_name: string
  description: string
  quantity: number
  unit_price: number
  discount_percent: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  total: number
}

interface Section {
  id: string
  title: string
  items: LineItem[]
}

export function QuotationBuilder({ quotation, onSave, onClose }: QuotationBuilderProps) {
  const [formData, setFormData] = useState({
    quotation_number: quotation?.quotation_number || generateQuotationNumber(),
    date: quotation?.date || new Date().toISOString().split('T')[0],
    validity_date: quotation?.validity_date || getDefaultValidityDate(),
    contact_id: quotation?.contact_id || '',
    contact_name: quotation?.contact_name || '',
    status: quotation?.status || 'draft',
    payment_terms: quotation?.payment_terms || '30',
    delivery_time: quotation?.delivery_time || '2-4 semaines',
    notes: quotation?.notes || '',
    internal_notes: quotation?.internal_notes || '',
    terms_conditions: quotation?.terms_conditions || getDefaultTerms()
  })

  const [sections, setSections] = useState<Section[]>(
    quotation?.sections || [{
      id: '1',
      title: 'Mobilier',
      items: []
    }]
  )

  const [totals, setTotals] = useState({
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0
  })

  const [showProductSearch, setShowProductSearch] = useState(false)
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')

  // Mock contacts for demo
  const contacts = [
    { id: '1', name: 'Meubles Modernes SARL', email: 'contact@meublesmodernes.fr' },
    { id: '2', name: 'Design Intérieur Pro', email: 'marie@designinterieur.fr' },
    { id: '3', name: 'Hôtel Luxe Palace', email: 'sleroy@luxepalace.com' }
  ]

  // Mock products for demo
  const products = [
    { id: '1', name: 'Canapé 3 places Confort', sku: 'CNP-001', price: 1500 },
    { id: '2', name: 'Table à manger extensible', sku: 'TAB-002', price: 1200 },
    { id: '3', name: 'Chaise design', sku: 'CHA-003', price: 250 },
    { id: '4', name: 'Lit double moderne', sku: 'LIT-004', price: 2000 },
    { id: '5', name: 'Armoire 3 portes', sku: 'ARM-005', price: 1800 },
    { id: '6', name: 'Bureau professionnel', sku: 'BUR-006', price: 850 },
    { id: '7', name: 'Fauteuil cuir', sku: 'FAU-007', price: 750 },
    { id: '8', name: 'Table basse design', sku: 'TBB-008', price: 450 },
    { id: '9', name: 'Étagère modulable', sku: 'ETA-009', price: 320 },
    { id: '10', name: 'Commode 6 tiroirs', sku: 'COM-010', price: 680 },
    { id: '11', name: 'Banquette d\'entrée', sku: 'BAN-011', price: 280 },
    { id: '12', name: 'Miroir décoratif', sku: 'MIR-012', price: 150 }
  ]

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
• Validité du devis: 30 jours
• Acompte de 30% à la commande
• Solde à la livraison
• Livraison comprise en France métropolitaine
• Garantie 2 ans pièces et main d'œuvre`
  }

  useEffect(() => {
    calculateTotals()
  }, [sections])

  const calculateTotals = () => {
    let subtotal = 0
    let totalDiscount = 0
    let totalTax = 0

    sections.forEach(section => {
      section.items.forEach(item => {
        const itemSubtotal = item.quantity * item.unit_price
        const discountAmount = itemSubtotal * (item.discount_percent / 100)
        const taxableAmount = itemSubtotal - discountAmount
        const taxAmount = taxableAmount * (item.tax_rate / 100)

        subtotal += itemSubtotal
        totalDiscount += discountAmount
        totalTax += taxAmount
      })
    })

    setTotals({
      subtotal,
      discount: totalDiscount,
      tax: totalTax,
      total: subtotal - totalDiscount + totalTax
    })
  }

  const handleAddSection = () => {
    const newSection: Section = {
      id: Date.now().toString(),
      title: 'Nouvelle section',
      items: []
    }
    setSections([...sections, newSection])
  }

  const handleUpdateSectionTitle = (sectionId: string, title: string) => {
    setSections(sections.map(s =>
      s.id === sectionId ? { ...s, title } : s
    ))
  }

  const handleDeleteSection = (sectionId: string) => {
    if (sections.length === 1) {
      toast.error('Vous devez avoir au moins une section')
      return
    }
    setSections(sections.filter(s => s.id !== sectionId))
  }

  const handleAddProduct = (sectionId: string, product: any) => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      product_id: product.id,
      product_name: product.name,
      description: '',
      quantity: 1,
      unit_price: product.price,
      discount_percent: 0,
      discount_amount: 0,
      tax_rate: 20,
      tax_amount: product.price * 0.2,
      total: product.price * 1.2
    }

    setSections(sections.map(section =>
      section.id === sectionId
        ? { ...section, items: [...section.items, newItem] }
        : section
    ))
    setShowProductSearch(false)
  }

  const handleUpdateLineItem = (sectionId: string, itemId: string, field: string, value: any) => {
    setSections(sections.map(section => {
      if (section.id !== sectionId) return section

      return {
        ...section,
        items: section.items.map(item => {
          if (item.id !== itemId) return item

          const updatedItem = { ...item, [field]: value }

          // Recalculate amounts
          const subtotal = updatedItem.quantity * updatedItem.unit_price
          updatedItem.discount_amount = subtotal * (updatedItem.discount_percent / 100)
          const taxableAmount = subtotal - updatedItem.discount_amount
          updatedItem.tax_amount = taxableAmount * (updatedItem.tax_rate / 100)
          updatedItem.total = taxableAmount + updatedItem.tax_amount

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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">
            <FileText className="mr-2 h-4 w-4" />
            Détails
          </TabsTrigger>
          <TabsTrigger value="items">
            <Package className="mr-2 h-4 w-4" />
            Articles
          </TabsTrigger>
          <TabsTrigger value="conditions">
            <Settings className="mr-2 h-4 w-4" />
            Conditions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Informations du devis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quotation_number">Numéro de devis</Label>
                  <Input
                    id="quotation_number"
                    value={formData.quotation_number}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Statut</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({...formData, status: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="sent">Envoyé</SelectItem>
                      <SelectItem value="accepted">Accepté</SelectItem>
                      <SelectItem value="rejected">Refusé</SelectItem>
                      <SelectItem value="expired">Expiré</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date">Date du devis</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="validity_date">Date de validité</Label>
                  <Input
                    id="validity_date"
                    type="date"
                    value={formData.validity_date}
                    onChange={(e) => setFormData({...formData, validity_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Client *</Label>
                <Select
                  value={formData.contact_id}
                  onValueChange={(value) => {
                    const contact = contacts.find(c => c.id === value)
                    setFormData({
                      ...formData,
                      contact_id: value,
                      contact_name: contact?.name || ''
                    })
                  }}
                >
                  <SelectTrigger>
                    <User className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map(contact => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name} - {contact.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                      <SelectItem value="custom">Personnalisé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delivery_time">Délai de livraison</Label>
                  <Input
                    id="delivery_time"
                    value={formData.delivery_time}
                    onChange={(e) => setFormData({...formData, delivery_time: e.target.value})}
                    placeholder="2-4 semaines"
                  />
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
                  <Input
                    value={section.title}
                    onChange={(e) => handleUpdateSectionTitle(section.id, e.target.value)}
                    className="text-lg font-semibold border-none focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSectionId(section.id)
                        setShowProductSearch(true)
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter article
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSection(section.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {section.items.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Aucun article dans cette section
                  </div>
                ) : (
                  <div className="space-y-4">
                    {section.items.map(item => (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="grid gap-4 md:grid-cols-12">
                          <div className="md:col-span-4 space-y-2">
                            <Label>Produit</Label>
                            <div className="flex items-center gap-2">
                              <div className="font-medium">{item.product_name}</div>
                              {item.product_id?.startsWith('custom-') && (
                                <Badge variant="secondary" className="text-xs">
                                  Personnalisé
                                </Badge>
                              )}
                            </div>
                            <Input
                              placeholder="Description..."
                              value={item.description}
                              onChange={(e) => handleUpdateLineItem(section.id, item.id, 'description', e.target.value)}
                            />
                          </div>
                          <div className="md:col-span-1 space-y-2">
                            <Label>Qté</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateLineItem(section.id, item.id, 'quantity', parseInt(e.target.value) || 1)}
                            />
                          </div>
                          <div className="md:col-span-2 space-y-2">
                            <Label>Prix unit. HT</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => handleUpdateLineItem(section.id, item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="md:col-span-1 space-y-2">
                            <Label>Remise %</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discount_percent}
                              onChange={(e) => handleUpdateLineItem(section.id, item.id, 'discount_percent', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="md:col-span-1 space-y-2">
                            <Label>TVA %</Label>
                            <Select
                              value={item.tax_rate.toString()}
                              onValueChange={(value) => handleUpdateLineItem(section.id, item.id, 'tax_rate', parseFloat(value))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">0%</SelectItem>
                                <SelectItem value="5.5">5.5%</SelectItem>
                                <SelectItem value="10">10%</SelectItem>
                                <SelectItem value="20">20%</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="md:col-span-2 space-y-2">
                            <Label>Total TTC</Label>
                            <div className="h-10 px-3 py-2 bg-gray-50 rounded-md font-medium">
                              {formatCurrency(item.total)}
                            </div>
                          </div>
                          <div className="md:col-span-1 flex items-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDuplicateLineItem(section.id, item)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteLineItem(section.id, item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <Button type="button" variant="outline" onClick={handleAddSection} className="w-full">
            <PlusCircle className="mr-2 h-4 w-4" />
            Ajouter une section
          </Button>

          {/* Totals */}
          <Card>
            <CardHeader>
              <CardTitle>Récapitulatif</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Sous-total HT</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Remise</span>
                  <span>-{formatCurrency(totals.discount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>TVA</span>
                  <span>{formatCurrency(totals.tax)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-lg">
                  <span>Total TTC</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conditions" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notes et conditions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes visibles sur le devis</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                  placeholder="Notes pour le client..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="internal_notes">Notes internes (non visibles)</Label>
                <textarea
                  id="internal_notes"
                  value={formData.internal_notes}
                  onChange={(e) => setFormData({...formData, internal_notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                  placeholder="Notes internes..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="terms_conditions">Conditions générales</Label>
                <textarea
                  id="terms_conditions"
                  value={formData.terms_conditions}
                  onChange={(e) => setFormData({...formData, terms_conditions: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md min-h-[200px]"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between gap-2 pt-4 border-t">
        <div className="flex gap-2">
          <Button type="button" variant="outline">
            <Copy className="mr-2 h-4 w-4" />
            Dupliquer
          </Button>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit">
            <Save className="mr-2 h-4 w-4" />
            Enregistrer
          </Button>
          <Button type="button" variant="default">
            <Send className="mr-2 h-4 w-4" />
            Enregistrer et envoyer
          </Button>
        </div>
      </div>

      {/* Product Search Dialog */}
      {showProductSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-3xl">
            <CardHeader>
              <CardTitle>Ajouter un article</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="catalog" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="catalog">
                    <Package className="mr-2 h-4 w-4" />
                    Depuis le catalogue
                  </TabsTrigger>
                  <TabsTrigger value="custom">
                    <Plus className="mr-2 h-4 w-4" />
                    Article personnalisé
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="catalog" className="space-y-4 mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input placeholder="Rechercher un produit dans le catalogue..." className="pl-10" />
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {products.map(product => (
                      <div
                        key={product.id}
                        className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                        onClick={() => handleAddProduct(selectedSectionId, product)}
                      >
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                        </div>
                        <div className="font-bold">{formatCurrency(product.price)}</div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="custom" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        💡 Créez un article personnalisé pour ce devis uniquement.
                        Cet article ne sera pas ajouté au catalogue produits.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custom-name">Nom de l'article *</Label>
                      <Input
                        id="custom-name"
                        placeholder="Ex: Canapé sur mesure 4 places"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const input = e.currentTarget
                            const skuInput = document.getElementById('custom-sku') as HTMLInputElement
                            const priceInput = document.getElementById('custom-price') as HTMLInputElement

                            if (input.value && priceInput?.value) {
                              const customProduct = {
                                id: 'custom-' + Date.now(),
                                name: input.value,
                                sku: skuInput?.value || 'CUSTOM',
                                price: parseFloat(priceInput.value) || 0,
                                is_custom: true
                              }
                              handleAddProduct(selectedSectionId, customProduct)
                              input.value = ''
                              skuInput.value = ''
                              priceInput.value = ''
                            }
                          }
                        }}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="custom-sku">Référence (optionnel)</Label>
                        <Input
                          id="custom-sku"
                          placeholder="Ex: CUSTOM-001"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="custom-price">Prix unitaire HT *</Label>
                        <Input
                          id="custom-price"
                          type="number"
                          step="0.01"
                          placeholder="1500.00"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => {
                        const nameInput = document.getElementById('custom-name') as HTMLInputElement
                        const skuInput = document.getElementById('custom-sku') as HTMLInputElement
                        const priceInput = document.getElementById('custom-price') as HTMLInputElement

                        if (!nameInput?.value) {
                          toast.error('Veuillez saisir un nom pour l\'article')
                          return
                        }

                        if (!priceInput?.value) {
                          toast.error('Veuillez saisir un prix pour l\'article')
                          return
                        }

                        const customProduct = {
                          id: 'custom-' + Date.now(),
                          name: nameInput.value,
                          sku: skuInput?.value || 'CUSTOM',
                          price: parseFloat(priceInput.value) || 0,
                          is_custom: true
                        }

                        handleAddProduct(selectedSectionId, customProduct)
                        nameInput.value = ''
                        skuInput.value = ''
                        priceInput.value = ''
                      }}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Ajouter l'article personnalisé
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-4 flex justify-end">
                <Button variant="outline" onClick={() => setShowProductSearch(false)}>
                  Fermer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </form>
  )
}