import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertCircle,
  Package,
  TrendingDown,
  TrendingUp,
  ArrowUpDown,
  History,
  Settings,
  Download,
  Upload,
  BarChart,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Minus,
  RefreshCw,
  Filter,
  Search,
  FileDown,
  Bell,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

// Types
interface StockItem {
  id: string
  type: 'product' | 'material'
  name: string
  code: string
  current_stock: number
  min_stock: number
  max_stock: number
  optimal_stock: number
  unit: string
  value_per_unit: number
  total_value: number
  last_movement: Date
  status: 'critical' | 'low' | 'normal' | 'overstocked'
  category?: string
  supplier?: string
  location?: string
}

interface StockMovement {
  id: string
  item_id: string
  item_name: string
  type: 'in' | 'out' | 'adjustment' | 'return' | 'transfer'
  quantity: number
  before_stock: number
  after_stock: number
  reason: string
  reference?: string
  user: string
  date: Date
  notes?: string
}

interface StockAlert {
  id: string
  item_id: string
  item_name: string
  type: 'critical' | 'low' | 'overstock' | 'expiry'
  message: string
  created_at: Date
  resolved: boolean
  resolved_at?: Date
  resolved_by?: string
}

interface StockAdjustment {
  item_id: string
  adjustment_type: 'add' | 'remove' | 'set'
  quantity: number
  reason: string
  notes?: string
}

