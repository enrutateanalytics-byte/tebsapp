import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogOut, MapPin, Navigation } from 'lucide-react';
import tebsaLogo from '@/assets/tebsa-logo.png';
import GoogleMapsProvider from '@/components/maps/GoogleMapsProvider';
import PublicCombinedMap from '@/components/public/PublicCombinedMap';
import PassengerQRGenerator from '@/components/public/PassengerQRGenerator';
import type { User, Session } from '@supabase/supabase-js';

interface RouteData {
  id: string;
  name: string;
  description: string | null;
  origin_address: string | null;
  destination_address: string | null;
  distance_km: number | null;
  estimated_duration_minutes: number | null;
  kml_file_path: string | null;
  is_active: boolean;
  client_id: string | null;
}

interface ClientUserData {
  id: string;
  client_id: string;
  name: string;
  is_active: boolean;
  clients: {
    name: string;
  } | null;
}

// Same shifts used when creating an assignment
const SHIFTS = [
  { id: 'morning', name: 'Turno Mañana', start: '06:00', end: '14:00' },
  { id: 'afternoon', name: 'Turno Tarde', start: '14:00', end: '22:00' },
  { id: 'night', name: 'Turno Noche', start: '22:00', end: '06:00' },
  { id: 'full', name: 'Turno Completo', start: null, end: null },
] as const;

const getShiftFromTimes = (start: string | null, end: string | null): string => {
  const s = start ? start.slice(0, 5) : null;
  const e = end ? end.slice(0, 5) : null;
  if (!s && !e) return 'full';
  return SHIFTS.find((sh) => sh.start === s && sh.end === e)?.id || 'full';
};

