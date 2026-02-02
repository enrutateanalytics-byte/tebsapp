import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, QrCode, MapPin, Building2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import GoogleMapsProvider from '@/components/maps/GoogleMapsProvider';
import DriverRouteMap from '@/components/driver/DriverRouteMap';
import QRScanner from '@/components/driver/QRScanner';
import PassengerCounter from '@/components/driver/PassengerCounter';
import TripControls from '@/components/driver/TripControls';

interface Assignment {
  id: string;
  assignment_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  actual_start_time: string | null;
  actual_end_time: string | null;
  started_by_driver_id: string | null;
  route_id: string;
  route: {
    id: string;
    name: string;
    description: string | null;
    client: {
      id: string;
      name: string;
    } | null;
  };
}

interface Boarding {
  id: string;
  is_valid: boolean;
}

interface Driver {
  id: string;
  name: string;
}

const DriverTripView = () => {
  const { id: assignmentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [boardings, setBoardings] = useState<Boarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (assignmentId) {
      fetchData();
    }
  }, [assignmentId]);

  const fetchData = async () => {
    try {
      // Get current user and driver info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/driver-login');
        return;
      }

      const { data: driverData } = await supabase
        .from('drivers')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!driverData) {
        navigate('/driver-login');
        return;
      }

      setDriver(driverData);

      // Fetch assignment details
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select(`
          id,
          assignment_date,
          start_time,
          end_time,
          status,
          actual_start_time,
          actual_end_time,
          started_by_driver_id,
          route_id,
          route:routes (
            id,
            name,
            description,
            client:clients (
              id,
              name
            )
          )
        `)
        .eq('id', assignmentId)
        .single();

      if (assignmentError || !assignmentData) {
        toast({
          title: 'Error',
          description: 'No se encontró la asignación',
          variant: 'destructive',
        });
        navigate('/driver-app');
        return;
      }

      setAssignment(assignmentData as unknown as Assignment);

      // Fetch boardings count
      await fetchBoardings();
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBoardings = async () => {
    const { data } = await supabase
      .from('passenger_boardings')
      .select('id, is_valid')
      .eq('assignment_id', assignmentId);
    
    setBoardings(data || []);
  };

  const handleStartTrip = async () => {
    if (!assignment || !driver) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('assignments')
        .update({
          actual_start_time: new Date().toISOString(),
          started_by_driver_id: driver.id,
          status: 'in_progress',
        })
        .eq('id', assignment.id);

      if (error) throw error;

      toast({
        title: 'Viaje iniciado',
        description: 'El viaje ha comenzado exitosamente',
      });

      // Refresh assignment data
      await fetchData();
    } catch (error: any) {
      console.error('Error starting trip:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo iniciar el viaje',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndTrip = async () => {
    if (!assignment) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('assignments')
        .update({
          actual_end_time: new Date().toISOString(),
          status: 'completed',
        })
        .eq('id', assignment.id);

      if (error) throw error;

      toast({
        title: 'Viaje finalizado',
        description: `Viaje completado con ${boardings.length} pasajeros`,
      });

      // Refresh assignment data
      await fetchData();
    } catch (error: any) {
      console.error('Error ending trip:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo finalizar el viaje',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleQRScan = async (qrCode: string) => {
    if (!assignment || !driver) return;

    try {
      // Check if QR is valid for this route
      const { data: qrData } = await supabase
        .from('passenger_qr_codes')
        .select('id, employee_name, allowed_route_ids, is_active')
        .eq('qr_code', qrCode)
        .maybeSingle();

      const isValid = qrData?.is_active && 
        qrData?.allowed_route_ids?.includes(assignment.route_id);

      // Register boarding
      const { error } = await supabase
        .from('passenger_boardings')
        .insert({
          assignment_id: assignment.id,
          passenger_qr_id: qrData?.id || null,
          qr_code_scanned: qrCode,
          route_id: assignment.route_id,
          driver_id: driver.id,
          is_valid: isValid || false,
          validation_message: isValid 
            ? `Pasajero válido: ${qrData?.employee_name}` 
            : qrData 
              ? 'QR no autorizado para esta ruta' 
              : 'Código QR no registrado',
        });

      if (error) throw error;

      toast({
        title: isValid ? 'Pasajero registrado' : 'QR escaneado',
        description: isValid 
          ? `${qrData?.employee_name} abordó exitosamente`
          : 'El código no está autorizado para esta ruta',
        variant: isValid ? 'default' : 'destructive',
      });

      await fetchBoardings();
    } catch (error: any) {
      console.error('Error registering boarding:', error);
      toast({
        title: 'Error',
        description: 'No se pudo registrar el abordaje',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!assignment) {
    return null;
  }

  const isStarted = !!assignment.actual_start_time;
  const isEnded = !!assignment.actual_end_time;
  const validBoardings = boardings.filter(b => b.is_valid).length;

  return (
    <div className="min-h-screen bg-background safe-area-top safe-area-bottom flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/driver-app')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{assignment.route?.name}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {assignment.route?.client?.name || 'Sin cliente'}
          </p>
        </div>
      </header>

      {/* Map Section */}
      <div className="h-48 md:h-64 relative">
        <GoogleMapsProvider>
          <DriverRouteMap 
            routeId={assignment.route_id} 
            showDriverLocation={isStarted && !isEnded}
          />
        </GoogleMapsProvider>
      </div>

      {/* Content */}
      <main className="flex-1 p-4 space-y-4 overflow-auto">
        {/* Trip Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Horario programado</span>
              </div>
              <span className="font-medium">
                {assignment.start_time?.slice(0, 5) || '--:--'} - {assignment.end_time?.slice(0, 5) || '--:--'}
              </span>
            </div>
            {assignment.actual_start_time && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-muted-foreground">Inicio real</span>
                <span className="font-medium text-primary">
                  {format(new Date(assignment.actual_start_time), 'HH:mm')}
                </span>
              </div>
            )}
            {assignment.actual_end_time && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-muted-foreground">Fin real</span>
                <span className="font-medium text-primary">
                  {format(new Date(assignment.actual_end_time), 'HH:mm')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Passenger Counter */}
        <PassengerCounter count={boardings.length} validCount={validBoardings} />

        {/* Trip Controls */}
        <TripControls
          isStarted={isStarted}
          isEnded={isEnded}
          isLoading={actionLoading}
          onStart={handleStartTrip}
          onEnd={handleEndTrip}
        />

        {/* QR Scanner Button */}
        {isStarted && !isEnded && (
          <Button 
            className="w-full" 
            size="lg" 
            variant="outline"
            onClick={() => setScannerOpen(true)}
          >
            <QrCode className="w-5 h-5 mr-2" />
            Escanear QR de Pasajero
          </Button>
        )}
      </main>

      {/* QR Scanner Modal */}
      <QRScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleQRScan}
        onError={(error) => {
          toast({
            title: 'Error de cámara',
            description: error,
            variant: 'destructive',
          });
        }}
      />
    </div>
  );
};

export default DriverTripView;
