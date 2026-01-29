import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Building2, Loader2, UserCheck, UserX } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

interface Supervisor {
  id: string;
  user_id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
}

interface SupervisorClient {
  id: string;
  supervisor_id: string;
  client_id: string;
}

const Supervisors = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState<Supervisor | null>(null);
  const [newSupervisor, setNewSupervisor] = useState({ email: '', password: '', name: '' });
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Only admins can access this page
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Fetch supervisors
  const { data: supervisors = [], isLoading: loadingSupervisors } = useQuery({
    queryKey: ['supervisors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supervisors')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Supervisor[];
    },
  });

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data as Client[];
    },
  });

  // Fetch supervisor_clients
  const { data: supervisorClients = [] } = useQuery({
    queryKey: ['supervisor_clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supervisor_clients')
        .select('*');
      if (error) throw error;
      return data as SupervisorClient[];
    },
  });

  // Create supervisor mutation
  const createSupervisor = async () => {
    setIsCreating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('create-supervisor', {
        body: {
          email: newSupervisor.email,
          password: newSupervisor.password,
          name: newSupervisor.name,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: 'Supervisor creado',
        description: `${newSupervisor.name} ha sido creado exitosamente.`,
      });

      setNewSupervisor({ email: '', password: '', name: '' });
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['supervisors'] });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear el supervisor',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Toggle supervisor active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('supervisors')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervisors'] });
      toast({
        title: 'Estado actualizado',
        description: 'El estado del supervisor ha sido actualizado.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Open assign clients dialog
  const openAssignDialog = (supervisor: Supervisor) => {
    setSelectedSupervisor(supervisor);
    const currentClientIds = supervisorClients
      .filter((sc) => sc.supervisor_id === supervisor.id)
      .map((sc) => sc.client_id);
    setSelectedClients(currentClientIds);
    setIsAssignOpen(true);
  };

  // Save client assignments
  const saveAssignments = async () => {
    if (!selectedSupervisor) return;

    try {
      // Get current assignments
      const currentAssignments = supervisorClients.filter(
        (sc) => sc.supervisor_id === selectedSupervisor.id
      );
      const currentClientIds = currentAssignments.map((sc) => sc.client_id);

      // Calculate additions and removals
      const toAdd = selectedClients.filter((id) => !currentClientIds.includes(id));
      const toRemove = currentClientIds.filter((id) => !selectedClients.includes(id));

      // Remove unselected clients
      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('supervisor_clients')
          .delete()
          .eq('supervisor_id', selectedSupervisor.id)
          .in('client_id', toRemove);
        if (removeError) throw removeError;
      }

      // Add new clients
      if (toAdd.length > 0) {
        const { error: addError } = await supabase.from('supervisor_clients').insert(
          toAdd.map((clientId) => ({
            supervisor_id: selectedSupervisor.id,
            client_id: clientId,
          }))
        );
        if (addError) throw addError;
      }

      toast({
        title: 'Clientes asignados',
        description: 'Las asignaciones han sido actualizadas.',
      });

      setIsAssignOpen(false);
      queryClient.invalidateQueries({ queryKey: ['supervisor_clients'] });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Get assigned clients count for a supervisor
  const getAssignedClientsCount = (supervisorId: string) => {
    return supervisorClients.filter((sc) => sc.supervisor_id === supervisorId).length;
  };

  // Get assigned client names for a supervisor
  const getAssignedClientNames = (supervisorId: string) => {
    const clientIds = supervisorClients
      .filter((sc) => sc.supervisor_id === supervisorId)
      .map((sc) => sc.client_id);
    return clients
      .filter((c) => clientIds.includes(c.id))
      .map((c) => c.name)
      .join(', ');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Supervisores</h1>
          <p className="text-muted-foreground">
            Gestiona supervisores y asigna clientes a cada uno
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Supervisor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Supervisor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  placeholder="Nombre completo"
                  value={newSupervisor.name}
                  onChange={(e) =>
                    setNewSupervisor({ ...newSupervisor, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={newSupervisor.email}
                  onChange={(e) =>
                    setNewSupervisor({ ...newSupervisor, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Contraseña segura"
                  value={newSupervisor.password}
                  onChange={(e) =>
                    setNewSupervisor({ ...newSupervisor, password: e.target.value })
                  }
                />
              </div>
              <Button
                className="w-full"
                onClick={createSupervisor}
                disabled={
                  isCreating ||
                  !newSupervisor.email ||
                  !newSupervisor.password ||
                  !newSupervisor.name
                }
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear Supervisor'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Supervisores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{supervisors.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activos</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {supervisors.filter((s) => s.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactivos</CardTitle>
            <UserX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {supervisors.filter((s) => !s.is_active).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Supervisores</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSupervisors ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : supervisors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay supervisores registrados
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Clientes Asignados</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supervisors.map((supervisor) => (
                  <TableRow key={supervisor.id}>
                    <TableCell className="font-medium">{supervisor.name}</TableCell>
                    <TableCell>{supervisor.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {getAssignedClientsCount(supervisor.id)} cliente(s)
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {getAssignedClientNames(supervisor.id) || 'Sin asignar'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={supervisor.is_active ? 'default' : 'secondary'}>
                        {supervisor.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAssignDialog(supervisor)}
                      >
                        <Building2 className="w-4 h-4 mr-1" />
                        Asignar Clientes
                      </Button>
                      <Button
                        variant={supervisor.is_active ? 'destructive' : 'default'}
                        size="sm"
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: supervisor.id,
                            is_active: !supervisor.is_active,
                          })
                        }
                      >
                        {supervisor.is_active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Assign Clients Dialog */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Asignar Clientes a {selectedSupervisor?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Selecciona los clientes que este supervisor podrá ver y gestionar:
            </p>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {clients.map((client) => (
                <div key={client.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={client.id}
                    checked={selectedClients.includes(client.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedClients([...selectedClients, client.id]);
                      } else {
                        setSelectedClients(
                          selectedClients.filter((id) => id !== client.id)
                        );
                      }
                    }}
                  />
                  <Label htmlFor={client.id} className="cursor-pointer">
                    {client.name}
                  </Label>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setIsAssignOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveAssignments}>Guardar Asignaciones</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Supervisors;
