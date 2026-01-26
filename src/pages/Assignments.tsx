import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchableSelect } from '@/components/ui/searchable-select';
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
import { Plus, Pencil, Trash2, CalendarClock, Search } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Assignment {
  id: string;
  route_id: string;
  unit_id: string;
  assignment_date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  routes?: { name: string } | null;
  units?: { plate_number: string; driver_name: string | null } | null;
}

interface RouteOption {
  id: string;
  name: string;
}

interface UnitOption {
  id: string;
  plate_number: string;
  driver_name: string | null;
}

const Assignments = () => {
  const [open, setOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [allDay, setAllDay] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select('*, routes(name), units(plate_number, driver_name)')
        .order('assignment_date', { ascending: false });
      if (error) throw error;
      return data as Assignment[];
    },
  });

  const { data: routes } = useQuery({
    queryKey: ['routes-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as RouteOption[];
    },
  });

  const { data: units } = useQuery({
    queryKey: ['units-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('id, plate_number, driver_name')
        .eq('is_active', true)
        .order('plate_number');
      if (error) throw error;
      return data as UnitOption[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (assignment: Omit<Assignment, 'id' | 'routes' | 'units'>) => {
      const { error } = await supabase.from('assignments').insert(assignment);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Asignación creada correctamente');
      setOpen(false);
    },
    onError: (error) => toast.error('Error: ' + error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (assignment: Omit<Assignment, 'routes' | 'units'>) => {
      const { error } = await supabase
        .from('assignments')
        .update(assignment)
        .eq('id', assignment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Asignación actualizada correctamente');
      setOpen(false);
      setEditingAssignment(null);
    },
    onError: (error) => toast.error('Error: ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Asignación eliminada correctamente');
    },
    onError: (error) => toast.error('Error: ' + error.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (!selectedRouteId || !selectedUnitId) {
      toast.error('Por favor selecciona ruta y unidad');
      return;
    }
    
    const assignment = {
      route_id: selectedRouteId,
      unit_id: selectedUnitId,
      assignment_date: formData.get('assignment_date') as string,
      start_time: allDay ? null : (formData.get('start_time') as string || null),
      end_time: allDay ? null : (formData.get('end_time') as string || null),
      notes: formData.get('notes') as string || null,
    };

    if (editingAssignment) {
      updateMutation.mutate({ ...assignment, id: editingAssignment.id });
    } else {
      createMutation.mutate(assignment);
    }
  };

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setEditingAssignment(null);
      setAllDay(true);
      setSelectedRouteId('');
      setSelectedUnitId('');
    }
  };

  const handleEdit = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setAllDay(!assignment.start_time && !assignment.end_time);
    setSelectedRouteId(assignment.route_id);
    setSelectedUnitId(assignment.unit_id);
    setOpen(true);
  };

  const filteredAssignments = useMemo(() => {
    if (!assignments || !searchQuery.trim()) return assignments;
    const query = searchQuery.toLowerCase();
    return assignments.filter((assignment) =>
      assignment.routes?.name?.toLowerCase().includes(query) ||
      assignment.units?.plate_number?.toLowerCase().includes(query) ||
      assignment.units?.driver_name?.toLowerCase().includes(query)
    );
  }, [assignments, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Asignaciones</h1>
          <p className="text-muted-foreground mt-1">Programa rutas a unidades específicas</p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Asignación
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingAssignment ? 'Editar Asignación' : 'Nueva Asignación'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Ruta *</Label>
                <SearchableSelect
                  options={routes?.map((route) => ({
                    value: route.id,
                    label: route.name,
                  })) || []}
                  value={selectedRouteId}
                  onValueChange={setSelectedRouteId}
                  placeholder="Seleccionar ruta"
                  searchPlaceholder="Buscar ruta..."
                  emptyMessage="No se encontraron rutas."
                />
              </div>
              <div className="space-y-2">
                <Label>Unidad *</Label>
                <SearchableSelect
                  options={units?.map((unit) => ({
                    value: unit.id,
                    label: `${unit.plate_number}${unit.driver_name ? ` - ${unit.driver_name}` : ''}`,
                  })) || []}
                  value={selectedUnitId}
                  onValueChange={setSelectedUnitId}
                  placeholder="Seleccionar unidad"
                  searchPlaceholder="Buscar unidad..."
                  emptyMessage="No se encontraron unidades."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignment_date">Fecha *</Label>
                <Input
                  id="assignment_date"
                  name="assignment_date"
                  type="date"
                  defaultValue={editingAssignment?.assignment_date ?? new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="all_day"
                  checked={allDay}
                  onCheckedChange={(checked) => setAllDay(checked === true)}
                />
                <Label htmlFor="all_day" className="cursor-pointer">Todo el día</Label>
              </div>
              {!allDay && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_time">Hora inicio</Label>
                    <Input
                      id="start_time"
                      name="start_time"
                      type="time"
                      defaultValue={editingAssignment?.start_time ?? ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_time">Hora fin</Label>
                    <Input
                      id="end_time"
                      name="end_time"
                      type="time"
                      defaultValue={editingAssignment?.end_time ?? ''}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={editingAssignment?.notes ?? ''}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingAssignment ? 'Guardar' : 'Crear'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar asignaciones..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : filteredAssignments?.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/20">
          <CalendarClock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No hay asignaciones</h3>
          <p className="text-muted-foreground mb-4">Comienza programando una ruta a una unidad</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Ruta</TableHead>
                <TableHead>Unidad / Conductor</TableHead>
                <TableHead>Horario</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments?.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium">
                    {format(new Date(assignment.assignment_date), 'dd MMM yyyy', { locale: es })}
                  </TableCell>
                  <TableCell>{assignment.routes?.name || '-'}</TableCell>
                  <TableCell>
                    {assignment.units?.plate_number}
                    {assignment.units?.driver_name && (
                      <span className="text-muted-foreground text-sm block">
                        {assignment.units.driver_name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {assignment.start_time && assignment.end_time
                      ? `${assignment.start_time.slice(0, 5)} - ${assignment.end_time.slice(0, 5)}`
                      : assignment.start_time?.slice(0, 5) || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(assignment)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('¿Eliminar esta asignación?')) {
                            deleteMutation.mutate(assignment.id);
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

export default Assignments;
