import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Plus, Trash2, Image, ChevronDown } from 'lucide-react'
import { ImageUpload } from '@/components/ImageUpload'

interface MaterialEntry {
  id: string
  partName: string
  materialId: string
  finishId: string
  quantity: number
  unit: string
  extraCost: number
  notes: string
}

interface ProductFormProps {
  onClose: () => void
  onSubmit: (data: any) => void
  product?: any
  categories?: any[]
  materials?: any[]
  finishes?: any[]
}

const UNITS = [
  { id: 'm', name: 'Mètre' },
  { id: 'm2', name: 'Mètre carré' },
  { id: 'm3', name: 'Mètre cube' },
  { id: 'kg', name: 'Kilogramme' },
  { id: 'piece', name: 'Pièce' },
  { id: 'l', name: 'Litre' },
]

export function ProductForm({ onClose, onSubmit, product, categories = [], materials: availableMaterials = [], finishes: availableFinishes = [] }: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    categoryId: product?.categoryId || '',
    basePrice: product?.basePrice || '',
    description: product?.description || '',
    dimensions: product?.dimensions || { length: '', width: '', height: '' },
    weight: product?.weight || '',
    stockQuantity: product?.stockQuantity || 0,
    leadTime: product?.leadTime || 14,
    allowsCustomMaterials: product?.allowsCustomMaterials ?? true,
  })

  const [materialEntries, setMaterialEntries] = useState<MaterialEntry[]>(() => {
    if (product?.materials && product.materials.length > 0) {
      return product.materials.map((m: any) => ({
        id: m.id || Date.now().toString(),
        partName: m.partName || '',
        materialId: m.materialId || '',
        finishId: m.finishId || 'none',
        quantity: m.quantity || 1,
        unit: m.unit || 'piece',
        extraCost: parseFloat(m.extraCost) || 0,
        notes: m.notes || '',
      }))
    }
    return [
      {
        id: '1',
        partName: '',
        materialId: '',
        finishId: 'none',
        quantity: 1,
        unit: 'piece',
        extraCost: 0,
        notes: '',
      },
    ]
  })

  const [productImages, setProductImages] = useState(product?.images || [])

  // Sync productImages state when product prop changes
  useEffect(() => {
    if (product?.images) {
      setProductImages(product.images)
    } else {
      setProductImages([])
    }
  }, [product?.images])

  const addMaterial = () => {
    setMaterialEntries([
      ...materialEntries,
      {
        id: Date.now().toString(),
        partName: '',
        materialId: '',
        finishId: 'none',
        quantity: 1,
        unit: 'piece',
        extraCost: 0,
        notes: '',
      },
    ])
  }

  const removeMaterial = (id: string) => {
    if (materialEntries.length > 1) {
      setMaterialEntries(materialEntries.filter((m) => m.id !== id))
    }
  }

  const updateMaterial = (id: string, field: keyof MaterialEntry, value: any) => {
    console.log('updateMaterial called:', { id, field, value })
    const updated = materialEntries.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    console.log('Updated materials:', updated)
    setMaterialEntries(updated)
  }

  const getAvailableFinishes = (materialId: string) => {
    // Return all finishes for now - filtering can be added later if needed
    return availableFinishes
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      ...formData,
      materials: materialEntries
        .filter((m) => m.materialId && m.partName)
        .map((m) => ({
          ...m,
          finishId: (m.finishId === 'none' || !m.finishId) ? null : m.finishId,
        })),
      // Don't include images - they're managed separately via upload/delete endpoints
      // images: productImages,
    }
    console.log('Submitting product with materials:', JSON.stringify(data.materials, null, 2))
    onSubmit(data)
    onClose()
  }

  return (
    <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
      <CardHeader>
        <CardTitle>{product ? 'Modifier le Produit' : 'Nouveau Produit'}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-y-auto max-h-[calc(90vh-120px)]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">Informations</TabsTrigger>
              <TabsTrigger value="images">
                <Image className="h-4 w-4 mr-2" />
                Images
              </TabsTrigger>
              <TabsTrigger value="materials">Matériaux</TabsTrigger>
              <TabsTrigger value="specifications">Spécifications</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom du produit *</Label>
                  <Input
                    id="name"
                    placeholder="ex: Canapé 3 places moderne"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">Référence (SKU) *</Label>
                  <Input
                    id="sku"
                    placeholder="ex: CAN-3P-MOD-001"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoryId">Catégorie *</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="basePrice">Prix de base (€) *</Label>
                  <Input
                    id="basePrice"
                    type="number"
                    step="0.01"
                    placeholder="ex: 1500.00"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stockQuantity">Stock disponible</Label>
                  <Input
                    id="stockQuantity"
                    type="number"
                    placeholder="ex: 10"
                    value={formData.stockQuantity}
                    onChange={(e) =>
                      setFormData({ ...formData, stockQuantity: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leadTime">Délai de fabrication (jours)</Label>
                  <Input
                    id="leadTime"
                    type="number"
                    placeholder="ex: 14"
                    value={formData.leadTime}
                    onChange={(e) =>
                      setFormData({ ...formData, leadTime: parseInt(e.target.value) || 14 })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                  placeholder="Description détaillée du produit..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="allowsCustom"
                  checked={formData.allowsCustomMaterials}
                  onChange={(e) =>
                    setFormData({ ...formData, allowsCustomMaterials: e.target.checked })
                  }
                />
                <Label htmlFor="allowsCustom">
                  Autoriser la personnalisation des matériaux lors de la commande
                </Label>
              </div>
            </TabsContent>

            <TabsContent value="images" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Images du produit</Label>
                  <p className="text-sm text-muted-foreground">
                    Ajoutez des images pour votre produit. La première image sera utilisée comme image principale.
                  </p>
                </div>
                <ImageUpload
                  images={productImages}
                  onImagesChange={setProductImages}
                  maxImages={10}
                  maxSize={5}
                  showGallery={true}
                  productName={formData.name || 'Produit'}
                  productId={product?.id}
                />
              </div>
            </TabsContent>

            <TabsContent value="materials" className="space-y-4 mt-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-4">
                  <Label>Matériaux et finitions du produit</Label>
                  <Button type="button" onClick={addMaterial} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un matériau
                  </Button>
                </div>

                <Accordion type="multiple" className="w-full">
                  {materialEntries.map((material, index) => (
                    <AccordionItem key={material.id} value={material.id}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex justify-between items-center w-full pr-4">
                          <span className="font-medium">
                            Matériau {index + 1} {material.partName && `- ${material.partName}`}
                          </span>
                          {materialEntries.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeMaterial(material.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-4">

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Partie du produit *</Label>
                          <Input
                            placeholder="ex: Assise, Dossier, Structure, Pieds..."
                            value={material.partName}
                            onChange={(e) =>
                              updateMaterial(material.id, 'partName', e.target.value)
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Matériau *</Label>
                          <Select
                            value={material.materialId}
                            onValueChange={(value) =>
                              updateMaterial(material.id, 'materialId', value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un matériau" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableMaterials.map((mat: any) => (
                                <SelectItem key={mat.id} value={mat.id}>
                                  {mat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Finition</Label>
                          <Select
                            key={`finish-${material.id}-${material.finishId}`}
                            value={material.finishId || 'none'}
                            onValueChange={(value) => {
                              console.log('Finish selected:', value)
                              console.log('Current material:', material)

                              // Create updated entries with both finishId and extraCost
                              const updatedEntries = materialEntries.map((m) => {
                                if (m.id === material.id) {
                                  if (value !== 'none' && value) {
                                    const selectedFinish = availableFinishes.find((f: any) => f.id === value)
                                    console.log('Selected finish:', selectedFinish)
                                    if (selectedFinish) {
                                      const extraCost = parseFloat(selectedFinish.extra_cost) || 0
                                      console.log('Setting finish and cost:', { finishId: value, extraCost })
                                      return { ...m, finishId: value, extraCost }
                                    }
                                  }
                                  // Reset to none
                                  return { ...m, finishId: value, extraCost: 0 }
                                }
                                return m
                              })
                              console.log('Updated material entries:', updatedEntries)
                              setMaterialEntries(updatedEntries)
                            }}
                            disabled={!material.materialId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner une finition" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sans finition</SelectItem>
                              {getAvailableFinishes(material.materialId).map((fin: any) => (
                                <SelectItem key={fin.id} value={fin.id}>
                                  {fin.name} {parseFloat(fin.extra_cost) > 0 && `(+${parseFloat(fin.extra_cost).toFixed(2)}€)`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Quantité</Label>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              step="0.001"
                              placeholder="1"
                              value={material.quantity}
                              onChange={(e) =>
                                updateMaterial(
                                  material.id,
                                  'quantity',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="flex-1"
                            />
                            <Select
                              value={material.unit}
                              onValueChange={(value) =>
                                updateMaterial(material.id, 'unit', value)
                              }
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UNITS.map((unit) => (
                                  <SelectItem key={unit.id} value={unit.id}>
                                    {unit.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Coût supplémentaire (€)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={material.extraCost}
                            onChange={(e) =>
                              updateMaterial(
                                material.id,
                                'extraCost',
                                parseFloat(e.target.value) || 0
                              )
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            Auto-rempli depuis la finition (modifiable)
                          </p>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Notes</Label>
                          <Input
                            placeholder="Notes optionnelles sur ce matériau..."
                            value={material.notes}
                            onChange={(e) =>
                              updateMaterial(material.id, 'notes', e.target.value)
                            }
                          />
                        </div>
                      </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </TabsContent>

            <TabsContent value="specifications" className="space-y-4 mt-4">
              <div className="space-y-4">
                <Label>Dimensions (cm)</Label>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="length">Longueur</Label>
                    <Input
                      id="length"
                      type="number"
                      placeholder="ex: 200"
                      value={formData.dimensions.length}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dimensions: { ...formData.dimensions, length: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="width">Largeur</Label>
                    <Input
                      id="width"
                      type="number"
                      placeholder="ex: 90"
                      value={formData.dimensions.width}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dimensions: { ...formData.dimensions, width: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Hauteur</Label>
                    <Input
                      id="height"
                      type="number"
                      placeholder="ex: 80"
                      value={formData.dimensions.height}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dimensions: { ...formData.dimensions, height: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weight">Poids (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    placeholder="ex: 45.5"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Instructions de fabrication</h4>
                  <p className="text-sm text-blue-700">
                    Les instructions détaillées de fabrication peuvent être ajoutées après la
                    création du produit via le système de documentation.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">{product ? 'Mettre à jour' : 'Créer le produit'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}