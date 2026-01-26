import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Bus } from 'lucide-react';
import GoogleMapsProvider from '@/components/maps/GoogleMapsProvider';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { useMemo, useCallback } from 'react';

interface GpsPosition {
  id: string;
  unit_id: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  recorded_at: string;
  units?: { plate_number: string; driver_name: string | null } | null;
}

const containerStyle = {
  width: '100%',
  height: '100%',
};

const Tracking = () => {
  const { data: positions, isLoading } = useQuery({
    queryKey: ['gps-positions'],
    queryFn: async () => {
      // Get the latest position for each unit
      const { data, error } = await supabase
        .from('gps_positions')
        .select('*, units(plate_number, driver_name)')
        .order('recorded_at', { ascending: false });
      
      if (error) throw error;
      
      // Group by unit_id and get the latest position
      const latestByUnit = new Map<string, GpsPosition>();
      (data as GpsPosition[]).forEach((pos) => {
        if (!latestByUnit.has(pos.unit_id)) {
          latestByUnit.set(pos.unit_id, pos);
        }
      });
      
      return Array.from(latestByUnit.values());
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: units } = useQuery({
    queryKey: ['units-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('id, plate_number, driver_name, is_active')
        .eq('is_active', true)
        .order('plate_number');
      if (error) throw error;
      return data;
    },
  });

  const center = useMemo(() => {
    if (positions && positions.length > 0) {
      const sumLat = positions.reduce((acc, p) => acc + Number(p.latitude), 0);
      const sumLng = positions.reduce((acc, p) => acc + Number(p.longitude), 0);
      return {
        lat: sumLat / positions.length,
        lng: sumLng / positions.length,
      };
    }
    return { lat: 19.4326, lng: -99.1332 }; // Default: Mexico City
  }, [positions]);

  const unitsWithPosition = positions?.map((p) => p.unit_id) ?? [];
  const unitsWithoutPosition = units?.filter((u) => !unitsWithPosition.includes(u.id)) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rastreo GPS</h1>
        <p className="text-muted-foreground mt-1">Seguimiento en tiempo real de las unidades</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="h-[600px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Mapa de Ubicaciones</CardTitle>
            </CardHeader>
            <CardContent className="h-[calc(100%-60px)]">
              <GoogleMapsProvider>
                <GoogleMap
                  mapContainerStyle={containerStyle}
                  center={center}
                  zoom={positions && positions.length > 0 ? 12 : 10}
                >
                  {positions?.map((pos) => (
                    <Marker
                      key={pos.id}
                      position={{ lat: Number(pos.latitude), lng: Number(pos.longitude) }}
                      title={`${pos.units?.plate_number} - ${pos.units?.driver_name || 'Sin conductor'}`}
                      icon={
                        typeof google !== 'undefined'
                          ? {
                              url: '/images/bus-icon.png',
                              scaledSize: new google.maps.Size(40, 40),
                              anchor: new google.maps.Point(20, 20),
                            }
                          : undefined
                      }
                    />
                  ))}
                </GoogleMap>
              </GoogleMapsProvider>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Unidades Activas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Cargando...</p>
              ) : positions?.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No hay posiciones GPS registradas
                </p>
              ) : (
                positions?.map((pos) => (
                  <div
                    key={pos.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{pos.units?.plate_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {pos.units?.driver_name || 'Sin conductor'}
                      </p>
                    </div>
                    <div className="text-right">
                      {pos.speed !== null && (
                        <p className="text-sm font-medium">{pos.speed} km/h</p>
                      )}
                      <Badge variant="default" className="mt-1">
                        En línea
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bus className="w-5 h-5 text-muted-foreground" />
                Sin Posición GPS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {unitsWithoutPosition.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Todas las unidades tienen posición GPS
                </p>
              ) : (
                unitsWithoutPosition.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{unit.plate_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {unit.driver_name || 'Sin conductor'}
                      </p>
                    </div>
                    <Badge variant="secondary">Sin señal</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Tracking;
