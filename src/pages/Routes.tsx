import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Route as RouteIcon, Map, Upload } from 'lucide-react';
import GoogleMapsProvider from '@/components/maps/GoogleMapsProvider';
import RouteMap from '@/components/maps/RouteMap';
import { parseKmlFile, stringToCoordinates, coordinatesToString } from '@/lib/kmlParser';

interface RouteData {
  id: string;
  client_id: string | null;
  name: string;
  description: string | null;
  kml_file_path: string | null;
  origin_address: string | null;
  destination_address: string | null;
  estimated_duration_minutes: number | null;
  distance_km: number | null;
  is_active: boolean;
  clients?: { name: string } | null;
}

interface Client {
  id: string;
  name: string;
}

const Routes = () => {
  const [open, setOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteData | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [kmlCoordinates, setKmlCoordinates] = useState<{ lat: number; lng: number }[]>([]);
  const [tempCoordinates, setTempCoordinates] = useState<{ lat: number; lng: number }[]>([]);
  const queryClient = useQueryClient();

  const { data: routes, isLoading } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('*, clients(name)')
        .order('name');
      if (error) throw error;
      return data as RouteData[];
    },
  });

  const { data: clients } = useQuery({
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

  const createMutation = useMutation({
    mutationFn: async (route: Omit<RouteData, 'id' | 'clients'>) => {
      const { error } = await supabase.from('routes').insert(route);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast.success('Ruta creada correctamente');
      setOpen(false);
      setTempCoordinates([]);
    },
    onError: (error) => toast.error('Error: ' + error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (route: Omit<RouteData, 'clients'>) => {
      const { error } = await supabase
        .from('routes')
        .update(route)
        .eq('id', route.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast.success('Ruta actualizada correctamente');
      setOpen(false);
      setEditingRoute(null);
      setTempCoordinates([]);
    },
    onError: (error) => toast.error('Error: ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('routes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast.success('Ruta eliminada correctamente');
    },
    onError: (error) => toast.error('Error: ' + error.message),
  });

  const handleKmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const coordinates = parseKmlFile(content);
      if (coordinates.length > 0) {
        setTempCoordinates(coordinates);
        toast.success(`${coordinates.length} puntos cargados del archivo KML`);
      } else {
        toast.error('No se encontraron coordenadas en el archivo KML');
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const route = {
      name: formData.get('name') as string,
      client_id: formData.get('client_id') as string || null,
      description: formData.get('description') as string || null,
      origin_address: formData.get('origin_address') as string || null,
      destination_address: formData.get('destination_address') as string || null,
      estimated_duration_minutes: formData.get('estimated_duration_minutes') 
        ? parseInt(formData.get('estimated_duration_minutes') as string) 
        : null,
      distance_km: formData.get('distance_km') 
        ? parseFloat(formData.get('distance_km') as string) 
        : null,
      is_active: formData.get('is_active') === 'on',
      kml_file_path: tempCoordinates.length > 0 
        ? coordinatesToString(tempCoordinates) 
        : editingRoute?.kml_file_path || null,
    };

    if (editingRoute) {
      updateMutation.mutate({ ...route, id: editingRoute.id });
    } else {
      createMutation.mutate(route);
    }
  };

  const viewRouteMap = (route: RouteData) => {
    setSelectedRoute(route);
    setKmlCoordinates(stringToCoordinates(route.kml_file_path));
    setMapOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rutas</h1>
          <p className="text-muted-foreground mt-1">Gestiona las rutas de transporte</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { 
          setOpen(o); 
          if (!o) {
            setEditingRoute(null);
            setTempCoordinates([]);
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Ruta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRoute ? 'Editar Ruta' : 'Nueva Ruta'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la ruta *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingRoute?.name}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_id">Cliente</Label>
                <Select name="client_id" defaultValue={editingRoute?.client_id ?? ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={editingRoute?.description ?? ''}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="origin_address">Origen</Label>
                  <Input
                    id="origin_address"
                    name="origin_address"
                    defaultValue={editingRoute?.origin_address ?? ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destination_address">Destino</Label>
                  <Input
                    id="destination_address"
                    name="destination_address"
                    defaultValue={editingRoute?.destination_address ?? ''}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estimated_duration_minutes">Duración (min)</Label>
                  <Input
                    id="estimated_duration_minutes"
                    name="estimated_duration_minutes"
                    type="number"
                    defaultValue={editingRoute?.estimated_duration_minutes ?? ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="distance_km">Distancia (km)</Label>
                  <Input
                    id="distance_km"
                    name="distance_km"
                    type="number"
                    step="0.1"
                    defaultValue={editingRoute?.distance_km ?? ''}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Archivo KML</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".kml"
                    onChange={handleKmlUpload}
                    className="flex-1"
                  />
                </div>
                {(tempCoordinates.length > 0 || stringToCoordinates(editingRoute?.kml_file_path).length > 0) && (
                  <p className="text-sm text-primary">
                    ✓ {tempCoordinates.length || stringToCoordinates(editingRoute?.kml_file_path).length} puntos de ruta cargados
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  name="is_active"
                  defaultChecked={editingRoute?.is_active ?? true}
                />
                <Label htmlFor="is_active">Ruta activa</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingRoute ? 'Guardar' : 'Crear'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Mapa de Ruta: {selectedRoute?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 h-full min-h-[400px]">
            <GoogleMapsProvider>
              <RouteMap coordinates={kmlCoordinates} className="w-full h-full rounded-lg overflow-hidden" />
            </GoogleMapsProvider>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : routes?.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/20">
          <RouteIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No hay rutas</h3>
          <p className="text-muted-foreground mb-4">Comienza agregando tu primera ruta</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ruta</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Origen → Destino</TableHead>
                <TableHead>Duración / Distancia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-32">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes?.map((route) => (
                <TableRow key={route.id}>
                  <TableCell className="font-medium">{route.name}</TableCell>
                  <TableCell>{route.clients?.name || '-'}</TableCell>
                  <TableCell>
                    {route.origin_address && route.destination_address
                      ? `${route.origin_address} → ${route.destination_address}`
                      : route.origin_address || route.destination_address || '-'}
                  </TableCell>
                  <TableCell>
                    {route.estimated_duration_minutes 
                      ? `${route.estimated_duration_minutes} min` 
                      : '-'}
                    {route.distance_km && ` / ${route.distance_km} km`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={route.is_active ? 'default' : 'secondary'}>
                      {route.is_active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {stringToCoordinates(route.kml_file_path).length > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => viewRouteMap(route)}
                          title="Ver mapa"
                        >
                          <Map className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingRoute(route);
                          setTempCoordinates(stringToCoordinates(route.kml_file_path));
                          setOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('¿Eliminar esta ruta?')) {
                            deleteMutation.mutate(route.id);
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

export default Routes;
