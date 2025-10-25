import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { settingsApi } from '@/services/api'

export function Settings() {
  const queryClient = useQueryClient()

  // Fetch company settings
  const { data: companyData, isLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: settingsApi.getCompany
  })

  const [companyForm, setCompanyForm] = useState({
    name: '',
    siret: '',
    tva: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    country: 'France',
    website: ''
  })

  // Update form when data is loaded
  useEffect(() => {
    if (companyData?.company) {
      setCompanyForm({
        name: companyData.company.name || '',
        siret: companyData.company.siret || '',
        tva: companyData.company.tva || '',
        email: companyData.company.email || '',
        phone: companyData.company.phone || '',
        address: companyData.company.address || '',
        city: companyData.company.city || '',
        postal_code: companyData.company.postal_code || '',
        country: companyData.company.country || 'France',
        website: companyData.company.website || ''
      })
    }
  }, [companyData])

  // Update company settings mutation
  const updateCompanyMutation = useMutation({
    mutationFn: settingsApi.updateCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] })
      toast.success('Informations de l\'entreprise mises à jour avec succès')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour')
    }
  })

  const handleCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateCompanyMutation.mutate(companyForm)
  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Paramètres</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Gérez les paramètres de votre application
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="company">Entreprise</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres Généraux</CardTitle>
              <CardDescription>
                Configurez les paramètres de base de votre application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="language">Langue</Label>
                <select
                  id="language"
                  className="w-full px-3 py-2 border rounded-md"
                  defaultValue="fr"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Devise</Label>
                <select
                  id="currency"
                  className="w-full px-3 py-2 border rounded-md"
                  defaultValue="eur"
                >
                  <option value="eur">Euro (€)</option>
                  <option value="usd">Dollar ($)</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="dark-mode" />
                <Label htmlFor="dark-mode">Mode sombre</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Informations de l'Entreprise</CardTitle>
              <CardDescription>
                Mettez à jour les informations de votre entreprise
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCompanySubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Nom de l'entreprise *</Label>
                    <Input
                      id="company-name"
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="siret">SIRET</Label>
                    <Input
                      id="siret"
                      value={companyForm.siret}
                      onChange={(e) => setCompanyForm({ ...companyForm, siret: e.target.value })}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tva">N° TVA</Label>
                    <Input
                      id="tva"
                      value={companyForm.tva}
                      onChange={(e) => setCompanyForm({ ...companyForm, tva: e.target.value })}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={companyForm.email}
                      onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      value={companyForm.phone}
                      onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Site Web</Label>
                    <Input
                      id="website"
                      value={companyForm.website}
                      onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Adresse</Label>
                    <Input
                      id="address"
                      value={companyForm.address}
                      onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postal_code">Code postal</Label>
                    <Input
                      id="postal_code"
                      value={companyForm.postal_code}
                      onChange={(e) => setCompanyForm({ ...companyForm, postal_code: e.target.value })}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Ville</Label>
                    <Input
                      id="city"
                      value={companyForm.city}
                      onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Pays</Label>
                    <Input
                      id="country"
                      value={companyForm.country}
                      onChange={(e) => setCompanyForm({ ...companyForm, country: e.target.value })}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={isLoading || updateCompanyMutation.isPending}
                >
                  {updateCompanyMutation.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Préférences de Notification</CardTitle>
              <CardDescription>
                Choisissez comment vous souhaitez recevoir les notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch id="email-notifications" defaultChecked />
                  <Label htmlFor="email-notifications">Notifications par email</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="new-orders" defaultChecked />
                  <Label htmlFor="new-orders">Nouvelles commandes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="low-stock" defaultChecked />
                  <Label htmlFor="low-stock">Alertes de stock bas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="payment-received" />
                  <Label htmlFor="payment-received">Paiements reçus</Label>
                </div>
              </div>
              <Button>Sauvegarder les préférences</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}