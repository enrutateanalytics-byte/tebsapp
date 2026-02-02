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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Search, Download, Users, MapPin, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface BoardingData {
  id: string;
  boarded_at: string;
  is_valid: boolean;
  validation_message: string | null;
  latitude: number | null;
  longitude: number | null;
  passenger_qr: {
    employee_name: string;
    employee_id: string | null;
  } | null;
}

interface TripWithBoardings {
  id: string;
  assignment_date: string;
  actual_start_time: string | null;
  actual_end_time: string | null;
  route: {
    id: string;
    name: string;
    client: {
      name: string;
    } | null;
  } | null;
  driver: {
    name: string;
  } | null;
  unit: {
    plate_number: string;
  } | null;
  boardings: BoardingData[];
}

const PassengersReport = () => {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedRoute, setSelectedRoute] = useState<string>('all');

  // Fetch routes for filter
  const { data: routes } = useQuery({
    queryKey: ['routes-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch trips with boardings
  const { data: trips, isLoading, refetch } = useQuery({
    queryKey: ['passengers-report', startDate, endDate, selectedRoute],
    queryFn: async () => {
      let query = supabase
        .from('assignments')
        .select(`
          id,
          assignment_date,
          actual_start_time,
          actual_end_time,
          route:routes (
            id,
            name,
            client:clients (
              name
            )
          ),
          driver:drivers (
            name
          ),
          unit:units (
            plate_number
          )
        `)
        .gte('assignment_date', startDate)
        .lte('assignment_date', endDate)
        .not('actual_start_time', 'is', null)
        .order('assignment_date', { ascending: false });

      if (selectedRoute !== 'all') {
        query = query.eq('route_id', selectedRoute);
      }

      const { data: assignmentsData, error: assignmentsError } = await query;
      if (assignmentsError) throw assignmentsError;

      // Fetch boardings for each assignment
      const assignmentIds = assignmentsData?.map(a => a.id) || [];
      
      if (assignmentIds.length === 0) return [];

      const { data: boardingsData, error: boardingsError } = await supabase
        .from('passenger_boardings')
        .select(`
          id,
          assignment_id,
          boarded_at,
          is_valid,
          validation_message,
          latitude,
          longitude,
          passenger_qr:passenger_qr_codes (
            employee_name,
            employee_id
          )
        `)
        .in('assignment_id', assignmentIds)
        .order('boarded_at', { ascending: true });

      if (boardingsError) throw boardingsError;

      // Combine data
      const tripsWithBoardings = assignmentsData?.map(assignment => ({
        ...assignment,
        boardings: boardingsData?.filter(b => b.assignment_id === assignment.id) || []
      })) as unknown as TripWithBoardings[];

      return tripsWithBoardings;
    },
  });

  const exportToCSV = () => {
    if (!trips || trips.length === 0) return;

    const headers = ['Fecha', 'Ruta', 'Cliente', 'Conductor', 'Unidad', 'Pasajero', 'ID Empleado', 'Hora Abordaje', 'Válido', 'Latitud', 'Longitud'];
    const rows: string[][] = [];

    trips.forEach(trip => {
      trip.boardings.forEach(boarding => {
        rows.push([
          format(new Date(trip.assignment_date), 'dd/MM/yyyy'),
          trip.route?.name || 'Sin ruta',
          trip.route?.client?.name || 'Sin cliente',
          trip.driver?.name || 'Sin conductor',
          trip.unit?.plate_number || 'Sin unidad',
          boarding.passenger_qr?.employee_name || 'Desconocido',
          boarding.passenger_qr?.employee_id || '-',
          format(new Date(boarding.boarded_at), 'HH:mm:ss'),
          boarding.is_valid ? 'Sí' : 'No',
          boarding.latitude?.toString() || '-',
          boarding.longitude?.toString() || '-',
        ]);
      });
    });

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte-pasajeros-${startDate}-${endDate}.csv`;
    link.click();
  };

  const totalBoardings = trips?.reduce((acc, trip) => acc + trip.boardings.length, 0) || 0;
  const validBoardings = trips?.reduce((acc, trip) => acc + trip.boardings.filter(b => b.is_valid).length, 0) || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Reporte de Pasajeros
            </CardTitle>
            <CardDescription>Aforo por viaje: pasajeros escaneados, identidad y ubicación</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={!totalBoardings}>
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
            <Label>Ruta</Label>
            <Select value={selectedRoute} onValueChange={setSelectedRoute}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las rutas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las rutas</SelectItem>
                {routes?.map((route) => (
                  <SelectItem key={route.id} value={route.id}>
                    {route.name}
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
          <Accordion type="single" collapsible className="space-y-2">
            {trips.map((trip) => (
              <AccordionItem key={trip.id} value={trip.id} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-left w-full pr-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {format(new Date(trip.assignment_date), 'dd/MM/yyyy', { locale: es })}
                      </Badge>
                      <span className="font-semibold">{trip.route?.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{trip.driver?.name}</span>
                      <span>•</span>
                      <span>{trip.unit?.plate_number}</span>
                    </div>
                    <Badge className="ml-auto bg-primary">
                      <Users className="w-3 h-3 mr-1" />
                      {trip.boardings.length} pasajeros
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2 pb-4">
                    <div className="text-sm text-muted-foreground mb-3">
                      <span>Cliente: {trip.route?.client?.name || 'Sin cliente'}</span>
                      {trip.actual_start_time && (
                        <span className="ml-4">
                          Inicio: {format(new Date(trip.actual_start_time), 'HH:mm')}
                        </span>
                      )}
                      {trip.actual_end_time && (
                        <span className="ml-4">
                          Fin: {format(new Date(trip.actual_end_time), 'HH:mm')}
                        </span>
                      )}
                    </div>

                    {trip.boardings.length > 0 ? (
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>Pasajero</TableHead>
                              <TableHead>ID Empleado</TableHead>
                              <TableHead>Hora</TableHead>
                              <TableHead>Ubicación</TableHead>
                              <TableHead>Estado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {trip.boardings.map((boarding, index) => (
                              <TableRow key={boarding.id}>
                                <TableCell className="font-medium">{index + 1}</TableCell>
                                <TableCell>
                                  {boarding.passenger_qr?.employee_name || 'Desconocido'}
                                </TableCell>
                                <TableCell>
                                  {boarding.passenger_qr?.employee_id || '-'}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {format(new Date(boarding.boarded_at), 'HH:mm:ss')}
                                </TableCell>
                                <TableCell>
                                  {boarding.latitude && boarding.longitude ? (
                                    <a
                                      href={`https://www.google.com/maps?q=${boarding.latitude},${boarding.longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-primary hover:underline"
                                    >
                                      <MapPin className="w-3 h-3" />
                                      Ver mapa
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {boarding.is_valid ? (
                                    <Badge variant="default" className="bg-green-600">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Válido
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive">
                                      <XCircle className="w-3 h-3 mr-1" />
                                      Inválido
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No se registraron pasajeros en este viaje
                      </p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No se encontraron viajes con pasajeros en el rango de fechas seleccionado
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
              <p className="text-sm text-muted-foreground">Total pasajeros</p>
              <p className="text-2xl font-bold">{totalBoardings}</p>
            </div>
            <div className="bg-muted rounded-lg px-4 py-2">
              <p className="text-sm text-muted-foreground">Pasajeros válidos</p>
              <p className="text-2xl font-bold text-green-600">{validBoardings}</p>
            </div>
            <div className="bg-muted rounded-lg px-4 py-2">
              <p className="text-sm text-muted-foreground">Promedio por viaje</p>
              <p className="text-2xl font-bold">
                {trips.length > 0 ? (totalBoardings / trips.length).toFixed(1) : 0}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PassengersReport;
