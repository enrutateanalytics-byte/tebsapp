import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bus, Route as RouteIcon, MapPin, LogOut, Navigation } from 'lucide-react';
import GoogleMapsProvider from '@/components/maps/GoogleMapsProvider';
import PublicRouteMap from '@/components/public/PublicRouteMap';
import PublicTrackingMap from '@/components/public/PublicTrackingMap';

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
  const [activeTab, setActiveTab] = useState('routes');

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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="routes" className="flex items-center gap-2">
              <RouteIcon className="w-4 h-4" />
              Rutas
            </TabsTrigger>
            <TabsTrigger value="tracking" className="flex items-center gap-2">
              <Navigation className="w-4 h-4" />
              Ubicaciones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="routes" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Routes List */}
              <div className="space-y-4">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <RouteIcon className="w-5 h-5 text-primary" />
                  Rutas Disponibles
                </h2>
                {routesLoading ? (
                  <p className="text-muted-foreground">Cargando rutas...</p>
                ) : routes?.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No hay rutas disponibles
                    </CardContent>
                  </Card>
                ) : (
                  routes?.map((route) => (
                    <Card 
                      key={route.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedRoute?.id === route.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedRoute(route)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h3 className="font-medium">{route.name}</h3>
                            {route.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {route.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {route.distance_km && (
                                <span>{route.distance_km} km</span>
                              )}
                              {route.estimated_duration_minutes && (
                                <span>• {route.estimated_duration_minutes} min</span>
                              )}
                            </div>
                          </div>
                          {route.kml_file_path && (
                            <Badge variant="secondary" className="shrink-0">
                              <MapPin className="w-3 h-3 mr-1" />
                              Mapa
                            </Badge>
                          )}
                        </div>
                        {(route.origin_address || route.destination_address) && (
                          <div className="mt-3 pt-3 border-t border-border text-xs space-y-1">
                            {route.origin_address && (
                              <p><span className="text-muted-foreground">Origen:</span> {route.origin_address}</p>
                            )}
                            {route.destination_address && (
                              <p><span className="text-muted-foreground">Destino:</span> {route.destination_address}</p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Route Map */}
              <div className="lg:col-span-2">
                <Card className="h-[500px]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">
                      {selectedRoute ? selectedRoute.name : 'Selecciona una ruta'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[calc(100%-60px)]">
                    <GoogleMapsProvider>
                      <PublicRouteMap route={selectedRoute} />
                    </GoogleMapsProvider>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tracking">
            <Card className="h-[600px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-primary" />
                  Ubicación de Unidades en Tiempo Real
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[calc(100%-60px)]">
                <GoogleMapsProvider>
                  <PublicTrackingMap clientId={clientId} />
                </GoogleMapsProvider>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default PublicApp;
