import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Package, Palette, Grid3X3, Layers, Edit, Trash2, Eye, Settings, FileText, Image } from 'lucide-react'
import { DataTable, DataTableColumnHeader, DataTableRowActions } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, cn } from '@/lib/utils'
import { ProductForm } from './ProductForm'
import { CategoryForm } from './CategoryForm'
import { MaterialForm } from './MaterialForm'
import { FinishForm } from './FinishForm'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'react-hot-toast'
import { productsApi } from '@/services/api'

export function ProductManagement() {
  const [selectedTab, setSelectedTab] = useState('products')
  const [showProductForm, setShowProductForm] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [showMaterialForm, setShowMaterialForm] = useState(false)
  const [showFinishForm, setShowFinishForm] = useState(false)
  const [showProductDetails, setShowProductDetails] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [viewingProduct, setViewingProduct] = useState<any>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const queryClient = useQueryClient()

  // Fetch products
  const { data: productsData = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getAll(),
  })

  // Fetch categories (include inactive for management view)
  const { data: categoriesData = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productsApi.getCategories(true),
  })

  // Fetch materials
  const { data: materialsData = [], isLoading: materialsLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: () => productsApi.getMaterials(),
  })

  // Fetch finishes
  const { data: finishesData = [], isLoading: finishesLoading } = useQuery({
    queryKey: ['finishes'],
    queryFn: () => productsApi.getFinishes(),
  })

  // Product mutations
  const createProductMutation = useMutation({
    mutationFn: (data: any) => productsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Produit créé avec succès')
      setShowProductForm(false)
      setEditingItem(null)
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Erreur lors de la création du produit'
      toast.error(errorMessage)
    },
  })

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Produit mis à jour avec succès')
      setShowProductForm(false)
      setEditingItem(null)
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Erreur lors de la mise à jour du produit'
      toast.error(errorMessage)
    },
  })

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Produit supprimé avec succès')
    },
    onError: () => {
      toast.error('Erreur lors de la suppression du produit')
    },
  })

  // Handle product submit (create or update)
  const handleProductSubmit = async (data: any) => {
    if (editingItem?.id) {
      await updateProductMutation.mutateAsync({ id: editingItem.id, data })
    } else {
      await createProductMutation.mutateAsync(data)
    }
  }

  // Category mutations
  const createCategoryMutation = useMutation({
    mutationFn: (data: any) => productsApi.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Catégorie créée avec succès')
      setShowCategoryForm(false)
      setEditingItem(null)
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Erreur lors de la création de la catégorie'
      toast.error(errorMessage)
    },
  })

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productsApi.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Catégorie mise à jour avec succès')
      setShowCategoryForm(false)
      setEditingItem(null)
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour de la catégorie')
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => productsApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Catégorie supprimée avec succès')
    },
    onError: () => {
      toast.error('Erreur lors de la suppression de la catégorie')
    },
  })

  // Handle category submit
  const handleCategorySubmit = async (data: any) => {
    if (editingItem?.id) {
      await updateCategoryMutation.mutateAsync({ id: editingItem.id, data })
    } else {
      await createCategoryMutation.mutateAsync(data)
    }
  }

  // Material mutations
  const createMaterialMutation = useMutation({
    mutationFn: (data: any) => productsApi.createMaterial(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      toast.success('Matériau créé avec succès')
      setShowMaterialForm(false)
      setEditingItem(null)
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Erreur lors de la création du matériau'
      toast.error(errorMessage)
    },
  })

  const updateMaterialMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productsApi.updateMaterial(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      toast.success('Matériau mis à jour avec succès')
      setShowMaterialForm(false)
      setEditingItem(null)
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour du matériau')
    },
  })

  const deleteMaterialMutation = useMutation({
    mutationFn: (id: string) => productsApi.deleteMaterial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      toast.success('Matériau supprimé avec succès')
    },
    onError: () => {
      toast.error('Erreur lors de la suppression du matériau')
    },
  })

  // Handle material submit
  const handleMaterialSubmit = async (data: any) => {
    if (editingItem?.id) {
      await updateMaterialMutation.mutateAsync({ id: editingItem.id, data })
    } else {
      await createMaterialMutation.mutateAsync(data)
    }
  }

  // Finish mutations
  const createFinishMutation = useMutation({
    mutationFn: (data: any) => productsApi.createFinish(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finishes'] })
      toast.success('Finition créée avec succès')
      setShowFinishForm(false)
      setEditingItem(null)
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Erreur lors de la création de la finition'
      toast.error(errorMessage)
    },
  })

  const updateFinishMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productsApi.updateFinish(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finishes'] })
      toast.success('Finition mise à jour avec succès')
      setShowFinishForm(false)
      setEditingItem(null)
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour de la finition')
    },
  })

  const deleteFinishMutation = useMutation({
    mutationFn: (id: string) => productsApi.deleteFinish(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finishes'] })
      toast.success('Finition supprimée avec succès')
    },
    onError: () => {
      toast.error('Erreur lors de la suppression de la finition')
    },
  })

  // Handle finish submit
  const handleFinishSubmit = async (data: any) => {
    if (editingItem?.id) {
      await updateFinishMutation.mutateAsync({ id: editingItem.id, data })
    } else {
      await createFinishMutation.mutateAsync(data)
    }
  }

  // Product columns for data table
  const productColumns = [
    {
      id: 'select',
      header: ({ table }: any) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
          className="h-4 w-4"
        />
      ),
      cell: ({ row }: any) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={(e) => row.toggleSelected(e.target.checked)}
          className="h-4 w-4"
        />
      ),
    },
    {
      accessorKey: 'sku',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="SKU" />
      ),
      cell: ({ row }: any) => (
        <div className="font-mono text-sm">{row.getValue('sku')}</div>
      ),
    },
    {
      accessorKey: 'name',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Nom du produit" />
      ),
      cell: ({ row }: any) => (
        <div className="font-medium">{row.getValue('name')}</div>
      ),
    },
    {
      accessorKey: 'categoryName',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Catégorie" />
      ),
      cell: ({ row }: any) => (
        <Badge variant="outline">{row.getValue('categoryName') || 'Non catégorisé'}</Badge>
      ),
    },
    {
      accessorKey: 'totalPrice',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Prix HT" />
      ),
      cell: ({ row }: any) => {
        const totalPrice = row.original.totalPrice || row.original.basePrice || 0
        const hasFinishCost = row.original.materialCost > 0
        return (
          <div className="space-y-1">
            <div className={`font-medium ${hasFinishCost ? 'text-green-600' : ''}`}>
              {formatCurrency(totalPrice)}
            </div>
            {hasFinishCost && (
              <div className="text-xs text-muted-foreground">
                Base: {formatCurrency(row.original.basePrice)} + Finitions: {formatCurrency(row.original.materialCost)}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'stockQuantity',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Stock" />
      ),
      cell: ({ row }: any) => {
        const stock = parseFloat(row.getValue('stockQuantity')) || 0
        const product = row.original
        const minStock = parseFloat(product.minStockLevel) || 0
        const maxStock = parseFloat(product.maxStockLevel) || 0
        let statusBadge = null
        let stockColor = ''

        if (stock === 0) {
          statusBadge = <Badge variant="destructive" className="text-xs">Rupture</Badge>
          stockColor = 'text-red-600 font-medium'
        } else if (minStock > 0 && stock <= minStock) {
          statusBadge = <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">Faible</Badge>
          stockColor = 'text-orange-600 font-medium'
        } else if (maxStock > 0 && stock > maxStock) {
          statusBadge = <Badge variant="outline" className="text-xs border-blue-500 text-blue-600">Surstock</Badge>
          stockColor = 'text-blue-600 font-medium'
        } else {
          statusBadge = <Badge variant="outline" className="text-xs border-green-500 text-green-600">En stock</Badge>
          stockColor = 'text-green-600 font-medium'
        }

        return (
          <div className="flex items-center gap-2">
            <span className={stockColor}>{stock}</span>
            {statusBadge}
          </div>
        )
      },
    },
    {
      accessorKey: 'allowsCustomMaterials',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Personnalisable" />
      ),
      cell: ({ row }: any) => (
        row.getValue('allowsCustomMaterials') ? (
          <Badge className="bg-green-100 text-green-800">Oui</Badge>
        ) : (
          <Badge variant="secondary">Non</Badge>
        )
      ),
    },
    {
      id: 'actions',
      cell: ({ row }: any) => (
        <DataTableRowActions
          row={row}
          onView={() => handleViewProduct(row.original)}
          onEdit={() => handleEditProduct(row.original)}
          onDelete={() => handleDeleteProduct(row.original.id)}
        />
      ),
    },
  ]

  // Category columns
  const categoryColumns = [
    {
      accessorKey: 'name',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Nom de la catégorie" />
      ),
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <Grid3X3 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.getValue('name')}</span>
        </div>
      ),
    },
    {
      accessorKey: 'slug',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Slug" />
      ),
      cell: ({ row }: any) => (
        <code className="text-sm bg-muted px-2 py-1 rounded">{row.getValue('slug')}</code>
      ),
    },
    {
      accessorKey: 'parent',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Catégorie parent" />
      ),
      cell: ({ row }: any) => row.getValue('parent') || '-',
    },
    {
      accessorKey: 'products_count',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Nombre de produits" />
      ),
      cell: ({ row }: any) => (
        <div className="text-center">{row.getValue('products_count') || 0}</div>
      ),
    },
    {
      accessorKey: 'is_active',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Statut" />
      ),
      cell: ({ row }: any) => (
        <Badge variant={row.getValue('is_active') ? 'default' : 'secondary'}>
          {row.getValue('is_active') ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }: any) => (
        <DataTableRowActions
          row={row}
          onEdit={() => handleEditCategory(row.original)}
          onDelete={() => handleDeleteCategory(row.original.id)}
        />
      ),
    },
  ]

  // Materials columns
  const materialColumns = [
    {
      accessorKey: 'name',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Nom du matériau" />
      ),
      cell: ({ row }: any) => (
        <div className="font-medium">{row.getValue('name')}</div>
      ),
    },
    {
      accessorKey: 'type',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }: any) => (
        <Badge variant="outline">{row.getValue('type')}</Badge>
      ),
    },
    {
      accessorKey: 'code',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Code" />
      ),
      cell: ({ row }: any) => (
        <code className="text-sm">{row.getValue('code')}</code>
      ),
    },
    {
      accessorKey: 'cost_per_unit',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Coût unitaire" />
      ),
      cell: ({ row }: any) => (
        <div>{formatCurrency(row.getValue('cost_per_unit'))}</div>
      ),
    },
    {
      accessorKey: 'stock_quantity',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Stock" />
      ),
      cell: ({ row }: any) => (
        <div>{row.getValue('stock_quantity')} {row.original.unit_of_measure}</div>
      ),
    },
    {
      accessorKey: 'supplier',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Fournisseur" />
      ),
      cell: ({ row }: any) => row.getValue('supplier') || '-',
    },
    {
      id: 'actions',
      cell: ({ row }: any) => (
        <DataTableRowActions
          row={row}
          onEdit={() => handleEditMaterial(row.original)}
          onDelete={() => handleDeleteMaterial(row.original.id)}
        />
      ),
    },
  ]

  // Finishes columns
  const finishColumns = [
    {
      accessorKey: 'name',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Nom de la finition" />
      ),
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          {row.original.hex_color && (
            <div
              className="w-6 h-6 rounded border"
              style={{ backgroundColor: row.original.hex_color }}
            />
          )}
          <span className="font-medium">{row.getValue('name')}</span>
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }: any) => (
        <Badge variant="outline">{row.getValue('type')}</Badge>
      ),
    },
    {
      accessorKey: 'code',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Code" />
      ),
      cell: ({ row }: any) => (
        <code className="text-sm">{row.getValue('code')}</code>
      ),
    },
    {
      accessorKey: 'extra_cost',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Coût supplémentaire" />
      ),
      cell: ({ row }: any) => {
        const cost = row.getValue('extra_cost') as number
        return cost > 0 ? (
          <div className="text-green-600 font-medium">+{formatCurrency(cost)}</div>
        ) : (
          <div className="text-muted-foreground">-</div>
        )
      },
    },
    {
      accessorKey: 'is_active',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Statut" />
      ),
      cell: ({ row }: any) => (
        <Badge variant={row.getValue('is_active') ? 'default' : 'secondary'}>
          {row.getValue('is_active') ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }: any) => (
        <DataTableRowActions
          row={row}
          onEdit={() => handleEditFinish(row.original)}
          onDelete={() => handleDeleteFinish(row.original.id)}
        />
      ),
    },
  ]

  // Use API data instead of mock data
  const products = productsData || []
  const categories = categoriesData || []
  const materials = materialsData || []
  const finishes = finishesData || []

  // Filter products by category
  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter((product: any) => product.categoryId === selectedCategory)

  // Handlers
  const handleEditProduct = async (product: any) => {
    try {
      // Fetch full product details including materials
      const fullProduct = await productsApi.getById(product.id)
      setEditingItem(fullProduct)
      setShowProductForm(true)
    } catch (error) {
      toast.error('Erreur lors du chargement du produit')
    }
  }

  const handleDeleteProduct = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      deleteProductMutation.mutate(id)
    }
  }

  const handleViewProduct = async (product: any) => {
    try {
      // Fetch full product details including materials
      const fullProduct = await productsApi.getById(product.id)
      setViewingProduct(fullProduct)
      setShowProductDetails(true)
    } catch (error) {
      toast.error('Erreur lors du chargement des détails du produit')
    }
  }

  const handleEditCategory = (category: any) => {
    setEditingItem(category)
    setShowCategoryForm(true)
  }

  const handleDeleteCategory = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
      deleteCategoryMutation.mutate(id)
    }
  }

  const handleEditMaterial = (material: any) => {
    setEditingItem(material)
    setShowMaterialForm(true)
  }

  const handleDeleteMaterial = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce matériau ?')) {
      deleteMaterialMutation.mutate(id)
    }
  }

  const handleEditFinish = (finish: any) => {
    setEditingItem(finish)
    setShowFinishForm(true)
  }

  const handleDeleteFinish = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette finition ?')) {
      deleteFinishMutation.mutate(id)
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion du Catalogue</h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos produits, catégories, matériaux et finitions
          </p>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Produits
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" />
            Catégories
          </TabsTrigger>
          <TabsTrigger value="materials" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Matériaux
          </TabsTrigger>
          <TabsTrigger value="finishes" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Finitions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Produits</CardTitle>
                <CardDescription>
                  Gérez votre catalogue de meubles et leurs options de personnalisation
                </CardDescription>
              </div>
              <Button onClick={() => {
                setEditingItem(null)
                setShowProductForm(true)
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau produit
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category Filter */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Catégorie:</span>
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Toutes les catégories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les catégories</SelectItem>
                    {categories.map((category: any) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Products Table */}
              <DataTable
                columns={productColumns}
                data={filteredProducts}
                searchPlaceholder="Rechercher un produit..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Catégories</CardTitle>
                <CardDescription>
                  Organisez vos produits par catégories
                </CardDescription>
              </div>
              <Button onClick={() => {
                setEditingItem(null)
                setShowCategoryForm(true)
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle catégorie
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={categoryColumns}
                data={categories}
                searchPlaceholder="Rechercher une catégorie..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Matériaux</CardTitle>
                <CardDescription>
                  Gérez les matériaux disponibles pour la fabrication
                </CardDescription>
              </div>
              <Button onClick={() => {
                setEditingItem(null)
                setShowMaterialForm(true)
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau matériau
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={materialColumns}
                data={materials}
                searchPlaceholder="Rechercher un matériau..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finishes" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Finitions</CardTitle>
                <CardDescription>
                  Gérez les finitions et couleurs disponibles
                </CardDescription>
              </div>
              <Button onClick={() => {
                setEditingItem(null)
                setShowFinishForm(true)
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle finition
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={finishColumns}
                data={finishes}
                searchPlaceholder="Rechercher une finition..."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Product Form Dialog */}
      <Dialog open={showProductForm} onOpenChange={setShowProductForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Modifier le produit' : 'Nouveau produit'}
            </DialogTitle>
          </DialogHeader>
          <ProductForm
            product={editingItem}
            categories={categories}
            materials={materials}
            finishes={finishes}
            onSubmit={handleProductSubmit}
            onClose={() => {
              setShowProductForm(false)
              setEditingItem(null)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Category Form Dialog */}
      <Dialog open={showCategoryForm} onOpenChange={setShowCategoryForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </DialogTitle>
          </DialogHeader>
          <CategoryForm
            category={editingItem}
            categories={categories}
            onSubmit={handleCategorySubmit}
            onClose={() => {
              setShowCategoryForm(false)
              setEditingItem(null)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Material Form Dialog */}
      <Dialog open={showMaterialForm} onOpenChange={setShowMaterialForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Modifier le matériau' : 'Nouveau matériau'}
            </DialogTitle>
          </DialogHeader>
          <MaterialForm
            material={editingItem}
            onSubmit={handleMaterialSubmit}
            onClose={() => {
              setShowMaterialForm(false)
              setEditingItem(null)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Finish Form Dialog */}
      <Dialog open={showFinishForm} onOpenChange={setShowFinishForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Modifier la finition' : 'Nouvelle finition'}
            </DialogTitle>
          </DialogHeader>
          <FinishForm
            finish={editingItem}
            onSubmit={handleFinishSubmit}
            onClose={() => {
              setShowFinishForm(false)
              setEditingItem(null)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Product Details Dialog */}
      <Dialog open={showProductDetails} onOpenChange={setShowProductDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Détails du produit</DialogTitle>
          </DialogHeader>
          {viewingProduct && (
            <div className="space-y-6">
              {/* Header Section */}
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold">{viewingProduct.name}</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">SKU: {viewingProduct.sku}</Badge>
                    <Badge variant={viewingProduct.is_customizable ? "default" : "secondary"}>
                      {viewingProduct.is_customizable ? "Personnalisable" : "Standard"}
                    </Badge>
                    {viewingProduct.is_made_to_order && (
                      <Badge variant="warning">Sur commande</Badge>
                    )}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  {viewingProduct.materialCost > 0 ? (
                    <>
                      <div className="text-sm text-muted-foreground">Prix de base HT: {formatCurrency(viewingProduct.basePrice)}</div>
                      <div className="text-sm text-muted-foreground">Coûts finitions: {formatCurrency(viewingProduct.materialCost)}</div>
                      <div className="text-2xl font-bold text-green-600">{formatCurrency(viewingProduct.totalPrice)}</div>
                      <div className="text-sm text-muted-foreground">Prix total HT</div>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{formatCurrency(viewingProduct.totalPrice || viewingProduct.basePrice)}</div>
                      <div className="text-sm text-muted-foreground">Prix HT</div>
                    </>
                  )}
                </div>
              </div>

              {/* Product Images Gallery */}
              {viewingProduct.images && viewingProduct.images.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Images du produit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {viewingProduct.images.map((img: any, index: number) => (
                        <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border bg-gray-50">
                          <img
                            src={img.url}
                            alt={img.originalName || `Image ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {img.isMain && (
                            <Badge className="absolute top-2 left-2 bg-yellow-500">
                              Principale
                            </Badge>
                          )}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => window.open(img.url, '_blank')}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Voir
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Main Information Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Informations générales
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Type</div>
                        <div className="font-medium">{viewingProduct.type}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Catégorie</div>
                        <div className="font-medium">{viewingProduct.categoryName || 'Non catégorisé'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Stock</div>
                        <div className="font-medium">
                          {viewingProduct.stockQuantity} unités
                          {viewingProduct.stockQuantity < 10 && (
                            <Badge variant="destructive" className="ml-2 text-xs">Faible</Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Délai de fabrication</div>
                        <div className="font-medium">{viewingProduct.manufacturing_time || '2-4 semaines'}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      Dimensions & Matériaux
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Longueur</div>
                        <div className="font-medium">{viewingProduct.dimensions?.length ? `${viewingProduct.dimensions.length} cm` : 'Non spécifié'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Largeur</div>
                        <div className="font-medium">{viewingProduct.dimensions?.width ? `${viewingProduct.dimensions.width} cm` : 'Non spécifié'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Hauteur</div>
                        <div className="font-medium">{viewingProduct.dimensions?.height ? `${viewingProduct.dimensions.height} cm` : 'Non spécifié'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Poids</div>
                        <div className="font-medium">{viewingProduct.weight ? `${viewingProduct.weight} kg` : 'Non spécifié'}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Matériaux et finitions du produit */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Composition et matériaux
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {viewingProduct.materials && viewingProduct.materials.length > 0 ? (
                    <div className="space-y-4">
                      {viewingProduct.materials.map((material: any, index: number) => (
                        <div key={index} className="border rounded-lg p-3 space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="font-medium">
                              {material.partName || `Partie ${index + 1}`}
                            </div>
                            {material.extraCost > 0 && (
                              <Badge variant="secondary">
                                +{formatCurrency(material.extraCost)}
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Matériau:</span>
                              <div className="font-medium">{material.materialName || 'Non spécifié'}</div>
                            </div>
                            {material.finishName && material.finishName !== 'none' && (
                              <div>
                                <span className="text-muted-foreground">Finition:</span>
                                <div className="font-medium">{material.finishName}</div>
                              </div>
                            )}
                            {material.quantity && (
                              <div>
                                <span className="text-muted-foreground">Quantité:</span>
                                <div className="font-medium">
                                  {material.quantity} {material.unit || 'unité'}
                                </div>
                              </div>
                            )}
                          </div>
                          {material.notes && (
                            <div className="text-xs text-muted-foreground italic">
                              {material.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <p>Aucun matériau spécifique défini</p>
                      <p className="text-sm mt-2">
                        Les matériaux peuvent être définis lors de la modification du produit
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Options de personnalisation */}
              {viewingProduct.allowsCustomMaterials && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Options de personnalisation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-blue-700">
                        <Settings className="h-5 w-5" />
                        <span className="font-medium">Personnalisation disponible</span>
                      </div>
                      <p className="text-sm text-blue-600 mt-2">
                        Ce produit peut être personnalisé avec différents matériaux et finitions selon les préférences du client.
                        Les options disponibles seront présentées lors de la création du devis.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Description */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Description
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {viewingProduct.description || `${viewingProduct.name} - Produit de haute qualité fabriqué en France avec des matériaux nobles. Design moderne et élégant qui s'adapte à tous les intérieurs. Garantie 2 ans sur la structure et 1 an sur le revêtement.`}
                  </p>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowProductDetails(false)}>
                  Fermer
                </Button>
                <Button onClick={() => {
                  setEditingItem(viewingProduct)
                  setShowProductDetails(false)
                  setShowProductForm(true)
                }}>
                  <Edit className="mr-2 h-4 w-4" />
                  Modifier
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}