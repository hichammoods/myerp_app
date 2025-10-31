import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { settingsApi, backupApi } from '@/services/api'
import { UserManagement } from '@/components/UserManagement'
import { Download, Upload, Database, FileText, Trash2, AlertCircle } from 'lucide-react'

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
    website: '',
    default_cgv: ''
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
        website: companyData.company.website || '',
        default_cgv: companyData.company.default_cgv || ''
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

  // Fetch backups list
  const { data: backupsData, isLoading: isLoadingBackups } = useQuery({
    queryKey: ['backups'],
    queryFn: backupApi.list,
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: backupApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      toast.success('Sauvegarde créée avec succès')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création de la sauvegarde')
    }
  })

  // Restore backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: backupApi.restore,
    onSuccess: () => {
      toast.success('Base de données restaurée avec succès')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la restauration')
    }
  })

  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: backupApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      toast.success('Sauvegarde supprimée avec succès')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression')
    }
  })

  const handleRestoreBackup = (filename: string) => {
    if (confirm(`⚠️ ATTENTION: La restauration va remplacer toutes les données actuelles.\n\nÊtes-vous sûr de vouloir restaurer la sauvegarde "${filename}" ?`)) {
      restoreBackupMutation.mutate(filename)
    }
  }

  const handleDeleteBackup = (filename: string) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer la sauvegarde "${filename}" ?`)) {
      deleteBackupMutation.mutate(filename)
    }
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
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="backups">Sauvegardes & Export</TabsTrigger>
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

                {/* Conditions Générales de Vente */}
                <div className="space-y-2">
                  <Label htmlFor="default_cgv">Conditions Générales de Vente (par défaut)</Label>
                  <p className="text-sm text-gray-500">
                    Ces conditions seront automatiquement ajoutées à chaque nouveau devis
                  </p>
                  <textarea
                    id="default_cgv"
                    className="w-full px-3 py-2 border rounded-md min-h-[200px] font-mono text-sm"
                    placeholder="Saisissez vos conditions générales de vente..."
                    value={companyForm.default_cgv}
                    onChange={(e) => setCompanyForm({ ...companyForm, default_cgv: e.target.value })}
                    disabled={isLoading}
                  />
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

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="backups">
          <div className="space-y-4">
            {/* Backup Statistics Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Sauvegardes de la Base de Données
                </CardTitle>
                <CardDescription>
                  Sauvegarde automatique quotidienne à 2h00 du matin. Conservation: 30 jours.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Statistics */}
                {backupsData?.stats && (
                  <div className="grid gap-4 md:grid-cols-3 mb-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600">Nombre de sauvegardes</div>
                      <div className="text-2xl font-bold text-blue-600">{backupsData.stats.count}</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600">Espace total utilisé</div>
                      <div className="text-2xl font-bold text-purple-600">{backupsData.stats.totalSizeMB} MB</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600">Dernière sauvegarde</div>
                      <div className="text-sm font-bold text-green-600">
                        {backupsData.stats.lastBackup
                          ? new Date(backupsData.stats.lastBackup).toLocaleString('fr-FR')
                          : 'Aucune'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Create Backup Button */}
                <div className="flex justify-between items-center border-b pb-4">
                  <div>
                    <h4 className="font-semibold">Créer une sauvegarde manuelle</h4>
                    <p className="text-sm text-gray-600">Créez une sauvegarde complète de la base de données</p>
                  </div>
                  <Button
                    onClick={() => createBackupMutation.mutate()}
                    disabled={createBackupMutation.isPending}
                  >
                    <Database className="h-4 w-4 mr-2" />
                    {createBackupMutation.isPending ? 'Création...' : 'Créer une sauvegarde'}
                  </Button>
                </div>

                {/* Backups List */}
                <div>
                  <h4 className="font-semibold mb-3">Sauvegardes disponibles</h4>
                  {isLoadingBackups ? (
                    <div className="text-center py-8 text-gray-500">Chargement...</div>
                  ) : backupsData?.backups && backupsData.backups.length > 0 ? (
                    <div className="space-y-2">
                      {backupsData.backups.map((backup: any) => (
                        <div
                          key={backup.filename}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <Database className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="font-medium">{backup.filename}</p>
                              <div className="flex gap-4 text-sm text-gray-500">
                                <span>{backup.sizeMB} MB</span>
                                <span>{new Date(backup.createdAt).toLocaleString('fr-FR')}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = `${import.meta.env.VITE_API_URL}/backup/${backup.filename}`;
                                link.download = backup.filename;
                                link.click();
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestoreBackup(backup.filename)}
                              disabled={restoreBackupMutation.isPending}
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteBackup(backup.filename)}
                              disabled={deleteBackupMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p>Aucune sauvegarde disponible</p>
                    </div>
                  )}
                </div>

                {/* Warning Message */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-yellow-800">Avertissement</p>
                      <p className="text-yellow-700">
                        La restauration d'une sauvegarde remplacera toutes les données actuelles.
                        Assurez-vous de créer une sauvegarde avant de restaurer.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Export Data Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Exporter les Données
                </CardTitle>
                <CardDescription>
                  Téléchargez vos données au format CSV pour analyse externe
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => backupApi.exportContacts()}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Exporter les contacts
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => backupApi.exportProducts()}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Exporter les produits
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => backupApi.exportQuotations()}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Exporter les devis
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => backupApi.exportSalesOrders()}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Exporter les commandes
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => backupApi.exportInvoices()}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Exporter les factures
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
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