export function StockManagement() {
  const [activeTab, setActiveTab] = useState('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false)
  const [showAlertConfig, setShowAlertConfig] = useState(false)
  const [adjustment, setAdjustment] = useState<StockAdjustment>({
    item_id: '',
    adjustment_type: 'add',
    quantity: 0,
    reason: '',
    notes: '',
  })

  // Mock data
  const stockItems: StockItem[] = [
    {
      id: '1',
      type: 'product',
      name: 'Table Moderne 180cm',
      code: 'TBL-180-MOD',
      current_stock: 5,
      min_stock: 10,
      max_stock: 50,
      optimal_stock: 25,
      unit: 'pièce',
      value_per_unit: 450,
      total_value: 2250,
      last_movement: new Date('2024-01-15'),
      status: 'critical',
      category: 'Tables',
      location: 'Entrepôt A - Zone 1',
    },
    {
      id: '2',
      type: 'material',
      name: 'Bois de Chêne',
      code: 'MAT-BOIS-01',
      current_stock: 150,
      min_stock: 100,
      max_stock: 500,
      optimal_stock: 300,
      unit: 'm²',
      value_per_unit: 75,
      total_value: 11250,
      last_movement: new Date('2024-01-14'),
      status: 'normal',
      category: 'Bois',
      supplier: 'Bois Premium SARL',
      location: 'Entrepôt B - Zone 3',
    },
    {
      id: '3',
      type: 'product',
      name: 'Chaise Ergonomique Pro',
      code: 'CHS-ERG-PRO',
      current_stock: 12,
      min_stock: 20,
      max_stock: 100,
      optimal_stock: 50,
      unit: 'pièce',
      value_per_unit: 120,
      total_value: 1440,
      last_movement: new Date('2024-01-16'),
      status: 'low',
      category: 'Chaises',
      location: 'Entrepôt A - Zone 2',
    },
    {
      id: '4',
      type: 'material',
      name: 'Tissu Velours Bleu',
      code: 'MAT-TIS-03',
      current_stock: 450,
      min_stock: 50,
      max_stock: 300,
      optimal_stock: 150,
      unit: 'm',
      value_per_unit: 25,
      total_value: 11250,
      last_movement: new Date('2024-01-10'),
      status: 'overstocked',
      category: 'Tissus',
      supplier: 'Textiles Deluxe',
      location: 'Entrepôt C - Zone 1',
    },
  ]

  const stockMovements: StockMovement[] = [
    {
      id: '1',
      item_id: '1',
      item_name: 'Table Moderne 180cm',
      type: 'out',
      quantity: 3,
      before_stock: 8,
      after_stock: 5,
      reason: 'Vente',
      reference: 'CMD-2024-001',
      user: 'Jean Dupont',
      date: new Date('2024-01-15'),
      notes: 'Livraison client Paris',
    },
    {
      id: '2',
      item_id: '2',
      item_name: 'Bois de Chêne',
      type: 'in',
      quantity: 100,
      before_stock: 50,
      after_stock: 150,
      reason: 'Réapprovisionnement',
      reference: 'PO-2024-015',
      user: 'Marie Martin',
      date: new Date('2024-01-14'),
    },
    {
      id: '3',
      item_id: '3',
      item_name: 'Chaise Ergonomique Pro',
      type: 'adjustment',
      quantity: -2,
      before_stock: 14,
      after_stock: 12,
      reason: 'Inventaire',
      user: 'Paul Durand',
      date: new Date('2024-01-16'),
      notes: 'Écart constaté lors de l\'inventaire',
    },
  ]

  const stockAlerts: StockAlert[] = [
    {
      id: '1',
      item_id: '1',
      item_name: 'Table Moderne 180cm',
      type: 'critical',
      message: 'Stock critique: 5 pièces restantes (min: 10)',
      created_at: new Date('2024-01-15'),
      resolved: false,
    },
    {
      id: '2',
      item_id: '3',
      item_name: 'Chaise Ergonomique Pro',
      type: 'low',
      message: 'Stock faible: 12 pièces restantes (min: 20)',
      created_at: new Date('2024-01-16'),
      resolved: false,
    },
    {
      id: '3',
      item_id: '4',
      item_name: 'Tissu Velours Bleu',
      type: 'overstock',
      message: 'Surstock: 450m en stock (max recommandé: 300m)',
      created_at: new Date('2024-01-10'),
      resolved: false,
    },
  ]

  // Chart data
  const stockValueData = [
    { name: 'Jan', products: 45000, materials: 32000 },
    { name: 'Feb', products: 48000, materials: 35000 },
    { name: 'Mar', products: 43000, materials: 38000 },
    { name: 'Apr', products: 51000, materials: 36000 },
    { name: 'May', products: 49000, materials: 40000 },
    { name: 'Jun', products: 52000, materials: 42000 },
  ]

  const stockStatusData = [
    { name: 'Critique', value: 15, color: '#ef4444' },
    { name: 'Faible', value: 25, color: '#f59e0b' },
    { name: 'Normal', value: 45, color: '#10b981' },
    { name: 'Surstock', value: 15, color: '#6366f1' },
  ]

  // Filtered items
  const filteredItems = useMemo(() => {
    return stockItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.code.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = filterCategory === 'all' || item.category === filterCategory
      const matchesStatus = filterStatus === 'all' || item.status === filterStatus

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [searchTerm, filterCategory, filterStatus])

  // Unresolved alerts count
  const unresolvedAlertsCount = stockAlerts.filter(a => !a.resolved).length

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'bg-red-500'
      case 'low':
        return 'bg-orange-500'
      case 'normal':
        return 'bg-green-500'
      case 'overstocked':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical':
        return <AlertCircle className="h-4 w-4" />
      case 'low':
        return <TrendingDown className="h-4 w-4" />
      case 'normal':
        return <CheckCircle className="h-4 w-4" />
      case 'overstocked':
        return <TrendingUp className="h-4 w-4" />
      default:
        return <Package className="h-4 w-4" />
    }
  }

  const handleStockAdjustment = () => {
    if (!selectedItem || !adjustment.reason || adjustment.quantity === 0) {
      toast.error('Veuillez remplir tous les champs requis')
      return
    }

    // Simulate stock adjustment
    let newStock = selectedItem.current_stock
    switch (adjustment.adjustment_type) {
      case 'add':
        newStock += adjustment.quantity
        break
      case 'remove':
        newStock -= adjustment.quantity
        break
      case 'set':
        newStock = adjustment.quantity
        break
    }

    toast.success(`Stock ajusté: ${selectedItem.name} - Nouveau stock: ${newStock} ${selectedItem.unit}`)
    setShowAdjustmentDialog(false)
    setAdjustment({
      item_id: '',
      adjustment_type: 'add',
      quantity: 0,
      reason: '',
      notes: '',
    })
  }

  const handleResolveAlert = (alertId: string) => {
    toast.success('Alerte marquée comme résolue')
  }

  const exportStockReport = () => {
    toast.success('Rapport de stock exporté')
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Stocks</h1>
          <p className="text-muted-foreground">
            Surveillez et gérez vos stocks de produits et matériaux
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowAlertConfig(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </Button>
          <Button
            variant="outline"
            onClick={exportStockReport}
          >
            <FileDown className="h-4 w-4 mr-2" />
            Exporter
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle Entrée
          </Button>
        </div>
      </div>

      {/* Alert Banner */}
      {unresolvedAlertsCount > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium text-orange-900">
                  {unresolvedAlertsCount} alerte{unresolvedAlertsCount > 1 ? 's' : ''} en cours
                </p>
                <p className="text-sm text-orange-700">
                  Vérifiez les niveaux de stock critiques
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab('alerts')}
            >
              Voir les alertes
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valeur Totale</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€26,190</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">+8.2%</span> depuis le mois dernier
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Articles en Stock</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">147</div>
            <p className="text-xs text-muted-foreground">
              82 produits, 65 matériaux
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertes Actives</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {unresolvedAlertsCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {stockAlerts.filter(a => a.type === 'critical').length} critiques
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mouvements Jour</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">
              15 entrées, 9 sorties
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="inventory">Inventaire</TabsTrigger>
          <TabsTrigger value="movements">Mouvements</TabsTrigger>
          <TabsTrigger value="alerts">
            Alertes
            {unresolvedAlertsCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unresolvedAlertsCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Évolution de la Valeur du Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={stockValueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="products"
                      stackId="1"
                      stroke="#8b5cf6"
                      fill="#8b5cf6"
                      fillOpacity={0.6}
                      name="Produits"
                    />
                    <Area
                      type="monotone"
                      dataKey="materials"
                      stackId="1"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.6}
                      name="Matériaux"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Répartition par Statut</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stockStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {stockStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Low Stock Items */}
          <Card>
            <CardHeader>
              <CardTitle>Articles à Réapprovisionner</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stockItems
                  .filter(item => item.status === 'critical' || item.status === 'low')
                  .map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge className={getStatusColor(item.status)}>
                          {getStatusIcon(item.status)}
                        </Badge>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500">
                            {item.current_stock} / {item.min_stock} {item.unit}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedItem(item)
                            setShowAdjustmentDialog(true)
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Réapprovisionner
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Rechercher par nom ou code..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes catégories</SelectItem>
                    <SelectItem value="Tables">Tables</SelectItem>
                    <SelectItem value="Chaises">Chaises</SelectItem>
                    <SelectItem value="Bois">Bois</SelectItem>
                    <SelectItem value="Tissus">Tissus</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    <SelectItem value="critical">Critique</SelectItem>
                    <SelectItem value="low">Faible</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="overstocked">Surstock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Stock Actuel</TableHead>
                    <TableHead>Min/Optimal/Max</TableHead>
                    <TableHead>Valeur</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500">{item.code}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {item.current_stock} {item.unit}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="text-red-500">{item.min_stock}</span> /
                          <span className="text-green-500"> {item.optimal_stock}</span> /
                          <span className="text-blue-500"> {item.max_stock}</span>
                        </div>
                      </TableCell>
                      <TableCell>€{item.total_value.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={cn("flex items-center gap-1 w-fit", getStatusColor(item.status))}>
                          {getStatusIcon(item.status)}
                          <span className="capitalize">{item.status}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedItem(item)
                            setShowAdjustmentDialog(true)
                          }}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historique des Mouvements</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Article</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead>Avant/Après</TableHead>
                    <TableHead>Raison</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Référence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>
                        {movement.date.toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell>{movement.item_name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={movement.type === 'in' ? 'default' : movement.type === 'out' ? 'destructive' : 'secondary'}
                        >
                          {movement.type === 'in' ? 'Entrée' :
                           movement.type === 'out' ? 'Sortie' :
                           movement.type === 'adjustment' ? 'Ajustement' :
                           movement.type === 'return' ? 'Retour' : 'Transfert'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={movement.quantity > 0 ? 'text-green-600' : 'text-red-600'}>
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {movement.before_stock} → {movement.after_stock}
                        </div>
                      </TableCell>
                      <TableCell>{movement.reason}</TableCell>
                      <TableCell>{movement.user}</TableCell>
                      <TableCell>
                        {movement.reference && (
                          <Badge variant="outline">{movement.reference}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alertes de Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stockAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "flex items-center justify-between p-4 border rounded-lg",
                      alert.resolved && "opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-full",
                        alert.type === 'critical' && "bg-red-100",
                        alert.type === 'low' && "bg-orange-100",
                        alert.type === 'overstock' && "bg-blue-100",
                        alert.type === 'expiry' && "bg-purple-100"
                      )}>
                        {alert.type === 'critical' && <AlertCircle className="h-5 w-5 text-red-600" />}
                        {alert.type === 'low' && <AlertTriangle className="h-5 w-5 text-orange-600" />}
                        {alert.type === 'overstock' && <TrendingUp className="h-5 w-5 text-blue-600" />}
                        {alert.type === 'expiry' && <Clock className="h-5 w-5 text-purple-600" />}
                      </div>
                      <div>
                        <p className="font-medium">{alert.item_name}</p>
                        <p className="text-sm text-gray-600">{alert.message}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {alert.created_at.toLocaleDateString('fr-FR')} à {alert.created_at.toLocaleTimeString('fr-FR')}
                        </p>
                      </div>
                    </div>
                    {!alert.resolved && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const item = stockItems.find(i => i.id === alert.item_id)
                            if (item) {
                              setSelectedItem(item)
                              setShowAdjustmentDialog(true)
                            }
                          }}
                        >
                          Traiter
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResolveAlert(alert.id)}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Stock Adjustment Dialog */}
      <Dialog open={showAdjustmentDialog} onOpenChange={setShowAdjustmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuster le Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedItem && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">{selectedItem.name}</p>
                <p className="text-sm text-gray-600">
                  Stock actuel: {selectedItem.current_stock} {selectedItem.unit}
                </p>
              </div>
            )}

            <div>
              <Label>Type d'ajustement</Label>
              <Select
                value={adjustment.adjustment_type}
                onValueChange={(value: 'add' | 'remove' | 'set') =>
                  setAdjustment({ ...adjustment, adjustment_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Ajouter au stock</SelectItem>
                  <SelectItem value="remove">Retirer du stock</SelectItem>
                  <SelectItem value="set">Définir le stock à</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Quantité</Label>
              <Input
                type="number"
                min="0"
                value={adjustment.quantity}
                onChange={(e) =>
                  setAdjustment({ ...adjustment, quantity: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div>
              <Label>Raison</Label>
              <Select
                value={adjustment.reason}
                onValueChange={(value) =>
                  setAdjustment({ ...adjustment, reason: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une raison" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inventory">Inventaire</SelectItem>
                  <SelectItem value="damage">Produit endommagé</SelectItem>
                  <SelectItem value="return">Retour client</SelectItem>
                  <SelectItem value="supplier_error">Erreur fournisseur</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={adjustment.notes}
                onChange={(e) =>
                  setAdjustment({ ...adjustment, notes: e.target.value })
                }
                placeholder="Ajouter des notes supplémentaires..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAdjustmentDialog(false)}
              >
                Annuler
              </Button>
              <Button onClick={handleStockAdjustment}>
                Confirmer l'ajustement
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alert Configuration Dialog */}
      <Dialog open={showAlertConfig} onOpenChange={setShowAlertConfig}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configuration des Alertes</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-3">Seuils d'Alerte par Défaut</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Stock Critique (%)</Label>
                  <Input type="number" defaultValue="20" min="0" max="100" />
                  <p className="text-xs text-gray-500 mt-1">
                    Alerte quand le stock est inférieur à X% du minimum
                  </p>
                </div>
                <div>
                  <Label>Stock Faible (%)</Label>
                  <Input type="number" defaultValue="50" min="0" max="100" />
                  <p className="text-xs text-gray-500 mt-1">
                    Alerte quand le stock est inférieur à X% de l'optimal
                  </p>
                </div>
                <div>
                  <Label>Surstock (%)</Label>
                  <Input type="number" defaultValue="120" min="100" max="200" />
                  <p className="text-xs text-gray-500 mt-1">
                    Alerte quand le stock dépasse X% du maximum
                  </p>
                </div>
                <div>
                  <Label>Délai d'Expiration (jours)</Label>
                  <Input type="number" defaultValue="30" min="1" />
                  <p className="text-xs text-gray-500 mt-1">
                    Alerte X jours avant expiration
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-3">Notifications</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Alertes par Email</p>
                    <p className="text-sm text-gray-500">
                      Recevoir les alertes critiques par email
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Bell className="h-4 w-4 mr-2" />
                    Configurer
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Rapport Hebdomadaire</p>
                    <p className="text-sm text-gray-500">
                      Recevoir un résumé hebdomadaire des stocks
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Bell className="h-4 w-4 mr-2" />
                    Configurer
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAlertConfig(false)}
              >
                Annuler
              </Button>
              <Button onClick={() => {
                toast.success('Configuration sauvegardée')
                setShowAlertConfig(false)
              }}>
                Sauvegarder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}