import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
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
import { Plus, Pencil, Trash2, Bus, MapPin, RefreshCw, Search, User, Users } from 'lucide-react';

interface Unit {
  id: string;
  plate_number: string;
  model: string | null;
  brand: string | null;
  year: number | null;
  capacity: number;
  driver_name: string | null;
  driver_phone: string | null;
  is_active: boolean;
  notes: string | null;
  imei: string | null;
}

const Units = () => {
  const [open, setOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: units, isLoading } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('plate_number');
      if (error) throw error;
      return data as Unit[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (unit: Omit<Unit, 'id'>) => {
      const { error } = await supabase.from('units').insert(unit);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      toast.success('Unidad creada correctamente');
      setOpen(false);
    },
    onError: (error) => toast.error('Error: ' + error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (unit: Unit) => {
      const { error } = await supabase
        .from('units')
        .update(unit)
        .eq('id', unit.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      toast.success('Unidad actualizada correctamente');
      setOpen(false);
      setEditingUnit(null);
    },
    onError: (error) => toast.error('Error: ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('units').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      toast.success('Unidad eliminada correctamente');
    },
    onError: (error) => toast.error('Error: ' + error.message),
  });

  const handleSyncTracksolid = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-tracksolid');
      if (error) throw error;
      if (data?.success) {
        toast.success(`Sincronizado: ${data.synced} posiciones nuevas`);
        queryClient.invalidateQueries({ queryKey: ['units'] });
      } else {
        toast.error(data?.error || 'Error al sincronizar');
      }
    } catch (error) {
      toast.error('Error al conectar con Tracksolid');
      console.error(error);
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const unit = {
      plate_number: formData.get('plate_number') as string,
      brand: formData.get('brand') as string || null,
      model: formData.get('model') as string || null,
      year: formData.get('year') ? parseInt(formData.get('year') as string) : null,
      capacity: parseInt(formData.get('capacity') as string) || 40,
      driver_name: formData.get('driver_name') as string || null,
      driver_phone: formData.get('driver_phone') as string || null,
      is_active: formData.get('is_active') === 'on',
      notes: formData.get('notes') as string || null,
      imei: formData.get('imei') as string || null,
    };

    if (editingUnit) {
      updateMutation.mutate({ ...unit, id: editingUnit.id });
    } else {
      createMutation.mutate(unit);
    }
  };

  const filteredUnits = useMemo(() => {
    if (!units || !searchQuery.trim()) return units;
    const query = searchQuery.toLowerCase();
    return units.filter((unit) =>
      unit.plate_number.toLowerCase().includes(query) ||
      unit.brand?.toLowerCase().includes(query) ||
      unit.model?.toLowerCase().includes(query) ||
      unit.driver_name?.toLowerCase().includes(query)
    );
  }, [units, searchQuery]);

  // Mobile card component
  const UnitCard = ({ unit }: { unit: Unit }) => (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Header with plate and status */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-bold text-lg">{unit.plate_number}</span>
              <Badge variant={unit.is_active ? 'default' : 'secondary'} className="text-xs">
                {unit.is_active ? 'Activa' : 'Inactiva'}
              </Badge>
              {unit.imei && (
                <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                  <MapPin className="w-3 h-3 mr-1" />
                  GPS
                </Badge>
              )}
            </div>
            
            {/* Vehicle info */}
            {(unit.brand || unit.model) && (
              <p className="text-sm text-muted-foreground mb-1">
                {`${unit.brand ?? ''} ${unit.model ?? ''} ${unit.year ?? ''}`.trim()}
              </p>
            )}
            
            {/* Capacity */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span>{unit.capacity} pasajeros</span>
            </div>
            
            {/* Driver */}
            {unit.driver_name && (
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span className="truncate">{unit.driver_name}</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-1 ml-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setEditingUnit(unit);
                setOpen(true);
              }}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => {
                if (confirm('¿Eliminar esta unidad?')) {
                  deleteMutation.mutate(unit.id);
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
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Unidades</h1>
          <p className="text-muted-foreground text-sm md:text-base mt-1">Gestiona los vehículos de la flota</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleSyncTracksolid}
            disabled={syncing}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar GPS'}
          </Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingUnit(null); }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Unidad
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingUnit ? 'Editar Unidad' : 'Nueva Unidad'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="plate_number">Número de placa *</Label>
                  <Input
                    id="plate_number"
                    name="plate_number"
                    defaultValue={editingUnit?.plate_number}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Input
                      id="brand"
                      name="brand"
                      defaultValue={editingUnit?.brand ?? ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Modelo</Label>
                    <Input
                      id="model"
                      name="model"
                      defaultValue={editingUnit?.model ?? ''}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="year">Año</Label>
                    <Input
                      id="year"
                      name="year"
                      type="number"
                      defaultValue={editingUnit?.year ?? ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacidad</Label>
                    <Input
                      id="capacity"
                      name="capacity"
                      type="number"
                      defaultValue={editingUnit?.capacity ?? 40}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="driver_name">Conductor</Label>
                    <Input
                      id="driver_name"
                      name="driver_name"
                      defaultValue={editingUnit?.driver_name ?? ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver_phone">Teléfono</Label>
                    <Input
                      id="driver_phone"
                      name="driver_phone"
                      defaultValue={editingUnit?.driver_phone ?? ''}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imei">IMEI GPS (Tracksolid)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="imei"
                      name="imei"
                      placeholder="123456789012345"
                      defaultValue={editingUnit?.imei ?? ''}
                      className="flex-1"
                    />
                    {editingUnit?.imei && (
                      <Badge variant="outline" className="flex items-center gap-1 shrink-0">
                        <MapPin className="w-3 h-3" />
                        GPS
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">IMEI de 15 dígitos del dispositivo GPS</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    name="is_active"
                    defaultChecked={editingUnit?.is_active ?? true}
                  />
                  <Label htmlFor="is_active">Unidad activa</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    defaultValue={editingUnit?.notes ?? ''}
                  />
                </div>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">
                    Cancelar
                  </Button>
                  <Button type="submit" className="w-full sm:w-auto">
                    {editingUnit ? 'Guardar' : 'Crear'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar unidades..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : filteredUnits?.length === 0 ? (
        <div className="text-center py-12 md:py-16 border rounded-lg bg-muted/20">
          <Bus className="w-10 h-10 md:w-12 md:h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-base md:text-lg font-medium mb-2">No hay unidades</h3>
          <p className="text-muted-foreground text-sm md:text-base mb-4">Comienza agregando tu primera unidad</p>
        </div>
      ) : (
        <>
          {/* Mobile: Card view */}
          <div className="md:hidden">
            {filteredUnits?.map((unit) => (
              <UnitCard key={unit.id} unit={unit} />
            ))}
          </div>
          
          {/* Desktop: Table view */}
          <div className="hidden md:block border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Capacidad</TableHead>
                  <TableHead>Conductor</TableHead>
                  <TableHead>GPS</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUnits?.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.plate_number}</TableCell>
                    <TableCell>
                      {unit.brand || unit.model
                        ? `${unit.brand ?? ''} ${unit.model ?? ''} ${unit.year ?? ''}`.trim()
                        : '-'}
                    </TableCell>
                    <TableCell>{unit.capacity} pasajeros</TableCell>
                    <TableCell>{unit.driver_name || '-'}</TableCell>
                    <TableCell>
                      {unit.imei ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <MapPin className="w-3 h-3 mr-1" />
                          Vinculado
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={unit.is_active ? 'default' : 'secondary'}>
                        {unit.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingUnit(unit);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('¿Eliminar esta unidad?')) {
                              deleteMutation.mutate(unit.id);
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

export default Units;