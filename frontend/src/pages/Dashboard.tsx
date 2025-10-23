import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Users, FileText, Receipt, TrendingUp, Euro } from 'lucide-react'

export function Dashboard() {
  const stats = [
    {
      title: 'Produits en Stock',
      value: '248',
      icon: Package,
      change: '+12%',
      changeType: 'positive',
    },
    {
      title: 'Clients Actifs',
      value: '1,234',
      icon: Users,
      change: '+5%',
      changeType: 'positive',
    },
    {
      title: 'Devis ce Mois',
      value: '45',
      icon: FileText,
      change: '+18%',
      changeType: 'positive',
    },
    {
      title: 'Chiffre d\'Affaires',
      value: '€125,430',
      icon: Euro,
      change: '+23%',
      changeType: 'positive',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Tableau de Bord</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Vue d'ensemble de votre entreprise de mobilier
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className={`text-xs ${
                  stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.change} par rapport au mois dernier
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Derniers Devis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { client: 'Jean Dupont', amount: '€3,450', status: 'En attente' },
                { client: 'Marie Martin', amount: '€5,200', status: 'Accepté' },
                { client: 'Pierre Bernard', amount: '€2,100', status: 'En cours' },
              ].map((quote, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{quote.client}</p>
                    <p className="text-sm text-gray-500">{quote.status}</p>
                  </div>
                  <div className="font-semibold">{quote.amount}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produits Populaires</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Canapé 3 places Confort', sales: 23 },
                { name: 'Table Basse Moderne', sales: 18 },
                { name: 'Lit King Size Deluxe', sales: 15 },
              ].map((product, i) => (
                <div key={i} className="flex items-center justify-between">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-gray-500">{product.sales} ventes</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}