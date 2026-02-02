import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Download, Bus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TripData {
  id: string;
  assignment_date: string;
  start_time: string | null;
  end_time: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  status: string;
  driver: {
    id: string;
    name: string;
  } | null;
  route: {
    id: string;
    name: string;
    client: {
      name: string;
    } | null;
  } | null;
  unit: {
    plate_number: string;
  } | null;
}

const TripsReport = () => {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDriver, setSelectedDriver] = useState<string>('all');

  // Fetch drivers for filter
  const { data: drivers } = useQuery({
    queryKey: ['drivers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch trips data
  const { data: trips, isLoading, refetch } = useQuery({
    queryKey: ['trips-report', startDate, endDate, selectedDriver],
    queryFn: async () => {
      let query = supabase
        .from('assignments')
        .select(`
          id,
          assignment_date,
          start_time,
          end_time,
          actual_start_time,
          actual_end_time,
          status,
          driver:drivers (
            id,
            name
          ),
          route:routes (
            id,
            name,
            client:clients (
              name
            )
          ),
          unit:units (
            plate_number
          )
        `)
        .gte('assignment_date', startDate)
        .lte('assignment_date', endDate)
        .not('actual_start_time', 'is', null)
        .order('assignment_date', { ascending: false })
        .order('actual_start_time', { ascending: false });

      if (selectedDriver !== 'all') {
        query = query.eq('driver_id', selectedDriver);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as TripData[];
    },
  });

  const getStatusBadge = (status: string, actualEnd: string | null) => {
    if (actualEnd) {
      return <Badge variant="default" className="bg-green-600">Completado</Badge>;
    }
    if (status === 'in_progress') {
      return <Badge variant="default" className="bg-blue-600">En curso</Badge>;
    }
    return <Badge variant="secondary">Pendiente</Badge>;
  };

  const calculateDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return '-';
    const startTime = new Date(start);
    const endTime = new Date(end);
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const exportToCSV = () => {
    if (!trips || trips.length === 0) return;

    const headers = ['Fecha', 'Conductor', 'Ruta', 'Cliente', 'Unidad', 'Inicio Programado', 'Fin Programado', 'Inicio Real', 'Fin Real', 'Duración', 'Estado'];
    const rows = trips.map(trip => [
      format(new Date(trip.assignment_date), 'dd/MM/yyyy'),
      trip.driver?.name || 'Sin conductor',
      trip.route?.name || 'Sin ruta',
      trip.route?.client?.name || 'Sin cliente',
      trip.unit?.plate_number || 'Sin unidad',
      trip.start_time?.slice(0, 5) || '-',
      trip.end_time?.slice(0, 5) || '-',
      trip.actual_start_time ? format(new Date(trip.actual_start_time), 'HH:mm') : '-',
      trip.actual_end_time ? format(new Date(trip.actual_end_time), 'HH:mm') : '-',
      calculateDuration(trip.actual_start_time, trip.actual_end_time),
      trip.actual_end_time ? 'Completado' : 'En curso'
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte-viajes-${startDate}-${endDate}.csv`;
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bus className="w-5 h-5" />
              Reporte de Viajes
            </CardTitle>
            <CardDescription>Historial de viajes realizados por conductores</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={!trips?.length}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Fecha inicio</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Fecha fin</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Conductor</Label>
            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los conductores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los conductores</SelectItem>
                {drivers?.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={() => refetch()} className="w-full">
              <Search className="w-4 h-4 mr-2" />
              Buscar
            </Button>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : trips && trips.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Conductor</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Inicio Real</TableHead>
                  <TableHead>Fin Real</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(trip.assignment_date), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>{trip.driver?.name || 'Sin conductor'}</TableCell>
                    <TableCell>{trip.route?.name || 'Sin ruta'}</TableCell>
                    <TableCell>{trip.route?.client?.name || '-'}</TableCell>
                    <TableCell>{trip.unit?.plate_number || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {trip.actual_start_time ? format(new Date(trip.actual_start_time), 'HH:mm') : '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {trip.actual_end_time ? format(new Date(trip.actual_end_time), 'HH:mm') : '-'}
                    </TableCell>
                    <TableCell>{calculateDuration(trip.actual_start_time, trip.actual_end_time)}</TableCell>
                    <TableCell>{getStatusBadge(trip.status, trip.actual_end_time)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No se encontraron viajes en el rango de fechas seleccionado
          </div>
        )}

        {/* Summary */}
        {trips && trips.length > 0 && (
          <div className="flex flex-wrap gap-4 pt-4 border-t">
            <div className="bg-muted rounded-lg px-4 py-2">
              <p className="text-sm text-muted-foreground">Total de viajes</p>
              <p className="text-2xl font-bold">{trips.length}</p>
            </div>
            <div className="bg-muted rounded-lg px-4 py-2">
              <p className="text-sm text-muted-foreground">Completados</p>
              <p className="text-2xl font-bold text-green-600">
                {trips.filter(t => t.actual_end_time).length}
              </p>
            </div>
            <div className="bg-muted rounded-lg px-4 py-2">
              <p className="text-sm text-muted-foreground">En curso</p>
              <p className="text-2xl font-bold text-blue-600">
                {trips.filter(t => !t.actual_end_time).length}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TripsReport;
