import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface FinishFormProps {
  onClose: () => void
  onSubmit: (data: any) => void
  finish?: any
}

export function FinishForm({ onClose, onSubmit, finish }: FinishFormProps) {
  const [formData, setFormData] = useState({
    name: finish?.name || '',
    type: finish?.type || 'finition_bois',
    code: finish?.code || '',
    hex_color: finish?.hex_color || '',
    extra_cost: finish?.extra_cost || '',
    is_active: finish?.is_active ?? true,
    applicable_to: finish?.applicable_to || [],
    description: finish?.description || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de la finition *</Label>
              <Input
                id="name"
                placeholder="Ex: Vernis mat, Chêne naturel"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                placeholder="Ex: FIN-VERNIS-MAT"
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
                  <SelectItem value="finition_bois">Finition bois</SelectItem>
                  <SelectItem value="couleur">Couleur</SelectItem>
                  <SelectItem value="vernis">Vernis</SelectItem>
                  <SelectItem value="laque">Laque</SelectItem>
                  <SelectItem value="huile">Huile</SelectItem>
                  <SelectItem value="cire">Cire</SelectItem>
                  <SelectItem value="peinture">Peinture</SelectItem>
                  <SelectItem value="teinture">Teinture</SelectItem>
                  <SelectItem value="traitement">Traitement</SelectItem>
                  <SelectItem value="finition_metal">Finition métal</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hex_color">Couleur hexadécimale</Label>
              <div className="flex gap-2">
                <Input
                  id="hex_color"
                  type="text"
                  placeholder="Ex: #D2691E"
                  value={formData.hex_color}
                  onChange={(e) => setFormData({ ...formData, hex_color: e.target.value })}
                  className="flex-1"
                />
                {formData.hex_color && (
                  <div
                    className="w-10 h-10 rounded border-2 border-gray-300"
                    style={{ backgroundColor: formData.hex_color }}
                  />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="extra_cost">Coût supplémentaire (€)</Label>
              <Input
                id="extra_cost"
                type="number"
                step="0.01"
                placeholder="Ex: 50.00"
                value={formData.extra_cost}
                onChange={(e) => setFormData({ ...formData, extra_cost: e.target.value })}
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
                  {formData.is_active ? 'Active' : 'Inactive'}
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Applicable aux matériaux</Label>
            <div className="grid grid-cols-3 gap-2">
              {['Bois', 'Tissu', 'Cuir', 'Métal', 'Plastique', 'Verre'].map((material) => (
                <div key={material} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`mat-${material}`}
                    checked={formData.applicable_to.includes(material)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          applicable_to: [...formData.applicable_to, material],
                        })
                      } else {
                        setFormData({
                          ...formData,
                          applicable_to: formData.applicable_to.filter((m: string) => m !== material),
                        })
                      }
                    }}
                    className="h-4 w-4"
                  />
                  <Label htmlFor={`mat-${material}`} className="font-normal">
                    {material}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className="w-full px-3 py-2 border rounded-md min-h-[80px]"
              placeholder="Description détaillée de la finition..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">
              {finish ? 'Mettre à jour' : 'Créer la finition'}
            </Button>
          </div>
        </form>
  )
}