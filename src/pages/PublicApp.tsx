import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bus, LogOut, Navigation } from 'lucide-react';
import GoogleMapsProvider from '@/components/maps/GoogleMapsProvider';
import PublicCombinedMap from '@/components/public/PublicCombinedMap';

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
}

const PublicApp = () => {
  const navigate = useNavigate();
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);

  const clientId = sessionStorage.getItem('publicClientId');
  const clientName = sessionStorage.getItem('publicClientName');

  useEffect(() => {
    if (!clientId) {
      navigate('/access');
    }
  }, [clientId, navigate]);

  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ['public-routes', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as RouteData[];
    },
    enabled: !!clientId,
  });

  const handleLogout = () => {
    sessionStorage.removeItem('publicClientId');
    sessionStorage.removeItem('publicClientName');
    sessionStorage.removeItem('publicAccessCode');
    navigate('/access');
  };

  if (!clientId) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Bus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg">TransportePro</h1>
              <p className="text-xs text-muted-foreground">{clientName}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Salir
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Card className="h-[calc(100vh-120px)]">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Navigation className="w-5 h-5 text-primary" />
                Ubicación en Tiempo Real
              </CardTitle>
              <Select
                value={selectedRoute?.id || ''}
                onValueChange={(value) => {
                  const route = routes?.find(r => r.id === value) || null;
                  setSelectedRoute(route);
                }}
              >
                <SelectTrigger className="w-full sm:w-[280px] bg-background">
                  <SelectValue placeholder="Seleccionar ruta..." />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {routesLoading ? (
                    <SelectItem value="loading" disabled>Cargando rutas...</SelectItem>
                  ) : routes?.length === 0 ? (
                    <SelectItem value="empty" disabled>No hay rutas disponibles</SelectItem>
                  ) : (
                    routes?.map((route) => (
                      <SelectItem key={route.id} value={route.id}>
                        {route.name}
                        {route.distance_km && ` (${route.distance_km} km)`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="h-[calc(100%-80px)]">
            <GoogleMapsProvider>
              <PublicCombinedMap route={selectedRoute} clientId={clientId} />
            </GoogleMapsProvider>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PublicApp;
