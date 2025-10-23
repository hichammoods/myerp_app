import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface MaterialFormProps {
  onClose: () => void
  onSubmit: (data: any) => void
  material?: any
}

export function MaterialForm({ onClose, onSubmit, material }: MaterialFormProps) {
  const [formData, setFormData] = useState({
    name: material?.name || '',
    type: material?.type || 'bois',
    code: material?.code || '',
    cost_per_unit: material?.cost_per_unit || '',
    stock_quantity: material?.stock_quantity || '',
    unit_of_measure: material?.unit_of_measure || 'm²',
    supplier: material?.supplier || '',
    description: material?.description || '',
    is_active: material?.is_active ?? true,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!onSubmit || typeof onSubmit !== 'function') {
      console.error('MaterialForm: onSubmit is not a function', { onSubmit })
      return
    }
    onSubmit(formData)
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du matériau *</Label>
              <Input
                id="name"
                placeholder="Ex: Bois de chêne"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                placeholder="Ex: BOIS-CHENE-001"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bois">Bois</SelectItem>
                  <SelectItem value="tissu">Tissu</SelectItem>
                  <SelectItem value="cuir">Cuir</SelectItem>
                  <SelectItem value="metal">Métal</SelectItem>
                  <SelectItem value="plastique">Plastique</SelectItem>
                  <SelectItem value="verre">Verre</SelectItem>
                  <SelectItem value="mousse">Mousse</SelectItem>
                  <SelectItem value="composite">Composite</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost_per_unit">Coût unitaire (€) *</Label>
              <Input
                id="cost_per_unit"
                type="number"
                step="0.01"
                placeholder="Ex: 45.50"
                value={formData.cost_per_unit}
                onChange={(e) => setFormData({ ...formData, cost_per_unit: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock_quantity">Stock disponible *</Label>
              <Input
                id="stock_quantity"
                type="number"
                step="0.001"
                placeholder="Ex: 150"
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit_of_measure">Unité de mesure *</Label>
              <Select
                value={formData.unit_of_measure}
                onValueChange={(value) => setFormData({ ...formData, unit_of_measure: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une unité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="m">Mètre (m)</SelectItem>
                  <SelectItem value="m²">Mètre carré (m²)</SelectItem>
                  <SelectItem value="m³">Mètre cube (m³)</SelectItem>
                  <SelectItem value="kg">Kilogramme (kg)</SelectItem>
                  <SelectItem value="l">Litre (l)</SelectItem>
                  <SelectItem value="piece">Pièce</SelectItem>
                  <SelectItem value="rouleau">Rouleau</SelectItem>
                  <SelectItem value="plaque">Plaque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Fournisseur</Label>
              <Input
                id="supplier"
                placeholder="Ex: Bois de France SARL"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="is_active">Statut</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active" className="font-normal">
                  {formData.is_active ? 'Actif' : 'Inactif'}
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className="w-full px-3 py-2 border rounded-md min-h-[80px]"
              placeholder="Description détaillée du matériau, caractéristiques, origine..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">
              {material ? 'Mettre à jour' : 'Créer le matériau'}
            </Button>
          </div>
        </form>
  )
}