import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usersApi } from '@/services/api'
import {
  Users,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
  Key,
  Search,
  Loader2,
  Copy
} from 'lucide-react'

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'sales' | 'inventory_manager'
  is_active: boolean
  suspended: boolean
  suspended_at?: string
  phone?: string
  last_login?: string
  created_at: string
}

export function UserManagement() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)

  // Form states
  const [createForm, setCreateForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'sales' as 'admin' | 'sales' | 'inventory_manager',
    phone: '',
    generate_password: true,
  })

  const [editForm, setEditForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'sales' as 'admin' | 'sales' | 'inventory_manager',
    phone: '',
  })

  // Fetch users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', { search, role: roleFilter !== 'all' ? roleFilter : undefined, status: statusFilter }],
    queryFn: () => usersApi.getAll({
      search: search || undefined,
      role: roleFilter !== 'all' ? roleFilter : undefined,
      status: statusFilter,
    }),
  })

  // Fetch roles metadata
  const { data: rolesData } = useQuery({
    queryKey: ['user-roles'],
    queryFn: usersApi.getRoles,
  })

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      if (data.generated_password) {
        setGeneratedPassword(data.generated_password)
      }
      toast.success('Utilisateur créé avec succès')
      setCreateDialogOpen(false)
      setCreateForm({
        email: '',
        first_name: '',
        last_name: '',
        role: 'sales',
        phone: '',
        generate_password: true,
      })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création de l\'utilisateur')
    },
  })

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Utilisateur modifié avec succès')
      setEditDialogOpen(false)
      setSelectedUser(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la modification')
    },
  })

  // Suspend/Unsuspend mutations
  const suspendMutation = useMutation({
    mutationFn: usersApi.suspend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Utilisateur suspendu')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suspension')
    },
  })

  const unsuspendMutation = useMutation({
    mutationFn: usersApi.unsuspend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Utilisateur réactivé')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la réactivation')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Utilisateur supprimé')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression')
    },
  })

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) => usersApi.resetPassword(id, data),
    onSuccess: (data) => {
      if (data.generated_password) {
        setGeneratedPassword(data.generated_password)
      }
      toast.success('Mot de passe réinitialisé')
      setPasswordDialogOpen(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la réinitialisation')
    },
  })

  const handleCreateUser = () => {
    createUserMutation.mutate(createForm)
  }

  const handleEditUser = () => {
    if (selectedUser) {
      updateUserMutation.mutate({ id: selectedUser.id, data: editForm })
    }
  }

  const handleOpenEdit = (user: User) => {
    setSelectedUser(user)
    setEditForm({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      phone: user.phone || '',
    })
    setEditDialogOpen(true)
  }

  const handleResetPassword = (user: User) => {
    setSelectedUser(user)
    setPasswordDialogOpen(true)
  }

  const handleConfirmResetPassword = () => {
    if (selectedUser) {
      resetPasswordMutation.mutate({ id: selectedUser.id, data: { generate_password: true } })
    }
  }

  const handleSuspend = (userId: string) => {
    if (confirm('Êtes-vous sûr de vouloir suspendre cet utilisateur ?')) {
      suspendMutation.mutate(userId)
    }
  }

  const handleUnsuspend = (userId: string) => {
    unsuspendMutation.mutate(userId)
  }

  const handleDelete = (userId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.')) {
      deleteMutation.mutate(userId)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copié dans le presse-papier')
  }

  const getRoleLabel = (role: string) => {
    const roleObj = rolesData?.roles?.find((r: any) => r.value === role)
    return roleObj?.label || role
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-500 text-white hover:bg-purple-600'
      case 'sales':
        return 'bg-blue-500 text-white hover:bg-blue-600'
      case 'inventory_manager':
        return 'bg-green-500 text-white hover:bg-green-600'
      default:
        return ''
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gestion des Utilisateurs
              </CardTitle>
              <CardDescription>
                Créez et gérez les comptes utilisateurs et leurs permissions
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvel utilisateur
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher par nom ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrer par rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="admin">Administrateur</SelectItem>
                <SelectItem value="sales">Commercial</SelectItem>
                <SelectItem value="inventory_manager">Gestionnaire Stock</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="suspended">Suspendus</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersData?.users?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucun utilisateur trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  usersData?.users?.map((user: User) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {getRoleLabel(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.suspended ? (
                          <Badge variant="destructive">Suspendu</Badge>
                        ) : (
                          <Badge className="bg-green-500 text-white hover:bg-green-600">Actif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.last_login
                          ? new Date(user.last_login).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Jamais'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleOpenEdit(user)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                              <Key className="mr-2 h-4 w-4" />
                              Réinitialiser mot de passe
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.suspended ? (
                              <DropdownMenuItem
                                onClick={() => handleUnsuspend(user.id)}
                                className="text-green-600"
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Réactiver
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleSuspend(user.id)}
                                className="text-orange-600"
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Suspendre
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDelete(user.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
            <DialogDescription>
              Un mot de passe temporaire sera généré automatiquement
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">Prénom</Label>
                <Input
                  id="first_name"
                  value={createForm.first_name}
                  onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                  placeholder="Jean"
                />
              </div>
              <div>
                <Label htmlFor="last_name">Nom</Label>
                <Input
                  id="last_name"
                  value={createForm.last_name}
                  onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                  placeholder="Dupont"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="jean.dupont@exemple.fr"
              />
            </div>
            <div>
              <Label htmlFor="phone">Téléphone (optionnel)</Label>
              <Input
                id="phone"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                placeholder="+33 6 12 34 56 78"
              />
            </div>
            <div>
              <Label htmlFor="role">Rôle</Label>
              <Select
                value={createForm.role}
                onValueChange={(value: any) => setCreateForm({ ...createForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rolesData?.roles?.map((role: any) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div>
                        <div className="font-medium">{role.label}</div>
                        <div className="text-xs text-muted-foreground">{role.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateUser} disabled={createUserMutation.isPending}>
              {createUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer l'utilisateur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>
              Modifiez les informations de l'utilisateur
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_first_name">Prénom</Label>
                <Input
                  id="edit_first_name"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_last_name">Nom</Label>
                <Input
                  id="edit_last_name"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit_email">Email</Label>
              <Input
                id="edit_email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit_phone">Téléphone</Label>
              <Input
                id="edit_phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit_role">Rôle</Label>
              <Select
                value={editForm.role}
                onValueChange={(value: any) => setEditForm({ ...editForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rolesData?.roles?.map((role: any) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div>
                        <div className="font-medium">{role.label}</div>
                        <div className="text-xs text-muted-foreground">{role.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleEditUser} disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              Un nouveau mot de passe temporaire sera généré. L'utilisateur devra le changer à sa prochaine connexion.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmResetPassword} disabled={resetPasswordMutation.isPending}>
              {resetPasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Réinitialiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generated Password Dialog */}
      <Dialog open={!!generatedPassword} onOpenChange={() => setGeneratedPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mot de passe généré</DialogTitle>
            <DialogDescription>
              Copiez ce mot de passe et communiquez-le à l'utilisateur de manière sécurisée.
              Il ne sera plus affiché.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
            <code className="flex-1 text-lg font-mono">{generatedPassword}</code>
            <Button
              size="icon"
              variant="outline"
              onClick={() => copyToClipboard(generatedPassword || '')}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setGeneratedPassword(null)}>
              J'ai copié le mot de passe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
