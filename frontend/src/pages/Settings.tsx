import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function Settings() {
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
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Nom de l'entreprise</Label>
                  <Input
                    id="company-name"
                    defaultValue="Mobilier Excellence SARL"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siret">SIRET</Label>
                  <Input
                    id="siret"
                    defaultValue="123 456 789 00012"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue="contact@mobilier-excellence.fr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    defaultValue="+33 1 23 45 67 89"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  defaultValue="123 Rue du Commerce, 75001 Paris"
                />
              </div>
              <Button>Enregistrer les modifications</Button>
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