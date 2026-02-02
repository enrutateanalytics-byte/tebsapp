import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogOut, MapPin, Clock, Building2, Play, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Assignment {
  id: string;
  assignment_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  actual_start_time: string | null;
  actual_end_time: string | null;
  notes: string | null;
  route: {
    id: string;
    name: string;
    description: string | null;
    client: {
      id: string;
      name: string;
    } | null;
  };
  unit: {
    id: string;
    plate_number: string;
  };
}

interface Driver {
  id: string;
  name: string;
}

const DriverApp = () => {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkDriverAuth();
  }, []);

  const checkDriverAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/driver-login');
        return;
      }

      // Get driver info
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (driverError || !driverData) {
        await supabase.auth.signOut();
        navigate('/driver-login');
        return;
      }

      setDriver(driverData);
      await fetchAssignments(driverData.id);
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/driver-login');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async (driverId: string | null) => {
    if (!driverId) {
      setAssignments([]);
      return;
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        id,
        assignment_date,
        start_time,
        end_time,
        status,
        actual_start_time,
        actual_end_time,
        notes,
        route:routes (
          id,
          name,
          description,
          client:clients (
            id,
            name
          )
        ),
        unit:units (
          id,
          plate_number
        )
      `)
      .eq('driver_id', driverId)
      .eq('assignment_date', today)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching assignments:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las asignaciones',
        variant: 'destructive',
      });
      return;
    }

    // Transform data to match the interface
    const transformedData = (data || []).map((item: any) => ({
      ...item,
      route: item.route,
      unit: item.unit,
    }));

    setAssignments(transformedData);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/driver-login');
  };

  const getStatusBadge = (assignment: Assignment) => {
    if (assignment.actual_end_time) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle className="w-3 h-3" />
          Finalizado
        </span>
      );
    }
    if (assignment.actual_start_time) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          <Play className="w-3 h-3" />
          En curso
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
        <AlertCircle className="w-3 h-3" />
        Pendiente
      </span>
    );
  };

  const handleTripClick = (assignmentId: string) => {
    navigate(`/driver-app/trip/${assignmentId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background safe-area-top safe-area-bottom">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Hola, {driver?.name?.split(' ')[0]}</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleSignOut}>
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      {/* Content */}
      <main className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Rutas de Hoy</h2>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fetchAssignments(driver?.id || null)}
          >
            Actualizar
          </Button>
        </div>

        {assignments.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No tienes rutas asignadas para hoy
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <Card 
                key={assignment.id} 
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => handleTripClick(assignment.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">
                        {assignment.route?.name || 'Ruta sin nombre'}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {assignment.route?.client?.name || 'Sin cliente'}
                      </CardDescription>
                    </div>
                    {getStatusBadge(assignment)}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {assignment.start_time?.slice(0, 5) || '--:--'} - {assignment.end_time?.slice(0, 5) || '--:--'}
                    </span>
                  </div>
                  {assignment.actual_start_time && !assignment.actual_end_time && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      Iniciado a las {format(new Date(assignment.actual_start_time), 'HH:mm')}
                    </p>
                  )}
                  {assignment.actual_end_time && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                      Finalizado a las {format(new Date(assignment.actual_end_time), 'HH:mm')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default DriverApp;
