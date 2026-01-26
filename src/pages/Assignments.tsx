import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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

import { toast } from 'sonner';
import { Plus, Pencil, Trash2, CalendarClock, Search, Sun, Sunset, Moon, Bus, Route } from 'lucide-react';

const SHIFTS = [
  { id: 'morning', name: 'Mañana', start: '06:00', end: '14:00', icon: Sun },
  { id: 'afternoon', name: 'Tarde', start: '14:00', end: '22:00', icon: Sunset },
  { id: 'night', name: 'Noche', start: '22:00', end: '06:00', icon: Moon },
  { id: 'full', name: 'Turno Completo', start: null, end: null, icon: CalendarClock },
] as const;

type ShiftId = typeof SHIFTS[number]['id'];

const getShiftFromTimes = (start: string | null, end: string | null): ShiftId => {
  if (!start && !end) return 'full';
  const shift = SHIFTS.find(s => s.start === start && s.end === end);
  return shift?.id || 'full';
};

const getShiftLabel = (start: string | null, end: string | null): string => {
  const shiftId = getShiftFromTimes(start, end);
  const shift = SHIFTS.find(s => s.id === shiftId);
  return shift?.name || 'Turno Completo';
};

const getShiftIcon = (start: string | null, end: string | null) => {
  const shiftId = getShiftFromTimes(start, end);
  const shift = SHIFTS.find(s => s.id === shiftId);
  return shift?.icon || CalendarClock;
};

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
  const [selectedShift, setSelectedShift] = useState<ShiftId>('full');
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
    
    const shift = SHIFTS.find(s => s.id === selectedShift);
    
    const assignment = {
      route_id: selectedRouteId,
      unit_id: selectedUnitId,
      assignment_date: new Date().toISOString().split('T')[0],
      start_time: shift?.start || null,
      end_time: shift?.end || null,
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
      setSelectedShift('full');
      setSelectedRouteId('');
      setSelectedUnitId('');
    }
  };

  const handleEdit = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setSelectedShift(getShiftFromTimes(assignment.start_time, assignment.end_time));
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

  // Mobile card view component
  const AssignmentCard = ({ assignment }: { assignment: Assignment }) => {
    const ShiftIcon = getShiftIcon(assignment.start_time, assignment.end_time);
    
    return (
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {/* Shift badge */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded-full">
                  <ShiftIcon className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-primary">
                    {getShiftLabel(assignment.start_time, assignment.end_time)}
                  </span>
                </div>
                {assignment.start_time && assignment.end_time && (
                  <span className="text-xs text-muted-foreground">
                    {assignment.start_time.slice(0, 5)} - {assignment.end_time.slice(0, 5)}
                  </span>
                )}
              </div>
              
              {/* Route */}
              <div className="flex items-center gap-2 mb-1">
                <Route className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{assignment.routes?.name || '-'}</span>
              </div>
              
              {/* Unit */}
              <div className="flex items-center gap-2">
                <Bus className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="truncate">
                  <span>{assignment.units?.plate_number}</span>
                  {assignment.units?.driver_name && (
                    <span className="text-muted-foreground text-sm ml-1">
                      • {assignment.units.driver_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-1 ml-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleEdit(assignment)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => {
                  if (confirm('¿Eliminar esta asignación?')) {
                    deleteMutation.mutate(assignment.id);
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
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Asignaciones</h1>
          <p className="text-muted-foreground text-sm md:text-base mt-1">Programa rutas a unidades específicas</p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Asignación
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
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
              <div className="space-y-3">
                <Label>Turno *</Label>
                <RadioGroup
                  value={selectedShift}
                  onValueChange={(value) => setSelectedShift(value as ShiftId)}
                  className="grid grid-cols-2 gap-2 sm:gap-3"
                >
                  {SHIFTS.map((shift) => {
                    const Icon = shift.icon;
                    return (
                      <div key={shift.id}>
                        <RadioGroupItem
                          value={shift.id}
                          id={shift.id}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={shift.id}
                          className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-2 sm:p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                        >
                          <Icon className="mb-1.5 sm:mb-2 h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="text-xs sm:text-sm font-medium text-center">{shift.name}</span>
                          {shift.start && shift.end ? (
                            <span className="text-[10px] sm:text-xs text-muted-foreground">
                              {shift.start} - {shift.end}
                            </span>
                          ) : (
                            <span className="text-[10px] sm:text-xs text-muted-foreground">24 horas</span>
                          )}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={editingAssignment?.notes ?? ''}
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button type="submit" className="w-full sm:w-auto">
                  {editingAssignment ? 'Guardar' : 'Crear'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar asignaciones..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : filteredAssignments?.length === 0 ? (
        <div className="text-center py-12 md:py-16 border rounded-lg bg-muted/20">
          <CalendarClock className="w-10 h-10 md:w-12 md:h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-base md:text-lg font-medium mb-2">No hay asignaciones</h3>
          <p className="text-muted-foreground text-sm md:text-base mb-4">Comienza programando una ruta a una unidad</p>
        </div>
      ) : (
        <>
          {/* Mobile: Card view */}
          <div className="md:hidden">
            {filteredAssignments?.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
          
          {/* Desktop: Table view */}
          <div className="hidden md:block border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Turno</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Unidad / Conductor</TableHead>
                  <TableHead className="w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments?.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">
                      {getShiftLabel(assignment.start_time, assignment.end_time)}
                      {assignment.start_time && assignment.end_time && (
                        <span className="text-muted-foreground text-xs block">
                          {assignment.start_time.slice(0, 5)} - {assignment.end_time.slice(0, 5)}
                        </span>
                      )}
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
        </>
      )}
    </div>
  );
};

export default Assignments;