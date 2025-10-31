import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { contactsApi, productsApi, settingsApi } from '@/services/api'
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

// Helper function to get product's main image URL
const getProductImageUrl = (product: any): string | null => {
  if (!product.images || !Array.isArray(product.images) || product.images.length === 0) {
    return null
  }

  // Find the main image or use the first one
  const mainImage = product.images.find((img: any) => img.is_main) || product.images[0]

  if (!mainImage || !mainImage.url) {
    return null
  }

  // Return the MinIO URL
  return mainImage.url
}

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
  product_id?: string
  product_name: string
  product_sku?: string
  description: string
  quantity: number
  unit_price: number
  discount_percent: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  line_total: number
  cost_price?: number
  notes?: string
  is_optional?: boolean
  stock_quantity?: number // Available stock for the product
  image_url?: string // Product image URL from MinIO
}

interface Section {
  id: string
  title: string
  items: LineItem[]
  collapsed: boolean
}

export function EnhancedQuotationBuilder({ quotation, onSave, onClose }: QuotationBuilderProps) {
  // Fetch contacts from API
  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsApi.getAll({ limit: 100 })
  })

  // Fetch products from API
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getAll({ limit: 100 })
  })

  // Fetch company settings for default CGV
  const { data: companySettingsData } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => settingsApi.getCompany()
  })

  const contacts = contactsData?.contacts || []
  const products = productsData || []
  const companySettings = companySettingsData?.company || null
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
    tax_rate: quotation?.tax_rate ?? 20,
    include_tax: quotation?.include_tax ?? false  // Default to FALSE - will be set to TRUE when contact type is company
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
    // Use default CGV from company settings if available, otherwise fall back to hardcoded default
    if (companySettings?.default_cgv) {
      return companySettings.default_cgv
    }

    // Fallback to hardcoded default
    return `Conditions générales de vente:
• Validité du devis : 30 jours
• Acompte de 30% à la commande
• Solde à la livraison
• Livraison comprise en France métropolitaine (hors Corse et DOM-TOM)
• Garantie 2 ans pièces et main d'œuvre
• Les délais de livraison sont donnés à titre indicatif
• Tout devis signé vaut bon de commande`
  }

  // Initialize sections from quotation line_items when editing
  useEffect(() => {
    if (quotation?.line_items && Array.isArray(quotation.line_items) && quotation.line_items.length > 0 && products.length > 0) {
      // Transform flat line_items into sections structure
      // Match with current products to get fresh stock quantities
      const items = quotation.line_items.map((item: any) => {
        const currentProduct = products.find((p: any) => p.id === item.product_id)
        return {
          id: item.id || Date.now().toString() + Math.random(),
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku || '',
          description: item.description || '',
          quantity: parseFloat(item.quantity) || 1,
          unit_price: parseFloat(item.unit_price) || 0,
          discount_percent: parseFloat(item.discount_percent) || 0,
          discount_amount: parseFloat(item.discount_amount) || 0,
          tax_rate: item.tax_rate != null ? parseFloat(item.tax_rate) : 0,  // FIX: Don't default to 20, preserve 0
          tax_amount: parseFloat(item.tax_amount) || 0,
          line_total: parseFloat(item.line_total) || 0,
          cost_price: parseFloat(item.cost_price) || 0,
          notes: item.notes || '',
          is_optional: item.is_optional || false,
          stock_quantity: currentProduct?.stockQuantity || 0,  // Get fresh stock from products
          image_url: currentProduct ? getProductImageUrl(currentProduct) : undefined // Get image from product
        }
      })

      setSections([{
        id: '1',
        title: 'Mobilier',
        items: items,
        collapsed: false
      }])
    }
  }, [quotation, products])

  // Update formData when quotation prop changes (when editing existing quotation)
  useEffect(() => {
    if (quotation && contacts.length > 0) {
      // Find the contact from the contacts list to populate contact_details
      const contact = contacts.find((c: any) => c.id === quotation.contact_id)

      let contactDetails = null
      if (contact) {
        const contactName = contact.company_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
        const contactAddress = [
          contact.address_street,
          contact.address_city,
          contact.address_zip
        ].filter(Boolean).join(', ')

        contactDetails = {
          name: contactName,
          email: contact.email,
          phone: contact.phone || contact.mobile,
          address: contactAddress,
          tax_id: contact.tax_id || '',
          payment_terms: contact.payment_terms?.toString() || '30',
          discount_rate: contact.discount_rate || 0,
          type: contact.customer_type || 'individual'
        }
      }

      setFormData({
        quotation_number: quotation.quotation_number || generateQuotationNumber(),
        date: quotation.created_at ? quotation.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
        validity_date: quotation.expiration_date || getDefaultValidityDate(),
        contact_id: quotation.contact_id || '',
        contact_name: quotation.contact_name || '',
        contact_details: contactDetails,
        status: quotation.status || 'draft',
        payment_terms: quotation.payment_terms || '30',
        delivery_time: quotation.delivery_terms || '2-4 semaines',
        delivery_address: quotation.delivery_address || '',
        installation_included: quotation.installation_included || quotation.shipping_method === 'installation' || (quotation.installation_cost && quotation.installation_cost > 0) || false,  // FIX: Check installation_cost too
        notes: quotation.notes || '',
        internal_notes: quotation.internal_notes || '',
        terms_conditions: quotation.terms_conditions || getDefaultTerms(),
        global_discount_type: quotation.discount_percent > 0 ? 'percent' : 'percent',
        global_discount_value: quotation.discount_percent || 0,
        shipping_cost: quotation.shipping_cost || 0,
        installation_cost: quotation.installation_cost || 0,
        tax_rate: quotation.tax_rate != null ? quotation.tax_rate : (contactDetails?.type === 'individual' ? 0 : 20),  // Preserve tax_rate from quotation
        include_tax: quotation.include_tax != null ? quotation.include_tax : (contactDetails?.type === 'company')  // Default based on contact type
      })
    }
  }, [quotation, contacts])

  // Update terms_conditions when company settings are loaded (for new quotations)
  useEffect(() => {
    if (!quotation && companySettings?.default_cgv) {
      // Only update if still using the hardcoded default (user hasn't edited it)
      const hardcodedDefault = `Conditions générales de vente:
• Validité du devis : 30 jours
• Acompte de 30% à la commande
• Solde à la livraison
• Livraison comprise en France métropolitaine (hors Corse et DOM-TOM)
• Garantie 2 ans pièces et main d'œuvre
• Les délais de livraison sont donnés à titre indicatif
• Tout devis signé vaut bon de commande`

      if (formData.terms_conditions === hardcodedDefault) {
        setFormData(prev => ({
          ...prev,
          terms_conditions: companySettings.default_cgv
        }))
      }
    }
  }, [companySettings, quotation])

  useEffect(() => {
    calculateTotals()
  }, [sections, formData.global_discount_type, formData.global_discount_value,
      formData.shipping_cost, formData.installation_cost, formData.tax_rate, formData.include_tax])

  const calculateTotals = () => {
    let items_subtotal = 0  // Sum of line_totals (after line discounts)

    sections.forEach(section => {
      section.items.forEach(item => {
        items_subtotal += item.line_total || 0
      })
    })

    // Calculate global discount (on discounted subtotal)
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
    // Use totalPrice (includes finish costs) from catalog, fallback to basePrice or unit_price
    const unitPrice = parseFloat(product.totalPrice || product.basePrice || product.unit_price) || 0
    // Set tax rate based on contact type: 0% for individuals, 20% for companies
    const defaultTaxRate = formData.contact_details?.type === 'individual' ? 0 : 20
    const newItem: LineItem = {
      id: Date.now().toString(),
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku || '',
      description: product.description || '',
      quantity: 1,
      unit_price: unitPrice,
      discount_percent: formData.contact_details?.discount_rate || 0,
      discount_amount: 0,
      tax_rate: defaultTaxRate,
      tax_amount: 0,
      line_total: unitPrice,
      cost_price: product.costPrice || product.cost_price || 0,
      notes: '',
      is_optional: false,
      stock_quantity: product.stockQuantity || 0,
      image_url: getProductImageUrl(product) || undefined
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
    const unitPrice = parseFloat(data.price) || 0
    const newItem: LineItem = {
      id: Date.now().toString(),
      product_name: data.name,
      product_sku: '',
      description: data.description || '',
      quantity: data.quantity || 1,
      unit_price: unitPrice,
      discount_percent: 0,
      discount_amount: 0,
      tax_rate: 20,
      tax_amount: 0,
      line_total: unitPrice * (data.quantity || 1),
      notes: data.notes || '',
      is_optional: false
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
    const quantity = parseFloat(item.quantity as any) || 0
    const unitPrice = parseFloat(item.unit_price as any) || 0
    const discountPercent = parseFloat(item.discount_percent as any) || 0
    const taxRate = parseFloat(item.tax_rate as any) || 0

    const baseTotal = quantity * unitPrice

    // Calculate discount amount from percentage
    item.discount_amount = baseTotal * (discountPercent / 100)

    const subtotal = baseTotal - item.discount_amount

    // Store tax rate for reference but don't apply to line_total
    // Line items should be HT (before tax), tax is applied at quotation level
    item.tax_amount = subtotal * (taxRate / 100)
    item.line_total = subtotal  // HT total (before tax)
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
    const contact = contacts.find((c: any) => c.id === contactId)
    if (contact) {
      const contactName = contact.company_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
      const contactAddress = [
        contact.address_street,
        contact.address_city,
        contact.address_zip
      ].filter(Boolean).join(', ')

      const contactType = contact.customer_type || 'individual'
      // Set tax rate and include_tax based on contact type
      const defaultTaxRate = contactType === 'individual' ? 0 : 20
      const defaultIncludeTax = contactType === 'company'  // Only companies have VAT enabled by default

      setFormData({
        ...formData,
        contact_id: contactId,
        contact_name: contactName,
        contact_details: {
          name: contactName,
          email: contact.email,
          phone: contact.phone || contact.mobile,
          address: contactAddress,
          tax_id: contact.tax_id || '',
          payment_terms: contact.payment_terms?.toString() || '30',
          discount_rate: contact.discount_rate || 0,
          type: contactType
        },
        payment_terms: contact.payment_terms?.toString() || '30',
        delivery_address: contactAddress,
        tax_rate: defaultTaxRate,
        include_tax: defaultIncludeTax  // Set include_tax based on contact type
      })

      // Apply contact discount and tax rate to all items
      setSections(sections.map(section => ({
        ...section,
        items: section.items.map(item => {
          const updatedItem = {
            ...item,
            discount_percent: contact.discount_rate || item.discount_percent,
            tax_rate: defaultTaxRate
          }
          recalculateLineItem(updatedItem)
          return updatedItem
        })
      })))
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

    // Transform frontend data structure to match backend API expectations
    // Flatten sections into line_items array
    const line_items = sections.flatMap(section =>
      section.items.map(item => ({
        product_id: item.product_id || null,
        product_name: item.product_name,
        product_sku: item.product_sku || '',
        description: item.description || '',
        quantity: parseFloat(item.quantity) || 0,
        unit_price: parseFloat(item.unit_price) || 0,
        discount_percent: parseFloat(item.discount_percent) || 0,
        discount_amount: parseFloat(item.discount_amount) || 0,
        tax_rate: parseFloat(item.tax_rate) || 0,
        tax_amount: parseFloat(item.tax_amount) || 0,
        line_total: parseFloat(item.line_total) || 0,
        notes: item.notes || null
      }))
    )

    // Calculate validity_days from validity_date
    const validityDate = new Date(formData.validity_date)
    const today = new Date()
    const validity_days = Math.ceil((validityDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    // Build API payload matching backend schema
    const quotationData = {
      contact_id: formData.contact_id,
      expiration_date: formData.validity_date,
      delivery_date: null, // Future: can add actual delivery date picker
      delivery_address: formData.delivery_address,
      payment_terms: formData.payment_terms,
      delivery_terms: formData.delivery_time, // "2-4 semaines" text
      shipping_method: formData.installation_included ? 'installation' : 'standard',
      installation_included: formData.installation_included,
      validity_days: validity_days > 0 ? validity_days : 30,
      line_items,
      discount_type: formData.global_discount_type,
      discount_value: formData.global_discount_value,
      shipping_cost: formData.shipping_cost,
      installation_cost: formData.installation_cost,
      tax_rate: formData.tax_rate,  // CRITICAL: Send global tax rate to backend
      include_tax: formData.include_tax,  // CRITICAL: Send include_tax flag to backend
      notes: formData.notes,
      internal_notes: formData.internal_notes,
      terms_conditions: formData.terms_conditions
    }

    // DEBUG: Log what's being sent
    console.log('Quotation Payload:', {
      shipping_cost: quotationData.shipping_cost,
      installation_cost: quotationData.installation_cost,
      installation_included: quotationData.installation_included,
      include_tax: quotationData.include_tax
    })

    onSave(quotationData)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  // Get stock issues for all items
  const getStockIssues = () => {
    const issues: { type: 'out' | 'low', item: LineItem }[] = []
    sections.forEach(section => {
      section.items.forEach(item => {
        if (item.product_id && item.stock_quantity !== undefined) {
          if (item.stock_quantity === 0) {
            issues.push({ type: 'out', item })
          } else if (item.stock_quantity < item.quantity) {
            issues.push({ type: 'low', item })
          }
        }
      })
    })
    return issues
  }

  const stockIssues = getStockIssues()

  const filteredProducts = products.filter((p: any) =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
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

      <Tabs defaultValue="client" className="w-full">
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
                    {contactsLoading ? (
                      <div className="p-2 text-sm text-gray-500">Chargement...</div>
                    ) : (
                      contacts.map((contact: any) => {
                        const displayName = contact.company_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                        return (
                          <SelectItem key={contact.id} value={contact.id}>
                            <div className="flex items-center gap-2">
                              {contact.customer_type === 'company' ?
                                <Building2 className="h-4 w-4" /> :
                                <User className="h-4 w-4" />
                              }
                              <span>{displayName}</span>
                              <span className="text-muted-foreground">- {contact.email}</span>
                            </div>
                          </SelectItem>
                        )
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>

              {formData.contact_details && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      Détails du contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500">Nom</span>
                          <span className="text-sm font-medium">{formData.contact_details.name}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Mail className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500">Email</span>
                          <span className="text-sm font-medium">{formData.contact_details.email}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Phone className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500">Téléphone</span>
                          <span className="text-sm font-medium">{formData.contact_details.phone || 'Non renseigné'}</span>
                        </div>
                      </div>
                      {formData.contact_details.type && (
                        <div className="flex items-start gap-2">
                          <Building2 className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">Type</span>
                            <span className="text-sm font-medium capitalize">
                              {formData.contact_details.type === 'company' ? 'Entreprise' : 'Particulier'}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-2 md:col-span-2">
                        <MapPin className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500">Adresse</span>
                          <span className="text-sm font-medium">{formData.contact_details.address || 'Non renseignée'}</span>
                        </div>
                      </div>
                      {formData.contact_details.tax_id && (
                        <div className="flex items-start gap-2">
                          <CreditCard className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">N° TVA</span>
                            <span className="text-sm font-medium">{formData.contact_details.tax_id}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <CreditCard className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500">Conditions de paiement</span>
                          <span className="text-sm font-medium">{formData.contact_details.payment_terms} jours</span>
                        </div>
                      </div>
                      {formData.contact_details.discount_rate > 0 && (
                        <div className="flex items-start gap-2 md:col-span-2">
                          <Percent className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">Remise client</span>
                            <span className="text-sm font-semibold text-green-600">
                              {formData.contact_details.discount_rate}% appliqué automatiquement
                            </span>
                          </div>
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
                        setFormData({
                          ...formData,
                          installation_included: checked,
                          installation_cost: checked ? formData.installation_cost : 0  // Reset cost when toggled off
                        })
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
          {/* Stock Issues Summary */}
          {stockIssues.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-orange-900 mb-2">
                      Alertes de stock ({stockIssues.length})
                    </h4>
                    <div className="space-y-1 text-sm text-orange-800">
                      {stockIssues.filter(i => i.type === 'out').length > 0 && (
                        <p>
                          • <strong>{stockIssues.filter(i => i.type === 'out').length}</strong> article(s) en rupture de stock
                        </p>
                      )}
                      {stockIssues.filter(i => i.type === 'low').length > 0 && (
                        <p>
                          • <strong>{stockIssues.filter(i => i.type === 'low').length}</strong> article(s) avec stock insuffisant
                        </p>
                      )}
                      <p className="text-xs mt-2 text-orange-700">
                        Vérifiez les indicateurs de stock sur chaque article ci-dessous. Contactez le service logistique si nécessaire.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
                          <div className="p-3">
                            {/* Compact table-like layout */}
                            <div className="grid grid-cols-12 gap-3 items-center">
                              {/* Product Info - 5 columns */}
                              <div className="col-span-5">
                                <div className="flex items-start gap-2">
                                  <div className="w-10 h-10 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
                                    {item.image_url ? (
                                      <img
                                        src={item.image_url}
                                        alt={item.product_name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <Image className="h-5 w-5 text-gray-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm truncate">{item.product_name}</h4>
                                    {item.product_sku && (
                                      <p className="text-xs text-gray-500">SKU: {item.product_sku}</p>
                                    )}
                                    {item.description && (
                                      <p className="text-xs text-gray-600 line-clamp-2">{item.description}</p>
                                    )}
                                    {/* Materials inline */}
                                    {item.is_customizable && item.materials && item.materials.length > 0 && (
                                      <div className="mt-1">
                                        <span className="text-xs text-gray-500">
                                          {`${item.materials[0].materialName} - ${item.materials[0].finishName}`}
                                          {item.materials.length > 1 && ` +${item.materials.length - 1}`}
                                        </span>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          className="h-5 px-1 ml-1"
                                          onClick={() => {
                                            setEditingItem(item)
                                            setShowMaterialDialog(true)
                                          }}
                                        >
                                          <Edit2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                    {/* Stock Indicator */}
                                    {item.product_id && item.stock_quantity !== undefined && (
                                      <div className="mt-2">
                                        {item.stock_quantity === 0 ? (
                                          <Badge variant="destructive" className="text-xs">
                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                            Rupture de stock
                                          </Badge>
                                        ) : item.stock_quantity < item.quantity ? (
                                          <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                            Stock partiel: {item.stock_quantity} disponible{item.stock_quantity > 1 ? 's' : ''}
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                            <Package className="h-3 w-3 mr-1" />
                                            En stock: {item.stock_quantity}
                                          </Badge>
                                        )}
                                      </div>
                                    )}
                                    {/* Notes inline */}
                                    {item.notes && (
                                      <p className="text-xs text-yellow-700 mt-1">
                                        <Info className="h-3 w-3 inline mr-1" />
                                        {item.notes}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Quantity - 2 columns */}
                              <div className="col-span-2">
                                <Label className="text-xs text-gray-500">Qté</Label>
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
                                  className="h-8 text-sm"
                                />
                              </div>

                              {/* Unit Price - 2 columns */}
                              <div className="col-span-2">
                                <Label className="text-xs text-gray-500">Prix unit.</Label>
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
                                  className="h-8 text-sm"
                                />
                              </div>

                              {/* Total - 2 columns */}
                              <div className="col-span-2">
                                <Label className="text-xs text-gray-500">Total</Label>
                                <div className="h-8 px-2 py-1 border rounded-md bg-gray-50 font-semibold text-sm flex items-center">
                                  {formatCurrency(item.line_total)}
                                </div>
                              </div>

                              {/* Actions - 1 column */}
                              <div className="col-span-1 flex flex-col gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDuplicateLineItem(section.id, item)}
                                  className="h-6 px-2"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteLineItem(section.id, item.id)}
                                  className="h-6 px-2 text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
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
                    value={parseFloat(formData.tax_rate).toString()}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      tax_rate: parseFloat(value)
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner le taux de TVA">
                        {formData.tax_rate}% TVA
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={5}>
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
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="validity_date">Date de validité</Label>
                  <Input
                    id="validity_date"
                    type="date"
                    value={formData.validity_date}
                    onChange={(e) => setFormData({...formData, validity_date: e.target.value})}
                  />
                </div>

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
                  {productsLoading ? (
                    <div className="text-center py-8 text-gray-500">
                      Chargement des produits...
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Aucun produit trouvé
                    </div>
                  ) : (
                    filteredProducts.map((product: any) => (
                      <Card
                        key={product.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleAddProduct(product)}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex gap-3">
                              <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                                {getProductImageUrl(product) ? (
                                  <img
                                    src={getProductImageUrl(product)!}
                                    alt={product.name}
                                    className="w-full h-full object-cover rounded"
                                  />
                                ) : (
                                  <Image className="h-8 w-8 text-gray-400" />
                                )}
                              </div>
                              <div>
                                <h4 className="font-semibold">{product.name}</h4>
                                <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                                <div className="flex items-center gap-4 mt-2">
                                  <span className="font-medium">{formatCurrency(parseFloat(product.totalPrice || product.basePrice || product.unit_price || 0))}</span>
                                  {(product.stock_quantity || 0) > 0 ? (
                                    <Badge variant="success">En stock ({product.stock_quantity})</Badge>
                                  ) : (
                                    <Badge variant="warning">Sur commande</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button size="sm" type="button">
                              <Plus className="h-4 w-4 mr-1" />
                              Ajouter
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
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