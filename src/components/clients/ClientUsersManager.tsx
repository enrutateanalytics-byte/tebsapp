import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, UserCheck, UserX, Eye, EyeOff, User, AtSign } from 'lucide-react';

interface ClientUser {
  id: string;
  user_id: string;
  client_id: string;
  name: string;
  username: string | null;
  email: string;
  is_active: boolean;
  created_at: string;
}

interface ClientUsersManagerProps {
  clientId: string;
  clientName: string;
}

const ClientUsersManager = ({ clientId, clientName }: ClientUsersManagerProps) => {
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
  });
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['client-users', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_users')
        .select('*')
        .eq('client_id', clientId)
        .order('name');
      if (error) throw error;
      return data as ClientUser[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (userData: { name: string; username: string; password: string }) => {
      const { data, error } = await supabase.functions.invoke('create-client-user', {
        body: {
          ...userData,
          client_id: clientId,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-users', clientId] });
      toast.success('Usuario creado correctamente');
      setOpen(false);
      setFormData({ name: '', username: '', password: '' });
    },
    onError: (error: Error) => toast.error('Error: ' + error.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('client_users')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ['client-users', clientId] });
      toast.success(is_active ? 'Usuario activado' : 'Usuario desactivado');
    },
    onError: (error: Error) => toast.error('Error: ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('client_users')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-users', clientId] });
      toast.success('Usuario eliminado');
    },
    onError: (error: Error) => toast.error('Error: ' + error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.username || !formData.password) {
      toast.error('Todos los campos son requeridos');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9._]{3,30}$/;
    if (!usernameRegex.test(formData.username)) {
      toast.error('El usuario debe tener 3-30 caracteres (letras, números, puntos o guiones bajos)');
      return;
    }
    createMutation.mutate(formData);
  };

  // Mobile card component
  const UserCard = ({ user }: { user: ClientUser }) => (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium truncate">{user.name}</span>
              <Badge variant={user.is_active ? 'default' : 'secondary'} className="text-xs">
                {user.is_active ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <AtSign className="w-3.5 h-3.5" />
              <span>{user.username || '-'}</span>
            </div>
          </div>
          
          <div className="flex gap-1 ml-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => toggleActiveMutation.mutate({ 
                id: user.id, 
                is_active: !user.is_active 
              })}
              title={user.is_active ? 'Desactivar' : 'Activar'}
            >
              {user.is_active ? (
                <UserX className="w-4 h-4" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => {
                if (confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) {
                  deleteMutation.mutate(user.id);
                }
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base md:text-lg font-medium">Usuarios de {clientName}</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Crear Usuario para {clientName}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userName">Nombre completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="userName"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Juan Pérez"
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="userUsername">Nombre de usuario</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="userUsername"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '') }))}
                    placeholder="juan.perez"
                    className="pl-9"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Solo letras, números, puntos y guiones bajos (3-30 caracteres)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="userPassword">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="userPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
                  {createMutation.isPending ? 'Creando...' : 'Crear Usuario'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground">Cargando usuarios...</div>
      ) : users?.length === 0 ? (
        <div className="text-center py-8 border rounded-lg bg-muted/20">
          <p className="text-muted-foreground text-sm">No hay usuarios registrados para este cliente</p>
        </div>
      ) : (
        <>
          {/* Mobile: Card view */}
          <div className="md:hidden">
            {users?.map((user) => (
              <UserCard key={user.id} user={user} />
            ))}
          </div>
          
          {/* Desktop: Table view */}
          <div className="hidden md:block border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">@</span>
                      {user.username || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'default' : 'secondary'}>
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleActiveMutation.mutate({ 
                            id: user.id, 
                            is_active: !user.is_active 
                          })}
                          title={user.is_active ? 'Desactivar' : 'Activar'}
                        >
                          {user.is_active ? (
                            <UserX className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) {
                              deleteMutation.mutate(user.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};

export default ClientUsersManager;