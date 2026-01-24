import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bus, LogOut, MapPin, Navigation } from 'lucide-react';
import GoogleMapsProvider from '@/components/maps/GoogleMapsProvider';
import PublicCombinedMap from '@/components/public/PublicCombinedMap';
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

const PublicApp = () => {
  const navigate = useNavigate();
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
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

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !session) {
      navigate('/login');
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
      navigate('/login');
    } else if (!clientUserLoading && clientUser && !clientUser.is_active) {
      // User is deactivated
      supabase.auth.signOut();
      navigate('/login');
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading || clientUserLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
            <Bus className="w-6 h-6 text-primary" />
          </div>
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
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <Bus className="w-4 h-4" />
          </div>
          <div className="leading-tight">
            <h1 className="font-semibold text-sm">TransportePro</h1>
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

        {/* Floating Route Selector */}
        <div className="absolute top-4 left-4 right-4 z-40 animate-fade-in">
          <Select
            value={selectedRoute?.id || ''}
            onValueChange={(value) => {
              const route = routes?.find(r => r.id === value) || null;
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
            <SelectContent className="bg-card/95 backdrop-blur-sm border-0 shadow-xl rounded-xl z-50">
              {routesLoading ? (
                <SelectItem value="loading" disabled>Cargando rutas...</SelectItem>
              ) : routes?.length === 0 ? (
                <SelectItem value="empty" disabled>No hay rutas disponibles</SelectItem>
              ) : (
                routes?.map((route) => (
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
