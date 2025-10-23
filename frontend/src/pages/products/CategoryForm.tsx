import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface CategoryFormProps {
  onClose: () => void
  onSubmit: (data: any) => void
  category?: any
  categories?: any[] // To select parent category
}

export function CategoryForm({ onClose, onSubmit, category, categories = [] }: CategoryFormProps) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    slug: category?.slug || '',
    description: category?.description || '',
    is_active: category?.is_active ?? true,
    display_order: category?.display_order || 0,
  })

  // Auto-generate slug from name
  useEffect(() => {
    if (!category && formData.name) {
      const slug = formData.name
        .toLowerCase()
        .replace(/[éèêë]/g, 'e')
        .replace(/[àâä]/g, 'a')
        .replace(/[ùûü]/g, 'u')
        .replace(/[îï]/g, 'i')
        .replace(/[ôö]/g, 'o')
        .replace(/[ç]/g, 'c')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      setFormData(prev => ({ ...prev, slug }))
    }
  }, [formData.name, category])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de la catégorie *</Label>
              <Input
                id="name"
                placeholder="Ex: Canapés, Tables, Chaises"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL) *</Label>
              <Input
                id="slug"
                placeholder="Ex: canapes, tables, chaises"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                required
                pattern="[a-z0-9\-]+"
                title="Le slug ne doit contenir que des lettres minuscules, chiffres et tirets"
              />
              <p className="text-xs text-muted-foreground">
                Utilisé dans l'URL. Lettres minuscules, chiffres et tirets uniquement.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_order">Ordre d'affichage</Label>
              <Input
                id="display_order"
                type="number"
                placeholder="0"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Plus le nombre est petit, plus la catégorie apparaît en haut
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
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
              <p className="text-xs text-muted-foreground">
                Les catégories inactives ne sont pas visibles dans le catalogue
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className="w-full px-3 py-2 border rounded-md min-h-[80px]"
              placeholder="Description de la catégorie pour le référencement et l'affichage..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">
              {category ? 'Mettre à jour' : 'Créer la catégorie'}
            </Button>
          </div>
        </form>
  )
}