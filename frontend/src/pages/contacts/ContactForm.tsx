import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Globe,
  FileText,
  CreditCard,
  Calendar,
  Users
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface ContactFormProps {
  contact?: any
  onSave: (data: any) => void
  onClose: () => void
}

export function ContactForm({ contact, onSave, onClose }: ContactFormProps) {
  const [formData, setFormData] = useState({
    type: contact?.type || 'client',
    customer_type: contact?.customer_type || 'individual',
    company_name: contact?.company_name || '',
    first_name: contact?.first_name || '',
    last_name: contact?.last_name || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    mobile: contact?.mobile || '',
    job_title: contact?.job_title || '',
    address_street: contact?.address_street || '',
    address_city: contact?.address_city || '',
    address_state: contact?.address_state || '',
    address_zip: contact?.address_zip || '',
    address_country: contact?.address_country || 'France',
    tax_id: contact?.tax_id || '',
    payment_terms: contact?.payment_terms || 30,
    credit_limit: contact?.credit_limit || 0,
    discount_rate: contact?.discount_rate || 0,
    notes: contact?.notes || '',
    is_active: contact?.is_active !== undefined ? contact.is_active : true,
    tags: contact?.tags || []
  })

  const [newTag, setNewTag] = useState('')
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [citySuggestions, setCitySuggestions] = useState<string[]>([])
  const [showCitySuggestions, setShowCitySuggestions] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: false }))
    }

    // City autocomplete
    if (name === 'address_city' && value.length >= 2) {
      fetchCitySuggestions(value)
    } else if (name === 'address_city') {
      setCitySuggestions([])
      setShowCitySuggestions(false)
    }
  }

  const fetchCitySuggestions = async (query: string) => {
    try {
      const response = await fetch(
        `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(query)}&fields=nom,code,codesPostaux&limit=10`
      )
      const data = await response.json()
      const cities = data.map((city: any) => city.nom)
      setCitySuggestions(cities)
      setShowCitySuggestions(cities.length > 0)
    } catch (error) {
      console.error('Error fetching cities:', error)
    }
  }

  const handleCitySelect = (city: string) => {
    setFormData(prev => ({ ...prev, address_city: city }))
    setShowCitySuggestions(false)
    setCitySuggestions([])
  }

  const handleSwitchChange = (name: string) => (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }))
  }

  const handleAddTag = () => {
    if (newTag && !formData.tags.includes(newTag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag]
      }))
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((tag: string) => tag !== tagToRemove)
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    const newErrors: Record<string, boolean> = {}
    let hasErrors = false

    // Helper function to check if a field is empty
    const isEmpty = (value: string | undefined | null) => {
      return !value || value.trim() === ''
    }

    // Either company_name OR (first_name AND last_name) is required
    const hasCompanyName = !isEmpty(formData.company_name)
    const hasFirstName = !isEmpty(formData.first_name)
    const hasLastName = !isEmpty(formData.last_name)

    if (!hasCompanyName && (!hasFirstName || !hasLastName)) {
      newErrors.company_name = true
      newErrors.first_name = true
      newErrors.last_name = true
      toast.error('Informations manquantes: Veuillez renseigner le nom de la société OU le nom et prénom du contact')
      hasErrors = true
    }

    // At least one contact method is required (email, phone, or mobile)
    const hasEmail = !isEmpty(formData.email)
    const hasPhone = !isEmpty(formData.phone)
    const hasMobile = !isEmpty(formData.mobile)

    if (!hasEmail && !hasPhone && !hasMobile) {
      newErrors.email = true
      newErrors.phone = true
      newErrors.mobile = true
      toast.error('Informations manquantes: Veuillez renseigner au moins un moyen de contact (email, téléphone ou mobile)')
      hasErrors = true
    }

    // If there are errors, don't submit and highlight fields
    if (hasErrors) {
      setErrors(newErrors)
      return // Form stays open, does not close
    }

    onSave(formData)
    toast.success(contact ? 'Contact mis à jour avec succès' : 'Contact créé avec succès')
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">
            <User className="mr-2 h-4 w-4" />
            Général
          </TabsTrigger>
          <TabsTrigger value="address">
            <MapPin className="mr-2 h-4 w-4" />
            Adresse
          </TabsTrigger>
          <TabsTrigger value="commercial">
            <CreditCard className="mr-2 h-4 w-4" />
            Commercial
          </TabsTrigger>
          <TabsTrigger value="notes">
            <FileText className="mr-2 h-4 w-4" />
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type de contact</Label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="client">Client</option>
                  <option value="other">Prospect</option>
                  <option value="supplier">Fournisseur</option>
                  <option value="partner">Partenaire</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_name">
                  <Building2 className="inline mr-2 h-4 w-4" />
                  Nom de la société <span className="text-red-500">*</span>
                  <span className="text-sm text-gray-500 ml-2">(ou nom/prénom)</span>
                </Label>
                <Input
                  id="company_name"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleInputChange}
                  placeholder="Meubles Design SARL"
                  className={errors.company_name ? 'border-red-500 focus:border-red-500' : ''}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">
                    Prénom <span className="text-red-500">*</span>
                    <span className="text-sm text-gray-500 ml-2">(ou société)</span>
                  </Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    placeholder="Jean"
                    className={errors.first_name ? 'border-red-500 focus:border-red-500' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">
                    Nom <span className="text-red-500">*</span>
                    <span className="text-sm text-gray-500 ml-2">(ou société)</span>
                  </Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    placeholder="Dupont"
                    className={errors.last_name ? 'border-red-500 focus:border-red-500' : ''}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  <Mail className="inline mr-2 h-4 w-4" />
                  Email <span className="text-red-500">*</span>
                  <span className="text-sm text-gray-500 ml-2">(ou téléphone)</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="contact@entreprise.fr"
                  className={errors.email ? 'border-red-500 focus:border-red-500' : ''}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    <Phone className="inline mr-2 h-4 w-4" />
                    Téléphone fixe <span className="text-red-500">*</span>
                    <span className="text-sm text-gray-500 ml-2">(ou email)</span>
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+33 1 23 45 67 89"
                    className={errors.phone ? 'border-red-500 focus:border-red-500' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">
                    <Phone className="inline mr-2 h-4 w-4" />
                    Téléphone mobile <span className="text-red-500">*</span>
                    <span className="text-sm text-gray-500 ml-2">(ou email)</span>
                  </Label>
                  <Input
                    id="mobile"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleInputChange}
                    placeholder="+33 6 12 34 56 78"
                    className={errors.mobile ? 'border-red-500 focus:border-red-500' : ''}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">
                  <Globe className="inline mr-2 h-4 w-4" />
                  Site web
                </Label>
                <Input
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  placeholder="https://www.entreprise.fr"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={handleSwitchChange('is_active')}
                />
                <Label htmlFor="is_active">Contact actif</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="address" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Adresse</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address_street">Adresse</Label>
                <Input
                  id="address_street"
                  name="address_street"
                  value={formData.address_street}
                  onChange={handleInputChange}
                  placeholder="123 rue de la Paix"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 relative">
                  <Label htmlFor="address_city">Ville</Label>
                  <Input
                    id="address_city"
                    name="address_city"
                    value={formData.address_city}
                    onChange={handleInputChange}
                    onFocus={() => formData.address_city.length >= 2 && setShowCitySuggestions(true)}
                    onBlur={() => setTimeout(() => setShowCitySuggestions(false), 200)}
                    placeholder="Paris"
                    autoComplete="off"
                  />
                  {showCitySuggestions && citySuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {citySuggestions.map((city, index) => (
                        <div
                          key={index}
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer"
                          onClick={() => handleCitySelect(city)}
                        >
                          {city}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_zip">Code postal</Label>
                  <Input
                    id="address_zip"
                    name="address_zip"
                    value={formData.address_zip}
                    onChange={handleInputChange}
                    placeholder="75001"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_country">Pays</Label>
                <select
                  id="address_country"
                  name="address_country"
                  value={formData.address_country}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="France">France</option>
                  <option value="Belgique">Belgique</option>
                  <option value="Suisse">Suisse</option>
                  <option value="Luxembourg">Luxembourg</option>
                  <option value="Espagne">Espagne</option>
                  <option value="Italie">Italie</option>
                  <option value="Allemagne">Allemagne</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commercial" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Informations commerciales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tax_id">N° SIRET / ID Fiscal</Label>
                  <Input
                    id="tax_id"
                    name="tax_id"
                    value={formData.tax_id}
                    onChange={handleInputChange}
                    placeholder="123 456 789 00012"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_type">Type de client</Label>
                  <select
                    id="customer_type"
                    name="customer_type"
                    value={formData.customer_type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="individual">Particulier</option>
                    <option value="company">Société</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="payment_terms">
                    <Calendar className="inline mr-2 h-4 w-4" />
                    Délai de paiement (jours)
                  </Label>
                  <Input
                    id="payment_terms"
                    name="payment_terms"
                    type="number"
                    value={formData.payment_terms}
                    onChange={handleInputChange}
                    placeholder="30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credit_limit">
                    <CreditCard className="inline mr-2 h-4 w-4" />
                    Limite de crédit (€)
                  </Label>
                  <Input
                    id="credit_limit"
                    name="credit_limit"
                    type="number"
                    value={formData.credit_limit}
                    onChange={handleInputChange}
                    placeholder="10000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount_rate">
                    Taux de remise (%)
                  </Label>
                  <Input
                    id="discount_rate"
                    name="discount_rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.discount_rate}
                    onChange={handleInputChange}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Étiquettes</Label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {formData.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTag(tag)}>
                      {tag} ✕
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Ajouter une étiquette"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  />
                  <Button type="button" variant="outline" onClick={handleAddTag}>
                    Ajouter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notes et commentaires</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes internes</Label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md min-h-[150px]"
                  placeholder="Notes internes sur ce contact..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit">
          <Users className="mr-2 h-4 w-4" />
          {contact ? 'Mettre à jour' : 'Créer le contact'}
        </Button>
      </div>
    </form>
  )
}