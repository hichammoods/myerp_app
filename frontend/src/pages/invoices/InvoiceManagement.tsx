import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Receipt, Download } from 'lucide-react'

export function InvoiceManagement() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Factures</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Gérez vos factures et paiements
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle Facture
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Facturé</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€234,500</div>
            <p className="text-xs text-muted-foreground">Ce mois</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">En Attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€45,230</div>
            <p className="text-xs text-muted-foreground">12 factures</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Payées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€189,270</div>
            <p className="text-xs text-muted-foreground">38 factures</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">En Retard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">€12,450</div>
            <p className="text-xs text-muted-foreground">3 factures</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Factures Récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Receipt className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p>Aucune facture disponible</p>
            <p className="text-sm mt-2">Les factures apparaîtront ici une fois créées</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}