const PublicApp = () => {
  const navigate = useNavigate();
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [shiftFilter, setShiftFilter] = useState<string>('__all__');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Redirect to public login if not authenticated
  useEffect(() => {
    if (!loading && !session) {
      navigate('/public-login');
    }
  }, [loading, session, navigate]);

  // Fetch client user data
  const { data: clientUser, isLoading: clientUserLoading } = useQuery({
    queryKey: ['client-user', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_users')
        .select('id, client_id, name, is_active, clients(name)')
        .eq('user_id', user!.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as ClientUserData | null;
    },
    enabled: !!user,
  });

  // Redirect if not a valid client user
  useEffect(() => {
    if (!clientUserLoading && clientUser === null && user) {
      // User is authenticated but not a client user
      supabase.auth.signOut();
      navigate('/public-login');
    } else if (!clientUserLoading && clientUser && !clientUser.is_active) {
      // User is deactivated
      supabase.auth.signOut();
      navigate('/public-login');
    }
  }, [clientUser, clientUserLoading, user, navigate]);

  // Fetch routes for the client
  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ['public-routes', clientUser?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('client_id', clientUser!.client_id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as RouteData[];
    },
    enabled: !!clientUser?.client_id,
  });

  // Fetch assignments (shift comes from the assignment's start/end time)
  const { data: routeAssignments } = useQuery({
    queryKey: ['public-route-assignments', clientUser?.client_id],
    queryFn: async () => {
      const ids = (routes ?? []).map((r) => r.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('assignments')
        .select('route_id, start_time, end_time, assignment_date')
        .in('route_id', ids)
        .order('assignment_date', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!routes && routes.length > 0,
  });

  // Map route_id -> set of shift ids (from its most recent assignment date)
  const routeShiftMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const latestDate = new Map<string, string>();
    routeAssignments?.forEach((a: any) => {
      const latest = latestDate.get(a.route_id);
      if (latest && latest !== a.assignment_date) return;
      latestDate.set(a.route_id, a.assignment_date);
      if (!map.has(a.route_id)) map.set(a.route_id, new Set());
      map.get(a.route_id)!.add(getShiftFromTimes(a.start_time, a.end_time));
    });
    return map;
  }, [routeAssignments]);

  // Available shifts based on assignments
  const availableShifts = useMemo(() => {
    const set = new Set<string>();
    routeShiftMap.forEach((s) => s.forEach((id) => set.add(id)));
    return SHIFTS.filter((s) => set.has(s.id));
  }, [routeShiftMap]);

  // Routes filtered by the selected shift
  const filteredRoutes = useMemo(() => {
    if (shiftFilter === '__all__') return routes ?? [];
    return (routes ?? []).filter((r) => routeShiftMap.get(r.id)?.has(shiftFilter));
  }, [routes, shiftFilter, routeShiftMap]);


  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/public-login');
  };

  if (loading || clientUserLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img src={tebsaLogo} alt="TEBSA" className="w-16 h-16 object-contain animate-pulse" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session || !clientUser) return null;

  const clientName = clientUser.clients?.name || 'Cliente';

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Compact Native-style Header */}
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shadow-lg z-50 safe-area-top">
        <div className="flex items-center gap-3">
          <img src={tebsaLogo} alt="TEBSA" className="w-10 h-10 object-contain bg-white rounded-lg p-1" />
          <div className="leading-tight">
            <h1 className="font-semibold text-sm">TEBSA Transportes</h1>
            <p className="text-[10px] opacity-80">{clientName}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleLogout}
          className="text-primary-foreground hover:bg-white/20 h-8 w-8"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </header>

      {/* Full-screen Map */}
      <div className="flex-1 relative">
        <GoogleMapsProvider>
          <PublicCombinedMap route={selectedRoute} clientId={clientUser.client_id} />
        </GoogleMapsProvider>

        {/* Floating Filters + Route Selector */}
        <div className="absolute top-4 left-4 right-4 z-40 animate-fade-in space-y-2">
          {/* Shift filter - quick pills */}
          {availableShifts.length > 0 && (
            <div className="overflow-x-auto overflow-y-hidden -mx-4 px-4">
              <div className="inline-flex items-center gap-1.5 bg-card/95 backdrop-blur-sm shadow-xl rounded-full p-1 max-w-full">
                <button
                  onClick={() => {
                    setShiftFilter('__all__');
                    setSelectedRoute(null);
                  }}
                  className={`shrink-0 h-8 px-3 rounded-full text-xs font-semibold transition-colors ${
                    shiftFilter === '__all__'
                      ? 'bg-primary text-primary-foreground shadow'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Todos
                </button>
                {availableShifts.map((shift) => (
                  <button
                    key={shift.id}
                    onClick={() => {
                      setShiftFilter(shift.id);
                      setSelectedRoute(null);
                    }}
                    className={`shrink-0 h-8 px-3 rounded-full text-xs font-semibold transition-colors ${
                      shiftFilter === shift.id
                        ? 'bg-primary text-primary-foreground shadow'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {shift.name}
                  </button>
                ))}
              </div>
            </div>
          )}


          {/* Route selector */}
          <Select
            value={selectedRoute?.id || ''}
            onValueChange={(value) => {
              const route = filteredRoutes.find(r => r.id === value) || null;
              setSelectedRoute(route);
            }}
          >
            <SelectTrigger className="w-full bg-card/95 backdrop-blur-sm shadow-xl border-0 h-12 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Navigation className="w-4 h-4 text-primary" />
                </div>
                <SelectValue placeholder="Seleccionar ruta..." />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-card/95 backdrop-blur-sm border-0 shadow-xl rounded-xl z-50 max-h-72">
              {routesLoading ? (
                <SelectItem value="loading" disabled>Cargando rutas...</SelectItem>
              ) : filteredRoutes.length === 0 ? (
                <SelectItem value="empty" disabled>No hay rutas disponibles</SelectItem>
              ) : (
                filteredRoutes.map((route) => (
                  <SelectItem 
                    key={route.id} 
                    value={route.id}
                    className="py-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{route.name}</span>
                      {route.distance_km && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {route.distance_km} km
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>


        {/* Floating QR Button - Bottom Right */}
        <div className="absolute bottom-6 right-4 z-40 animate-fade-in">
          <PassengerQRGenerator clientId={clientUser.client_id} userName={clientUser.name} />
        </div>
        {/* Route Info Card - Shows when route is selected */}
        {selectedRoute && (
          <div className="absolute bottom-6 left-4 right-4 z-40 animate-fade-in">
            <div className="bg-card/95 backdrop-blur-sm rounded-2xl shadow-xl p-4 border-0">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
                  <Navigation className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{selectedRoute.name}</h3>
                  {selectedRoute.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {selectedRoute.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {selectedRoute.distance_km && (
                      <span className="text-xs bg-muted px-2 py-1 rounded-full">
                        {selectedRoute.distance_km} km
                      </span>
                    )}
                    {selectedRoute.estimated_duration_minutes && (
                      <span className="text-xs bg-muted px-2 py-1 rounded-full">
                        {selectedRoute.estimated_duration_minutes} min
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {(selectedRoute.origin_address || selectedRoute.destination_address) && (
              <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                  {selectedRoute.origin_address && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-muted-foreground truncate">{selectedRoute.origin_address}</span>
                    </div>
                  )}
                  {selectedRoute.destination_address && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-destructive shrink-0" />
                      <span className="text-muted-foreground truncate">{selectedRoute.destination_address}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicApp;
