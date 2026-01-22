import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Building2, Copy, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Client {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  notes: string | null;
  access_code?: string | null;
}

const Clients = () => {
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const queryClient = useQueryClient();

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as any[];
    },
  });

  const copyAccessCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código de acceso copiado');
  };

  const createMutation = useMutation({
    mutationFn: async (client: Omit<Client, 'id'>) => {
      const { error } = await supabase.from('clients').insert(client);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente creado correctamente');
      setOpen(false);
    },
    onError: (error) => toast.error('Error: ' + error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (client: Client) => {
      const { error } = await supabase
        .from('clients')
        .update(client)
        .eq('id', client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente actualizado correctamente');
      setOpen(false);
      setEditingClient(null);
    },
    onError: (error) => toast.error('Error: ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente eliminado correctamente');
    },
    onError: (error) => toast.error('Error: ' + error.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const client = {
      name: formData.get('name') as string,
      contact_name: formData.get('contact_name') as string || null,
      contact_email: formData.get('contact_email') as string || null,
      contact_phone: formData.get('contact_phone') as string || null,
      address: formData.get('address') as string || null,
      notes: formData.get('notes') as string || null,
    };

    if (editingClient) {
      updateMutation.mutate({ ...client, id: editingClient.id });
    } else {
      createMutation.mutate(client);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-muted-foreground mt-1">Gestiona las empresas clientes</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingClient(null); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la empresa *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingClient?.name}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_name">Nombre de contacto</Label>
                <Input
                  id="contact_name"
                  name="contact_name"
                  defaultValue={editingClient?.contact_name ?? ''}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Email</Label>
                  <Input
                    id="contact_email"
                    name="contact_email"
                    type="email"
                    defaultValue={editingClient?.contact_email ?? ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Teléfono</Label>
                  <Input
                    id="contact_phone"
                    name="contact_phone"
                    defaultValue={editingClient?.contact_phone ?? ''}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  name="address"
                  defaultValue={editingClient?.address ?? ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={editingClient?.notes ?? ''}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingClient ? 'Guardar' : 'Crear'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : clients?.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/20">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No hay clientes</h3>
          <p className="text-muted-foreground mb-4">Comienza agregando tu primer cliente</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Código de Acceso</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients?.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>
                    {client.access_code ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono tracking-wider">
                          <KeyRound className="w-3 h-3 mr-1" />
                          {client.access_code}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyAccessCode(client.access_code)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{client.contact_name || '-'}</TableCell>
                  <TableCell>{client.contact_email || '-'}</TableCell>
                  <TableCell>{client.contact_phone || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingClient(client);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('¿Eliminar este cliente?')) {
                            deleteMutation.mutate(client.id);
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
      )}
    </div>
  );
};

export default Clients;
